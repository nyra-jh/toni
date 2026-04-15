import "dotenv/config";
import express from "express";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const elevenlabs = new ElevenLabsClient();

let agentId = null;

// Create or reuse the conversational agent
async function ensureAgent() {
  if (agentId) return agentId;
  // Force new agent creation on each server start

  console.log("Creating ElevenLabs conversational agent...");
  const agent = await elevenlabs.conversationalAi.agents.create({
    name: "Toni",
    conversationConfig: {
      agent: {
        prompt: {
          prompt:
            "You are Toni, a friendly and playful character. You're a cute blue scribble-ball creature. " +
            "You speak in short, enthusiastic sentences. You love chatting and are always cheerful and curious. " +
            "Keep your responses brief — 1 to 3 sentences max. Be warm and fun!",
        },
        firstMessage: "Hey there! I'm Toni! What's on your mind?",
        language: "en",
      },
      tts: {
        voiceId: "EXAVITQu4vr4xnSDxMaL",  // Bella
      },
    },
  });

  agentId = agent.agentId;
  console.log(`Agent created: ${agentId}`);
  return agentId;
}

// Get a signed conversation URL for the frontend
app.get("/api/conversation-url", async (req, res) => {
  try {
    const id = await ensureAgent();
    const conversation = await elevenlabs.conversationalAi.conversations.getSignedUrl({
      agentId: id,
    });
    res.json({ signedUrl: conversation.signedUrl });
  } catch (err) {
    console.error("Error getting signed URL:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Serve static files
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Toni server running at http://localhost:${PORT}`);
  // Pre-create agent
  ensureAgent().catch((err) => console.error("Agent creation failed:", err.message));
});
