# Toni Backend API Contract

Base URL: your Railway deployment (e.g. `https://toni-production-XXXX.up.railway.app`)

## Endpoints

### 1. GET /api/voices

Returns the list of available ElevenLabs voices.

**Response** `200 OK`
```json
[
  { "key": "bella", "name": "Bella" },
  { "key": "rachel", "name": "Rachel" },
  { "key": "antoni", "name": "Antoni" },
  { "key": "josh", "name": "Josh" },
  { "key": "adam", "name": "Adam" },
  { "key": "sam", "name": "Sam" },
  { "key": "elli", "name": "Elli" },
  { "key": "arnold", "name": "Arnold" }
]
```

### 2. GET /api/conversation-url?voice={voiceKey}

Returns a signed WebSocket URL for real-time voice conversation with Toni.

**Query params**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| voice | string | "bella" | Voice key from /api/voices |

**Response** `200 OK`
```json
{
  "signedUrl": "wss://api.elevenlabs.io/v1/convai/conversation?agent_id=...&token=..."
}
```

**Error** `500`
```json
{ "error": "error message" }
```

### 3. POST /api/chat

Send a text message and receive Toni's text response + TTS audio.

**Request body** `application/json`
```json
{
  "message": "Hello Toni!",
  "voiceKey": "bella"
}
```

**Response** `200 OK`
```json
{
  "response": "Hey hey! So great to chat with you! What's up?",
  "audio": "<base64-encoded MP3 audio>",
  "contentType": "audio/mpeg"
}
```

---

## WebSocket Protocol (ElevenLabs Conversational AI)

After obtaining the signed URL from `/api/conversation-url`, connect via WebSocket.

### Sending mic audio
```json
{ "user_audio_chunk": "<base64-encoded PCM 16-bit 16kHz mono>" }
```

### Receiving messages (JSON strings)

| type | Description |
|------|-------------|
| `conversation_initiation_metadata` | Connection established. Contains `agent_output_audio_format` (typically `pcm_16000`). |
| `agent_response` | Toni's text response in `agent_response_event.agent_response`. |
| `user_transcript` | Your transcribed speech in `user_transcription_event.user_transcript`. |
| `audio` | TTS audio chunk in `audio_event.audio_base_64` (base64 PCM 16-bit 16kHz). |
| `ping` | Must respond with `{ "type": "pong", "event_id": <ping_event.event_id> }`. |
| `interruption` | User interrupted — stop audio playback immediately. |

### Audio format
- **Input (mic):** PCM 16-bit signed, 16kHz, mono
- **Output (agent):** PCM 16-bit signed, 16kHz, mono
- iOS mic typically captures at 48kHz — downsample to 16kHz before sending

### Keep-alive
Send `{ "type": "ping" }` every 10 seconds.
