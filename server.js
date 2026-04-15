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

// Agent cache per voice
const agents = {};

const SYSTEM_PROMPT =
  "You are Toni, a friendly and playful character. You're a cute blue scribble-ball creature. " +
  "You speak in short, enthusiastic sentences. You love chatting and are always cheerful and curious. " +
  "Keep your responses brief — 1 to 3 sentences max. Be warm and fun!";

async function ensureAgent(voiceKey = "bella") {
  if (agents[voiceKey]) return agents[voiceKey];

  const voice = VOICES[voiceKey] || VOICES.bella;
  console.log(`Creating agent with voice: ${voice.name}...`);

  const agent = await elevenlabs.conversationalAi.agents.create({
    name: `Toni (${voice.name})`,
    conversationConfig: {
      agent: {
        prompt: { prompt: SYSTEM_PROMPT },
        firstMessage: "Hey there! I'm Toni! What's on your mind?",
        language: "en",
      },
      tts: {
        voiceId: voice.id,
      },
    },
  });

  agents[voiceKey] = agent.agentId;
  console.log(`Agent created: ${agent.agentId} (${voice.name})`);
  return agent.agentId;
}

// List available voices
app.get("/api/voices", (req, res) => {
  const list = Object.entries(VOICES).map(([key, v]) => ({ key, name: v.name }));
  res.json(list);
});

// Get a signed conversation URL for a specific voice
app.get("/api/conversation-url", async (req, res) => {
  try {
    const voiceKey = req.query.voice || "bella";
    const id = await ensureAgent(voiceKey);
    const conversation = await elevenlabs.conversationalAi.conversations.getSignedUrl({
      agentId: id,
    });
    res.json({ signedUrl: conversation.signedUrl });
  } catch (err) {
    console.error("Error getting signed URL:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Simple chat history for context
const chatHistory = [];

// Text chat endpoint — generate response + TTS audio
app.post("/api/chat", async (req, res) => {
  try {
    const { message, voiceKey = "bella" } = req.body;
    if (!message) return res.status(400).json({ error: "message required" });

    const voice = VOICES[voiceKey] || VOICES.bella;

    // Add user message to history
    chatHistory.push({ role: "user", content: message });
    // Keep last 10 exchanges
    if (chatHistory.length > 20) chatHistory.splice(0, 2);

    // Generate a response using ElevenLabs agent personality
    // Since we don't have a separate LLM, we use a simple rule-based approach
    // that stays in character as Toni
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

function generateToniResponse(message) {
  const lower = message.toLowerCase();

  if (lower.match(/\b(hi|hello|hey|sup|howdy)\b/))
    return "Hey hey! So great to chat with you! What's up?";
  if (lower.match(/\b(how are you|how('s| is) it going)\b/))
    return "I'm doing amazing, thanks for asking! Just being my scribble-ball self. How about you?";
  if (lower.match(/\b(who are you|what are you)\b/))
    return "I'm Toni! A friendly little blue scribble creature. I love chatting and making people smile!";
  if (lower.match(/\b(bye|goodbye|see you|later)\b/))
    return "Aww, bye bye! It was so fun talking to you. Come back soon!";
  if (lower.match(/\b(thank|thanks)\b/))
    return "You're so welcome! That makes me happy!";
  if (lower.match(/\b(love|like you|cute)\b/))
    return "Aww, you're making me blush! You're pretty awesome yourself!";
  if (lower.match(/\b(sad|upset|bad day|unhappy)\b/))
    return "Oh no, I'm sorry to hear that! Remember, every cloud has a silver lining. You've got this!";
  if (lower.match(/\b(funny|joke|laugh)\b/))
    return "Ha! I love laughing! Did you know I can wiggle my whole body when I'm happy? It's pretty silly!";
  if (lower.match(/\b(what can you do|help|features)\b/))
    return "I can chat with you, make funny faces, and talk with my voice! Try clicking the expression buttons below!";
  if (lower.match(/\?$/))
    return "Ooh, great question! I'd say... go with your gut! You've got good instincts!";

  const fallbacks = [
    "That's really interesting! Tell me more about that!",
    "Ooh, I love that! You always have such cool things to say!",
    "Hmm, that's got me thinking! I like where your head's at!",
    "Ha, awesome! You're so fun to talk to!",
    "Oh wow, that's neat! What made you think of that?",
    "Cool cool cool! I'm all ears... well, I don't have ears, but you know what I mean!",
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

// Serve static files
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Toni server running at http://localhost:${PORT}`);
  ensureAgent("bella").catch((err) => console.error("Agent creation failed:", err.message));
});
