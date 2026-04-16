import "dotenv/config";
import express from "express";
import multer from "multer";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
const FAQ_ENTRIES = [
  // ── TROUBLESHOOTING: App Issues ──
  { q: "app abstürzt absturz crash crashes freezes einfriert",
    a: "Das tut mir leid! Versuche bitte folgende Schritte: Schließe die App komplett und öffne sie erneut. Falls das nicht hilft, prüfe im App Store ob ein Update verfügbar ist.",
    a_en: "I'm sorry about that! Please try these steps: Close the app completely and reopen it. If that doesn't help, check the App Store for an update.",
    followUps: ["App neu installieren", "Immer noch Probleme", "Problem melden"],
    followUps_en: ["Reinstall app", "Still having problems", "Report problem"] },
  { q: "app langsam slow laden lange dauert",
    a: "Wenn die App langsam ist, hilft es oft die App zu schließen und neu zu starten. Prüfe auch deine Internetverbindung — am besten funktioniert es über WLAN!",
    a_en: "When the app is slow, it often helps to close and restart it. Also check your internet connection — WiFi works best!",
    followUps: ["App neu starten hat geholfen", "Immer noch langsam", "Übungen laden nicht"],
    followUps_en: ["Restarting helped", "Still slow", "Exercises won't load"] },
  { q: "app neu installieren neuinstallation reinstall",
    a: "Du kannst die App sicher deinstallieren und neu aus dem App Store laden. Keine Sorge — deine Daten und Fortschritte bleiben gespeichert, da sie mit deinem Konto verknüpft sind!",
    a_en: "You can safely uninstall and reinstall from the App Store. Don't worry — your data and progress are saved with your account!",
    followUps: ["Daten wirklich sicher?", "Wie melde ich mich wieder an?", "Problem melden"],
    followUps_en: ["Is my data safe?", "How do I log back in?", "Report problem"] },
  { q: "app funktioniert nicht geht nicht startet nicht",
    a: "Versuche bitte diese Schritte: Erstens, schließe die App komplett und starte sie neu. Zweitens, prüfe ob du die neueste Version hast. Drittens, starte dein Gerät einmal neu.",
    a_en: "Please try these steps: First, close the app completely and restart it. Second, check if you have the latest version. Third, restart your device.",
    followUps: ["Hat funktioniert!", "Problem besteht weiter", "App neu installieren"],
    followUps_en: ["That worked!", "Problem continues", "Reinstall app"] },
  { q: "update aktualisieren neue version",
    a: "Gehe in den App Store, suche nach meiReha und tippe auf 'Aktualisieren'. Automatische Updates kannst du in deinen Geräte-Einstellungen aktivieren!",
    a_en: "Go to the App Store, search for myReha and tap 'Update'. You can enable automatic updates in your device settings!",
    followUps: ["Kein Update verfügbar", "Nach Update geht nichts mehr", "Problem melden"],
    followUps_en: ["No update available", "Nothing works after update", "Report problem"] },
  { q: "bildschirm schwarz weiß display anzeige kaputt ui",
    a: "Versuche die App komplett zu schließen und neu zu öffnen. Falls der Bildschirm weiterhin nicht richtig angezeigt wird, prüfe ob ein App-Update verfügbar ist.",
    a_en: "Try closing the app completely and reopening it. If the display still isn't right, check if an app update is available.",
    followUps: ["App neu starten", "App aktualisieren", "Problem melden"],
    followUps_en: ["Restart app", "Update app", "Report problem"] },

  // ── TROUBLESHOOTING: Exercises ──
  { q: "übung starten geht nicht startet nicht exercise restart choose different",
    a: "Versuche die Übung zu schließen und neu zu starten. Gehe dazu zurück zum Dashboard und wähle die Übung erneut aus. Prüfe auch deine Internetverbindung!",
    a_en: "Try closing the exercise and restarting it. Go back to the dashboard and select the exercise again. Also check your internet connection!",
    followUps: ["Übung neu starten", "Andere Übung wählen", "Alle Übungen betroffen"],
    followUps_en: ["Restart exercise", "Choose different exercise", "All exercises affected"] },
  { q: "übung neu starten restart exercise neustarten",
    a: "Gehe zurück zum Dashboard, indem du oben links auf den Zurück-Pfeil tippst. Wähle dann die Übung erneut aus — sie startet von vorne!",
    a_en: "Go back to the dashboard by tapping the back arrow at the top left. Then select the exercise again — it'll start from the beginning!",
    followUps: ["Hat geklappt!", "Übung reagiert nicht", "Problem melden"],
    followUps_en: ["That worked!", "Exercise not responding", "Report problem"] },
  { q: "übungen laden nicht loading fehler exercises wont load",
    a: "Prüfe deine Internetverbindung und starte die App neu. Tipp: Schließe die App komplett über den App-Switcher und öffne sie erneut. Falls es weiterhin nicht klappt, könnte es ein Serverproblem sein.",
    a_en: "Check your internet connection and restart the app. Tip: Close the app completely via the app switcher and reopen it.",
    followUps: ["App neu starten", "Internet prüfen", "Problem melden"],
    followUps_en: ["Restart app", "Check internet", "Report problem"] },
  { q: "übung verstehe ich nicht anleitung schwer schwierig",
    a: "Kein Problem! Tippe auf das Fragezeichen-Symbol in der Übung — dort findest du eine Anleitung und oft auch ein Video. Du kannst auch deinen Therapeuten um Hilfe bitten.",
    a_en: "I don't understand the exercise — no problem! Tap the question mark icon in the exercise for instructions and often a video too.",
    followUps: ["Andere Übung wählen", "Schwierigkeit anpassen", "Therapeut kontaktieren"],
    followUps_en: ["Choose different exercise", "Adjust difficulty", "Contact therapist"] },
  { q: "übung zu schwer zu leicht schwierigkeit level",
    a: "Die App passt sich normalerweise automatisch an. Du kannst aber auch in den Einstellungen deinen Therapieplan anpassen oder deinen Therapeuten bitten, die Schwierigkeit zu ändern.",
    a_en: "The app normally adjusts automatically. But you can also adjust your therapy plan in settings or ask your therapist to change the difficulty.",
    followUps: ["Einstellungen öffnen", "Therapeut kontaktieren", "Wie funktioniert der Therapieplan?"],
    followUps_en: ["Open settings", "Contact therapist", "How does the therapy plan work?"] },
  { q: "ton audio sound hören lautsprecher übung kein ton",
    a: "Prüfe ob dein Gerät nicht auf stumm geschaltet ist und die Lautstärke hoch genug ist. Manche Übungen haben Audio-Anleitungen — stelle sicher, dass der Ton in der App aktiviert ist!",
    a_en: "Check if your device isn't on silent and the volume is high enough. Some exercises have audio instructions — make sure sound is enabled in the app!",
    followUps: ["Ton funktioniert jetzt", "Immer noch kein Ton", "Problem melden"],
    followUps_en: ["Sound works now", "Still no sound", "Report problem"] },

  // ── TROUBLESHOOTING: Login & Account ──
  { q: "einloggen login nicht möglich anmelden geht nicht",
    a: "Prüfe ob deine E-Mail-Adresse und dein Passwort korrekt sind. Tipp: Achte auf Groß- und Kleinschreibung! Du kannst das Passwort über 'Passwort vergessen?' zurücksetzen.",
    a_en: "Check if your email and password are correct. Tip: Watch for upper and lower case! You can reset your password via 'Forgot password?'.",
    followUps: ["Passwort zurücksetzen", "E-Mail-Adresse vergessen", "Problem melden"],
    followUps_en: ["Reset password", "Forgot email", "Report problem"] },
  { q: "passwort vergessen zurücksetzen reset password forgot",
    a: "Kein Problem! Tippe auf dem Login-Bildschirm auf 'Passwort vergessen?'. Du bekommst dann eine E-Mail mit einem Link zum Zurücksetzen. Prüfe auch deinen Spam-Ordner!",
    a_en: "No problem! Tap 'Forgot password?' on the login screen. You'll receive an email with a reset link. Also check your spam folder!",
    followUps: ["Keine E-Mail erhalten", "Spam-Ordner gecheckt", "Problem melden"],
    followUps_en: ["No email received", "Checked spam", "Report problem"] },
  { q: "email adresse vergessen welche email konto",
    a: "Deine E-Mail-Adresse findest du in der App unter Einstellungen > Mein Konto. Falls du nicht eingeloggt bist, frag bei deiner Klinik oder deinem Therapeuten nach — die haben deine Registrierungsdaten.",
    a_en: "You can find your email in the app under Settings > My Account. If you're not logged in, ask your clinic or therapist — they have your registration data.",
    followUps: ["Einstellungen öffnen", "Therapeut fragen", "Problem melden"],
    followUps_en: ["Open settings", "Ask therapist", "Report problem"] },
  { q: "registrieren anmelden neues konto erstellen",
    a: "Du kannst dich über E-Mail oder Einladungscode registrieren. Öffne die App und tippe auf 'Neuen Zugang erstellen'. Nach der Eingabe deiner Daten bekommst du eine Bestätigungs-Mail.",
    a_en: "You can register via email or invitation code. Open the app and tap 'Create new account'. After entering your data, you'll receive a confirmation email.",
    followUps: ["Bestätigungs-Mail nicht erhalten", "Einladungscode eingeben", "Was ist ein Einladungscode?"],
    followUps_en: ["No confirmation email", "Enter invitation code", "What's an invitation code?"] },
  { q: "zugangscode verloren einladungscode code",
    a: "Den Zugangscode kannst du bei deiner Klinik, deinem Therapeuten oder beim Support unter support@nyra.health erneut anfordern.",
    a_en: "You can request the access code again from your clinic, therapist, or support at support@nyra.health.",
    followUps: ["Problem melden", "Ohne Code registrieren", "Was ist ein Zugangscode?"],
    followUps_en: ["Report problem", "Register without code", "What's an access code?"] },
  { q: "zugangscode nicht erhalten bekommen",
    a: "Prüfe zuerst deinen Spam-Ordner! Falls du den Code dort nicht findest, frag bei deiner Klinik, Versicherung oder beim Support unter support@nyra.health nach.",
    a_en: "Check your spam folder first! If you can't find the code there, ask your clinic, insurance, or support at support@nyra.health.",
    followUps: ["Spam-Ordner gecheckt", "Problem melden", "Neue E-Mail anfordern"],
    followUps_en: ["Checked spam", "Report problem", "Request new email"] },

  // ── TROUBLESHOOTING: Settings & Navigation ──
  { q: "einstellungen settings finden wo",
    a: "Die Einstellungen findest du über das Zahnrad-Symbol oben rechts im Dashboard. Dort kannst du dein Profil, deine Benachrichtigungen und deinen Therapieplan verwalten.",
    a_en: "You'll find settings via the gear icon at the top right of the dashboard. There you can manage your profile, notifications, and therapy plan.",
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
    a: "Prüfe ob deine Internetverbindung stabil ist und starte die App neu. Deine Fortschritte werden automatisch gespeichert, sobald du wieder online bist. Falls weiterhin Daten fehlen, kontaktiere den Support.",
    a_en: "Check if your internet connection is stable and restart the app. Your progress is saved automatically once you're back online.",
    followUps: ["Internet prüfen", "App neu starten", "Problem melden"],
    followUps_en: ["Check internet", "Restart app", "Report problem"] },
  { q: "offline nutzen ohne internet",
    a: "Einige Inhalte sind offline verfügbar! Deine Fortschritte werden dann automatisch synchronisiert, sobald du wieder Internet hast.",
    a_en: "Some content is available offline! Your progress will sync automatically once you have internet again.",
    followUps: ["Welche Inhalte offline?", "Synchronisation klappt nicht", "Problem melden"],
    followUps_en: ["What content offline?", "Sync not working", "Report problem"] },
  { q: "fortschritt sehen ergebnis statistik",
    a: "Im Dashboard findest du den Fortschrittsbereich — dort siehst du deine absolvierten Übungen, deine Entwicklung über die Zeit und deine Erfolge!",
    a_en: "In the dashboard you'll find the progress section — there you can see your completed exercises, development over time, and achievements!",
    followUps: ["Wo ist das Dashboard?", "Fortschritte teilen", "Therapeut kontaktieren"],
    followUps_en: ["Where's the dashboard?", "Share progress", "Contact therapist"] },

  // ── TROUBLESHOOTING: Payment ──
  { q: "zahlung payment bezahlung fehlgeschlagen nicht geklappt",
    a: "Prüfe ob deine Zahlungsmethode im App Store aktuell ist. Gehe dazu in die Einstellungen deines Geräts > Apple-ID/Google-Konto > Zahlung. Bei weiteren Problemen hilft dir support@nyra.health.",
    a_en: "Check if your payment method in the App Store is up to date. Go to your device Settings > Apple ID/Google Account > Payment.",
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
    a: "myReha deckt alle Sprach- und Kognitionstherapie-Bereiche ab: Aussprache, Lesen, Schreiben, Sprachverständnis, Gedächtnis, logisches Denken, Planung, Rechnen, Aufmerksamkeit und Wahrnehmung.",
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
    a: "Deine Daten sind sicher! Sie werden anonym und ausschließlich für deinen persönlichen Übungsplan verwendet. Alles läuft über europäische Server mit höchsten Sicherheitsstandards — vollständig DSGVO-konform!",
    a_en: "Your data is safe! It's used anonymously and exclusively for your personal exercise plan. Everything runs on European servers with highest security standards — fully GDPR compliant!",
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
    a: "Das tut mir leid, dass es noch nicht klappt! Damit ich dir besser helfen kann: Kannst du mir beschreiben, was genau passiert? Zum Beispiel: Siehst du eine Fehlermeldung? Oder bleibt der Bildschirm einfach stehen?",
    a_en: "I'm sorry it's still not working! To help you better: Can you describe what exactly happens? For example: Do you see an error message? Or does the screen just freeze?",
    followUps: ["Fehlermeldung gesehen", "Bildschirm friert ein", "App schließt sich einfach", "Problem melden"],
    followUps_en: ["Saw error message", "Screen freezes", "App just closes", "Report problem"] },
  { q: "problem melden bug report fehler melden ticket report problem",
    a: "Ich erstelle gerne eine Meldung für unser Entwickler-Team! Beschreibe mir bitte kurz: Was hast du gemacht, als das Problem aufgetreten ist? Und was ist genau passiert?",
    a_en: "I'll gladly create a report for our development team! Please describe briefly: What were you doing when the problem occurred? And what exactly happened?",
    followUps: null,
    followUps_en: null,
    triggerReport: true },
  { q: "fehlermeldung error fehler angezeigt saw error message",
    a: "Danke für die Info! Weißt du noch, was in der Fehlermeldung stand? Auch nur ein Teil des Textes hilft unserem Team, das Problem schneller zu finden.",
    a_en: "Thanks for the info! Do you remember what the error message said? Even part of the text helps our team find the problem faster.",
    followUps: ["Ich weiß es nicht mehr", "Problem melden", "Nochmal versuchen"],
    followUps_en: ["I don't remember", "Report problem", "Try again"] },
  { q: "bildschirm friert ein hängt stuck frozen reagiert nicht screen freezes",
    a: "Das klingt nach einem Anzeigeproblem. Versuche bitte: Schließe die App komplett über den App-Switcher, warte ein paar Sekunden und öffne sie erneut. Bei welcher Funktion ist das passiert?",
    a_en: "That sounds like a display issue. Please try: Close the app completely via the app switcher, wait a few seconds, and reopen it. Which feature was this happening with?",
    followUps: ["Bei einer Übung", "Im Dashboard", "Gleich nach dem Start", "Problem melden"],
    followUps_en: ["During an exercise", "In the dashboard", "Right after launch", "Report problem"] },
  { q: "app schließt sich einfach von alleine beendet just closes itself",
    a: "Wenn die App sich unerwartet schließt, hilft oft ein Update. Prüfe im App Store, ob eine neue Version verfügbar ist. Passiert es bei einer bestimmten Übung oder zufällig?",
    a_en: "When the app closes unexpectedly, an update often helps. Check the App Store for a new version. Does it happen with a specific exercise or randomly?",
    followUps: ["Bei bestimmter Übung", "Passiert zufällig", "App aktualisieren", "Problem melden"],
    followUps_en: ["With specific exercise", "Happens randomly", "Update app", "Report problem"] },
  // ── Report flow: area-specific follow-ups ──
  { q: "bei einer übung übung problem during exercise",
    a: "Verstanden — das Problem tritt bei einer Übung auf. Kannst du mir noch sagen: Passiert es bei einer bestimmten Übung oder bei allen? Und siehst du eine Fehlermeldung?",
    a_en: "Got it — the problem occurs during an exercise. Can you tell me: Does it happen with a specific exercise or all of them? And do you see an error message?",
    followUps: null,
    followUps_en: null,
    triggerReport: true },
  { q: "beim einloggen login problem melden during login authentication",
    a: "OK, ein Login-Problem. Passiert das nach der Eingabe deiner Daten oder wird die Login-Seite gar nicht angezeigt?",
    a_en: "OK, a login problem. Does it happen after entering your credentials or does the login page not load at all?",
    followUps: null,
    followUps_en: null,
    triggerReport: true },
  { q: "im dashboard problem dashboard",
    a: "Alles klar — ein Problem im Dashboard. Kannst du beschreiben, was du dort siehst oder was nicht funktioniert?",
    a_en: "Alright — a problem in the dashboard. Can you describe what you see there or what's not working?",
    followUps: null,
    followUps_en: null,
    triggerReport: true },
  { q: "woanders anderes problem anderer bereich",
    a: "OK! Beschreibe mir bitte kurz, wo genau in der App das Problem auftritt und was passiert.",
    a_en: "OK! Please describe briefly where exactly in the app the problem occurs and what happens.",
    followUps: null,
    followUps_en: null,
    triggerReport: true },
  // These entries create the ticket after user provides detail
  { q: "bei bestimmter übung bestimmte exercise specific with particular",
    a: "Danke für die Info! Ich habe das Problem an unser Entwickler-Team weitergeleitet. Sie werden sich darum kümmern! Kann ich dir noch bei etwas anderem helfen?",
    a_en: "Thanks for the info! I've forwarded the problem to our development team. They'll take care of it! Can I help with anything else?",
    followUps: ["Andere Frage", "Nein, alles gut!"],
    followUps_en: ["Other question", "No, all good!"],
    createTicket: true },
  { q: "bei allen übungen alle exercises all affected every",
    a: "Danke! Ich habe eine Meldung für unser Entwickler-Team erstellt. Das klingt nach einem größeren Problem, deshalb schauen sie sich das schnell an! Kann ich dir noch helfen?",
    a_en: "Thanks! I've created a report for our development team. This sounds like a bigger issue, so they'll look into it quickly! Can I still help?",
    followUps: ["Andere Frage", "Nein, alles gut!"],
    followUps_en: ["Other question", "No, all good!"],
    createTicket: true },
  { q: "ja fehlermeldung meldung error message gesehen",
    a: "Danke für die Info! Ich habe das Problem mit allen Details an unser Team gemeldet. Sie werden sich darum kümmern! Kann ich noch etwas für dich tun?",
    a_en: "Thanks for the info! I've reported the problem with all details to our team. They'll take care of it! Can I do anything else for you?",
    followUps: ["Andere Frage", "Nein, alles gut!"],
    followUps_en: ["Other question", "No, all good!"],
    createTicket: true },
  { q: "nein keine meldung nichts angezeigt",
    a: "Verstehe — keine Fehlermeldung. Ich habe trotzdem eine Meldung für unser Team erstellt. Sie schauen sich das an! Kann ich dir noch helfen?",
    a_en: "I see — no error message. I've still created a report for our team. They'll look into it! Can I help with anything else?",
    followUps: ["Andere Frage", "Nein, alles gut!"],
    followUps_en: ["Other question", "No, all good!"],
    createTicket: true },
  { q: "nach dateneingabe daten eingegeben eingabe",
    a: "Danke! Ich habe das Login-Problem an unser Team weitergeleitet. Sie werden sich darum kümmern! Kann ich dir noch helfen?",
    a_en: "Thanks! I've forwarded the login problem to our team. They'll take care of it! Can I still help?",
    followUps: ["Andere Frage", "Nein, alles gut!"],
    followUps_en: ["Other question", "No, all good!"],
    createTicket: true },
  { q: "seite lädt nicht laden seite",
    a: "Danke für die Info! Ich habe eine Meldung erstellt. Unser Team prüft das! Bis dahin: Versuche die App neu zu starten. Kann ich noch helfen?",
    a_en: "Thanks for the info! I've created a report. Our team will check it! In the meantime: Try restarting the app. Can I still help?",
    followUps: ["Andere Frage", "Nein, alles gut!"],
    followUps_en: ["Other question", "No, all good!"],
    createTicket: true },
  { q: "fehlermeldung beim login login error",
    a: "Verstanden! Ich habe das an unser Team gemeldet. Sie schauen sich den Login-Fehler an! Kann ich dir noch helfen?",
    a_en: "Understood! I've reported this to our team. They'll look into the login error! Can I still help?",
    followUps: ["Andere Frage", "Nein, alles gut!"],
    followUps_en: ["Other question", "No, all good!"],
    createTicket: true },
  { q: "übungen fehlen fehlt missing exercises",
    a: "Danke! Ich habe das Dashboard-Problem gemeldet. Unser Team prüft, warum Übungen fehlen! Kann ich noch etwas für dich tun?",
    a_en: "Thanks! I've reported the dashboard problem. Our team will check why exercises are missing! Can I do anything else?",
    followUps: ["Andere Frage", "Nein, alles gut!"],
    followUps_en: ["Other question", "No, all good!"],
    createTicket: true },
  { q: "fortschritt nicht angezeigt progress missing",
    a: "Das habe ich notiert und an unser Team weitergeleitet! Sie prüfen das Fortschritts-Problem. Kann ich dir noch helfen?",
    a_en: "I've noted that and forwarded it to our team! They'll check the progress issue. Can I still help?",
    followUps: ["Andere Frage", "Nein, alles gut!"],
    followUps_en: ["Other question", "No, all good!"],
    createTicket: true },
  { q: "leerer bildschirm leer blank empty screen",
    a: "Danke für die Info! Ein leerer Bildschirm klingt nach einem Anzeigefehler — ich habe das gemeldet. Unser Team kümmert sich darum! Kann ich noch helfen?",
    a_en: "Thanks for the info! A blank screen sounds like a display error — I've reported it. Our team will take care of it! Can I still help?",
    followUps: ["Andere Frage", "Nein, alles gut!"],
    followUps_en: ["Other question", "No, all good!"],
    createTicket: true },

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

function generateToniResponse(message, lang = 'de') {
  const isEn = lang === 'en';

  // Try FAQ match first
  const faqMatch = findBestFaqMatch(message);
  if (faqMatch) return {
    text: isEn ? (faqMatch.a_en || faqMatch.a) : faqMatch.a,
    followUps: faqMatch.followUps === null ? null : (isEn ? (faqMatch.followUps_en || faqMatch.followUps || []) : (faqMatch.followUps || [])),
    createTicket: faqMatch.createTicket || false
  };

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

  // Generic fallback — ask for details instead of sending to support
  return isEn
    ? { text: "Can you describe a bit more precisely what happened? Then I can help you better! For example: What were you doing when the problem occurred?", followUps: ["App crashes", "Exercise won't load", "Can't log in", "Something else"] }
    : { text: "Kannst du mir etwas genauer beschreiben, was passiert ist? Dann kann ich dir besser helfen! Zum Beispiel: Was hast du gemacht, als das Problem aufgetreten ist?", followUps: ["App stürzt ab", "Übung lädt nicht", "Login geht nicht", "Etwas anderes"] };
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

    const lang = req.body?.lang || 'en';
    const result = await elevenlabs.speechToText.convert({
      file: audioFile,
      modelId: 'scribe_v2',
      languageCode: lang === 'de' ? 'deu' : 'eng',
    });

    // Normalize "Tony" → "Toni" (common STT misinterpretation)
    const text = (result.text || '').replace(/\bTony\b/gi, 'Toni');
    res.json({ text });
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

app.post("/api/chat", async (req, res) => {
  try {
    const { message, voiceKey = "bella", lang = "de" } = req.body;
    if (!message) return res.status(400).json({ error: "message required" });

    const voice = VOICES[voiceKey] || VOICES.bella;

    chatHistory.push({ role: "user", content: message });
    if (chatHistory.length > 20) chatHistory.splice(0, 2);

    const result = generateToniResponse(message, lang);
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
