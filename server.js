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
// FAQ KNOWLEDGE BASE
// =============================================
const FAQ_ENTRIES = [
  // Website FAQ
  { q: "was ist myreha", a: "myReha ist eine zertifizierte Medizin-App zum Trainieren von Gedächtnis, Sprache und Aufmerksamkeit. Du bekommst einen persönlichen Trainingsplan, der sich automatisch an dich anpasst!" },
  { q: "was ist besonders an myreha", a: "myReha bietet qualitativ hochwertige, wissenschaftlich fundierte Neuro-Reha — überall verfügbar! Die App wurde von Experten entwickelt und passt sich intelligent an deinen Fortschritt an." },
  { q: "welche bereiche", a: "myReha deckt alle Sprach- und Kognitionstherapie-Bereiche ab: Aussprache, Lesen, Schreiben, Sprachverständnis, Gedächtnis, logisches Denken, Planung, Rechnen, Aufmerksamkeit und Wahrnehmung." },
  { q: "welche erkrankungen", a: "myReha kann bei Rehabilitation nach Schlaganfällen, Hirnblutungen, Multipler Sklerose, Morbus Parkinson, Schädel-Hirn-Trauma und anderen neurologischen Erkrankungen helfen." },
  { q: "für wen geeignet", a: "myReha ist für Menschen mit Sprachstörungen wie Aphasie oder kognitiven Defiziten nach neurologischen Erkrankungen geeignet — unabhängig vom Schweregrad!" },
  { q: "medizinprodukt zertifiziert ce", a: "Ja! myReha hat ein CE-Kennzeichen. Das bedeutet, dass alle Sicherheits- und Gesundheitsanforderungen eingehalten werden und strenge medizinische und Datenschutzprüfungen bestanden wurden." },
  { q: "vorteile vergleich andere apps", a: "myReha ist die einzige Lösung mit über 65.000 Aufgaben und künstlicher Intelligenz für personalisierte Trainingspläne — und das als zertifiziertes Medizinprodukt!" },
  { q: "medizinische inhalte woher", a: "Die Inhalte wurden von einem interdisziplinären Team aus Medizin, Logopädie, Ergotherapie und Neuropsychologie nach Gold-Standard-Methoden entwickelt." },
  { q: "wer steckt dahinter gegründet", a: "myReha wurde von Dr. Philipp Schöllauf gegründet, zusammen mit einem Team aus Therapeuten und Ärzten, in Zusammenarbeit mit der Neurologischen Abteilung einer Klinik in Wien und Experten der Medizinischen Universität Wien." },
  { q: "wie bekomme ich die app download", a: "Du kannst myReha im Apple App Store und im Google Play Store herunterladen — einfach nach 'myReha' suchen!" },
  { q: "wie installiere ich", a: "Lade die App aus dem App Store herunter, installiere sie und klicke auf 'Neuen Zugang erstellen'. Dann einfach der Registrierung folgen!" },
  { q: "geräteanforderungen geräte kompatibel", a: "iPhones und iPads brauchen mindestens iOS 16.0, Android-Geräte mindestens Android 6.0." },
  { q: "wie wird die app angewendet", a: "Du kannst myReha auf deinem Smartphone oder Tablet nutzen — zeit- und ortsunabhängig, so oft du möchtest!" },
  { q: "wie lange nutzen wie oft", a: "Wir empfehlen mindestens eine dreimonatige Rehaphase mit mindestens 4 Stunden pro Woche. Langfristige Nutzung ist sehr sinnvoll!" },
  { q: "welche übungen muss ich machen therapieplan", a: "Du bekommst einen persönlichen Therapieplan, der sich automatisch an deinen Fortschritt anpasst. Er basiert auf deiner Selbsteinschätzung oder den Empfehlungen deines Therapeuten." },
  { q: "übungen zugeschnitten angepasst", a: "Die App lernt mit dir mit! Sie misst deine Leistung in jeder Übung und bietet dir fortlaufend passende, angepasste Übungen." },
  { q: "übungsplan anpassen", a: "Der Plan passt sich automatisch an deinen Fortschritt an. Du kannst aber auch manuell Anpassungen in den App-Einstellungen vornehmen." },
  { q: "angehörigen hilfe brauche ich jemanden", a: "Nein, du kannst myReha ganz selbstständig und ohne Hilfe verwenden! Die App ist so gestaltet, dass alles verständlich ist." },
  { q: "schlaganfall verwenden", a: "Ja, die App wurde in intensiver Zusammenarbeit mit Schlaganfallpatienten entwickelt und ist speziell auf ihre Bedürfnisse angepasst!" },
  { q: "ohne therapeuten arzt alleine", a: "Ja! Du kannst hochwertige Reha ganz selbstständig machen — von zu Hause aus oder sogar im Urlaub." },
  { q: "praxis therapeuten version", a: "Ja! Es gibt eine Praxis-Version für Therapeuten mit dem kompletten Übungskatalog aus über 65.000 Aufgaben und einem Fortschritts-Dashboard." },
  { q: "klinik zuhause weitermachen", a: "Ja! Du kannst dich mit deinen Klinik-Zugangsdaten anmelden oder dich neu auf deinem privaten Gerät registrieren." },
  { q: "therapiestunde gemeinsam therapeut", a: "Ja! myReha ist eine großartige Ergänzung zur Therapiestunde. Dein Therapieteam kann auch deine Fortschritte analysieren." },
  { q: "kosten kostenpflichtig preis", a: "myReha bietet Premium-Abos: 69,99€ pro Monat, 63,33€ bei 3 Monaten oder 58,33€ bei 6 Monaten. Viele Krankenkassen übernehmen die Kosten!" },
  { q: "krankenkasse übernehmen versicherung", a: "Ja! Zahlreiche Krankenkassen übernehmen die Kosten für myReha. Bei der Registrierung werden deine Angaben geprüft." },
  { q: "testphase kostenlos testen", a: "Ja! Nach dem Download kannst du eine limitierte Basis-Version ganz ohne Zahlungsdaten und Kosten nutzen." },
  { q: "premium abo vorteile", a: "Das Premium-Abo bietet dir einen individuellen Therapieplan, Zugang zu über 65.000 Aufgaben und Echtzeit-Erfolgskontrolle. Du kannst es in den App-Einstellungen erwerben." },
  { q: "welches abo nehmen", a: "Zum Schnuppern eignet sich das 1-Monats-Abo. Für eine richtige Reha empfehle ich die drei- oder sechsmonatigen Abos — die sind auch günstiger pro Monat!" },
  { q: "abo kündigen", a: "Ja, du kannst jederzeit einfach und schnell kündigen — über die Einstellungen deines Geräts, ganz ohne Probleme!" },
  { q: "rechnung bezahlen", a: "Ja! Bei Problemen kannst du auch direkt an support@nyra.health schreiben. Rechnungen kommen vom App Store-Anbieter und sind über deine Geräte-Einstellungen abrufbar." },
  { q: "daten sicherheit datenschutz dsgvo", a: "Deine Daten sind sicher! Sie werden anonym und ausschließlich für deinen persönlichen Übungsplan verwendet. Alles läuft über europäische Server mit höchsten ISO-zertifizierten Sicherheitsstandards — vollständig DSGVO-konform!" },
  { q: "passwort vergessen zurücksetzen", a: "Kein Problem! Du kannst dein Passwort jederzeit selbst zurücksetzen. Klicke einfach auf 'Passwort vergessen?' in der App und folge den Anweisungen." },

  // Support FAQ (from table)
  { q: "registrieren anmelden", a: "Du kannst dich über E-Mail oder Einladungscode registrieren. Nach der Eingabe deiner Daten bekommst du eine Bestätigungs-Mail zur Aktivierung." },
  { q: "zugangscode verloren", a: "Den Zugangscode kannst du beim Support oder über deine Einrichtung (z.B. Klinik oder Therapeut) erneut anfordern." },
  { q: "einloggen login nicht möglich", a: "Prüfe ob E-Mail und Passwort korrekt sind. Du kannst das Passwort über 'Passwort vergessen' zurücksetzen. Bei weiteren Problemen hilft der Support!" },
  { q: "app funktioniert nicht abstürzt absturz", a: "Versuche die App neu zu starten oder neu zu installieren. Prüfe ob du die neueste Version hast. Wenn es weiter nicht geht, kontaktiere den Support mit deinem Gerät und Betriebssystem." },
  { q: "übungen laden nicht", a: "Prüfe deine Internetverbindung und starte die App neu. Falls es weiterhin nicht klappt, könnte es ein Serverproblem sein — informiere den Support!" },
  { q: "wie starte ich therapie training", a: "Nach dem Login gehst du ins Dashboard, wählst deinen Trainingsplan und suchst dir eine Übung aus. Die Anleitung wird automatisch angezeigt!" },
  { q: "wie oft übungen machen häufigkeit", a: "Die empfohlene Häufigkeit wird individuell in deinem Trainingsplan festgelegt, zum Beispiel täglich oder mehrmals pro Woche." },
  { q: "übung verstehe ich nicht anleitung", a: "In der App gibt es Anleitungen und Videos zu den Übungen. Du kannst auch deinen Therapeuten kontaktieren oder den Support fragen!" },
  { q: "fortschritte nicht gespeichert", a: "Prüfe ob deine Internetverbindung stabil ist und starte die App neu. Wenn weiterhin Daten fehlen, kontaktiere den Support." },
  { q: "offline nutzen ohne internet", a: "Einige Inhalte sind offline verfügbar! Deine Fortschritte werden dann synchronisiert, sobald du wieder Internet hast." },
  { q: "fortschritt sehen ergebnis", a: "Im Dashboard oder im Fortschrittsbereich kannst du deine absolvierten Übungen und deine Entwicklung sehen!" },
  { q: "zugriff daten wer sieht", a: "Nur autorisierte Personen wie deine behandelnden Therapeuten haben Zugriff. Alle Daten werden DSGVO-konform verarbeitet." },
  { q: "wie lange zugriff zugang", a: "Der Zugriff ist meist an die Dauer deiner Therapie gekoppelt. Die genaue Dauer wird dir bei Start mitgeteilt." },
  { q: "mehrere geräte", a: "Ja! Du kannst dich auf mehreren Geräten einloggen, solange du dieselben Zugangsdaten verwendest." },
  { q: "support kontaktieren hilfe", a: "Du erreichst den Support per E-Mail an support@nyra.health, über das Kontaktformular in der App oder über deine betreuende Einrichtung." },
  { q: "zugangscode nicht erhalten", a: "Prüfe deinen Spam-Ordner! Falls du ihn nicht findest, frag bei deiner Klinik, Versicherung oder beim Support nach." },
  { q: "account löschen", a: "Ja, über den Support kannst du eine vollständige Löschung deiner Daten beantragen." },
  { q: "nicht kompatibel gerät alt", a: "Prüfe ob dein Gerät die Mindestanforderungen erfüllt: iOS 16.0 oder Android 6.0. Bei älteren Geräten kann es leider Einschränkungen geben." },
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
  if (faqMatch) return faqMatch.a;

  // Fallback: friendly responses
  const lower = message.toLowerCase();

  if (lower.match(/\b(hi|hello|hey|hallo|servus|grüß)\b/))
    return "Hallo! Schön, dass du da bist! Wie kann ich dir helfen?";
  if (lower.match(/\b(danke|dankeschön|thank)/))
    return "Gerne! Freut mich, wenn ich helfen konnte!";
  if (lower.match(/\b(tschüss|bye|ciao|auf wiedersehen)/))
    return "Tschüss! Bis bald und viel Erfolg beim Training!";
  if (lower.match(/\b(wer bist du|who are you|was bist du)/))
    return "Ich bin Toni, dein freundlicher Helfer in der myReha App! Ich beantworte gerne deine Fragen rund um die App.";
  if (lower.match(/\b(hilfe|help|was kannst du)/))
    return "Ich kann dir bei Fragen zur myReha App helfen! Frag mich zum Beispiel zu Übungen, Kosten, Datenschutz oder technischen Problemen.";

  // Generic fallback
  const fallbacks = [
    "Hmm, da bin ich mir nicht ganz sicher. Versuch es doch mal beim Support unter support@nyra.health — die helfen dir bestimmt weiter!",
    "Das ist eine gute Frage! Für eine genaue Antwort wende dich am besten an support@nyra.health.",
    "Oh, da muss ich passen! Aber der Support unter support@nyra.health kann dir sicher weiterhelfen!",
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
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

    const response = generateToniResponse(message);
    chatHistory.push({ role: "assistant", content: response });

    // Convert response to speech
    const audioStream = await elevenlabs.textToSpeech.convert(voice.id, {
      text: response,
      modelId: "eleven_flash_v2",
    });

    const chunks = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    res.json({
      response,
      audio: audioBuffer.toString("base64"),
      contentType: "audio/mpeg",
    });
  } catch (err) {
    console.error("Chat error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Serve static files
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Toni server running at http://localhost:${PORT}`);
  console.log(`Using agent: ${AGENT_ID}`);
});
