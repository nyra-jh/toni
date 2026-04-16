import "dotenv/config";
import express from "express";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());

const elevenlabs = new ElevenLabsClient();

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
    followUps: ["App neu installieren", "Immer noch Probleme", "Problem melden"] },
  { q: "app langsam slow laden lange dauert",
    a: "Wenn die App langsam ist, hilft es oft die App zu schließen und neu zu starten. Prüfe auch deine Internetverbindung — am besten funktioniert es über WLAN!",
    followUps: ["App neu starten hat geholfen", "Immer noch langsam", "Übungen laden nicht"] },
  { q: "app neu installieren neuinstallation",
    a: "Du kannst die App sicher deinstallieren und neu aus dem App Store laden. Keine Sorge — deine Daten und Fortschritte bleiben gespeichert, da sie mit deinem Konto verknüpft sind!",
    followUps: ["Daten wirklich sicher?", "Wie melde ich mich wieder an?", "Problem melden"] },
  { q: "app funktioniert nicht geht nicht startet nicht",
    a: "Versuche bitte diese Schritte: Erstens, schließe die App komplett und starte sie neu. Zweitens, prüfe ob du die neueste Version hast. Drittens, starte dein Gerät einmal neu.",
    followUps: ["Hat funktioniert!", "Problem besteht weiter", "App neu installieren"] },
  { q: "update aktualisieren neue version",
    a: "Gehe in den App Store, suche nach meiReha und tippe auf 'Aktualisieren'. Automatische Updates kannst du in deinen Geräte-Einstellungen aktivieren!",
    followUps: ["Kein Update verfügbar", "Nach Update geht nichts mehr", "Problem melden"] },
  { q: "bildschirm schwarz weiß display anzeige kaputt ui",
    a: "Versuche die App komplett zu schließen und neu zu öffnen. Falls der Bildschirm weiterhin nicht richtig angezeigt wird, prüfe ob ein App-Update verfügbar ist.",
    followUps: ["App neu starten", "App aktualisieren", "Problem melden"] },

  // ── TROUBLESHOOTING: Exercises ──
  { q: "übung starten geht nicht startet nicht exercise",
    a: "Versuche die Übung zu schließen und neu zu starten. Gehe dazu zurück zum Dashboard und wähle die Übung erneut aus. Prüfe auch deine Internetverbindung!",
    followUps: ["Übung neu starten", "Andere Übung wählen", "Alle Übungen betroffen"] },
  { q: "übung neu starten restart exercise neustarten",
    a: "Gehe zurück zum Dashboard, indem du oben links auf den Zurück-Pfeil tippst. Wähle dann die Übung erneut aus — sie startet von vorne!",
    followUps: ["Hat geklappt!", "Übung reagiert nicht", "Problem melden"] },
  { q: "übungen laden nicht loading fehler",
    a: "Prüfe deine Internetverbindung und starte die App neu. Tipp: Schließe die App komplett über den App-Switcher und öffne sie erneut. Falls es weiterhin nicht klappt, könnte es ein Serverproblem sein.",
    followUps: ["App neu starten", "Internet prüfen", "Problem melden"] },
  { q: "übung verstehe ich nicht anleitung schwer schwierig",
    a: "Kein Problem! Tippe auf das Fragezeichen-Symbol in der Übung — dort findest du eine Anleitung und oft auch ein Video. Du kannst auch deinen Therapeuten um Hilfe bitten.",
    followUps: ["Andere Übung wählen", "Schwierigkeit anpassen", "Therapeut kontaktieren"] },
  { q: "übung zu schwer zu leicht schwierigkeit level",
    a: "Die App passt sich normalerweise automatisch an. Du kannst aber auch in den Einstellungen deinen Therapieplan anpassen oder deinen Therapeuten bitten, die Schwierigkeit zu ändern.",
    followUps: ["Einstellungen öffnen", "Therapeut kontaktieren", "Wie funktioniert der Therapieplan?"] },
  { q: "ton audio sound hören lautsprecher übung kein ton",
    a: "Prüfe ob dein Gerät nicht auf stumm geschaltet ist und die Lautstärke hoch genug ist. Manche Übungen haben Audio-Anleitungen — stelle sicher, dass der Ton in der App aktiviert ist!",
    followUps: ["Ton funktioniert jetzt", "Immer noch kein Ton", "Problem melden"] },

  // ── TROUBLESHOOTING: Login & Account ──
  { q: "einloggen login nicht möglich anmelden geht nicht",
    a: "Prüfe ob deine E-Mail-Adresse und dein Passwort korrekt sind. Tipp: Achte auf Groß- und Kleinschreibung! Du kannst das Passwort über 'Passwort vergessen?' zurücksetzen.",
    followUps: ["Passwort zurücksetzen", "E-Mail-Adresse vergessen", "Problem melden"] },
  { q: "passwort vergessen zurücksetzen reset password",
    a: "Kein Problem! Tippe auf dem Login-Bildschirm auf 'Passwort vergessen?'. Du bekommst dann eine E-Mail mit einem Link zum Zurücksetzen. Prüfe auch deinen Spam-Ordner!",
    followUps: ["Keine E-Mail erhalten", "Spam-Ordner gecheckt", "Problem melden"] },
  { q: "email adresse vergessen welche email konto",
    a: "Deine E-Mail-Adresse findest du in der App unter Einstellungen > Mein Konto. Falls du nicht eingeloggt bist, frag bei deiner Klinik oder deinem Therapeuten nach — die haben deine Registrierungsdaten.",
    followUps: ["Einstellungen öffnen", "Therapeut fragen", "Problem melden"] },
  { q: "registrieren anmelden neues konto erstellen",
    a: "Du kannst dich über E-Mail oder Einladungscode registrieren. Öffne die App und tippe auf 'Neuen Zugang erstellen'. Nach der Eingabe deiner Daten bekommst du eine Bestätigungs-Mail.",
    followUps: ["Bestätigungs-Mail nicht erhalten", "Einladungscode eingeben", "Was ist ein Einladungscode?"] },
  { q: "zugangscode verloren einladungscode code",
    a: "Den Zugangscode kannst du bei deiner Klinik, deinem Therapeuten oder beim Support unter support@nyra.health erneut anfordern.",
    followUps: ["Problem melden", "Ohne Code registrieren", "Was ist ein Zugangscode?"] },
  { q: "zugangscode nicht erhalten bekommen",
    a: "Prüfe zuerst deinen Spam-Ordner! Falls du den Code dort nicht findest, frag bei deiner Klinik, Versicherung oder beim Support unter support@nyra.health nach.",
    followUps: ["Spam-Ordner gecheckt", "Problem melden", "Neue E-Mail anfordern"] },

  // ── TROUBLESHOOTING: Settings & Navigation ──
  { q: "einstellungen settings finden wo",
    a: "Die Einstellungen findest du über das Zahnrad-Symbol oben rechts im Dashboard. Dort kannst du dein Profil, deine Benachrichtigungen und deinen Therapieplan verwalten.",
    followUps: ["Profil bearbeiten", "Benachrichtigungen ändern", "Therapieplan anpassen"] },
  { q: "profil bearbeiten name ändern",
    a: "Gehe zu Einstellungen > Mein Konto. Dort kannst du deinen Namen und andere Profildaten bearbeiten.",
    followUps: ["E-Mail ändern", "Passwort ändern", "Zurück zum Dashboard"] },
  { q: "benachrichtigungen erinnerungen notifications",
    a: "Du kannst Erinnerungen in den Einstellungen unter 'Benachrichtigungen' ein- und ausschalten. So wirst du regelmäßig an dein Training erinnert!",
    followUps: ["Erinnerungen aktivieren", "Erinnerungen ausschalten", "Einstellungen öffnen"] },
  { q: "sprache ändern language deutsch englisch",
    a: "Die Spracheinstellungen findest du unter Einstellungen > Allgemein. Die App passt sich auch an die Spracheinstellung deines Geräts an.",
    followUps: ["Einstellungen öffnen", "Übungen in anderer Sprache?", "Problem melden"] },

  // ── TROUBLESHOOTING: Data & Sync ──
  { q: "fortschritte nicht gespeichert verloren daten weg sync",
    a: "Prüfe ob deine Internetverbindung stabil ist und starte die App neu. Deine Fortschritte werden automatisch gespeichert, sobald du wieder online bist. Falls weiterhin Daten fehlen, kontaktiere den Support.",
    followUps: ["Internet prüfen", "App neu starten", "Problem melden"] },
  { q: "offline nutzen ohne internet",
    a: "Einige Inhalte sind offline verfügbar! Deine Fortschritte werden dann automatisch synchronisiert, sobald du wieder Internet hast.",
    followUps: ["Welche Inhalte offline?", "Synchronisation klappt nicht", "Problem melden"] },
  { q: "fortschritt sehen ergebnis statistik",
    a: "Im Dashboard findest du den Fortschrittsbereich — dort siehst du deine absolvierten Übungen, deine Entwicklung über die Zeit und deine Erfolge!",
    followUps: ["Wo ist das Dashboard?", "Fortschritte teilen", "Therapeut kontaktieren"] },

  // ── TROUBLESHOOTING: Payment ──
  { q: "zahlung payment bezahlung fehlgeschlagen nicht geklappt",
    a: "Prüfe ob deine Zahlungsmethode im App Store aktuell ist. Gehe dazu in die Einstellungen deines Geräts > Apple-ID/Google-Konto > Zahlung. Bei weiteren Problemen hilft dir support@nyra.health.",
    followUps: ["Zahlungsmethode prüfen", "Andere Zahlungsmethode", "Problem melden"] },
  { q: "kosten kostenpflichtig preis was kostet",
    a: "myReha bietet Premium-Abos: neunundsechzig Euro neunundneunzig pro Monat, dreiundsechzig Euro dreiunddreißig bei drei Monaten oder achtundfünfzig Euro dreiunddreißig bei sechs Monaten. Viele Krankenkassen übernehmen die Kosten!",
    followUps: ["Übernimmt meine Krankenkasse?", "Welches Abo passt zu mir?", "Kostenlos testen"] },
  { q: "krankenkasse übernehmen versicherung kostenübernahme",
    a: "Ja! Zahlreiche Krankenkassen übernehmen die Kosten für myReha. Bei der Registrierung werden deine Angaben geprüft und du erfährst sofort, ob deine Kasse dabei ist.",
    followUps: ["Wie beantrage ich das?", "Welche Kassen?", "Problem melden"] },
  { q: "testphase kostenlos testen gratis free",
    a: "Ja! Nach dem Download kannst du eine limitierte Basis-Version ganz ohne Zahlungsdaten und Kosten nutzen. So kannst du die App erstmal ausprobieren!",
    followUps: ["Was ist im Basis-Abo?", "Auf Premium upgraden", "Was kostet Premium?"] },
  { q: "premium abo vorteile upgrade",
    a: "Das Premium-Abo bietet dir einen individuellen Therapieplan, Zugang zu über fünfundsechzigtausend Aufgaben und Echtzeit-Erfolgskontrolle. Du kannst es in den App-Einstellungen unter 'Abo' erwerben.",
    followUps: ["Jetzt upgraden", "Was kostet es?", "Krankenkasse fragen"] },
  { q: "welches abo nehmen empfehlung",
    a: "Zum Schnuppern eignet sich das Einmonats-Abo. Für eine richtige Reha empfehle ich die drei- oder sechsmonatigen Abos — die sind auch günstiger pro Monat!",
    followUps: ["Einmonats-Abo wählen", "Dreimonats-Abo wählen", "Krankenkasse fragen"] },
  { q: "abo kündigen cancel subscription",
    a: "Du kannst jederzeit kündigen — gehe dazu in die Einstellungen deines Geräts > Apple-ID/Google-Konto > Abonnements > myReha > Kündigen. Ganz einfach und ohne Probleme!",
    followUps: ["Verliere ich meine Daten?", "Kann ich pausieren?", "Problem melden"] },
  { q: "rechnung bezahlen invoice",
    a: "Rechnungen kommen vom App Store-Anbieter und sind über deine Geräte-Einstellungen abrufbar. Bei Problemen schreibe direkt an support@nyra.health!",
    followUps: ["Rechnung nicht gefunden", "Falsch abgebucht", "Problem melden"] },

  // ── INFO: General ──
  { q: "was ist myreha mereha meireha",
    a: "myReha ist eine zertifizierte Medizin-App zum Trainieren von Gedächtnis, Sprache und Aufmerksamkeit. Du bekommst einen persönlichen Trainingsplan, der sich automatisch an dich anpasst!",
    followUps: ["Für wen ist die App?", "Was kostet es?", "Wie starte ich?"] },
  { q: "welche bereiche sprache gedächtnis",
    a: "myReha deckt alle Sprach- und Kognitionstherapie-Bereiche ab: Aussprache, Lesen, Schreiben, Sprachverständnis, Gedächtnis, logisches Denken, Planung, Rechnen, Aufmerksamkeit und Wahrnehmung.",
    followUps: ["Welche Übungen gibt es?", "Wie starte ich?", "Therapieplan erstellen"] },
  { q: "welche erkrankungen schlaganfall parkinson",
    a: "myReha kann bei Rehabilitation nach Schlaganfällen, Hirnblutungen, Multipler Sklerose, Morbus Parkinson, Schädel-Hirn-Trauma und anderen neurologischen Erkrankungen helfen.",
    followUps: ["Für wen geeignet?", "Wie starte ich?", "Kostenlos testen"] },
  { q: "für wen geeignet wer kann nutzen",
    a: "myReha ist für Menschen mit Sprachstörungen wie Aphasie oder kognitiven Defiziten nach neurologischen Erkrankungen geeignet — unabhängig vom Schweregrad!",
    followUps: ["Welche Erkrankungen?", "Brauche ich einen Therapeuten?", "Kostenlos testen"] },
  { q: "wie bekomme ich die app download installieren",
    a: "Lade myReha im Apple App Store oder Google Play Store herunter — suche einfach nach 'myReha'. Nach dem Download tippst du auf 'Neuen Zugang erstellen' und folgst der Registrierung!",
    followUps: ["Geräteanforderungen?", "Registrierung hilfe", "Was kostet es?"] },
  { q: "geräteanforderungen geräte kompatibel iphone ipad android",
    a: "iPhones und iPads brauchen mindestens iOS sechzehn, Android-Geräte mindestens Android sechs. Auf neueren Geräten läuft die App am besten!",
    followUps: ["Mein Gerät ist zu alt", "Auf mehreren Geräten nutzen?", "App herunterladen"] },
  { q: "wie lange nutzen wie oft häufigkeit empfehlung",
    a: "Wir empfehlen mindestens eine dreimonatige Rehaphase mit mindestens vier Stunden pro Woche. Langfristige Nutzung ist sehr sinnvoll — je regelmäßiger, desto besser!",
    followUps: ["Wie starte ich?", "Therapieplan anpassen", "Fortschritte ansehen"] },
  { q: "therapieplan übungsplan anpassen ändern",
    a: "Der Plan passt sich automatisch an deinen Fortschritt an. Du kannst aber auch manuell Anpassungen vornehmen: Gehe zu Einstellungen > Therapieplan.",
    followUps: ["Einstellungen öffnen", "Schwierigkeit ändern", "Therapeut kontaktieren"] },
  { q: "ohne therapeuten arzt alleine selbstständig",
    a: "Ja! Du kannst hochwertige Reha ganz selbstständig machen — von zu Hause aus oder sogar im Urlaub. Die App leitet dich durch alles!",
    followUps: ["Wie starte ich?", "Therapieplan erstellen", "Kostenlos testen"] },
  { q: "praxis therapeuten version klinik professional",
    a: "Ja! Es gibt eine Praxis-Version für Therapeuten mit dem kompletten Übungskatalog aus über fünfundsechzigtausend Aufgaben und einem Fortschritts-Dashboard.",
    followUps: ["Mehr Infos für Therapeuten", "Klinik-Zugang", "Problem melden"] },
  { q: "mehrere geräte gleichzeitig verschiedene",
    a: "Ja! Du kannst dich auf mehreren Geräten einloggen, solange du dieselben Zugangsdaten verwendest. Deine Fortschritte werden automatisch synchronisiert!",
    followUps: ["Wie synchronisieren?", "Neues Gerät einrichten", "Zugangsdaten vergessen"] },
  { q: "daten sicherheit datenschutz dsgvo privacy",
    a: "Deine Daten sind sicher! Sie werden anonym und ausschließlich für deinen persönlichen Übungsplan verwendet. Alles läuft über europäische Server mit höchsten Sicherheitsstandards — vollständig DSGVO-konform!",
    followUps: ["Wer sieht meine Daten?", "Account löschen", "Mehr zum Datenschutz"] },
  { q: "zugriff daten wer sieht",
    a: "Nur autorisierte Personen wie deine behandelnden Therapeuten haben Zugriff. Alle Daten werden DSGVO-konform verarbeitet.",
    followUps: ["Datenschutz-Info", "Account löschen", "Problem melden"] },
  { q: "account löschen konto entfernen",
    a: "Du kannst eine vollständige Löschung deiner Daten beim Support beantragen. Schreibe einfach an support@nyra.health mit deiner Anfrage.",
    followUps: ["Problem melden", "Was passiert mit meinen Daten?", "Abo vorher kündigen?"] },
  { q: "nicht kompatibel gerät alt zu alt",
    a: "Prüfe ob dein Gerät die Mindestanforderungen erfüllt: iOS sechzehn oder Android sechs. Bei älteren Geräten kann es leider Einschränkungen geben — ein Update des Betriebssystems könnte helfen!",
    followUps: ["Gerät aktualisieren", "Anderes Gerät nutzen", "Problem melden"] },
  { q: "support kontaktieren hilfe erreichen",
    a: "Du erreichst den Support per E-Mail an support@nyra.health oder über das Kontaktformular in der App unter Einstellungen > Hilfe & Support.",
    followUps: ["E-Mail schreiben", "In der App kontaktieren", "Häufige Fragen ansehen"] },
  { q: "medizinprodukt zertifiziert ce kennzeichen",
    a: "Ja! myReha hat ein CE-Kennzeichen als zertifiziertes Medizinprodukt. Das bedeutet, dass alle Sicherheits- und Gesundheitsanforderungen erfüllt sind.",
    followUps: ["Was bedeutet das?", "Wer hat entwickelt?", "Mehr über myReha"] },
  { q: "wer steckt dahinter gegründet team",
    a: "myReha wurde von Dr. Philipp Schöllauf gegründet, zusammen mit einem Team aus Therapeuten und Ärzten, in Zusammenarbeit mit der Neurologischen Abteilung einer Klinik in Wien.",
    followUps: ["Mehr über myReha", "Kontakt aufnehmen", "App herunterladen"] },

  // ── Meta: Conversation flow ──
  { q: "hat funktioniert geholfen danke gelöst",
    a: "Super, das freut mich! Kann ich dir noch bei etwas anderem helfen?",
    followUps: ["Nein, alles gut!", "Andere Frage", "Übungen starten"] },
  { q: "immer noch problem nicht geholfen besteht weiter geht immer noch nicht",
    a: "Das tut mir leid, dass es noch nicht klappt! Damit ich dir besser helfen kann: Kannst du mir beschreiben, was genau passiert? Zum Beispiel: Siehst du eine Fehlermeldung? Oder bleibt der Bildschirm einfach stehen?",
    followUps: ["Fehlermeldung gesehen", "Bildschirm friert ein", "App schließt sich einfach", "Problem melden"] },
  { q: "problem melden bug report fehler melden ticket",
    a: "Ich erstelle gerne eine Meldung für unser Entwickler-Team! Beschreibe mir bitte kurz: Was hast du gemacht, als das Problem aufgetreten ist? Und was ist genau passiert?",
    followUps: ["Bei einer Übung", "Beim Einloggen", "Im Dashboard", "Woanders"] },
  { q: "fehlermeldung error fehler angezeigt",
    a: "Danke für die Info! Weißt du noch, was in der Fehlermeldung stand? Auch nur ein Teil des Textes hilft unserem Team, das Problem schneller zu finden.",
    followUps: ["Ich weiß es nicht mehr", "Problem melden", "Nochmal versuchen"] },
  { q: "bildschirm friert ein hängt stuck frozen reagiert nicht",
    a: "Das klingt nach einem Anzeigeproblem. Versuche bitte: Schließe die App komplett über den App-Switcher, warte ein paar Sekunden und öffne sie erneut. Bei welcher Funktion ist das passiert?",
    followUps: ["Bei einer Übung", "Im Dashboard", "Gleich nach dem Start", "Problem melden"] },
  { q: "app schließt sich einfach von alleine beendet",
    a: "Wenn die App sich unerwartet schließt, hilft oft ein Update. Prüfe im App Store, ob eine neue Version verfügbar ist. Passiert es bei einer bestimmten Übung oder zufällig?",
    followUps: ["Bei bestimmter Übung", "Passiert zufällig", "App aktualisieren", "Problem melden"] },
  { q: "nein alles gut fertig tschüss",
    a: "Wunderbar! Dann wünsche ich dir viel Erfolg beim Training. Bis bald!",
    followUps: [] },
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

function generateToniResponse(message) {
  // Try FAQ match first
  const faqMatch = findBestFaqMatch(message);
  if (faqMatch) return { text: faqMatch.a, followUps: faqMatch.followUps || [] };

  // Fallback: friendly responses
  const lower = message.toLowerCase();

  if (lower.match(/\b(hi|hello|hey|hallo|servus|grüß)\b/))
    return { text: "Hallo! Schön, dass du da bist! Wie kann ich dir helfen?", followUps: ["Übung funktioniert nicht", "Login-Problem", "Frage zur App"] };
  if (lower.match(/\b(danke|dankeschön|thank)/))
    return { text: "Gerne! Freut mich, wenn ich helfen konnte!", followUps: ["Andere Frage", "Übungen starten", "Nein, alles gut!"] };
  if (lower.match(/\b(tschüss|bye|ciao|auf wiedersehen)/))
    return { text: "Tschüss! Bis bald und viel Erfolg beim Training!", followUps: [] };
  if (lower.match(/\b(wer bist du|who are you|was bist du)/))
    return { text: "Ich bin Toni, dein freundlicher Helfer in der myReha App! Ich beantworte gerne deine Fragen rund um die App.", followUps: ["Was kann die App?", "Wie starte ich?", "Ich habe ein Problem"] };
  if (lower.match(/\b(hilfe|help|was kannst du)/))
    return { text: "Ich kann dir bei Fragen zur myReha App helfen! Frag mich zum Beispiel zu Übungen, Kosten oder technischen Problemen.", followUps: ["Übung funktioniert nicht", "Kosten & Abo", "App-Problem melden"] };

  // Generic fallback — ask for details instead of sending to support
  return {
    text: "Kannst du mir etwas genauer beschreiben, was passiert ist? Dann kann ich dir besser helfen! Zum Beispiel: Was hast du gemacht, als das Problem aufgetreten ist?",
    followUps: ["App stürzt ab", "Übung lädt nicht", "Login geht nicht", "Etwas anderes"]
  };
}

// No agent creation needed — configured in ElevenLabs dashboard

// =============================================
// ROUTES
// =============================================

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
    const { message, voiceKey = "bella" } = req.body;
    if (!message) return res.status(400).json({ error: "message required" });

    const voice = VOICES[voiceKey] || VOICES.bella;

    chatHistory.push({ role: "user", content: message });
    if (chatHistory.length > 20) chatHistory.splice(0, 2);

    const result = generateToniResponse(message);
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
      followUps: result.followUps || [],
      audio: audioBuffer.toString("base64"),
      contentType: "audio/mpeg",
    });
  } catch (err) {
    console.error("Chat error:", err.message);
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
