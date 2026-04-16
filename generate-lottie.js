#!/usr/bin/env node
/**
 * Generate Lottie JSON for Toni character.
 * Strategy: render SVG to PNG, embed as image asset, animate eyes on top.
 */

import fs from 'fs';

const FPS = 24;
const TOTAL_FRAMES = 120;
const WIDTH = 512;
const HEIGHT = 512;
const S = WIDTH / 2404; // scale factor

// ─── Lottie helpers ──────────────────────────────────────────────────

function sv(val) { return { a: 0, k: val }; }

function hexToRGB(hex) {
  hex = hex.replace('#', '');
  return [
    parseInt(hex.substr(0, 2), 16) / 255,
    parseInt(hex.substr(2, 2), 16) / 255,
    parseInt(hex.substr(4, 2), 16) / 255
  ];
}

// ─── Animations ─────────────────────────────────────────────────────

function floatPosition(cx, cy) {
  return {
    a: 1,
    k: [
      { t: 0,   s: [cx, cy],     i: { x: [0.42,0.42], y: [1,1] }, o: { x: [0.58,0.58], y: [0,0] } },
      { t: 30,  s: [cx, cy - 6], i: { x: [0.42,0.42], y: [1,1] }, o: { x: [0.58,0.58], y: [0,0] } },
      { t: 60,  s: [cx, cy],     i: { x: [0.42,0.42], y: [1,1] }, o: { x: [0.58,0.58], y: [0,0] } },
      { t: 90,  s: [cx, cy + 6], i: { x: [0.42,0.42], y: [1,1] }, o: { x: [0.58,0.58], y: [0,0] } },
      { t: 120, s: [cx, cy] }
    ]
  };
}

function breathScale() {
  return {
    a: 1,
    k: [
      { t: 0,   s: [100, 100],     i: { x: [0.42,0.42], y: [1,1] }, o: { x: [0.58,0.58], y: [0,0] } },
      { t: 30,  s: [100.3, 100.6], i: { x: [0.42,0.42], y: [1,1] }, o: { x: [0.58,0.58], y: [0,0] } },
      { t: 60,  s: [100, 100],     i: { x: [0.42,0.42], y: [1,1] }, o: { x: [0.58,0.58], y: [0,0] } },
      { t: 90,  s: [100.3, 100.6], i: { x: [0.42,0.42], y: [1,1] }, o: { x: [0.58,0.58], y: [0,0] } },
      { t: 120, s: [100, 100] }
    ]
  };
}

// Blink via opacity on the eyes layer (0 = hidden during blink)
// Using hold keyframes (h: 1) for instant on/off
function blinkOpacity() {
  return {
    a: 1,
    k: [
      { t: 0,  s: [100], h: 1 },
      { t: 50, s: [0],   h: 1 },
      { t: 53, s: [100], h: 1 },
      { t: 89, s: [0],   h: 1 },
      { t: 92, s: [100], h: 1 }
    ]
  };
}

// ─── Build using ONLY shape layers (no images) ─────────────────────
// Use filled paths for the scribble ball body instead of stroked paths

// The Toni body is a scribble ball. Since converting SVG stroke paths to Lottie
// doesn't work reliably, we'll draw the body as a simple filled ellipse
// approximation that captures the essence of Toni's shape, plus the face on top.

function makeBodyLayer() {
  // Toni's body center is approximately at (1160, 1180) in 2404-space
  // The scribble fills roughly a 1600x1400 area
  const bodyCx = 1160 * S;
  const bodyCy = 1180 * S;
  const bodyRx = 820 * S;
  const bodyRy = 720 * S;

  return {
    ddd: 0,
    ty: 4,
    nm: 'Body',
    sr: 1,
    ks: {
      o: sv(100),
      r: sv(0),
      p: floatPosition(256, 256),
      a: sv([256, 256]),
      s: breathScale()
    },
    ao: 0,
    shapes: [
      // Outer body (dark blue) — slightly larger
      {
        ty: 'gr',
        nm: 'Body Outer',
        it: [
          { ty: 'el', p: sv([bodyCx, bodyCy]), s: sv([(bodyRx + 15) * 2, (bodyRy + 15) * 2]), d: 1 },
          { ty: 'fl', c: sv([...hexToRGB('#2833AC'), 1]), o: sv(100), r: 1 },
          { ty: 'tr', p: sv([0, 0]), a: sv([0, 0]), s: sv([100, 100]), r: sv(0), o: sv(100) }
        ]
      },
      // Inner body (primary blue)
      {
        ty: 'gr',
        nm: 'Body Inner',
        it: [
          { ty: 'el', p: sv([bodyCx, bodyCy]), s: sv([bodyRx * 2, bodyRy * 2]), d: 1 },
          { ty: 'fl', c: sv([...hexToRGB('#3949F5'), 1]), o: sv(100), r: 1 },
          { ty: 'tr', p: sv([0, 0]), a: sv([0, 0]), s: sv([100, 100]), r: sv(0), o: sv(100) }
        ]
      },
    ],
    ip: 0,
    op: TOTAL_FRAMES,
    st: 0,
    bm: 0
  };
}

function makeEyesLayer() {
  function eyeShapes(side) {
    const isLeft = side === 'left';
    const wCx = (isLeft ? 915 : 1413) * S;
    const wCy = 1116 * S;
    const wRx = 130 * S;
    const wRy = 190 * S;
    const pCx = (isLeft ? 940 : 1438) * S;
    const pCy = 1130 * S;
    const pR = 70 * S;
    const hCx = (isLeft ? 960 : 1458) * S;
    const hCy = 1100 * S;
    const hR = 20 * S;

    return [
      {
        ty: 'gr', nm: `${side} white`,
        it: [
          { ty: 'el', p: sv([wCx, wCy]), s: sv([wRx * 2, wRy * 2]), d: 1 },
          { ty: 'fl', c: sv([1, 1, 1, 1]), o: sv(100), r: 1 },
          { ty: 'tr', p: sv([0, 0]), a: sv([0, 0]), s: sv([100, 100]), r: sv(0), o: sv(100) }
        ]
      },
      {
        ty: 'gr', nm: `${side} pupil`,
        it: [
          { ty: 'el', p: sv([pCx, pCy]), s: sv([pR * 2, pR * 2]), d: 1 },
          { ty: 'fl', c: sv([...hexToRGB('#0B0F31'), 1]), o: sv(100), r: 1 },
          { ty: 'tr', p: sv([0, 0]), a: sv([0, 0]), s: sv([100, 100]), r: sv(0), o: sv(100) }
        ]
      },
      {
        ty: 'gr', nm: `${side} highlight`,
        it: [
          { ty: 'el', p: sv([hCx, hCy]), s: sv([hR * 2, hR * 2]), d: 1 },
          { ty: 'fl', c: sv([1, 1, 1, 1]), o: sv(100), r: 1 },
          { ty: 'tr', p: sv([0, 0]), a: sv([0, 0]), s: sv([100, 100]), r: sv(0), o: sv(100) }
        ]
      }
    ];
  }

  // Blink is done via layer opacity (eyes disappear briefly)
  return {
    ddd: 0, ty: 4, nm: 'Eyes', sr: 1,
    ks: {
      o: blinkOpacity(), r: sv(0),
      p: floatPosition(256, 256),
      a: sv([256, 256]),
      s: breathScale()
    },
    ao: 0,
    shapes: [...eyeShapes('left'), ...eyeShapes('right')],
    ip: 0, op: TOTAL_FRAMES, st: 0, bm: 0
  };
}

function makeMouthLayer() {
  // Smile as a quadratic curve: M961,1490 Q1161,1570 1361,1490
  // Convert Q to cubic: cp1 = start + 2/3*(ctrl-start), cp2 = end + 2/3*(ctrl-end)
  const sx = 961*S, sy = 1490*S;
  const qx = 1161*S, qy = 1570*S;
  const ex = 1361*S, ey = 1490*S;
  const c1x = sx + 2/3*(qx-sx), c1y = sy + 2/3*(qy-sy);
  const c2x = ex + 2/3*(qx-ex), c2y = ey + 2/3*(qy-ey);

  const smilePath = {
    v: [[sx, sy], [ex, ey]],
    i: [[0, 0], [c2x - ex, c2y - ey]],
    o: [[c1x - sx, c1y - sy], [0, 0]],
    c: false
  };

  return {
    ddd: 0, ty: 4, nm: 'Mouth', sr: 1,
    ks: {
      o: sv(100), r: sv(0),
      p: floatPosition(256, 256),
      a: sv([256, 256]),
      s: breathScale()
    },
    ao: 0,
    shapes: [
      {
        ty: 'gr', nm: 'Smile',
        it: [
          { ty: 'sh', ks: sv(smilePath) },
          { ty: 'st', c: sv([...hexToRGB('#0B0F31'), 1]), o: sv(100), w: sv(46 * S), lc: 2, lj: 1, ml: 4 },
          { ty: 'tr', p: sv([0, 0]), a: sv([0, 0]), s: sv([100, 100]), r: sv(0), o: sv(100) }
        ]
      }
    ],
    ip: 0, op: TOTAL_FRAMES, st: 0, bm: 0
  };
}

// ─── Assemble ────────────────────────────────────────────────────────

const lottie = {
  v: '5.7.4',
  fr: FPS,
  ip: 0,
  op: TOTAL_FRAMES,
  w: WIDTH,
  h: HEIGHT,
  nm: 'Toni',
  ddd: 0,
  assets: [],
  layers: [
    makeMouthLayer(),
    makeEyesLayer(),
    makeBodyLayer()
  ],
  markers: []
};

const output = JSON.stringify(lottie, null, 2);
fs.writeFileSync('/Users/juliahollitsch/toni/toni-lottie.json', output);
console.log(`Lottie JSON written (${(output.length / 1024).toFixed(1)} KB)`);
console.log('Layers:', lottie.layers.map(l => l.nm).join(', '));
