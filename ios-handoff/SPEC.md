# Toni Character Spec — iOS Implementation Guide

## Overview

Toni is a blue scribble-ball character with expressive face animations and real-time voice conversation powered by ElevenLabs. This document contains everything needed to rebuild Toni natively in Swift/SwiftUI.

---

## 1. Design Tokens

### Colors
| Token | Hex | Usage |
|-------|-----|-------|
| primary-900 | #0B0F31 | Pupils, mouth shapes, brows |
| primary-800 | #141A5C | — |
| primary-700 | #1E2678 | Button pressed |
| primary-600 | #2833AC | Body shadow stroke, button hover |
| primary-500 | #3949F5 | Body main stroke, primary button |
| primary-400 | #5B6BF7 | — |
| primary-200 | #B0B7FC | Borders |
| primary-100 | #D5D9FD | Dividers |
| primary-50 | #EAECFE | User chat bubble bg |
| primary-25 | #F4F5FF | Page background |
| white | #FFFFFF | Eye whites, card background, highlights |
| accent-red | #E8345A | Tongue, hearts, stop button |
| text-secondary | #5A5E7A | Labels |
| text-tertiary | #8E91A8 | Placeholders |

### Typography
- Font: Inter (or system `-apple-system`)
- Weights: Regular (400), Medium (500), SemiBold (600)
- Body: 14px, Labels: 12-14px, Titles: 16-24px

### Corner Radii
- cr-10: 10px (dropdowns, inputs)
- cr-20: 20px (chat bubbles)
- cr-30: 30px (buttons, input pills)
- cr-40: 40px (card container)
- round: 999px (chips, circular buttons)

---

## 2. Character Anatomy

### Coordinate System
The SVG canvas is **2404 x 2404**. All coordinates below are in this space.

### Body
Two overlapping scribble-ball strokes:
- **Shadow layer:** stroke `#2833AC`, width `185.994`, offset ~50px down-right from main
- **Main layer:** stroke `#3949F5`, width `185.994`
- Both use `stroke-linecap="square"`
- SVG paths are in `assets/toni-body.svg`

### Floating animation
```
translateY: 0px → -6px → 0px over 3 seconds, ease-in-out, infinite
```

### Face anchor point
The face is positioned inside the body scribble. All face elements use absolute coordinates within the 2404x2404 canvas.

---

## 3. Eyes

### Eye Whites (ellipses behind pupils)
| Eye | cx | cy | rx | ry |
|-----|----|----|----|----|
| Left | 915 | 1116 | 180 | 259 |
| Right | 1413 | 1116 | 180 | 259 |

Fill: `#FFFFFF`

### Pupils (default "normal" eyes)
Each pupil is a dark circle with a white highlight dot.

| Eye | Pupil cx | Pupil cy | Pupil r | Highlight cx | Highlight cy | Highlight r |
|-----|----------|----------|---------|-------------|-------------|-------------|
| Left | 940 | 1130 | 95 | 970 | 1095 | 28 |
| Right | 1438 | 1130 | 95 | 1468 | 1095 | 28 |

- Pupil fill: `#0B0F31`
- Highlight fill: `#FFFFFF`

### Eye Types

| Type | Description | Implementation |
|------|-------------|----------------|
| `normal` | Default round pupil + highlight | Circle + small white circle |
| `closed-happy` | Happy squint (^_^) | Arc path: `M{cx-90} 1150 Q{cx} 1040 {cx+90} 1150`, stroke `#0B0F31` width 50, no fill |
| `closed-sleepy` | Flat line (—) | Line: `x1={cx-85} y1=1130 x2={cx+85} y2=1130`, stroke `#0B0F31` width 50 |
| `x` | Dizzy X eyes | Two crossed lines at ±65px from center, stroke width 50 |
| `heart` | Heart-shaped | Path with two arcs forming a heart, fill `#E8345A`, scale param (default 1.0) |
| `wink` | Wink curve | Arc path: `M{cx-80} 1130 Q{cx} 1180 {cx+80} 1130`, stroke width 48 |

### Brows
Hidden by default. When shown:
- Stroke: `#0B0F31`, width 44, `stroke-linecap: round`, no fill
- Left brow center-x: ~915, Right brow center-x: ~1413
- Positioned above eyes (y ~800-870)

### Blinking
- Schedule random blinks every 2.2–4.2 seconds
- Blink: squash eye whites to `ry=30`, `cy=1140`, hide pupils for 120ms, then restore
- Skip blinking for: love, sleepy, dead, cheeky expressions

---

## 4. Mouth (Visemes)

All mouths are centered at **MX=1161, MY=1490**.

### Viseme Shapes

| Viseme | Phonemes | Shape | Key params |
|--------|----------|-------|------------|
| **rest** | (silence) | Gentle smile curve | `Q` curve, stroke only, width 46 |
| **BMP** | B, M, P | Closed flat line | Horizontal line, stroke width 50 |
| **AEI** | A, E, I | Wide open + teeth + tongue | Ellipse rx=180 ry=110, white top/bottom teeth rects, red tongue ellipse rx=70 ry=42 |
| **Ee** | Long E | Wide narrow | Ellipse rx=185 ry=60, top/bottom teeth |
| **UQW** | U, Q, W | Small round | Ellipse rx=60 ry=72, filled `#0B0F31` |
| **O** | O | Medium round | Ellipse rx=85 ry=95, filled `#0B0F31` |
| **CDNSTZ** | C,D,N,S,T,Z | Flat wide + teeth strip | Ellipse rx=155 ry=38, white center strip |
| **GK** | G, K | Medium open + teeth | Ellipse rx=160 ry=55, top/bottom teeth |
| **Th** | Th | Flat + tongue | Ellipse rx=140 ry=35, top teeth, red tongue peeking out |
| **FV** | F, V | Top lip bite | Top curve path + bottom ellipse, teeth strip |
| **L** | L | Open + tongue up | Ellipse rx=165 ry=80, teeth, red tongue at top rx=45 ry=28 |
| **R** | R | Medium + teeth | Ellipse rx=120 ry=65, top teeth only |
| **H** | H | Open wide | Ellipse rx=160 ry=90, top teeth only |

### Mouth colors
- Mouth fill: `#0B0F31`
- Teeth: `#FFFFFF` with opacity 0.95
- Tongue: `#E8345A`

---

## 5. Expressions

Each expression sets eyes, brows, mouth, and eye whites.

### Expression Definitions

| Expression | Eyes | Eye whites | Brows | Mouth |
|-----------|------|------------|-------|-------|
| **happy** | normal (default) | default | hidden | rest (smile) |
| **excited** | closed-happy both | hidden | hidden | AEI (open) |
| **surprised** | normal, r=80, cy=1120 | ry=280 | raised arcs (y~770-815) | O |
| **sad** | normal, cy=1150, r=85 | ry=220, cy=1130 | inner-down slant | frown curve |
| **angry** | normal, cy=1140, r=90 | ry=200, cy=1130 | V-shaped angry (outer high, inner low) | BMP (pressed lips) |
| **love** | heart (scale 1.2) both | default | hidden | wide smile curve |
| **sleepy** | closed-sleepy both | ry=160, cy=1130 | hidden | small smile |
| **skeptical** | L: normal cx=950; R: normal cx=1445 r=80 | R: ry=170 cy=1140 | L only: raised arc | crooked smile |
| **cheeky** | L: normal; R: wink | R: ry=170 cy=1130 | hidden | AEI |
| **dead** | X both | hidden | hidden | wobbly line |
| **lookaway** | both shifted left (cx-45, cy-20) | default | hidden | small smile |

---

## 6. Volume-Based Mouth Sync

During audio playback, analyze volume and map to 5 levels:

```
avg < 5    → level 0 → rest
avg < 25   → level 1 → BMP
avg < 55   → level 2 → CDNSTZ
avg < 100  → level 3 → Ee
avg >= 100 → level 4 → AEI
```

- Use `AVAudioEngine` installTap to get RMS/frequency data
- Update mouth shape every frame (~60fps via CADisplayLink)
- When audio stops, wait 300ms then return to rest (more chunks may arrive)

---

## 7. Audio Pipeline (iOS)

### Mic capture
```swift
let audioEngine = AVAudioEngine()
let inputNode = audioEngine.inputNode
let inputFormat = inputNode.outputFormat(forBus: 0) // typically 48kHz

// Install tap, downsample 48kHz → 16kHz
inputNode.installTap(onBus: 0, bufferSize: 4096, format: inputFormat) { buffer, time in
    let pcm16k = downsample(buffer, from: inputFormat.sampleRate, to: 16000)
    let base64 = pcm16k.toBase64()
    websocket.send("{\"user_audio_chunk\":\"\(base64)\"}")
}
```

### Downsampling
```
ratio = inputSampleRate / 16000
for i in 0..<outputLength:
    srcIndex = floor(i * ratio)
    clamp input[srcIndex] to [-1, 1]
    output[i] = Int16(sample * 32767)  // or * 32768 for negative
```

### Playback
- Receive base64 PCM chunks → decode to Int16 → convert to Float32
- Create `AVAudioPCMBuffer` at 16kHz, schedule on `AVAudioPlayerNode`
- Chain: playerNode → analyser tap (for mouth sync) → mainMixerNode → output

### Echo cancellation
Enable `AVAudioSession` voice chat mode:
```swift
try AVAudioSession.sharedInstance().setCategory(.playAndRecord, mode: .voiceChat)
```

---

## 8. ElevenLabs iOS SDK Alternative

Instead of raw WebSocket, you can use the official SDK:

```swift
// Package: https://github.com/elevenlabs/ElevenLabsSwift
import ElevenLabsSDK

let conversation = try await ElevenLabsSDK.Conversation.startSession(
    agentId: agentId,  // from your backend
    // or use signedUrl from /api/conversation-url
)
```

The SDK handles WebSocket, audio capture, and playback. You'd hook into its callbacks to drive the mouth animation.

---

## 9. App Context Injection (WebView)

When loading Toni in a WKWebView, inject the app context at document start:

```swift
let context = """
  window.setAppContext({
    platform: "iOS",
    device: "\(deviceString)",
    app: "\(appVersion)",
    environment: "\(environment)",
    userId: "\(userId)",
    userType: "\(userType)",
    organization: "\(orgId)",
    locale: "\(locale)",
    language: "\(language)",
    entrypoint: "\(entrypoint)"
  });
"""

let script = WKUserScript(
    source: context,
    injectionTime: .atDocumentEnd,
    forMainFrameOnly: true
)
webView.configuration.userContentController.addUserScript(script)
```

### What Toni does with context
- **language** — passed to the backend to create agents in the correct language (e.g. `de` for German)
- **entrypoint** — logged, can be used to customize Toni's behavior per exercise type
- **userId / organization** — available for analytics or personalization

### Receiving messages from Toni
Register a message handler to get callbacks:

```swift
webView.configuration.userContentController.add(self, name: "toni")

func userContentController(_ controller: WKUserContentController,
                          didReceive message: WKScriptMessage) {
    guard let body = message.body as? [String: Any],
          let type = body["type"] as? String else { return }

    switch type {
    case "ready":
        print("Toni is loaded and ready")
    default:
        break
    }
}
```

---

## 10. File Inventory

```
ios-handoff/
├── SPEC.md          ← This file
├── API.md           ← Backend API contract + WebSocket protocol
└── assets/
    └── toni-body.svg  ← Body SVG paths (import as asset or parse paths)
```

The backend (server.js) stays on Railway — the iOS app calls it for signed URLs and text chat.
