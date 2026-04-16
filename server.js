import "dotenv/config";
import express from "express";
import multer from "multer";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// =============================================
// ISSUE MEMORY — Learn from reported problems
// =============================================
// Use persistent volume on Railway (/data), fall back to local directory for dev
const DATA_DIR = fs.existsSync('/data') ? '/data' : __dirname;
const ISSUES_FILE = join(DATA_DIR, 'reported-issues.json');
const STATS_FILE = join(DATA_DIR, 'conversation-stats.json');
const TRENDING_THRESHOLD = 3;       // reports needed to count as "trending"
const TRENDING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

let reportedIssues = [];

// ── Conversation outcome tracking (ROI metrics) ──
let conversationStats = {
  totalConversations: 0,
  resolvedByToni: 0,
  escalatedToTickets: 0,
  outcomes: [], // { timestamp, outcome: 'resolved'|'ticket', category }
};

function loadStats() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      conversationStats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('Could not load conversation stats:', e.message);
  }
}

function saveStats() {
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(conversationStats, null, 2));
  } catch (e) {
    console.warn('Could not save conversation stats:', e.message);
  }
}

function recordConversation() {
  conversationStats.totalConversations++;
  saveStats();
}

function recordOutcome(outcome, category = 'other') {
  if (outcome === 'resolved') {
    conversationStats.resolvedByToni++;
  } else if (outcome === 'ticket') {
    conversationStats.escalatedToTickets++;
  }
  conversationStats.outcomes.push({
    timestamp: Date.now(),
    outcome,
    category,
  });
  // Keep only last 1000 outcomes
  if (conversationStats.outcomes.length > 1000) {
    conversationStats.outcomes = conversationStats.outcomes.slice(-1000);
  }
  saveStats();
}

function loadIssues() {
  try {
    if (fs.existsSync(ISSUES_FILE)) {
      reportedIssues = JSON.parse(fs.readFileSync(ISSUES_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('Could not load reported issues:', e.message);
    reportedIssues = [];
  }
}

function saveIssues() {
  try {
    fs.writeFileSync(ISSUES_FILE, JSON.stringify(reportedIssues, null, 2));
  } catch (e) {
    console.warn('Could not save reported issues:', e.message);
  }
}

// Extract meaningful keywords from a message
function extractIssueKeywords(message) {
  const stopWords = new Set([
    'die', 'der', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen',
    'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mein', 'dein',
    'und', 'oder', 'aber', 'auch', 'noch', 'schon', 'nur', 'sehr',
    'ist', 'bin', 'hat', 'sind', 'war', 'kann', 'will', 'soll', 'muss',
    'wie', 'was', 'wer', 'wann', 'warum', 'mit', 'von', 'für', 'auf',
    'bei', 'nach', 'aus', 'vor', 'bis', 'nicht', 'kein', 'keine',
    'the', 'is', 'are', 'was', 'have', 'has', 'not', 'my', 'can',
    'how', 'what', 'when', 'why', 'with', 'this', 'that', 'does',
    'habe', 'hab', 'dann', 'wenn', 'als', 'mir', 'mich', 'uns',
    'zum', 'zur', 'einem', 'einer', 'etwas', 'immer', 'bitte',
  ]);
  return message.toLowerCase()
    .replace(/[?!.,;:()]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
}

// Categorize an issue based on keywords
function categorizeIssue(keywords) {
  const cats = {
    crash: ['crash', 'abstürzt', 'absturz', 'gecrasht', 'stürzt', 'abgestürzt'],
    login: ['login', 'einloggen', 'anmelden', 'passwort', 'password', 'registrieren'],
    exercise: ['übung', 'übungen', 'exercise', 'training', 'laden', 'starten'],
    audio: ['ton', 'audio', 'sound', 'hören', 'lautsprecher', 'mikrofon'],
    display: ['anzeige', 'bildschirm', 'display', 'schwarz', 'weiß', 'layout'],
    performance: ['langsam', 'slow', 'laden', 'dauert', 'hängt', 'freeze', 'einfriert'],
    payment: ['zahlung', 'kosten', 'abo', 'subscription', 'bezahlen', 'geld'],
    data: ['daten', 'fortschritt', 'gespeichert', 'verloren', 'progress'],
  };
  for (const [cat, catKeywords] of Object.entries(cats)) {
    if (keywords.some(kw => catKeywords.some(ck => kw.includes(ck) || ck.includes(kw)))) {
      return cat;
    }
  }
  return 'other';
}

// Record a reported issue
function recordIssue(message, category = null, entrypoint = null) {
  const keywords = extractIssueKeywords(message);
  const cat = category || categorizeIssue(keywords);
  const entry = {
    timestamp: Date.now(),
    message: message.slice(0, 200), // truncate for storage
    keywords,
    category: cat,
    entrypoint: entrypoint || 'unknown',
  };
  reportedIssues.push(entry);

  // Keep only last 500 issues to avoid unbounded growth
  if (reportedIssues.length > 500) {
    reportedIssues = reportedIssues.slice(-500);
  }
  saveIssues();
  return cat;
}

// Check if a category is trending (reported >= TRENDING_THRESHOLD times recently)
// Optionally filter by entrypoint
function getTrendingIssues(entrypoint = null) {
  const cutoff = Date.now() - TRENDING_WINDOW_MS;
  let recent = reportedIssues.filter(i => i.timestamp > cutoff);
  if (entrypoint) {
    recent = recent.filter(i => i.entrypoint === entrypoint);
  }

  const counts = {};
  for (const issue of recent) {
    counts[issue.category] = (counts[issue.category] || 0) + 1;
  }

  const trending = {};
  for (const [cat, count] of Object.entries(counts)) {
    if (count >= TRENDING_THRESHOLD) {
      trending[cat] = count;
    }
  }
  return trending;
}

// Get entrypoint-specific insights (which screens have the most issues)
function getEntrypointInsights() {
  const cutoff = Date.now() - TRENDING_WINDOW_MS;
  const recent = reportedIssues.filter(i => i.timestamp > cutoff);

  const byEntrypoint = {};
  for (const issue of recent) {
    const ep = issue.entrypoint || 'unknown';
    if (!byEntrypoint[ep]) byEntrypoint[ep] = { total: 0, categories: {} };
    byEntrypoint[ep].total++;
    byEntrypoint[ep].categories[issue.category] = (byEntrypoint[ep].categories[issue.category] || 0) + 1;
  }
  return byEntrypoint;
}

// Find if the current message matches a trending issue (check both global + entrypoint-specific)
function findTrendingMatch(message, entrypoint = null) {
  const keywords = extractIssueKeywords(message);
  const category = categorizeIssue(keywords);

  // Check entrypoint-specific trending first (more specific = more helpful)
  if (entrypoint) {
    const epTrending = getTrendingIssues(entrypoint);
    if (epTrending[category]) {
      return { category, reportCount: epTrending[category], entrypoint, isEntrypointSpecific: true };
    }
  }

  // Fall back to global trending
  const globalTrending = getTrendingIssues();
  if (globalTrending[category]) {
    return { category, reportCount: globalTrending[category], entrypoint: null, isEntrypointSpecific: false };
  }
  return null;
}

// Load issues + stats on startup
loadIssues();
loadStats();
console.log(`Loaded ${reportedIssues.length} reported issues from memory`);
console.log(`Loaded conversation stats: ${conversationStats.totalConversations} conversations, ${conversationStats.resolvedByToni} resolved, ${conversationStats.escalatedToTickets} tickets`);

const app = express();
app.use(express.json());

const elevenlabs = new ElevenLabsClient();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Available voices
const VOICES = {
  bella: { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella" },
  rachel: { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel" },
  antoni: { id: "ErXwobaYiN019PkySvjV", name: "Antoni" },
  josh: { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh" },
  adam: { id: "pNInz6obpgDQGcFmaJgB", name: "Adam" },
  sam: { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam" },
  elli: { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli" },
  arnold: { id: "VR6AewLTigWG4xSOukaG", name: "Arnold" },
};

// Single agent configured in ElevenLabs dashboard
const AGENT_ID = "agent_4601kpanrrfyf8avkgzm4qj0xkmf";

// =============================================
// KNOWLEDGE BASE — Troubleshooting & FAQ
// =============================================
// Each entry has: q (keywords), a (response), followUps (suggested next chips)
// H.E.A.R.T. Framework: Hear → Empathize → Apologize → Respond → Thank
// Keep responses concise: acknowledge briefly, empathize in a few words, then solve.
const FAQ_ENTRIES = [
  // ── TROUBLESHOOTING: App Issues ──
  { q: "app abstürzt absturz crash crashes freezes einfriert",
    a: "Die App stürzt ab — das ist ärgerlich, tut mir leid! Schließe die App bitte komplett und öffne sie erneut. Falls das nicht hilft, prüfe ob ein Update verfügbar ist. Danke fürs Melden!",
    a_en: "The app is crashing — that's frustrating, I'm sorry! Please close the app completely and reopen it. If that doesn't help, check for an update. Thanks for letting me know!",
    followUps: ["App neu installieren", "Immer noch Probleme", "Problem melden"],
    followUps_en: ["Reinstall app", "Still having problems", "Report problem"] },
  { q: "app langsam slow laden lange dauert",
    a: "Langsame App — verstehe, das nervt! Tut mir leid. Schließe die App komplett und starte sie neu. Prüfe auch deine Internetverbindung — WLAN funktioniert am besten. Danke für deine Geduld!",
    a_en: "Slow app — I get it, that's annoying! Sorry about that. Close the app completely and restart it. Also check your internet — WiFi works best. Thanks for your patience!",
    followUps: ["App neu starten hat geholfen", "Immer noch langsam", "Übungen laden nicht"],
    followUps_en: ["Restarting helped", "Still slow", "Exercises won't load"] },
  { q: "app neu installieren neuinstallation reinstall",
    a: "Klar! Du kannst die App sicher deinstallieren und neu laden. Keine Sorge — deine Daten bleiben gespeichert, da sie mit deinem Konto verknüpft sind. Danke fürs Dranbleiben!",
    a_en: "Sure! You can safely uninstall and reinstall. Don't worry — your data is saved with your account. Thanks for sticking with us!",
    followUps: ["Daten wirklich sicher?", "Wie melde ich mich wieder an?", "Problem melden"],
    followUps_en: ["Is my data safe?", "How do I log back in?", "Report problem"] },
  { q: "app funktioniert nicht geht nicht startet nicht",
    a: "Das ist ärgerlich, tut mir leid! Probiere bitte: 1) App komplett schließen und neu starten, 2) prüfen ob ein Update verfügbar ist, 3) Gerät einmal neu starten. Danke fürs Ausprobieren!",
    a_en: "That's annoying, I'm sorry! Please try: 1) Close the app completely and restart, 2) check for updates, 3) restart your device. Thanks for trying!",
    followUps: ["Hat funktioniert!", "Problem besteht weiter", "App neu installieren"],
    followUps_en: ["That worked!", "Problem continues", "Reinstall app"] },
  { q: "update aktualisieren neue version",
    a: "Gehe in den App Store, suche myReha und tippe auf 'Aktualisieren'. Tipp: Aktiviere automatische Updates in den Geräte-Einstellungen. Danke fürs Nachfragen!",
    a_en: "Go to the App Store, search myReha and tap 'Update'. Tip: Enable automatic updates in your device settings. Thanks for asking!",
    followUps: ["Kein Update verfügbar", "Nach Update geht nichts mehr", "Problem melden"],
    followUps_en: ["No update available", "Nothing works after update", "Report problem"] },
  { q: "bildschirm schwarz weiß display anzeige kaputt ui",
    a: "Fehlerhafter Bildschirm — das ist verwirrend, tut mir leid! Schließe die App komplett und öffne sie erneut. Falls es bleibt, prüfe ob ein Update verfügbar ist. Danke fürs Melden!",
    a_en: "Broken screen — that's confusing, I'm sorry! Close the app completely and reopen it. If it persists, check for an update. Thanks for letting me know!",
    followUps: ["App neu starten", "App aktualisieren", "Problem melden"],
    followUps_en: ["Restart app", "Update app", "Report problem"] },

  // ── TROUBLESHOOTING: Exercises ──
  { q: "übung funktioniert nicht geht nicht klappt nicht exercise doesnt work broken",
    a: "Übung funktioniert nicht — das ist frustrierend, tut mir leid! Was genau passiert: Bleibt der Bildschirm hängen, kommt eine Fehlermeldung, oder reagiert die Übung nicht? Danke fürs Beschreiben!",
    a_en: "Exercise not working — that's frustrating, I'm sorry! What exactly happens: does the screen freeze, do you get an error, or does it not respond? Thanks for describing!",
    followUps: ["Bildschirm hängt", "Keine Reaktion auf Eingabe", "Fehlermeldung", "Übung lädt nicht"],
    followUps_en: ["Screen freezes", "No response to input", "Error message", "Exercise won't load"] },
  { q: "froschübung frosch frog bestimmte übung spezielle eine übung specific exercise",
    a: "Problem mit einer bestimmten Übung — das ist ärgerlich, tut mir leid! Startet sie gar nicht, bleibt sie hängen, oder wird deine Eingabe nicht erkannt? Danke fürs genaue Beschreiben!",
    a_en: "Problem with a specific exercise — that's annoying, I'm sorry! Does it not start, freeze midway, or not recognize your input? Thanks for the details!",
    followUps: ["Startet nicht", "Bleibt hängen", "Eingabe wird nicht erkannt", "Anderes Problem"],
    followUps_en: ["Won't start", "Freezes", "Input not recognized", "Other problem"] },
  { q: "übung starten geht nicht startet nicht exercise wont start",
    a: "Übung startet nicht — ärgerlich, tut mir leid! Gehe zurück zum Dashboard und wähle sie erneut. Prüfe auch dein Internet. Hilft das nicht, starte die App komplett neu. Danke für deine Geduld!",
    a_en: "Exercise won't start — annoying, I'm sorry! Go back to the dashboard and select it again. Check your internet too. If that doesn't help, restart the app completely. Thanks for your patience!",
    followUps: ["Übung neu starten", "Andere Übung wählen", "Alle Übungen betroffen"],
    followUps_en: ["Restart exercise", "Choose different exercise", "All exercises affected"] },
  { q: "eingabe erkannt reagiert nicht tippt nichts passiert input recognized touch",
    a: "Keine Reaktion auf Eingabe — das ist frustrierend, tut mir leid! Schließe die App komplett und starte neu. Probiere auch andere Übungen, um einzugrenzen ob es an dieser liegt. Danke fürs Melden!",
    a_en: "No response to input — that's frustrating, I'm sorry! Close the app completely and restart. Try other exercises too, to narrow down if it's this specific one. Thanks for reporting!",
    followUps: ["Nur bei dieser Übung", "Bei allen Übungen", "App neu gestartet, geht trotzdem nicht"],
    followUps_en: ["Only this exercise", "All exercises", "Restarted app, still not working"] },
  { q: "übung hängt einfriert freeze stuck bildschirm hängt mittendrin",
    a: "Übung friert ein — nervig, tut mir leid! Schließe die App über den App-Switcher komplett und öffne sie erneut. Passiert das bei einer bestimmten Übung oder mehreren? Danke für deine Geduld!",
    a_en: "Exercise freezing — annoying, I'm sorry! Close the app completely via the app switcher and reopen it. Does this happen with one exercise or multiple? Thanks for your patience!",
    followUps: ["Nur bei einer Übung", "Bei mehreren Übungen", "Nach App-Neustart auch noch"],
    followUps_en: ["Only one exercise", "Multiple exercises", "Still happens after restart"] },
  { q: "übung neu starten restart exercise neustarten",
    a: "Klar! Gehe zurück zum Dashboard, indem du oben links auf den Zurück-Pfeil tippst. Wähle dann die Übung erneut aus — sie startet von vorne. Danke fürs Dranbleiben!",
    a_en: "Sure! Go back to the dashboard by tapping the back arrow at the top left. Then select the exercise again — it'll start from the beginning. Thanks for sticking with it!",
    followUps: ["Hat geklappt!", "Übung reagiert nicht", "Problem melden"],
    followUps_en: ["That worked!", "Exercise not responding", "Report problem"] },
  { q: "übungen laden nicht loading fehler exercises wont load",
    a: "Übungen laden nicht — frustrierend, tut mir leid! Prüfe deine Internetverbindung und starte die App komplett neu über den App-Switcher. Danke fürs Dranbleiben!",
    a_en: "Exercises won't load — frustrating, I'm sorry! Check your internet connection and restart the app completely via the app switcher. Thanks for hanging in there!",
    followUps: ["App neu starten", "Internet prüfen", "Problem melden"],
    followUps_en: ["Restart app", "Check internet", "Report problem"] },
  { q: "übung verstehe ich nicht anleitung schwer schwierig",
    a: "Übung verwirrend — verstehe, das geht vielen so! Tippe auf das Fragezeichen-Symbol für eine Anleitung und oft auch ein Video. Frag auch gern deinen Therapeuten. Danke fürs Nachfragen!",
    a_en: "Exercise confusing — I get it, that's normal! Tap the question mark icon for instructions and often a video too. You can also ask your therapist. Thanks for asking!",
    followUps: ["Andere Übung wählen", "Schwierigkeit anpassen", "Therapeut kontaktieren"],
    followUps_en: ["Choose different exercise", "Adjust difficulty", "Contact therapist"] },
  { q: "übung zu schwer zu leicht schwierigkeit level",
    a: "Schwierigkeit passt nicht — verstehe! Die App passt sich automatisch an, aber du kannst auch unter Einstellungen > Therapieplan anpassen oder deinen Therapeuten fragen. Danke fürs Feedback!",
    a_en: "Difficulty doesn't fit — I get it! The app adjusts automatically, but you can also change it in Settings > Therapy Plan or ask your therapist. Thanks for the feedback!",
    followUps: ["Einstellungen öffnen", "Therapeut kontaktieren", "Wie funktioniert der Therapieplan?"],
    followUps_en: ["Open settings", "Contact therapist", "How does the therapy plan work?"] },
  { q: "ton audio sound hören lautsprecher kein ton stumm leise",
    a: "Kein Ton — das nervt, tut mir leid! Prüfe ob dein Gerät auf stumm steht und ob die Lautstärke hoch genug ist. Stelle auch sicher, dass der Ton in der App aktiviert ist. Danke fürs Checken!",
    a_en: "No sound — that's annoying, I'm sorry! Check if your device is on silent and if the volume is high enough. Also make sure sound is enabled in the app. Thanks for checking!",
    followUps: ["Ton funktioniert jetzt", "Immer noch kein Ton", "Problem melden"],
    followUps_en: ["Sound works now", "Still no sound", "Report problem"] },

  // ── TROUBLESHOOTING: Login & Account ──
  { q: "einloggen login nicht möglich anmelden geht nicht",
    a: "Login geht nicht — ärgerlich, tut mir leid! Prüfe ob E-Mail und Passwort korrekt sind (Groß-/Kleinschreibung!). Du kannst auch über 'Passwort vergessen?' zurücksetzen. Danke für deine Geduld!",
    a_en: "Can't log in — annoying, I'm sorry! Check if your email and password are correct (case-sensitive!). You can also reset via 'Forgot password?'. Thanks for your patience!",
    followUps: ["Passwort zurücksetzen", "E-Mail-Adresse vergessen", "Problem melden"],
    followUps_en: ["Reset password", "Forgot email", "Report problem"] },
  { q: "passwort vergessen zurücksetzen reset password forgot",
    a: "Passwort vergessen — kein Problem! Tippe auf 'Passwort vergessen?' am Login-Bildschirm. Du bekommst eine E-Mail mit Reset-Link. Prüfe auch den Spam-Ordner! Danke fürs Dranbleiben!",
    a_en: "Forgot password — no problem! Tap 'Forgot password?' on the login screen. You'll get an email with a reset link. Check your spam folder too! Thanks for sticking with it!",
    followUps: ["Keine E-Mail erhalten", "Spam-Ordner gecheckt", "Problem melden"],
    followUps_en: ["No email received", "Checked spam", "Report problem"] },
  { q: "email adresse vergessen welche email konto",
    a: "E-Mail vergessen — verstehe! Du findest sie unter Einstellungen > Mein Konto. Falls du nicht eingeloggt bist, frag bei deiner Klinik oder deinem Therapeuten nach. Danke fürs Nachfragen!",
    a_en: "Forgot your email — I get it! Find it under Settings > My Account. If you're not logged in, ask your clinic or therapist. Thanks for reaching out!",
    followUps: ["Einstellungen öffnen", "Therapeut fragen", "Problem melden"],
    followUps_en: ["Open settings", "Ask therapist", "Report problem"] },
  { q: "registrieren anmelden neues konto erstellen",
    a: "Schön, dass du dich registrieren möchtest! Tippe auf 'Neuen Zugang erstellen', gib deine Daten ein und bestätige per E-Mail. Willkommen bei myReha!",
    a_en: "Great that you want to register! Tap 'Create new account', enter your data, and confirm via email. Welcome to myReha!",
    followUps: ["Bestätigungs-Mail nicht erhalten", "Einladungscode eingeben", "Was ist ein Einladungscode?"],
    followUps_en: ["No confirmation email", "Enter invitation code", "What's an invitation code?"] },
  { q: "zugangscode verloren einladungscode code",
    a: "Zugangscode verloren — das ist ärgerlich, aber kein Problem! Den kannst du bei deiner Klinik, deinem Therapeuten oder beim Support unter support@nyra.health erneut anfordern. Danke fürs Bescheid sagen!",
    a_en: "Lost your access code — that's annoying, but no problem! You can request it again from your clinic, therapist, or support at support@nyra.health. Thanks for letting us know!",
    followUps: ["Problem melden", "Ohne Code registrieren", "Was ist ein Zugangscode?"],
    followUps_en: ["Report problem", "Register without code", "What's an access code?"] },
  { q: "zugangscode nicht erhalten bekommen",
    a: "Kein Zugangscode — ärgerlich, tut mir leid! Prüfe deinen Spam-Ordner. Falls nichts da ist, frag bei deiner Klinik oder support@nyra.health nach. Danke für deine Geduld!",
    a_en: "No access code — annoying, I'm sorry! Check your spam folder. If it's not there, ask your clinic or contact support@nyra.health. Thanks for your patience!",
    followUps: ["Spam-Ordner gecheckt", "Problem melden", "Neue E-Mail anfordern"],
    followUps_en: ["Checked spam", "Report problem", "Request new email"] },

  // ── TROUBLESHOOTING: Settings & Navigation ──
  { q: "einstellungen settings finden wo",
    a: "Die Einstellungen findest du über das Zahnrad-Symbol oben rechts im Dashboard. Dort kannst du dein Profil, deine Benachrichtigungen und deinen Therapieplan verwalten. Danke fürs Fragen!",
    a_en: "You'll find settings via the gear icon at the top right of the dashboard. There you can manage your profile, notifications, and therapy plan. Thanks for asking!",
    followUps: ["Profil bearbeiten", "Benachrichtigungen ändern", "Therapieplan anpassen"],
    followUps_en: ["Edit profile", "Change notifications", "Adjust therapy plan"] },
  { q: "profil bearbeiten name ändern",
    a: "Gehe zu Einstellungen > Mein Konto. Dort kannst du deinen Namen und andere Profildaten bearbeiten.",
    a_en: "Go to Settings > My Account. There you can edit your name and other profile data.",
    followUps: ["E-Mail ändern", "Passwort ändern", "Zurück zum Dashboard"],
    followUps_en: ["Change email", "Change password", "Back to dashboard"] },
  { q: "benachrichtigungen erinnerungen notifications",
    a: "Du kannst Erinnerungen in den Einstellungen unter 'Benachrichtigungen' ein- und ausschalten. So wirst du regelmäßig an dein Training erinnert!",
    a_en: "You can toggle reminders on and off in Settings under 'Notifications'. This way you'll be regularly reminded of your training!",
    followUps: ["Erinnerungen aktivieren", "Erinnerungen ausschalten", "Einstellungen öffnen"],
    followUps_en: ["Enable reminders", "Disable reminders", "Open settings"] },
  { q: "sprache ändern language deutsch englisch",
    a: "Die Spracheinstellungen findest du unter Einstellungen > Allgemein. Die App passt sich auch an die Spracheinstellung deines Geräts an.",
    a_en: "You'll find language settings under Settings > General. The app also adapts to your device's language setting.",
    followUps: ["Einstellungen öffnen", "Übungen in anderer Sprache?", "Problem melden"],
    followUps_en: ["Open settings", "Exercises in other language?", "Report problem"] },

  // ── TROUBLESHOOTING: Data & Sync ──
  { q: "fortschritte nicht gespeichert verloren daten weg sync",
    a: "Fortschritte weg — das ist frustrierend, tut mir leid! Prüfe deine Internetverbindung und starte die App neu. Deine Daten werden automatisch synchronisiert, sobald du online bist. Danke fürs Melden!",
    a_en: "Progress gone — that's frustrating, I'm sorry! Check your internet and restart the app. Your data syncs automatically once you're back online. Thanks for letting me know!",
    followUps: ["Internet prüfen", "App neu starten", "Problem melden"],
    followUps_en: ["Check internet", "Restart app", "Report problem"] },
  { q: "offline nutzen ohne internet",
    a: "Gute Frage! Einige Inhalte sind offline verfügbar. Deine Fortschritte werden dann automatisch synchronisiert, sobald du wieder Internet hast. Danke fürs Nachfragen!",
    a_en: "Good question! Some content is available offline. Your progress will sync automatically once you have internet again. Thanks for asking!",
    followUps: ["Welche Inhalte offline?", "Synchronisation klappt nicht", "Problem melden"],
    followUps_en: ["What content offline?", "Sync not working", "Report problem"] },
  { q: "fortschritt sehen ergebnis statistik",
    a: "Im Dashboard findest du den Fortschrittsbereich — dort siehst du deine absolvierten Übungen, deine Entwicklung über die Zeit und deine Erfolge. Weiter so!",
    a_en: "In the dashboard you'll find the progress section — there you can see your completed exercises, development over time, and achievements. Keep it up!",
    followUps: ["Wo ist das Dashboard?", "Fortschritte teilen", "Therapeut kontaktieren"],
    followUps_en: ["Where's the dashboard?", "Share progress", "Contact therapist"] },

  // ── TROUBLESHOOTING: Payment ──
  { q: "zahlung payment bezahlung fehlgeschlagen nicht geklappt",
    a: "Zahlungsprobleme — stressig, tut mir leid! Prüfe ob deine Zahlungsmethode aktuell ist: Geräte-Einstellungen > Apple-ID/Google-Konto > Zahlung. Bei Problemen hilft support@nyra.health. Danke für deine Geduld!",
    a_en: "Payment issues — stressful, I'm sorry! Check if your payment method is current: device Settings > Apple ID/Google Account > Payment. For help, contact support@nyra.health. Thanks for your patience!",
    followUps: ["Zahlungsmethode prüfen", "Andere Zahlungsmethode", "Problem melden"],
    followUps_en: ["Check payment method", "Different payment method", "Report problem"] },
  { q: "kosten kostenpflichtig preis was kostet",
    a: "myReha bietet Premium-Abos: neunundsechzig Euro neunundneunzig pro Monat, dreiundsechzig Euro dreiunddreißig bei drei Monaten oder achtundfünfzig Euro dreiunddreißig bei sechs Monaten. Viele Krankenkassen übernehmen die Kosten!",
    a_en: "myReha offers Premium subscriptions: \u20ac69.99/month, \u20ac63.33 for 3 months, or \u20ac58.33 for 6 months. Many health insurances cover the costs!",
    followUps: ["Übernimmt meine Krankenkasse?", "Welches Abo passt zu mir?", "Kostenlos testen"],
    followUps_en: ["Does my insurance cover it?", "Which plan fits me?", "Free trial"] },
  { q: "krankenkasse übernehmen versicherung kostenübernahme",
    a: "Ja! Zahlreiche Krankenkassen übernehmen die Kosten für myReha. Bei der Registrierung werden deine Angaben geprüft und du erfährst sofort, ob deine Kasse dabei ist.",
    a_en: "Yes! Many health insurances cover the costs for myReha. During registration, your details are checked and you'll find out immediately.",
    followUps: ["Wie beantrage ich das?", "Welche Kassen?", "Problem melden"],
    followUps_en: ["How do I apply?", "Which insurances?", "Report problem"] },
  { q: "testphase kostenlos testen gratis free",
    a: "Ja! Nach dem Download kannst du eine limitierte Basis-Version ganz ohne Zahlungsdaten und Kosten nutzen. So kannst du die App erstmal ausprobieren!",
    a_en: "Yes! After downloading, you can use a limited basic version completely free — no payment data needed. Try the app first!",
    followUps: ["Was ist im Basis-Abo?", "Auf Premium upgraden", "Was kostet Premium?"],
    followUps_en: ["What's in the basic plan?", "Upgrade to premium", "What does premium cost?"] },
  { q: "premium abo vorteile upgrade",
    a: "Das Premium-Abo bietet dir einen individuellen Therapieplan, Zugang zu über fünfundsechzigtausend Aufgaben und Echtzeit-Erfolgskontrolle. Du kannst es in den App-Einstellungen unter 'Abo' erwerben.",
    a_en: "Premium gives you an individual therapy plan, access to 65,000+ tasks, and real-time progress tracking. You can get it in Settings > Subscription.",
    followUps: ["Jetzt upgraden", "Was kostet es?", "Krankenkasse fragen"],
    followUps_en: ["Upgrade now", "What does it cost?", "Ask insurance"] },
  { q: "welches abo nehmen empfehlung",
    a: "Zum Schnuppern eignet sich das Einmonats-Abo. Für eine richtige Reha empfehle ich die drei- oder sechsmonatigen Abos — die sind auch günstiger pro Monat!",
    a_en: "For trying out, the monthly plan works well. For proper rehab, I recommend the 3 or 6 month plans — they're cheaper per month!",
    followUps: ["Einmonats-Abo wählen", "Dreimonats-Abo wählen", "Krankenkasse fragen"],
    followUps_en: ["Monthly plan", "3-month plan", "Ask insurance"] },
  { q: "abo kündigen cancel subscription",
    a: "Du kannst jederzeit kündigen — gehe dazu in die Einstellungen deines Geräts > Apple-ID/Google-Konto > Abonnements > myReha > Kündigen. Ganz einfach und ohne Probleme!",
    a_en: "You can cancel anytime — go to your device Settings > Apple ID/Google Account > Subscriptions > myReha > Cancel.",
    followUps: ["Verliere ich meine Daten?", "Kann ich pausieren?", "Problem melden"],
    followUps_en: ["Will I lose my data?", "Can I pause?", "Report problem"] },
  { q: "rechnung bezahlen invoice",
    a: "Rechnungen kommen vom App Store-Anbieter und sind über deine Geräte-Einstellungen abrufbar. Bei Problemen schreibe direkt an support@nyra.health!",
    a_en: "Invoices come from the App Store and are available in your device settings. For issues, contact support@nyra.health directly!",
    followUps: ["Rechnung nicht gefunden", "Falsch abgebucht", "Problem melden"],
    followUps_en: ["Can't find invoice", "Wrong charge", "Report problem"] },

  // ── INFO: General ──
  { q: "was ist myreha mereha meireha",
    a: "myReha ist eine zertifizierte Medizin-App zum Trainieren von Gedächtnis, Sprache und Aufmerksamkeit. Du bekommst einen persönlichen Trainingsplan, der sich automatisch an dich anpasst!",
    a_en: "myReha is a certified medical app for training memory, language, and attention. You get a personal training plan that adapts automatically!",
    followUps: ["Für wen ist die App?", "Was kostet es?", "Wie starte ich?"],
    followUps_en: ["Who is it for?", "What does it cost?", "How do I start?"] },
  { q: "welche bereiche sprache gedächtnis",
    a: "myReha deckt alle Therapie-Bereiche ab: Aussprache, Lesen, Schreiben, Sprachverständnis, Gedächtnis, logisches Denken, Planung, Rechnen, Aufmerksamkeit und Wahrnehmung.",
    a_en: "myReha covers all speech and cognition therapy areas: pronunciation, reading, writing, comprehension, memory, logical thinking, planning, math, attention, and perception.",
    followUps: ["Welche Übungen gibt es?", "Wie starte ich?", "Therapieplan erstellen"],
    followUps_en: ["What exercises?", "How do I start?", "Create therapy plan"] },
  { q: "welche erkrankungen schlaganfall parkinson",
    a: "myReha kann bei Rehabilitation nach Schlaganfällen, Hirnblutungen, Multipler Sklerose, Morbus Parkinson, Schädel-Hirn-Trauma und anderen neurologischen Erkrankungen helfen.",
    a_en: "myReha can help with rehabilitation after strokes, brain hemorrhages, multiple sclerosis, Parkinson's, traumatic brain injury, and other neurological conditions.",
    followUps: ["Für wen geeignet?", "Wie starte ich?", "Kostenlos testen"],
    followUps_en: ["Who is it suitable for?", "How do I start?", "Free trial"] },
  { q: "für wen geeignet wer kann nutzen",
    a: "myReha ist für Menschen mit Sprachstörungen wie Aphasie oder kognitiven Defiziten nach neurologischen Erkrankungen geeignet — unabhängig vom Schweregrad!",
    a_en: "myReha is for people with speech disorders like aphasia or cognitive deficits after neurological conditions — regardless of severity!",
    followUps: ["Welche Erkrankungen?", "Brauche ich einen Therapeuten?", "Kostenlos testen"],
    followUps_en: ["Which conditions?", "Do I need a therapist?", "Free trial"] },
  { q: "wie bekomme ich die app download installieren",
    a: "Lade myReha im Apple App Store oder Google Play Store herunter — suche einfach nach 'myReha'. Nach dem Download tippst du auf 'Neuen Zugang erstellen' und folgst der Registrierung!",
    a_en: "Download myReha from the Apple App Store or Google Play Store — just search for 'myReha'. After downloading, tap 'Create new account'!",
    followUps: ["Geräteanforderungen?", "Registrierung hilfe", "Was kostet es?"],
    followUps_en: ["Device requirements?", "Registration help", "What does it cost?"] },
  { q: "geräteanforderungen geräte kompatibel iphone ipad android",
    a: "iPhones und iPads brauchen mindestens iOS sechzehn, Android-Geräte mindestens Android sechs. Auf neueren Geräten läuft die App am besten!",
    a_en: "iPhones and iPads need at least iOS 16, Android devices at least Android 6. The app runs best on newer devices!",
    followUps: ["Mein Gerät ist zu alt", "Auf mehreren Geräten nutzen?", "App herunterladen"],
    followUps_en: ["My device is too old", "Use on multiple devices?", "Download app"] },
  { q: "wie lange nutzen wie oft häufigkeit empfehlung",
    a: "Wir empfehlen mindestens eine dreimonatige Rehaphase mit mindestens vier Stunden pro Woche. Langfristige Nutzung ist sehr sinnvoll — je regelmäßiger, desto besser!",
    a_en: "We recommend at least a 3-month rehab phase with at least 4 hours per week. Long-term use is very beneficial — the more regular, the better!",
    followUps: ["Wie starte ich?", "Therapieplan anpassen", "Fortschritte ansehen"],
    followUps_en: ["How do I start?", "Adjust therapy plan", "View progress"] },
  { q: "therapieplan übungsplan anpassen ändern",
    a: "Der Plan passt sich automatisch an deinen Fortschritt an. Du kannst aber auch manuell Anpassungen vornehmen: Gehe zu Einstellungen > Therapieplan.",
    a_en: "The plan adapts automatically to your progress. But you can also make manual adjustments: Go to Settings > Therapy Plan.",
    followUps: ["Einstellungen öffnen", "Schwierigkeit ändern", "Therapeut kontaktieren"],
    followUps_en: ["Open settings", "Change difficulty", "Contact therapist"] },
  { q: "ohne therapeuten arzt alleine selbstständig",
    a: "Ja! Du kannst hochwertige Reha ganz selbstständig machen — von zu Hause aus oder sogar im Urlaub. Die App leitet dich durch alles!",
    a_en: "Yes! You can do high-quality rehab completely independently — from home or even on vacation. The app guides you through everything!",
    followUps: ["Wie starte ich?", "Therapieplan erstellen", "Kostenlos testen"],
    followUps_en: ["How do I start?", "Create therapy plan", "Free trial"] },
  { q: "praxis therapeuten version klinik professional",
    a: "Ja! Es gibt eine Praxis-Version für Therapeuten mit dem kompletten Übungskatalog aus über fünfundsechzigtausend Aufgaben und einem Fortschritts-Dashboard.",
    a_en: "Yes! There's a practice version for therapists with the complete exercise catalog of 65,000+ tasks and a progress dashboard.",
    followUps: ["Mehr Infos für Therapeuten", "Klinik-Zugang", "Problem melden"],
    followUps_en: ["More info for therapists", "Clinic access", "Report problem"] },
  { q: "mehrere geräte gleichzeitig verschiedene",
    a: "Ja! Du kannst dich auf mehreren Geräten einloggen, solange du dieselben Zugangsdaten verwendest. Deine Fortschritte werden automatisch synchronisiert!",
    a_en: "Yes! You can log in on multiple devices using the same credentials. Your progress syncs automatically!",
    followUps: ["Wie synchronisieren?", "Neues Gerät einrichten", "Zugangsdaten vergessen"],
    followUps_en: ["How to sync?", "Set up new device", "Forgot credentials"] },
  { q: "daten sicherheit datenschutz dsgvo privacy",
    a: "Deine Daten sind sicher! Alles läuft anonym über europäische Server — vollständig DSGVO-konform und nur für deinen persönlichen Übungsplan verwendet.",
    a_en: "Your data is safe! Everything runs anonymously on European servers — fully GDPR compliant and used only for your personal exercise plan.",
    followUps: ["Wer sieht meine Daten?", "Account löschen", "Mehr zum Datenschutz"],
    followUps_en: ["Who sees my data?", "Delete account", "More about privacy"] },
  { q: "zugriff daten wer sieht",
    a: "Nur autorisierte Personen wie deine behandelnden Therapeuten haben Zugriff. Alle Daten werden DSGVO-konform verarbeitet.",
    a_en: "Only authorized people like your treating therapists have access. All data is processed GDPR-compliant.",
    followUps: ["Datenschutz-Info", "Account löschen", "Problem melden"],
    followUps_en: ["Privacy info", "Delete account", "Report problem"] },
  { q: "account löschen konto entfernen",
    a: "Du kannst eine vollständige Löschung deiner Daten beim Support beantragen. Schreibe einfach an support@nyra.health mit deiner Anfrage.",
    a_en: "You can request complete deletion of your data from support. Simply write to support@nyra.health.",
    followUps: ["Problem melden", "Was passiert mit meinen Daten?", "Abo vorher kündigen?"],
    followUps_en: ["Report problem", "What happens to my data?", "Cancel subscription first?"] },
  { q: "nicht kompatibel gerät alt zu alt",
    a: "Prüfe ob dein Gerät die Mindestanforderungen erfüllt: iOS sechzehn oder Android sechs. Bei älteren Geräten kann es leider Einschränkungen geben — ein Update des Betriebssystems könnte helfen!",
    a_en: "Check if your device meets the minimum requirements: iOS 16 or Android 6. For older devices, there may be limitations — a system update might help!",
    followUps: ["Gerät aktualisieren", "Anderes Gerät nutzen", "Problem melden"],
    followUps_en: ["Update device", "Use different device", "Report problem"] },
  { q: "support kontaktieren hilfe erreichen contact support other question andere frage",
    a: "Du erreichst den Support per E-Mail an support@nyra.health oder über das Kontaktformular in der App unter Einstellungen > Hilfe & Support.",
    a_en: "You can reach support via email at support@nyra.health or through the contact form in the app under Settings > Help & Support.",
    followUps: ["E-Mail schreiben", "In der App kontaktieren", "Häufige Fragen ansehen"],
    followUps_en: ["Write email", "Contact in app", "View FAQ"] },
  { q: "medizinprodukt zertifiziert ce kennzeichen",
    a: "Ja! myReha hat ein CE-Kennzeichen als zertifiziertes Medizinprodukt. Das bedeutet, dass alle Sicherheits- und Gesundheitsanforderungen erfüllt sind.",
    a_en: "Yes! myReha has a CE mark as a certified medical product. This means all safety and health requirements are met.",
    followUps: ["Was bedeutet das?", "Wer hat entwickelt?", "Mehr über myReha"],
    followUps_en: ["What does that mean?", "Who developed it?", "More about myReha"] },
  { q: "wer steckt dahinter gegründet team",
    a: "myReha wurde von Dr. Philipp Schöllauf gegründet, zusammen mit einem Team aus Therapeuten und Ärzten, in Zusammenarbeit mit der Neurologischen Abteilung einer Klinik in Wien.",
    a_en: "myReha was founded by Dr. Philipp Schöllauf, together with a team of therapists and doctors, in collaboration with the neurological department of a clinic in Vienna.",
    followUps: ["Mehr über myReha", "Kontakt aufnehmen", "App herunterladen"],
    followUps_en: ["More about myReha", "Get in touch", "Download app"] },

  // ── Meta: Conversation flow ──
  { q: "hat funktioniert geholfen danke gelöst that worked helped thanks solved",
    a: "Super, das freut mich! Kann ich dir noch bei etwas anderem helfen?",
    a_en: "Great, I'm glad to hear that! Can I help you with anything else?",
    followUps: ["Nein, alles gut!", "Andere Frage", "Übungen starten"],
    followUps_en: ["No, all good!", "Other question", "Start exercises"] },
  { q: "immer noch problem nicht geholfen besteht weiter geht immer noch nicht still having problems not working continues",
    a: "Immer noch Probleme — das ist frustrierend, tut mir leid! Siehst du eine Fehlermeldung oder bleibt der Bildschirm einfach stehen? Ein paar Details helfen mir weiter. Danke fürs Dranbleiben!",
    a_en: "Still not working — that's frustrating, I'm sorry! Do you see an error message or does the screen just freeze? A few details will help me. Thanks for sticking with it!",
    followUps: ["Fehlermeldung gesehen", "Bildschirm friert ein", "App schließt sich einfach", "Kein bestimmtes Muster"],
    followUps_en: ["Saw error message", "Screen freezes", "App just closes", "No clear pattern"] },
  { q: "problem melden bug report fehler melden ticket report problem",
    a: "Klar, ich helfe beim Melden! Was hast du gemacht, als das Problem auftrat, und was genau ist passiert? Danke fürs Beschreiben!",
    a_en: "Sure, I'll help you report it! What were you doing when the problem occurred, and what exactly happened? Thanks for describing!",
    followUps: ["Bei einer Übung", "Beim Einloggen", "Im Dashboard", "Woanders"],
    followUps_en: ["During an exercise", "When logging in", "On the dashboard", "Somewhere else"] },
  { q: "fehlermeldung error fehler angezeigt saw error message",
    a: "Danke! Weißt du noch, was in der Fehlermeldung stand? Auch nur ein Teil hilft uns. Und passiert das jedes Mal oder nur manchmal?",
    a_en: "Thanks! Do you remember what the error message said? Even part of it helps. And does it happen every time or only sometimes?",
    followUps: ["Ich weiß es nicht mehr", "Passiert jedes Mal", "Nur manchmal", "Nochmal versuchen"],
    followUps_en: ["I don't remember", "Happens every time", "Only sometimes", "Try again"] },
  { q: "bildschirm friert ein hängt stuck frozen reagiert nicht screen freezes",
    a: "Anzeigeproblem — nervig, tut mir leid! Schließe die App komplett, warte kurz und öffne sie erneut. Falls es bleibt: Bei welcher Funktion genau? Und seit wann? Danke fürs Melden!",
    a_en: "Display issue — annoying, I'm sorry! Close the app completely, wait a moment, and reopen. If it persists: which feature exactly? And since when? Thanks for reporting!",
    followUps: ["Bei einer Übung", "Im Dashboard", "Gleich nach dem Start", "Hat nach Neustart geklappt"],
    followUps_en: ["During an exercise", "In the dashboard", "Right after launch", "Fixed after restart"] },
  { q: "app schließt sich einfach von alleine beendet just closes itself",
    a: "App schließt sich einfach — ärgerlich, tut mir leid! Prüfe ob ein Update im App Store verfügbar ist. Passiert es bei einer bestimmten Aktion oder zufällig? Seit wann ungefähr? Danke fürs Melden!",
    a_en: "App just closes — annoying, I'm sorry! Check for an update in the App Store. Does it happen during a specific action or randomly? Since when? Thanks for reporting!",
    followUps: ["Bei bestimmter Aktion", "Passiert zufällig", "Seit einem Update", "Schon immer"],
    followUps_en: ["During specific action", "Happens randomly", "Since an update", "Always been like this"] },
  // ── Report flow: area-specific follow-ups (keep gathering info, no ticket yet) ──
  { q: "bei einer übung übung problem during exercise",
    a: "Verstanden — Problem bei einer Übung. Bei einer bestimmten oder bei allen? Siehst du eine Fehlermeldung? Und seit wann ungefähr? Danke fürs Beschreiben!",
    a_en: "Got it — problem during an exercise. With a specific one or all? Do you see an error message? Since when? Thanks for describing!",
    followUps: ["Nur eine bestimmte", "Bei allen", "Fehlermeldung", "Keine Fehlermeldung"],
    followUps_en: ["Only a specific one", "All of them", "Error message", "No error message"] },
  { q: "beim einloggen login problem melden during login authentication",
    a: "Login-Problem — ärgerlich! Passiert es nach der Dateneingabe oder lädt die Seite gar nicht? Hast du dich vorher schon mal erfolgreich eingeloggt? Danke fürs Beschreiben!",
    a_en: "Login problem — annoying! Does it happen after entering data or won't the page load? Have you logged in successfully before? Thanks for describing!",
    followUps: ["Nach Dateneingabe", "Seite lädt nicht", "Erstes Mal", "Hat vorher funktioniert"],
    followUps_en: ["After entering data", "Page won't load", "First time", "Worked before"] },
  { q: "im dashboard problem dashboard",
    a: "Problem im Dashboard — verstehe! Was genau siehst du oder funktioniert nicht? Fehlen Übungen, Fortschritte, oder etwas anderes? Danke fürs Beschreiben!",
    a_en: "Dashboard problem — I see! What exactly do you see or isn't working? Exercises missing, progress missing, or something else? Thanks for describing!",
    followUps: ["Übungen fehlen", "Fortschritte fehlen", "Leerer Bildschirm", "Etwas anderes"],
    followUps_en: ["Exercises missing", "Progress missing", "Blank screen", "Something else"] },
  { q: "woanders anderes problem anderer bereich",
    a: "OK! Beschreibe bitte wo genau in der App das Problem auftritt und was dann passiert. Danke fürs Beschreiben!",
    a_en: "OK! Please describe where exactly in the app the problem occurs and what happens. Thanks for describing!",
    followUps: null,
    followUps_en: null },
  // These entries gather MORE detail instead of immediately creating tickets
  { q: "bei bestimmter übung bestimmte exercise specific with particular",
    a: "Danke! Weißt du den Namen der Übung? Und was passiert genau — startet nicht, friert ein, oder reagiert nicht? Je mehr Details, desto besser!",
    a_en: "Thanks! Do you know the exercise name? What happens — won't start, freezes, or not responding? The more details, the better!",
    followUps: ["Startet nicht", "Friert ein", "Reagiert nicht", "Weiß den Namen nicht"],
    followUps_en: ["Won't start", "Freezes", "Not responding", "Don't know the name"] },
  { q: "bei allen übungen alle exercises all affected every",
    a: "Alle Übungen betroffen — klingt nach einem allgemeinen Problem. Hast du die App schon neu gestartet? Ist dein Internet stabil? Seit wann tritt das auf? Danke fürs Beschreiben!",
    a_en: "All exercises affected — sounds like a general issue. Have you restarted the app? Is your internet stable? Since when? Thanks for describing!",
    followUps: ["Schon versucht, hilft nicht", "Internet ist stabil", "Seit einem Update", "Seit heute"],
    followUps_en: ["Already tried, doesn't help", "Internet is stable", "Since an update", "Since today"] },
  { q: "ja fehlermeldung meldung error message gesehen",
    a: "Super! Was stand in der Fehlermeldung? Auch nur ein Wort oder eine Zahl hilft. Bei welcher Aktion kam die Meldung? Danke!",
    a_en: "Great! What did the error message say? Even a word or number helps. During which action did it appear? Thanks!",
    followUps: null,
    followUps_en: null },
  { q: "nein keine meldung nichts angezeigt",
    a: "Keine Fehlermeldung — verstehe. Was passiert stattdessen? Bildschirm bleibt stehen, wird schwarz, oder schließt sich die App? Danke fürs Beschreiben!",
    a_en: "No error message — I see. What happens instead? Screen freezes, goes black, or does the app close? Thanks for describing!",
    followUps: ["Bildschirm bleibt stehen", "Wird schwarz", "App schließt sich", "Etwas anderes"],
    followUps_en: ["Screen freezes", "Goes black", "App closes", "Something else"] },
  { q: "nach dateneingabe daten eingegeben eingabe",
    a: "Problem nach der Dateneingabe — danke! Siehst du einen Fehler, lädt es endlos, oder passiert nichts? Nutzt du E-Mail oder Zugangscode?",
    a_en: "Problem after entering data — thanks! Do you see an error, does it load forever, or nothing happens? Do you use email or access code?",
    followUps: ["Fehlermeldung", "Lädt endlos", "Passiert nichts", "Zugangscode"],
    followUps_en: ["Error message", "Loads forever", "Nothing happens", "Access code"] },
  { q: "seite lädt nicht laden seite",
    a: "Seite lädt nicht — frustrierend, tut mir leid! Nur beim Login oder auch woanders? Ist dein Internet stabil? Versuche die App komplett neu zu starten. Danke fürs Melden!",
    a_en: "Page won't load — frustrating, I'm sorry! Only at login or elsewhere too? Is your internet stable? Try restarting the app completely. Thanks for reporting!",
    followUps: ["Nur beim Login", "Auch woanders", "Internet ist stabil", "App neu gestartet"],
    followUps_en: ["Only at login", "Other places too", "Internet is stable", "Restarted app"] },
  { q: "fehlermeldung beim login login error",
    a: "Fehler beim Login — danke fürs Melden! Was stand in der Fehlermeldung? Hast du dich vorher schon mal erfolgreich eingeloggt?",
    a_en: "Login error — thanks for reporting! What did the error message say? Have you logged in successfully before?",
    followUps: ["Weiß ich nicht mehr", "Hat vorher funktioniert", "Erstes Mal", "Passwort zurücksetzen"],
    followUps_en: ["Don't remember", "Worked before", "First time", "Reset password"] },
  { q: "übungen fehlen fehlt missing exercises",
    a: "Übungen fehlen — seltsam! Waren sie schon immer weg oder plötzlich verschwunden? Gar keine Übungen oder nur bestimmte? Danke fürs Beschreiben!",
    a_en: "Exercises missing — strange! Were they always missing or suddenly gone? No exercises at all or just certain ones? Thanks for describing!",
    followUps: ["Plötzlich verschwunden", "Waren noch nie da", "Nur bestimmte fehlen", "Gar keine da"],
    followUps_en: ["Suddenly disappeared", "Were never there", "Only certain ones missing", "None at all"] },
  { q: "fortschritt nicht angezeigt progress missing",
    a: "Fortschritte fehlen — ärgerlich, tut mir leid! War der Fortschritt vorher da oder wurde er nie angezeigt? Hast du das Gerät gewechselt? Danke fürs Melden!",
    a_en: "Progress missing — annoying, I'm sorry! Was it visible before or never shown? Have you changed devices? Thanks for reporting!",
    followUps: ["War vorher da", "Wurde nie angezeigt", "Gerät gewechselt", "App neu installiert"],
    followUps_en: ["Was there before", "Never showed", "Changed device", "Reinstalled app"] },
  { q: "leerer bildschirm leer blank empty screen",
    a: "Leerer Bildschirm — verwirrend! Immer an der gleichen Stelle oder verschiedenen? Hast du die App schon komplett neu gestartet? Danke fürs Melden!",
    a_en: "Blank screen — confusing! Always at the same place or different ones? Have you restarted the app completely? Thanks for reporting!",
    followUps: ["Immer gleiche Stelle", "Verschiedene Stellen", "Schon versucht", "Noch nicht versucht"],
    followUps_en: ["Always same place", "Different places", "Already tried", "Haven't tried yet"] },
  // ── Only create ticket when user has been through the investigation flow ──
  { q: "schon versucht hilft nicht trotzdem nicht already tried doesnt help still broken nicht gelöst",
    a: "Schon alles probiert und es geht nicht — tut mir wirklich leid! Ich leite das an unser Entwickler-Team weiter, die kümmern sich darum. Danke für deine Geduld!",
    a_en: "Already tried everything and it won't work — I'm really sorry! I'll forward this to our dev team, they'll take care of it. Thanks for your patience!",
    followUps: ["Andere Frage", "Nein, alles gut!"],
    followUps_en: ["Other question", "No, all good!"],
    createTicket: true },
  { q: "seit einem update seit heute seit gestern seit kurzem since update since today recently",
    a: "Wichtige Info, danke! Problem ist also relativ neu. Hast du die App schon komplett neu gestartet? Falls das nicht hilft, leite ich es an unser Team weiter.",
    a_en: "Important info, thanks! So the problem is relatively new. Have you restarted the app completely? If that doesn't help, I'll forward it to our team.",
    followUps: ["Schon versucht, hilft nicht", "Werde ich probieren", "Hat geholfen!"],
    followUps_en: ["Already tried, doesn't help", "I'll try that", "That helped!"] },

  { q: "nein alles gut fertig tschüss no all good done goodbye",
    a: "Wunderbar! Dann wünsche ich dir viel Erfolg beim Training. Bis bald!",
    a_en: "Wonderful! Good luck with your training. See you soon!",
    followUps: [],
    followUps_en: [] },
];

const TONI_SYSTEM_PROMPT =
  "Du bist Toni, ein freundlicher und verspielter Charakter der myReha App. Du bist ein niedliches blaues Knäuel-Wesen. " +
  "Du sprichst kurz, enthusiastisch und aufmunternd. Du hilfst Nutzern bei Fragen zur myReha App. " +
  "Antworte in 1 bis 3 Sätzen. Sei warm, freundlich und hilfsbereit! " +
  "Du sprichst standardmäßig Deutsch, kannst aber auch Englisch wenn der Nutzer Englisch spricht. " +
  "Wenn du eine Frage nicht beantworten kannst, empfehle den Support unter support@nyra.health.";

// =============================================
// SMART RESPONSE GENERATION
// =============================================
const STOP_WORDS = new Set([
  "die", "der", "das", "den", "dem", "des", "ein", "eine", "einen", "einem",
  "ich", "du", "er", "sie", "es", "wir", "ihr", "mein", "dein", "sein",
  "und", "oder", "aber", "auch", "noch", "schon", "nur", "sehr",
  "ist", "bin", "hat", "sind", "war", "kann", "will", "soll", "muss",
  "wie", "was", "wer", "wann", "warum", "welche", "welcher", "welches",
  "mit", "von", "für", "auf", "bei", "nach", "aus", "vor", "bis",
  "nicht", "kein", "keine", "keinen", "mich", "mir", "uns",
  "app", "the", "how", "can", "does", "what",
]);

function findBestFaqMatch(message) {
  const lowerOriginal = message.toLowerCase().replace(/[?!.,;:]/g, "");
  const words = lowerOriginal.split(/\s+/).filter(w => w.length > 0 && !STOP_WORDS.has(w));

  if (words.length === 0) return null;

  // Strip common German prefixes (ge-, ver-, be-, an-, ab-, auf-, ein-, aus-, zu-)
  // so "gecrasht" → "crasht", "abgestürzt" → "stürzt" etc.
  function stripGermanPrefix(w) {
    const prefixes = ['ge', 'ver', 'be', 'an', 'ab', 'auf', 'ein', 'aus', 'zu', 'zer', 'ent', 'er'];
    for (const p of prefixes) {
      if (w.startsWith(p) && w.length > p.length + 2) return w.slice(p.length);
    }
    return w;
  }

  // Strip common suffixes (-t, -en, -e, -st, -te, -ung)
  function stripSuffix(w) {
    if (w.length < 4) return w;
    if (w.endsWith('ung')) return w.slice(0, -3);
    if (w.endsWith('en') || w.endsWith('st') || w.endsWith('te') || w.endsWith('er')) return w.slice(0, -2);
    if (w.endsWith('t') || w.endsWith('e') || w.endsWith('s')) return w.slice(0, -1);
    return w;
  }

  function normalize(w) {
    return stripSuffix(stripGermanPrefix(w));
  }

  let bestMatch = null;
  let bestScore = 0;

  for (const entry of FAQ_ENTRIES) {
    const keywords = entry.q.split(/\s+/).filter(kw => !STOP_WORDS.has(kw) && kw.length > 2);
    let score = 0;

    for (const kw of keywords) {
      for (const word of words) {
        // Exact match
        if (word === kw) {
          score += kw.length > 5 ? 4 : 3;
          break;
        }

        // Normalized match (strips prefixes + suffixes)
        const kwNorm = normalize(kw);
        const wordNorm = normalize(word);
        if (kwNorm.length >= 3 && wordNorm.length >= 3 && (kwNorm === wordNorm || kwNorm.startsWith(wordNorm) || wordNorm.startsWith(kwNorm))) {
          score += kw.length > 5 ? 3 : 2;
          break;
        }

        // Stem match for German word forms (kostet/kosten, registriere/registrieren)
        const kwStem = kw.length > 5 ? kw.slice(0, -2) : kw.slice(0, -1);
        const wordStem = word.length > 5 ? word.slice(0, -2) : word.slice(0, -1);
        if (kwStem.length >= 4 && word.startsWith(kwStem)) {
          score += kw.length > 5 ? 3 : 2;
          break;
        }
        if (wordStem.length >= 4 && kw.startsWith(wordStem)) {
          score += kw.length > 5 ? 3 : 2;
          break;
        }

        // Contains check: if the word contains the keyword or vice versa (for compound words)
        if (kw.length >= 4 && word.includes(kw)) {
          score += 2;
          break;
        }
        if (word.length >= 4 && kw.includes(word)) {
          score += 2;
          break;
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  // Need at least 3 points for a confident match
  return bestScore >= 3 ? bestMatch : null;
}

function generateToniResponse(message, lang = 'de', entrypoint = null) {
  const isEn = lang === 'en';

  // Friendly entrypoint labels for messages
  const entrypointLabels = {
    exercise: { de: 'in den Übungen', en: 'in the exercises' },
    dashboard: { de: 'im Dashboard', en: 'on the dashboard' },
    login: { de: 'beim Login', en: 'at login' },
    settings: { de: 'in den Einstellungen', en: 'in settings' },
    profile: { de: 'im Profil', en: 'in the profile' },
    onboarding: { de: 'beim Onboarding', en: 'during onboarding' },
    browser: { de: 'in der App', en: 'in the app' },
  };

  // Check if this matches a trending (frequently reported) issue
  const trending = findTrendingMatch(message, entrypoint);
  if (trending) {
    const categoryNames = {
      crash: { de: 'App-Abstürze', en: 'app crashes' },
      login: { de: 'Login-Probleme', en: 'login issues' },
      exercise: { de: 'Probleme mit Übungen', en: 'exercise issues' },
      audio: { de: 'Audio-Probleme', en: 'audio issues' },
      display: { de: 'Anzeige-Probleme', en: 'display issues' },
      performance: { de: 'Performance-Probleme', en: 'performance issues' },
      payment: { de: 'Zahlungsprobleme', en: 'payment issues' },
      data: { de: 'Datenprobleme', en: 'data issues' },
      other: { de: 'dieses Problem', en: 'this issue' },
    };
    const catName = categoryNames[trending.category] || categoryNames.other;

    // Build a context-aware trending message
    let locationHint = '';
    if (trending.isEntrypointSpecific && trending.entrypoint) {
      const epLabel = entrypointLabels[trending.entrypoint] || { de: `in "${trending.entrypoint}"`, en: `in "${trending.entrypoint}"` };
      locationHint = isEn
        ? `, especially ${epLabel.en}`
        : `, besonders ${epLabel.de}`;
    }

    // Still try FAQ for a specific helpful answer, but prepend the trending notice
    const faqMatch = findBestFaqMatch(message);
    if (faqMatch) {
      const trendingNote = isEn
        ? `⚡ We've seen similar reports about ${catName.en}${locationHint} recently — sorry about that! To help you best: `
        : `⚡ Wir haben ähnliche Meldungen zu ${catName.de}${locationHint} erhalten — tut mir leid! Um dir bestmöglich zu helfen: `;
      return {
        text: trendingNote + (isEn ? (faqMatch.a_en || faqMatch.a) : faqMatch.a),
        followUps: faqMatch.followUps === null ? null : (isEn ? (faqMatch.followUps_en || faqMatch.followUps || []) : (faqMatch.followUps || [])),
        createTicket: false, // already known issue
        isTrending: true,
      };
    }

    // No FAQ match but it's trending — ask for details to create a ticket
    return isEn
      ? { text: `⚡ We've seen similar reports about ${catName.en}${locationHint} recently — I'm sorry about that! Can you tell me exactly what happened? What were you doing when the problem occurred, and what did you see on screen? The more details, the faster we can help!`, followUps: ["Describe the problem", "When does it happen?", "Create a ticket"], isTrending: true }
      : { text: `⚡ Wir haben ähnliche Meldungen zu ${catName.de}${locationHint} erhalten — tut mir leid! Kannst du mir genau sagen, was passiert ist? Was hast du gemacht, als das Problem auftrat, und was hast du auf dem Bildschirm gesehen? Je mehr Details, desto schneller können wir helfen!`, followUps: ["Problem beschreiben", "Wann passiert es?", "Ticket erstellen"], isTrending: true };
  }

  // Try FAQ match first
  const faqMatch = findBestFaqMatch(message);
  if (faqMatch) {
    // Only allow ticket creation after at least 3 exchanges (user messages in history)
    // This prevents creating a ticket on the very first message
    const userMessageCount = chatHistory.filter(m => m.role === 'user').length;
    const allowTicket = faqMatch.createTicket && userMessageCount >= 6;

    return {
      text: isEn ? (faqMatch.a_en || faqMatch.a) : faqMatch.a,
      followUps: faqMatch.followUps === null ? null : (isEn ? (faqMatch.followUps_en || faqMatch.followUps || []) : (faqMatch.followUps || [])),
      createTicket: allowTicket
    };
  }

  // Fallback: friendly responses
  const lower = message.toLowerCase();

  if (lower.match(/\b(hi|hello|hey|hallo|servus|grüß)\b/))
    return isEn
      ? { text: "Hello! Great to have you here! How can I help you?", followUps: ["Exercise not working", "Login problem", "Question about the app"] }
      : { text: "Hallo! Schön, dass du da bist! Wie kann ich dir helfen?", followUps: ["Übung funktioniert nicht", "Login-Problem", "Frage zur App"] };
  if (lower.match(/\b(danke|dankeschön|thank)/))
    return isEn
      ? { text: "You're welcome! Happy I could help!", followUps: ["Other question", "Start exercises", "No, all good!"] }
      : { text: "Gerne! Freut mich, wenn ich helfen konnte!", followUps: ["Andere Frage", "Übungen starten", "Nein, alles gut!"] };
  if (lower.match(/\b(tschüss|bye|ciao|auf wiedersehen)/))
    return isEn
      ? { text: "Bye! Good luck with your training!", followUps: [] }
      : { text: "Tschüss! Bis bald und viel Erfolg beim Training!", followUps: [] };
  if (lower.match(/\b(wer bist du|who are you|was bist du)/))
    return isEn
      ? { text: "I'm Toni, your friendly helper in the myReha app! I'm happy to answer your questions about the app.", followUps: ["What can the app do?", "How do I start?", "I have a problem"] }
      : { text: "Ich bin Toni, dein freundlicher Helfer in der myReha App! Ich beantworte gerne deine Fragen rund um die App.", followUps: ["Was kann die App?", "Wie starte ich?", "Ich habe ein Problem"] };
  if (lower.match(/\b(hilfe|help|was kannst du)/))
    return isEn
      ? { text: "I can help you with questions about the myReha app! Ask me about exercises, costs, or technical problems.", followUps: ["Exercise not working", "Costs & subscription", "Report app problem"] }
      : { text: "Ich kann dir bei Fragen zur myReha App helfen! Frag mich zum Beispiel zu Übungen, Kosten oder technischen Problemen.", followUps: ["Übung funktioniert nicht", "Kosten & Abo", "App-Problem melden"] };

  // H.E.A.R.T. context-aware fallback — detect topic and ask empathetic follow-ups
  const lastAssistantMsg = [...chatHistory].reverse().find(m => m.role === 'assistant')?.content || '';
  const userMessageCount = chatHistory.filter(m => m.role === 'user').length;
  const allUserMsgs = chatHistory.filter(m => m.role === 'user').map(m => m.content.toLowerCase()).join(' ');

  // After enough exchanges with no resolution — Thank + escalate (need at least 7 messages)
  if (userMessageCount >= 7) {
    return isEn
      ? { text: "Thanks for your patience explaining this! I'll forward everything to our support team — they'll get back to you soon. Thank you!", followUps: [], createTicket: true }
      : { text: "Danke für deine Geduld! Ich leite alles an unser Support-Team weiter — die melden sich bald bei dir und kümmern sich darum. Danke!", followUps: [], createTicket: true };
  }

  // Detect topic from all user messages in this conversation
  const isExerciseRelated = /übung|exercise|training|frosch|level|aufgabe/.test(allUserMsgs);
  const isLoginRelated = /login|einlog|anmeld|passwort|password|registrier|zugang/.test(allUserMsgs);
  const isPaymentRelated = /zahl|kosten|abo|subscription|geld|preis|money/.test(allUserMsgs);

  // Topic-specific follow-up questions with H.E.A.R.T. tone
  if (isExerciseRelated) {
    const exerciseFallbacksDe = [
      { text: "Übung funktioniert nicht — frustrierend, tut mir leid! Passiert es bei einer bestimmten Übung oder allen? Siehst du eine Fehlermeldung? Danke fürs Beschreiben!", followUps: ["Nur eine Übung", "Alle Übungen", "Fehlermeldung", "Keine Fehlermeldung"] },
      { text: "Danke für die Info! Was passiert beim Öffnen der Übung — startet nicht, bleibt hängen, oder reagiert nicht auf Eingabe?", followUps: ["Startet nicht", "Bleibt hängen", "Eingabe wird ignoriert", "Anderes"] },
      { text: "Hilfreich, danke! Letzte Frage: Seit wann besteht das Problem? Hat die Übung vorher funktioniert?", followUps: ["Hat vorher funktioniert", "War schon immer so", "Nach einem Update", "Weiß nicht"] },
    ];
    const exerciseFallbacksEn = [
      { text: "Exercise not working — frustrating, I'm sorry! Does it happen with a specific exercise or all? Do you see an error message? Thanks for describing!", followUps: ["Only one exercise", "All exercises", "Error message", "No error message"] },
      { text: "Thanks for the info! What happens when you open the exercise — won't start, freezes, or not responding to input?", followUps: ["Won't start", "Freezes", "Input ignored", "Something else"] },
      { text: "Helpful, thanks! Last question: How long has this been happening? Did the exercise work before?", followUps: ["Worked before", "Always been like this", "After an update", "Not sure"] },
    ];
    const fbs = isEn ? exerciseFallbacksEn : exerciseFallbacksDe;
    for (const fb of fbs) {
      if (fb.text !== lastAssistantMsg) return { text: fb.text, followUps: fb.followUps };
    }
  }

  if (isLoginRelated) {
    const loginFallbacksDe = [
      { text: "Login-Probleme — ärgerlich, tut mir leid! Was passiert genau: Fehlermeldung, endloses Laden, oder gar nichts? Danke fürs Beschreiben!", followUps: ["Fehlermeldung", "Lädt endlos", "Passiert nichts", "Passwort vergessen"] },
      { text: "Danke! Nutzt du E-Mail oder Zugangscode? Und hast du dich vorher schon mal erfolgreich eingeloggt?", followUps: ["E-Mail", "Zugangscode", "Erstes Mal", "Hat vorher funktioniert"] },
    ];
    const loginFallbacksEn = [
      { text: "Login trouble — annoying, I'm sorry! What happens exactly: error message, endless loading, or nothing? Thanks for describing!", followUps: ["Error message", "Loads forever", "Nothing happens", "Forgot password"] },
      { text: "Thanks! Do you use email or access code? And have you logged in successfully before?", followUps: ["Email", "Access code", "First time", "Worked before"] },
    ];
    const fbs = isEn ? loginFallbacksEn : loginFallbacksDe;
    for (const fb of fbs) {
      if (fb.text !== lastAssistantMsg) return { text: fb.text, followUps: fb.followUps };
    }
  }

  // Generic H.E.A.R.T. fallbacks when we can't detect the topic
  const fallbacksDe = [
    { text: "Ich möchte dir helfen — tut mir leid, dass etwas nicht klappt! Was hast du gemacht, als das Problem auftrat? Danke fürs Beschreiben!", followUps: ["App stürzt ab", "Übung funktioniert nicht", "Login geht nicht", "Etwas anderes"] },
    { text: "Das ist frustrierend, verstehe ich — tut mir leid! In welchem Bereich der App tritt das Problem auf? Danke für deine Geduld!", followUps: ["Bei einer Übung", "Beim Einloggen", "Im Dashboard", "Woanders"] },
    { text: "Das ist ärgerlich, tut mir leid! Passiert das jedes Mal oder nur manchmal? Das hilft mir, die Ursache einzugrenzen. Danke fürs Dranbleiben!", followUps: ["Jedes Mal", "Nur manchmal", "Nur einmal passiert", "Problem melden"] },
  ];

  const fallbacksEn = [
    { text: "I want to help — sorry something isn't working! What were you doing when the problem occurred? Thanks for describing!", followUps: ["App crashes", "Exercise won't load", "Can't log in", "Something else"] },
    { text: "That's frustrating, I get it — I'm sorry! Which area of the app does the problem occur in? Thanks for your patience!", followUps: ["During an exercise", "When logging in", "On the dashboard", "Somewhere else"] },
    { text: "That's annoying, I'm sorry! Does this happen every time or only sometimes? That helps me narrow it down. Thanks for sticking with it!", followUps: ["Every time", "Only sometimes", "Happened once", "Report problem"] },
  ];

  const fallbacks = isEn ? fallbacksEn : fallbacksDe;
  for (const fb of fallbacks) {
    if (fb.text !== lastAssistantMsg) return { text: fb.text, followUps: fb.followUps };
  }
  return { text: fallbacks[0].text, followUps: fallbacks[0].followUps };
}

// No agent creation needed — configured in ElevenLabs dashboard

// =============================================
// LINEAR TICKET INTEGRATION
// =============================================
const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const LINEAR_API_URL = "https://api.linear.app/graphql";

// =============================================
// QMRA CLASSIFICATION SYSTEM (Multi-label)
// =============================================

// [QMRA] Classification of Problem
const QMRA_CLASSIFICATIONS = {
  serious_safety: {
    label: "Serious: Safety-relevant",
    linearLabel: "[QMRA] Serious: Safety-relevant",
    keywords: ["verletzt", "schmerzen", "gesundheit", "gefahr", "falsche übung", "falsche anleitung", "wrong exercise", "injury", "health risk", "harmful", "schaden", "gefährlich", "tod", "death", "verschlechterung", "deterioration", "public health"],
    priority: 1,
    isSerious: true,
  },
  serious_other: {
    label: "Serious: Others",
    linearLabel: "[QMRA] Serious: Others",
    keywords: ["daten verloren", "alle daten weg", "account gelöscht", "nicht zugreifen", "komplett kaputt", "data loss", "cannot access", "completely broken", "zahlung falsch", "doppelt abgebucht", "geld", "money", "operational failure", "effectiveness"],
    priority: 1,
    isSerious: true,
  },
  moderate: {
    label: "Moderate",
    linearLabel: "[QMRA] Moderate",
    keywords: ["abstürzt", "crash", "einfriert", "freeze", "funktioniert nicht", "geht nicht", "login nicht", "übung startet nicht", "laden nicht", "error", "fehler", "nicht laden", "nicht starten", "kaputt", "reliability", "zuverlässigkeit"],
    priority: 2,
    isSerious: false,
  },
  minor: {
    label: "Minor",
    linearLabel: "[QMRA] Minor",
    keywords: ["langsam", "slow", "verzögerung", "delay", "manchmal", "sometimes", "ab und zu", "layout", "anzeige", "display", "design", "ui", "aussehen", "non-critical", "aesthetic"],
    priority: 3,
    isSerious: false,
  },
  marginal: {
    label: "Marginal",
    linearLabel: "[QMRA] Marginal",
    keywords: ["wunsch", "vorschlag", "suggestion", "feature", "wäre schön", "könnte", "would be nice", "verbesserung", "improvement", "feedback", "insignificant"],
    priority: 4,
    isSerious: false,
  },
};

// Feedback Type labels
const FEEDBACK_TYPES = {
  bug: { label: "External Bug", linearLabel: "External Bug", keywords: ["fehler", "error", "crash", "abstürzt", "bug", "kaputt", "broken", "geht nicht", "not working", "funktioniert nicht", "einfriert", "freeze"] },
  suggestion: { label: "External Suggestion", linearLabel: "External Suggestion", keywords: ["wunsch", "vorschlag", "suggestion", "feature", "wäre schön", "could", "könnte", "would be nice", "verbesserung", "improvement", "idee", "idea"] },
  feedback: { label: "External Feedback", linearLabel: "External Feedback", keywords: ["feedback", "meinung", "opinion", "rückmeldung", "bewertung", "rating", "erfahrung", "experience"] },
};

// CAPA/Vigilance label (only for Serious issues)
const CAPA_VIGILANCE_LABEL = "[QMRA] CAPA/Vigilance";

function classifyTicket(conversationText) {
  const lower = conversationText.toLowerCase();

  // 1. Determine QMRA Classification
  let bestClass = "minor";
  let bestScore = 0;
  for (const [key, config] of Object.entries(QMRA_CLASSIFICATIONS)) {
    let score = 0;
    for (const kw of config.keywords) {
      if (lower.includes(kw)) score += kw.length;
    }
    if (score > bestScore) {
      bestScore = score;
      bestClass = key;
    }
  }
  const qmraClass = QMRA_CLASSIFICATIONS[bestClass];

  // 2. Determine Feedback Type
  let bestFeedback = "bug"; // default to bug for problem reports
  let bestFeedbackScore = 0;
  for (const [key, config] of Object.entries(FEEDBACK_TYPES)) {
    let score = 0;
    for (const kw of config.keywords) {
      if (lower.includes(kw)) score += kw.length;
    }
    if (score > bestFeedbackScore) {
      bestFeedbackScore = score;
      bestFeedback = key;
    }
  }
  const feedbackType = FEEDBACK_TYPES[bestFeedback];

  // 3. Determine if CAPA/Vigilance label is needed
  const needsCapa = qmraClass.isSerious;

  return {
    qmra: qmraClass,
    feedbackType,
    needsCapa,
    priority: qmraClass.priority,
    // Labels to attach
    labelNames: [
      feedbackType.linearLabel,
      qmraClass.linearLabel,
      ...(needsCapa ? [CAPA_VIGILANCE_LABEL] : []),
    ],
  };
}

// Simple German → English translation via keyword replacement for ticket context
function translateToEnglish(text) {
  const translations = {
    "app abstürzt": "app crashes",
    "app stürzt ab": "app crashes",
    "einfriert": "freezes",
    "funktioniert nicht": "not working",
    "geht nicht": "not working",
    "startet nicht": "won't start",
    "laden nicht": "won't load",
    "langsam": "slow",
    "fehler": "error",
    "fehlermeldung": "error message",
    "bildschirm": "screen",
    "schwarz": "black",
    "weiß": "white",
    "übung": "exercise",
    "übungen": "exercises",
    "einloggen": "login",
    "passwort": "password",
    "daten": "data",
    "verloren": "lost",
    "gespeichert": "saved",
    "internet": "internet",
    "verbindung": "connection",
    "aktualisieren": "update",
    "installieren": "install",
    "neu starten": "restart",
    "schließen": "close",
    "öffnen": "open",
    "kein ton": "no sound",
    "ton": "sound",
    "lautsprecher": "speaker",
    "zahlung": "payment",
    "bezahlung": "payment",
    "abo": "subscription",
    "kündigen": "cancel",
    "fortschritt": "progress",
    "dashboard": "dashboard",
    "einstellungen": "settings",
    "therapieplan": "therapy plan",
    "bei einer übung": "during an exercise",
    "beim einloggen": "during login",
    "im dashboard": "in the dashboard",
    "immer": "always",
    "manchmal": "sometimes",
    "nach dem update": "after the update",
    "seit heute": "since today",
    "seit gestern": "since yesterday",
    "schon länger": "for a while now",
  };

  let result = text;
  // Sort by length (longest first) to avoid partial replacements
  const sorted = Object.entries(translations).sort((a, b) => b[0].length - a[0].length);
  for (const [de, en] of sorted) {
    // Use word boundaries for short words to avoid partial matches (e.g. "ton" in "Toni")
    const pattern = de.length <= 4 ? `\\b${de}\\b` : de;
    result = result.replace(new RegExp(pattern, "gi"), en);
  }
  return result;
}

async function getLinearTeamId() {
  // First check env var
  if (process.env.LINEAR_TEAM_ID) return process.env.LINEAR_TEAM_ID;

  // Try to query (requires read scope on the API key)
  try {
    const query = `query { teams { nodes { id name key } } }`;
    const res = await fetch(LINEAR_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: LINEAR_API_KEY,
      },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    if (data.errors) {
      console.warn("Linear read scope not available. Set LINEAR_TEAM_ID env var with the TON team UUID.");
      return null;
    }
    const team = data.data?.teams?.nodes?.find((t) => t.key === "TON");
    return team?.id || null;
  } catch (err) {
    console.warn("Could not query Linear teams:", err.message);
    return null;
  }
}

// Cache team ID and label IDs
let cachedTeamId = null;
const cachedLabelIds = {}; // { labelName: labelId }

// Find or create a label in Linear
async function getOrCreateLabel(name, color) {
  if (cachedLabelIds[name]) return cachedLabelIds[name];

  // Try to find existing labels first
  try {
    const query = `query { issueLabels(filter: { name: { eq: "${name}" } }) { nodes { id name } } }`;
    const res = await fetch(LINEAR_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: LINEAR_API_KEY },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    const existing = data.data?.issueLabels?.nodes?.[0];
    if (existing) {
      cachedLabelIds[name] = existing.id;
      return existing.id;
    }
  } catch (e) {
    // Read scope may not be available, continue to create
  }

  // Create the label
  const teamId = cachedTeamId || await getLinearTeamId();
  const mutation = `
    mutation CreateLabel($input: IssueLabelCreateInput!) {
      issueLabelCreate(input: $input) {
        success
        issueLabel { id name }
      }
    }
  `;
  const variables = {
    input: {
      name,
      color: color || "#3949F5",
      teamId,
    },
  };

  const res = await fetch(LINEAR_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: LINEAR_API_KEY },
    body: JSON.stringify({ query: mutation, variables }),
  });
  const data = await res.json();
  if (data.errors) {
    console.warn(`Could not create label "${name}":`, data.errors[0].message);
    return null;
  }
  const labelId = data.data?.issueLabelCreate?.issueLabel?.id;
  if (labelId) cachedLabelIds[name] = labelId;
  return labelId;
}

// Label color map
const LABEL_COLORS = {
  "External Bug": "#E8345A",
  "External Suggestion": "#3949F5",
  "External Feedback": "#5B6BF7",
  "[QMRA] Serious: Safety-relevant": "#C02040",
  "[QMRA] Serious: Others": "#E8345A",
  "[QMRA] Moderate": "#F59E0B",
  "[QMRA] Minor": "#3B82F6",
  "[QMRA] Marginal": "#9CA3AF",
  "[QMRA] CAPA/Vigilance": "#7C3AED",
};

async function createLinearTicket({ title, description, priority, labelNames }) {
  if (!LINEAR_API_KEY) throw new Error("LINEAR_API_KEY not configured");

  if (!cachedTeamId) {
    cachedTeamId = await getLinearTeamId();
  }
  if (!cachedTeamId) throw new Error("LINEAR_TEAM_ID not configured. Go to Linear > Settings > Teams > TON and copy the team UUID from the URL, then add LINEAR_TEAM_ID=<uuid> to .env");

  // Resolve all label IDs
  const labelIds = [];
  if (labelNames && labelNames.length > 0) {
    for (const name of labelNames) {
      const labelId = await getOrCreateLabel(name, LABEL_COLORS[name]);
      if (labelId) labelIds.push(labelId);
    }
  }

  const mutation = `
    mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          url
        }
      }
    }
  `;

  const variables = {
    input: {
      teamId: cachedTeamId,
      title,
      description,
      priority: priority || 3,
      ...(labelIds.length > 0 ? { labelIds } : {}),
    },
  };

  const res = await fetch(LINEAR_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: LINEAR_API_KEY,
    },
    body: JSON.stringify({ query: mutation, variables }),
  });

  const data = await res.json();
  if (data.errors) throw new Error(data.errors[0].message);
  return data.data?.issueCreate?.issue;
}

// =============================================
// ROUTES
// =============================================

// Speech-to-text transcription via ElevenLabs
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file' });

    const audioBlob = new Blob([req.file.buffer], { type: req.file.mimetype });
    const audioFile = new File([audioBlob], 'recording.webm', { type: req.file.mimetype });

    const result = await elevenlabs.speechToText.convert({
      file: audioFile,
      modelId: 'scribe_v2',
      // Don't force language — let scribe auto-detect so users can speak any language
    });

    // Normalize "Tony" → "Toni" (common STT misinterpretation)
    const text = (result.text || '').replace(/\bTony\b/gi, 'Toni');
    const detectedLang = result.language_code || '';
    res.json({ text, detectedLang });
  } catch (err) {
    console.error('Transcription error:', err.message);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

// List available voices
app.get("/api/voices", (req, res) => {
  const list = Object.entries(VOICES).map(([key, v]) => ({ key, name: v.name }));
  res.json(list);
});

// Get a signed conversation URL
app.get("/api/conversation-url", async (req, res) => {
  try {
    const conversation =
      await elevenlabs.conversationalAi.conversations.getSignedUrl({
        agentId: AGENT_ID,
      });
    res.json({ signedUrl: conversation.signedUrl });
  } catch (err) {
    console.error("Error getting signed URL:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Text chat endpoint — generate response + TTS audio
const chatHistory = [];

// Detect if a message is German or English based on common words
function detectMessageLang(message, fallback = 'de') {
  const lower = message.toLowerCase();
  const deWords = ['ich', 'die', 'der', 'das', 'und', 'ist', 'nicht', 'ein', 'eine', 'mir', 'mich', 'hab', 'habe', 'kann', 'geht', 'bei', 'mein', 'meine', 'auch', 'noch', 'app', 'wie', 'was', 'wann', 'warum', 'funktioniert', 'problem', 'hilfe', 'bitte', 'danke', 'übung', 'hallo', 'guten', 'morgen', 'tag'];
  const enWords = ['the', 'is', 'are', 'was', 'have', 'has', 'not', 'my', 'can', 'how', 'what', 'when', 'why', 'with', 'this', 'that', 'help', 'please', 'thank', 'hello', 'problem', 'does', 'work', 'working'];

  const words = lower.split(/\s+/);
  let deScore = 0, enScore = 0;
  for (const w of words) {
    if (deWords.includes(w)) deScore++;
    if (enWords.includes(w)) enScore++;
  }
  // Also check for German-specific characters
  if (/[äöüß]/.test(lower)) deScore += 2;

  if (deScore > enScore) return 'de';
  if (enScore > deScore) return 'en';
  return fallback;
}

// ── Issue insights endpoint (for monitoring what Toni has learned) ──
app.get("/api/issues/insights", (req, res) => {
  const cutoff = Date.now() - TRENDING_WINDOW_MS;
  const recent = reportedIssues.filter(i => i.timestamp > cutoff);

  const categoryCounts = {};
  for (const issue of recent) {
    categoryCounts[issue.category] = (categoryCounts[issue.category] || 0) + 1;
  }

  const trending = getTrendingIssues();
  const byEntrypoint = getEntrypointInsights();

  res.json({
    totalReported: reportedIssues.length,
    recentCount: recent.length,
    windowDays: 7,
    categoryCounts,
    trending,
    byEntrypoint,
    recentIssues: recent.slice(-20).reverse().map(i => ({
      category: i.category,
      entrypoint: i.entrypoint || 'unknown',
      message: i.message,
      keywords: i.keywords,
      time: new Date(i.timestamp).toISOString(),
    })),
  });
});

// ── Seed endpoint: populate dashboard with realistic issue data ──
app.post("/api/issues/seed", (req, res) => {
  const force = req.query.force === 'true';
  if (reportedIssues.length > 0 && !force) {
    return res.json({ message: `Already have ${reportedIssues.length} issues. Use ?force=true to add more.`, count: reportedIssues.length });
  }

  const now = Date.now();
  const DAY = 86400000;
  const seedData = [
    // ── Crash issues (various entrypoints) ──
    { msg: "App stürzt ab beim Öffnen einer Übung", cat: "crash", ep: "exercise", daysAgo: 1 },
    { msg: "App crashed nach dem Login", cat: "crash", ep: "login", daysAgo: 2 },
    { msg: "Froschübung - App schließt sich einfach", cat: "crash", ep: "exercise", daysAgo: 2 },
    { msg: "App friert ein im Dashboard", cat: "crash", ep: "dashboard", daysAgo: 3 },
    { msg: "App stürzt immer ab bei der Aussprache-Übung", cat: "crash", ep: "exercise", daysAgo: 4 },
    { msg: "Absturz nach App-Update", cat: "crash", ep: "dashboard", daysAgo: 5 },
    { msg: "App crashes when starting exercise", cat: "crash", ep: "exercise", daysAgo: 6 },
    // ── Exercise issues ──
    { msg: "Übung reagiert nicht auf Eingabe", cat: "exercise", ep: "exercise", daysAgo: 1 },
    { msg: "Übung lädt nicht - bleibt beim Ladebildschirm", cat: "exercise", ep: "exercise", daysAgo: 1 },
    { msg: "Froschübung funktioniert nicht richtig", cat: "exercise", ep: "exercise", daysAgo: 2 },
    { msg: "Aufgabe wird nicht als abgeschlossen markiert", cat: "exercise", ep: "exercise", daysAgo: 3 },
    { msg: "Alle Übungen zeigen leeren Bildschirm", cat: "exercise", ep: "exercise", daysAgo: 3 },
    { msg: "Exercise not responding to touch input", cat: "exercise", ep: "exercise", daysAgo: 4 },
    { msg: "Schwierigkeitsstufe passt sich nicht an", cat: "exercise", ep: "exercise", daysAgo: 5 },
    { msg: "Übung startet nicht nach Auswahl", cat: "exercise", ep: "exercise", daysAgo: 6 },
    // ── Login issues ──
    { msg: "Kann mich nicht einloggen - Passwort wird nicht akzeptiert", cat: "login", ep: "login", daysAgo: 1 },
    { msg: "Login-Seite lädt nicht", cat: "login", ep: "login", daysAgo: 2 },
    { msg: "Zugangscode funktioniert nicht", cat: "login", ep: "login", daysAgo: 3 },
    { msg: "Nach Passwort-Reset geht Login immer noch nicht", cat: "login", ep: "login", daysAgo: 4 },
    { msg: "Login page keeps loading forever", cat: "login", ep: "login", daysAgo: 5 },
    // ── Audio issues ──
    { msg: "Kein Ton bei den Übungen", cat: "audio", ep: "exercise", daysAgo: 1 },
    { msg: "Audio-Anleitung spielt nicht ab", cat: "audio", ep: "exercise", daysAgo: 3 },
    { msg: "Mikrofon wird nicht erkannt in der Übung", cat: "audio", ep: "exercise", daysAgo: 4 },
    { msg: "Sound cuts out during exercise", cat: "audio", ep: "exercise", daysAgo: 6 },
    // ── Performance issues ──
    { msg: "App ist extrem langsam", cat: "performance", ep: "dashboard", daysAgo: 2 },
    { msg: "Übungen laden sehr lange", cat: "performance", ep: "exercise", daysAgo: 3 },
    { msg: "Dashboard braucht ewig zum Laden", cat: "performance", ep: "dashboard", daysAgo: 5 },
    // ── Display issues ──
    { msg: "Bildschirm wird schwarz nach Übungsstart", cat: "display", ep: "exercise", daysAgo: 1 },
    { msg: "Layout verschoben auf iPad", cat: "display", ep: "dashboard", daysAgo: 4 },
    { msg: "Text wird abgeschnitten in der Übung", cat: "display", ep: "exercise", daysAgo: 5 },
    // ── Data/sync issues ──
    { msg: "Fortschritte wurden nicht gespeichert", cat: "data", ep: "dashboard", daysAgo: 2 },
    { msg: "Übungsergebnisse fehlen nach Sync", cat: "data", ep: "dashboard", daysAgo: 3 },
    { msg: "Daten weg nach Geräte-Wechsel", cat: "data", ep: "settings", daysAgo: 6 },
    // ── Payment issues ──
    { msg: "Zahlung fehlgeschlagen im App Store", cat: "payment", ep: "settings", daysAgo: 3 },
    { msg: "Abo wird nicht erkannt nach Kauf", cat: "payment", ep: "settings", daysAgo: 5 },
    // ── Older issues (8-30 days ago, outside trending window) ──
    { msg: "App stürzt ab bei jeder Übung", cat: "crash", ep: "exercise", daysAgo: 10 },
    { msg: "Login geht seit Wochen nicht", cat: "login", ep: "login", daysAgo: 12 },
    { msg: "Übungen laden nicht mehr", cat: "exercise", ep: "exercise", daysAgo: 14 },
    { msg: "Daten verloren nach Update", cat: "data", ep: "dashboard", daysAgo: 15 },
    { msg: "Audio funktioniert nicht", cat: "audio", ep: "exercise", daysAgo: 18 },
    { msg: "App ist unerträglich langsam", cat: "performance", ep: "dashboard", daysAgo: 20 },
    { msg: "Schwarzer Bildschirm nach Start", cat: "display", ep: "exercise", daysAgo: 22 },
    { msg: "Passwort-Reset E-Mail kommt nicht an", cat: "login", ep: "login", daysAgo: 25 },
    { msg: "Abo-Zahlung doppelt abgebucht", cat: "payment", ep: "settings", daysAgo: 28 },
    { msg: "Übung friert mittendrin ein", cat: "exercise", ep: "exercise", daysAgo: 30 },
  ];

  for (const item of seedData) {
    const keywords = item.msg.toLowerCase().replace(/[?!.,;:()-]/g, '').split(/\s+/).filter(w => w.length > 2);
    reportedIssues.push({
      timestamp: now - (item.daysAgo * DAY) + Math.floor(Math.random() * DAY * 0.5), // slight randomness
      message: item.msg,
      keywords,
      category: item.cat,
      entrypoint: item.ep,
      source: 'seed',
    });
  }

  saveIssues();

  // Also seed conversation stats if empty
  if (conversationStats.totalConversations === 0 || force) {
    const now = Date.now();
    const DAY = 86400000;
    conversationStats = {
      totalConversations: 128,
      resolvedByToni: 89,
      escalatedToTickets: 14,
      outcomes: [
        // Recent resolved outcomes
        ...Array.from({length: 12}, (_, i) => ({ timestamp: now - (i * DAY * 0.5), outcome: 'resolved', category: ['exercise','login','audio','crash','display','performance'][i % 6] })),
        // Recent ticket outcomes
        ...Array.from({length: 4}, (_, i) => ({ timestamp: now - (i * DAY * 1.5), outcome: 'ticket', category: ['crash','exercise','login','data'][i] })),
      ],
    };
    saveStats();
  }

  res.json({ message: `Seeded ${seedData.length} issues`, count: reportedIssues.length });
});

// ── Stats endpoint for ROI metrics ──
app.get("/api/stats", (req, res) => {
  const { totalConversations, resolvedByToni, escalatedToTickets, outcomes } = conversationStats;
  const unresolved = totalConversations - resolvedByToni - escalatedToTickets;
  const resolutionRate = totalConversations > 0 ? Math.round((resolvedByToni / totalConversations) * 100) : 0;
  // Estimate: each resolved conversation saves ~10 min of support time
  const minutesSaved = resolvedByToni * 10;
  const hoursSaved = (minutesSaved / 60).toFixed(1);

  // Weekly trend (last 7 days)
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekOutcomes = (outcomes || []).filter(o => o.timestamp > weekAgo);
  const weekResolved = weekOutcomes.filter(o => o.outcome === 'resolved').length;
  const weekTickets = weekOutcomes.filter(o => o.outcome === 'ticket').length;

  res.json({
    totalConversations,
    resolvedByToni,
    escalatedToTickets,
    unresolved,
    resolutionRate,
    minutesSaved,
    hoursSaved,
    weekResolved,
    weekTickets,
  });
});

// ── Visual monitoring dashboard (braindays-inspired design) ──
app.get("/monitoring", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Toni — Issue Monitor</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #F8F9FC;
      --surface: #FFFFFF;
      --border: #E4E4EE;
      --border-light: #F0F0F8;
      --text: #1A1A2E;
      --text-muted: #5A5A72;
      --text-faint: #8E8EA0;
      --accent: #3949F5;
      --accent-light: #EEF0FF;
      --accent-dark: #2833AC;
      --green: #16A34A;
      --green-light: #ECFDF5;
      --red: #DC2626;
      --red-light: #FEF2F2;
      --orange: #D47B2E;
      --orange-light: #FFF7ED;
      --purple: #6B4C8A;
      --purple-light: #F5F0FF;
      --cyan: #0891B2;
      --cyan-light: #ECFEFF;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
    }

    /* ── Hero header ── */
    .hero {
      background: linear-gradient(135deg, #0a0e27 0%, #222C93 50%, #3949F5 100%);
      color: white;
      padding: 48px 40px 40px;
    }
    .hero-inner {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      gap: 24px;
    }
    .hero-avatar {
      width: 96px;
      height: 96px;
      border-radius: 50%;
      border: 3px solid rgba(255,255,255,0.2);
      flex-shrink: 0;
    }
    .hero h1 {
      font-family: 'DM Serif Display', serif;
      font-size: 36px;
      font-weight: 400;
      margin-bottom: 4px;
    }
    .hero p {
      font-size: 15px;
      opacity: 0.7;
    }
    .hero .updated {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      opacity: 0.5;
      margin-top: 6px;
    }

    /* ── Main content ── */
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 32px 40px 80px;
    }

    /* ── Section headings ── */
    .section-title {
      font-family: 'DM Serif Display', serif;
      font-size: 24px;
      font-weight: 400;
      color: var(--text);
      margin-bottom: 16px;
      margin-top: 32px;
    }

    /* ── Cards ── */
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      transition: box-shadow 0.2s ease, border-color 0.2s ease;
    }
    .card:hover {
      border-color: var(--accent);
      box-shadow: 0 4px 24px rgba(57,73,245,0.08);
    }
    .card-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-faint);
      margin-bottom: 10px;
    }
    .card-stat {
      font-family: 'DM Serif Display', serif;
      font-size: 42px;
      color: var(--text);
      line-height: 1;
    }
    .card-detail {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 6px;
    }

    /* ── ROI hero cards ── */
    .roi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-top: -56px;
      position: relative;
      z-index: 10;
    }
    .roi-card {
      padding: 28px 24px;
    }
    .roi-card.highlight {
      border-left: 5px solid var(--green);
    }
    .roi-card.highlight .card-stat { color: var(--green); }
    .roi-card.ticket { border-left: 5px solid var(--orange); }
    .roi-card.ticket .card-stat { color: var(--orange); }
    .roi-card.accent { border-left: 5px solid var(--accent); }
    .roi-card.accent .card-stat { color: var(--accent); }
    .roi-card.time { border-left: 5px solid var(--purple); }
    .roi-card.time .card-stat { color: var(--purple); }

    /* ── Progress bar (resolution rate) ── */
    .progress-wrap {
      margin-top: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .progress-track {
      flex: 1;
      height: 8px;
      background: var(--border-light);
      border-radius: 4px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      border-radius: 4px;
      background: linear-gradient(90deg, var(--green), #34D399);
      transition: width 1s cubic-bezier(.4,0,.2,1);
    }
    .progress-pct {
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
      font-weight: 600;
      color: var(--green);
      min-width: 40px;
    }

    /* ── Stats grid ── */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-top: 24px;
    }

    /* ── Two-column layout ── */
    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 16px;
    }

    /* ── Category bars ── */
    .bar-chart { margin-top: 8px; }
    .bar-row { display: flex; align-items: center; margin-bottom: 10px; gap: 12px; }
    .bar-label {
      width: 120px;
      font-size: 13px;
      font-weight: 500;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .bar-emoji { font-size: 16px; }
    .bar-track {
      flex: 1;
      height: 28px;
      background: var(--border-light);
      border-radius: 8px;
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      border-radius: 8px;
      display: flex;
      align-items: center;
      padding-left: 10px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: white;
      font-weight: 500;
      min-width: 32px;
      transition: width 0.8s cubic-bezier(.4,0,.2,1);
    }
    .bar-fill.cat-crash { background: linear-gradient(90deg, #DC2626, #EF4444); }
    .bar-fill.cat-login { background: linear-gradient(90deg, #D47B2E, #F59E0B); }
    .bar-fill.cat-exercise { background: linear-gradient(90deg, #3949F5, #6366F1); }
    .bar-fill.cat-audio { background: linear-gradient(90deg, #6B4C8A, #8B5CF6); }
    .bar-fill.cat-display { background: linear-gradient(90deg, #0891B2, #06B6D4); }
    .bar-fill.cat-performance { background: linear-gradient(90deg, #CA8A04, #EAB308); color: #1A1A2E; }
    .bar-fill.cat-payment { background: linear-gradient(90deg, #16A34A, #22C55E); }
    .bar-fill.cat-data { background: linear-gradient(90deg, #4338CA, #6366F1); }
    .bar-fill.cat-other { background: linear-gradient(90deg, #64748B, #94A3B8); }

    /* ── Entrypoints ── */
    .ep-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid var(--border-light);
    }
    .ep-row:last-child { border-bottom: none; }
    .ep-name { font-weight: 600; font-size: 14px; }
    .ep-count {
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
      font-weight: 600;
      color: var(--accent);
      background: var(--accent-light);
      padding: 4px 12px;
      border-radius: 20px;
    }
    .ep-cats { font-size: 12px; color: var(--text-faint); margin-top: 2px; }

    /* ── Trending badges ── */
    .trending-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--red-light);
      color: var(--red);
      padding: 4px 12px;
      border-radius: 20px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 500;
      margin: 4px 4px 4px 0;
    }
    .trending-badge.calm {
      background: var(--green-light);
      color: var(--green);
    }

    /* ── Issue list ── */
    .issue-list { max-height: 400px; overflow-y: auto; }
    .issue-item {
      padding: 14px 0;
      border-bottom: 1px solid var(--border-light);
    }
    .issue-item:last-child { border-bottom: none; }
    .issue-meta {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 6px;
    }
    .issue-cat {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      padding: 3px 10px;
      border-radius: 6px;
      background: var(--accent-light);
      color: var(--accent);
    }
    .issue-ep {
      font-size: 12px;
      color: var(--text-muted);
    }
    .issue-time {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--text-faint);
      margin-left: auto;
    }
    .issue-msg { font-size: 14px; color: var(--text-muted); line-height: 1.4; }

    /* ── Refresh button ── */
    .refresh-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--accent);
      color: white;
      border: none;
      padding: 14px 24px;
      border-radius: 28px;
      cursor: pointer;
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 8px 24px rgba(57,73,245,0.25);
      transition: all 0.2s ease;
    }
    .refresh-btn:hover {
      background: var(--accent-dark);
      transform: translateY(-1px);
      box-shadow: 0 12px 32px rgba(57,73,245,0.35);
    }

    .empty { color: var(--text-faint); font-style: italic; padding: 24px 0; }

    @media (max-width: 900px) {
      .roi-grid, .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .two-col { grid-template-columns: 1fr; }
      .hero { padding: 32px 20px 32px; }
      .container { padding: 24px 20px 80px; }
      .roi-grid { margin-top: -40px; }
    }
    @media (max-width: 500px) {
      .roi-grid, .stats-grid { grid-template-columns: 1fr; }
      .hero h1 { font-size: 28px; }
    }
  </style>
</head>
<body>

  <div class="hero">
    <div class="hero-inner">
      <img src="/toni-animated.gif" alt="Toni" class="hero-avatar">
      <div>
        <h1>Toni Issue Monitor</h1>
        <p>What Toni has learned from user conversations</p>
        <div class="updated" id="refresh-info"></div>
      </div>
    </div>
  </div>

  <div class="container">
    <!-- ROI metrics (overlapping hero) -->
    <div class="roi-grid" id="roi-grid"></div>

    <!-- Resolution rate bar -->
    <div class="card" style="margin-top:16px;" id="resolution-card"></div>

    <!-- Issue stats -->
    <h2 class="section-title">Issue Intelligence</h2>
    <div class="stats-grid" id="stats-grid"></div>

    <!-- Category + Entrypoint breakdown -->
    <div class="two-col" style="margin-top:24px;">
      <div class="card">
        <div class="card-label">Issues by Category</div>
        <div class="bar-chart" id="category-bars"></div>
      </div>
      <div class="card">
        <div class="card-label">Issues by App Screen</div>
        <div id="entrypoint-list"></div>
      </div>
    </div>

    <!-- Recent reports -->
    <h2 class="section-title">Recent Reports</h2>
    <div class="card" style="margin-top:8px;">
      <div class="issue-list" id="issue-list"></div>
    </div>
  </div>

  <button class="refresh-btn" onclick="loadData()">Refresh</button>

  <script>
    const CATEGORY_EMOJI = {
      crash: '\u{1F4A5}', exercise: '\u{1F3CB}', login: '\u{1F510}', audio: '\u{1F50A}',
      display: '\u{1F4F1}', performance: '\u{26A1}', payment: '\u{1F4B3}', data: '\u{1F4BE}', other: '\u{2753}'
    };
    const CATEGORY_LABEL = {
      crash: 'Crash', exercise: 'Exercise', login: 'Login', audio: 'Audio',
      display: 'Display', performance: 'Speed', payment: 'Payment', data: 'Data', other: 'Other'
    };

    let autoRefreshInterval;

    async function loadData() {
      try {
        const [issueRes, statsRes] = await Promise.all([
          fetch('/api/issues/insights'),
          fetch('/api/stats'),
        ]);
        const issues = await issueRes.json();
        const stats = await statsRes.json();
        renderROI(stats);
        renderResolutionBar(stats);
        renderStats(issues, stats);
        renderCategories(issues);
        renderEntrypoints(issues);
        renderIssues(issues);
        document.getElementById('refresh-info').textContent = 'Updated ' + new Date().toLocaleTimeString();
      } catch (e) {
        console.error('Failed to load data:', e);
      }
    }

    function renderROI(s) {
      document.getElementById('roi-grid').innerHTML = \`
        <div class="card roi-card accent">
          <div class="card-label">Conversations</div>
          <div class="card-stat">\${s.totalConversations}</div>
          <div class="card-detail">Total handled by Toni</div>
        </div>
        <div class="card roi-card highlight">
          <div class="card-label">Resolved by Toni</div>
          <div class="card-stat">\${s.resolvedByToni}</div>
          <div class="card-detail">\${s.resolutionRate}% resolution rate</div>
        </div>
        <div class="card roi-card ticket">
          <div class="card-label">Tickets Created</div>
          <div class="card-stat">\${s.escalatedToTickets}</div>
          <div class="card-detail">\${s.weekTickets} this week</div>
        </div>
        <div class="card roi-card time">
          <div class="card-label">Time Saved</div>
          <div class="card-stat">\${s.hoursSaved}h</div>
          <div class="card-detail">~10 min per resolved conversation</div>
        </div>
      \`;
    }

    function renderResolutionBar(s) {
      const pct = s.resolutionRate || 0;
      document.getElementById('resolution-card').innerHTML = \`
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div class="card-label">Toni Resolution Rate</div>
            <div style="font-size:14px;color:var(--text-muted);">
              \${s.resolvedByToni} of \${s.totalConversations} conversations resolved without a ticket
            </div>
          </div>
          <div class="progress-pct">\${pct}%</div>
        </div>
        <div class="progress-wrap">
          <div class="progress-track">
            <div class="progress-fill" style="width: \${pct}%"></div>
          </div>
        </div>
      \`;
    }

    function renderStats(data, stats) {
      const trendingCount = Object.keys(data.trending || {}).length;
      document.getElementById('stats-grid').innerHTML = \`
        <div class="card">
          <div class="card-label">Total Reports</div>
          <div class="card-stat">\${data.totalReported}</div>
          <div class="card-detail">All time issues tracked</div>
        </div>
        <div class="card">
          <div class="card-label">Last 7 Days</div>
          <div class="card-stat">\${data.recentCount}</div>
          <div class="card-detail">Recent reports</div>
        </div>
        <div class="card">
          <div class="card-label">Trending Issues</div>
          <div class="card-stat">\${trendingCount}</div>
          <div class="card-detail">\${trendingCount > 0
            ? Object.keys(data.trending).map(k =>
                '<span class="trending-badge">' + (CATEGORY_EMOJI[k]||'') + ' ' + (CATEGORY_LABEL[k]||k) + ' (' + data.trending[k] + ')</span>'
              ).join('')
            : '<span class="trending-badge calm">All calm</span>'
          }</div>
        </div>
        <div class="card">
          <div class="card-label">App Screens</div>
          <div class="card-stat">\${Object.keys(data.byEntrypoint || {}).length}</div>
          <div class="card-detail">Unique entrypoints affected</div>
        </div>
      \`;
    }

    function renderCategories(data) {
      const cats = data.categoryCounts || {};
      const maxCount = Math.max(...Object.values(cats), 1);
      const container = document.getElementById('category-bars');
      if (Object.keys(cats).length === 0) {
        container.innerHTML = '<div class="empty">No issues reported yet</div>';
        return;
      }
      const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
      container.innerHTML = sorted.map(([cat, count]) => \`
        <div class="bar-row">
          <span class="bar-label"><span class="bar-emoji">\${CATEGORY_EMOJI[cat] || ''}</span> \${CATEGORY_LABEL[cat] || cat}</span>
          <div class="bar-track">
            <div class="bar-fill cat-\${cat}" style="width: \${(count / maxCount) * 100}%">\${count}</div>
          </div>
        </div>
      \`).join('');
    }

    function renderEntrypoints(data) {
      const eps = data.byEntrypoint || {};
      const container = document.getElementById('entrypoint-list');
      if (Object.keys(eps).length === 0) {
        container.innerHTML = '<div class="empty">No entrypoint data yet</div>';
        return;
      }
      const sorted = Object.entries(eps).sort((a, b) => b[1].total - a[1].total);
      container.innerHTML = sorted.map(([ep, info]) => {
        const topCats = Object.entries(info.categories).sort((a, b) => b[1] - a[1]).slice(0, 3)
          .map(([c, n]) => (CATEGORY_EMOJI[c]||'') + ' ' + (CATEGORY_LABEL[c]||c) + ': ' + n).join(', ');
        return \`
          <div class="ep-row">
            <div>
              <span class="ep-name">\${ep}</span>
              <div class="ep-cats">\${topCats}</div>
            </div>
            <span class="ep-count">\${info.total}</span>
          </div>
        \`;
      }).join('');
    }

    function renderIssues(data) {
      const issues = data.recentIssues || [];
      const container = document.getElementById('issue-list');
      if (issues.length === 0) {
        container.innerHTML = '<div class="empty">No recent issues</div>';
        return;
      }
      container.innerHTML = issues.map(i => \`
        <div class="issue-item">
          <div class="issue-meta">
            <span class="issue-cat">\${CATEGORY_EMOJI[i.category] || ''} \${CATEGORY_LABEL[i.category] || i.category}</span>
            <span class="issue-ep">\${i.entrypoint}</span>
            <span class="issue-time">\${new Date(i.time).toLocaleString()}</span>
          </div>
          <div class="issue-msg">\${i.message}</div>
        </div>
      \`).join('');
    }

    loadData();
    autoRefreshInterval = setInterval(loadData, 30000);
  </script>
</body>
</html>`);
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, voiceKey = "bella", lang: clientLang = "de", entrypoint = null } = req.body;
    if (!message) return res.status(400).json({ error: "message required" });

    // Detect language from message content (override browser locale)
    const lang = detectMessageLang(message, clientLang);

    const voice = VOICES[voiceKey] || VOICES.bella;

    chatHistory.push({ role: "user", content: message });
    if (chatHistory.length > 20) chatHistory.splice(0, 2);

    // Track conversation start (first user message = new conversation)
    const userMsgCount = chatHistory.filter(m => m.role === 'user').length;
    if (userMsgCount === 1) {
      recordConversation();
    }

    // Record issue for learning (only after first exchange, skip greetings)
    if (userMsgCount >= 2 && message.length > 10) {
      recordIssue(message, null, entrypoint);
    }

    // Detect resolution keywords — user says the problem is solved
    const lowerMsg = message.toLowerCase();
    const resolutionPhrases = ['hat funktioniert', 'hat geholfen', 'funktioniert jetzt', 'alles gut', 'gelöst', 'that worked', 'solved', 'thanks that helped', 'problem fixed'];
    if (resolutionPhrases.some(p => lowerMsg.includes(p))) {
      recordOutcome('resolved');
    }

    const result = generateToniResponse(message, lang, entrypoint);
    // Ensure "Toni" is always spelled correctly (never "Tony")
    result.text = result.text.replace(/\bTony\b/gi, 'Toni');
    chatHistory.push({ role: "assistant", content: result.text });

    // Convert response to speech
    const audioStream = await elevenlabs.textToSpeech.convert(voice.id, {
      text: result.text,
      modelId: "eleven_flash_v2_5",
    });

    const chunks = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    res.json({
      response: result.text,
      followUps: result.followUps,
      createTicket: result.createTicket || false,
      audio: audioBuffer.toString("base64"),
      contentType: "audio/mpeg",
    });
  } catch (err) {
    console.error("Chat error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Create a Linear ticket from chat conversation
app.post("/api/create-ticket", async (req, res) => {
  try {
    const { conversation, deviceContext, area } = req.body;
    if (!conversation || conversation.length === 0)
      return res.status(400).json({ error: "conversation required" });

    // Extract user messages for analysis
    const userMessages = conversation.filter((m) => m.role === "user");
    const userTexts = userMessages.map((m) => m.text);

    // Build topic from first meaningful user message
    const firstUserMsg = userMessages[0]?.text || "User-reported issue";
    const topicEn = translateToEnglish(firstUserMsg);
    const title = `[Toni] ${topicEn.slice(0, 80)}`;

    // Classify the ticket (multi-label)
    const allUserText = userTexts.join(" ");
    const classification = classifyTicket(allUserText);

    // Map classification to priority label
    const priorityLabels = { 1: "Urgent (1)", 2: "High (2)", 3: "Medium (3)", 4: "Low (4)" };
    const priorityLabel = priorityLabels[classification.priority] || "Medium (3)";

    // Extract structured info from user messages
    const whatHappens = userTexts.length > 1 ? translateToEnglish(userTexts.slice(1).join(". ")) : translateToEnglish(userTexts[0] || "");
    const topic = translateToEnglish(firstUserMsg);

    // Build the full conversation transcript translated to English
    // Keep "Toni" as "Toni" (not translated)
    const conversationTranslated = conversation
      .map((m) => {
        const speaker = m.role === "user" ? "User" : "Toni";
        const translated = translateToEnglish(m.text);
        return `${speaker}: ${translated}`;
      })
      .join("\n");

    // Patient info from device context
    const userId = deviceContext?.userId || "Unknown";
    const userType = deviceContext?.userType || "Patient";
    const organization = deviceContext?.organization || "Unknown";

    const description = `**Reported by:** ${userType} (via Toni Chatbot)

**Patient/User ID:** ${userId}
**Organization:** ${organization}
**Topic:** ${topic}

## Description

${whatHappens}

## QMRA Classification

**Feedback Type:** ${classification.feedbackType.label}
**Problem Classification:** ${classification.qmra.label}
**Priority:** ${priorityLabel}${classification.needsCapa ? '\n**⚠️ CAPA/Vigilance:** Required (Serious issue)' : ''}

## Collected Information

- **Area:** ${area || "Not specified"}
- **What happens:** ${whatHappens}
- **Platform:** ${deviceContext?.platform || "Unknown"}
- **Device:** ${deviceContext?.device || "Unknown"}
- **App Version:** ${deviceContext?.app || deviceContext?.appVersion || "Unknown"}
- **OS Version:** ${deviceContext?.osVersion || "Unknown"}
- **Locale:** ${deviceContext?.locale || "Unknown"}
- **Environment:** ${deviceContext?.environment || "Unknown"}

## Full Conversation (translated to English)

\`\`\`
${conversationTranslated}
\`\`\`

---
*Automatically created by Toni Support Bot*`;

    const issue = await createLinearTicket({
      title,
      description,
      priority: classification.priority,
      labelNames: classification.labelNames,
    });

    // Track ticket creation for ROI metrics
    const ticketCategory = classifyTicket(allUserText)?.feedbackType?.label || 'other';
    recordOutcome('ticket', ticketCategory);

    res.json({
      success: true,
      ticketId: issue?.identifier,
      ticketUrl: issue?.url,
    });
  } catch (err) {
    console.error("Ticket creation error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Text-to-speech only (no chat logic) — for welcome message etc.
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voiceKey = "bella" } = req.body;
    if (!text) return res.status(400).json({ error: "text required" });

    const voice = VOICES[voiceKey] || VOICES.bella;
    const audioStream = await elevenlabs.textToSpeech.convert(voice.id, {
      text,
      modelId: "eleven_flash_v2_5",
    });

    const chunks = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    res.json({
      audio: audioBuffer.toString("base64"),
      contentType: "audio/mpeg",
    });
  } catch (err) {
    console.error("TTS error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Serve static files (no cache for HTML to ensure fresh deploys)
app.use(express.static(__dirname, {
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Toni server running at http://localhost:${PORT}`);
  console.log(`Using agent: ${AGENT_ID}`);
});
