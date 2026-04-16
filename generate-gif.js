#!/usr/bin/env node
/**
 * Generate an animated GIF of Toni with float + blink.
 * Uses node-canvas to render SVG frames and gif-encoder-2 to assemble.
 */

import { createCanvas } from 'canvas';
import GIFEncoder from 'gif-encoder-2';
import fs from 'fs';

const SIZE = 512;
const FPS = 20;
const DURATION = 4; // seconds
const TOTAL_FRAMES = FPS * DURATION;

// Blink config
const BLINK_FRAMES = [
  { start: Math.floor(TOTAL_FRAMES * 0.4), duration: 3 },  // ~1.6s
  { start: Math.floor(TOTAL_FRAMES * 0.75), duration: 3 },  // ~3s
];

// Float config: oscillate Y over the loop
function getFloatY(frame) {
  const t = frame / TOTAL_FRAMES;
  return Math.sin(t * Math.PI * 2) * 8; // ±8px
}

// Breath config: subtle scale
function getBreathScale(frame) {
  const t = frame / TOTAL_FRAMES;
  return 1 + Math.sin(t * Math.PI * 4) * 0.005; // ±0.5%
}

function isBlinkFrame(frame) {
  for (const blink of BLINK_FRAMES) {
    if (frame >= blink.start && frame < blink.start + blink.duration) return true;
  }
  return false;
}

function drawToni(ctx, frame) {
  const floatY = getFloatY(frame);
  const scale = getBreathScale(frame);
  const blinking = isBlinkFrame(frame);

  ctx.clearRect(0, 0, SIZE, SIZE);

  // Center and apply float + breath
  ctx.save();
  ctx.translate(SIZE / 2, SIZE / 2 + floatY);
  ctx.scale(scale, scale);
  ctx.translate(-SIZE / 2, -SIZE / 2);

  // Scale from SVG 2404 to 512
  const S = SIZE / 2404;
  ctx.save();
  ctx.scale(S, S);

  // ── Draw body strokes ──
  // Dark blue layer (back)
  ctx.strokeStyle = '#2833AC';
  ctx.lineWidth = 186;
  ctx.lineCap = 'square';
  ctx.lineJoin = 'miter';

  drawBodyPath(ctx);

  // Primary blue layer (front, offset slightly)
  ctx.save();
  ctx.translate(-50, -26);
  ctx.strokeStyle = '#3949F5';
  drawBodyPath(ctx);
  ctx.restore();

  // ── Draw face ──
  // Eye whites
  drawEllipse(ctx, 915, 1116, 130, blinking ? 15 : 190, 'white');
  drawEllipse(ctx, 1413, 1116, 130, blinking ? 15 : 190, 'white');

  if (!blinking) {
    // Pupils
    drawCircle(ctx, 940, 1130, 70, '#0B0F31');
    drawCircle(ctx, 1438, 1130, 70, '#0B0F31');
    // Highlights
    drawCircle(ctx, 960, 1100, 20, 'white');
    drawCircle(ctx, 1458, 1100, 20, 'white');
  }

  // Mouth (smile curve)
  ctx.beginPath();
  ctx.moveTo(961, 1490);
  ctx.quadraticCurveTo(1161, 1570, 1361, 1490);
  ctx.strokeStyle = '#0B0F31';
  ctx.lineWidth = 46;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.restore(); // S scale
  ctx.restore(); // float/breath
}

function drawBodyPath(ctx) {
  // Sub-path 1
  ctx.beginPath();
  ctx.moveTo(259.679, 1716);
  ctx.bezierCurveTo(143.679, 1467, 260.367, 1153.79, 581.626, 1070.2);
  ctx.bezierCurveTo(902.886, 986.605, 1766.48, 982.673, 1882.89, 1070.2);
  ctx.stroke();

  // Sub-path 2
  ctx.beginPath();
  ctx.moveTo(1882.89, 1070.2);
  ctx.bezierCurveTo(2028.4, 1179.61, 1550.29, 1843.19, 1342.41, 1843.19);
  ctx.bezierCurveTo(1194.92, 1843.19, 1274.58, 913.746, 1445.26, 840.442);
  ctx.bezierCurveTo(1502.37, 815.913, 1553.97, 784.523, 1602.81, 756.357);
  ctx.stroke();

  // Sub-path 3
  ctx.beginPath();
  ctx.moveTo(1882.89, 1070.2);
  ctx.bezierCurveTo(1995.58, 1151.53, 2180.68, 1273.5, 2060.68, 1609.5);
  ctx.stroke();

  // Sub-path 4
  ctx.beginPath();
  ctx.moveTo(1882.89, 1070.2);
  ctx.bezierCurveTo(1912.43, 1016.07, 1957.29, 902.283, 2217.68, 969.022);
  ctx.stroke();

  // Sub-path 5
  ctx.beginPath();
  ctx.moveTo(1602.81, 756.357);
  ctx.bezierCurveTo(1699.91, 700.352, 1786.07, 657.096, 1882.89, 705.87);
  ctx.bezierCurveTo(2028.4, 779.174, 1312.87, 1931.81, 1022.94, 1882.58);
  ctx.bezierCurveTo(687.484, 1825.61, 1213.31, 806.844, 1602.81, 756.357);
  ctx.stroke();

  // Sub-path 6
  ctx.beginPath();
  ctx.moveTo(1602.81, 756.357);
  ctx.bezierCurveTo(1436.87, 1132.3, 994.495, 1843.19, 683.776, 1843.19);
  ctx.bezierCurveTo(295.377, 1843.19, 1024.04, 539.048, 1400.4, 551.083);
  ctx.bezierCurveTo(1609.24, 557.761, 1479.53, 917.086, 1178.3, 1217.34);
  ctx.stroke();

  // Sub-path 7
  ctx.beginPath();
  ctx.moveTo(1178.3, 1217.34);
  ctx.bezierCurveTo(936.673, 1458.19, 669.381, 1637.95, 539.358, 1583.9);
  ctx.bezierCurveTo(366.492, 1512.03, 453.093, 966.993, 733.179, 756.357);
  ctx.bezierCurveTo(1013.26, 545.721, 1433.22, 550.493, 1178.3, 1217.34);
  ctx.stroke();
}

function drawEllipse(ctx, cx, cy, rx, ry, color) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawCircle(ctx, cx, cy, r, color) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

// ── Generate GIF ──────────────────────────────────────────────────────

console.log(`Generating ${TOTAL_FRAMES} frames at ${FPS}fps (${DURATION}s loop)...`);

const canvas = createCanvas(SIZE, SIZE);
const ctx = canvas.getContext('2d');

const encoder = new GIFEncoder(SIZE, SIZE, 'neuquant', true);
encoder.setDelay(Math.round(1000 / FPS));
encoder.setRepeat(0); // loop forever
encoder.setQuality(10);
encoder.setTransparent(0x00000000); // transparent background

encoder.start();

for (let i = 0; i < TOTAL_FRAMES; i++) {
  drawToni(ctx, i);
  encoder.addFrame(ctx);
  if (i % 10 === 0) process.stdout.write(`\rFrame ${i + 1}/${TOTAL_FRAMES}`);
}

encoder.finish();

const buffer = encoder.out.getData();
fs.writeFileSync('/Users/juliahollitsch/toni/toni-animated.gif', buffer);
console.log(`\nGIF saved: toni-animated.gif (${(buffer.length / 1024).toFixed(1)} KB)`);
