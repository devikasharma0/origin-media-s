// Original sound design for live_countdown.html.
// Run from origin-renders/: node make-audio.js
// Writes audio/live-countdown.wav.
const fs = require('fs');

const SR = 48000;
const DUR = 15;
const N = SR * DUR;
const TAU = Math.PI * 2;
const L = new Float32Array(N);
const R = new Float32Array(N);
const SL = new Float32Array(N);
const SR2 = new Float32Array(N);

let seed = 12345;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const noise = () => rnd() * 2 - 1;
const fadeIn = (x, a) => (x < a ? x / a : 1);

function put(t0, dur, fn, { gain = 1, pan = 0, send = 0 } = {}) {
  const s0 = Math.floor(t0 * SR);
  const n = Math.floor(dur * SR);
  const gl = gain * Math.cos((pan + 1) * Math.PI / 4);
  const gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < n; i++) {
    const k = s0 + i;
    if (k < 0 || k >= N) continue;
    const v = fn(i / SR);
    L[k] += v * gl;
    R[k] += v * gr;
    if (send) {
      SL[k] += v * gl * send;
      SR2[k] += v * gr * send;
    }
  }
}

function tick(t, f, pan, gain = 0.4) {
  put(t, 0.08, x => noise() * Math.exp(-x / 0.004) * 0.6 + Math.sin(TAU * f * x) * Math.exp(-x / 0.012), { gain, pan, send: 0.15 });
}

function kick(t, gain, f0 = 120, f1 = 42, dec = 0.18) {
  let ph = 0;
  put(t, 0.7, x => {
    const f = f1 + (f0 - f1) * Math.exp(-x / 0.04);
    ph += TAU * f / SR;
    return Math.sin(ph) * Math.exp(-x / dec) * fadeIn(x, 0.002);
  }, { gain });
}

function hat(t, gain) {
  let lp = 0;
  put(t, 0.06, x => {
    const n = noise();
    lp += 0.5 * (n - lp);
    return (n - lp) * Math.exp(-x / 0.012);
  }, { gain, pan: 0.2, send: 0.1 });
}

function blip(t, f, dur, gain, send = 0.3, pan = 0) {
  put(t, dur, x => Math.sin(TAU * f * x) * fadeIn(x, 0.004) * Math.min(1, (dur - x) / 0.01), { gain, send, pan });
}

function glint(t, f, gain, pan) {
  put(t, 0.4, x => Math.sin(TAU * f * x) * Math.exp(-x / 0.07) * fadeIn(x, 0.002), { gain, pan, send: 0.5 });
}

function pluck(t, f, gain) {
  put(t, 1.5, x => {
    let v = 0;
    for (let h = 1; h <= 4; h++) v += Math.sin(TAU * f * h * x) * Math.exp(-x * h / 0.35) / Math.pow(h, 1.5);
    return v * fadeIn(x, 0.003);
  }, { gain, send: 0.45 });
}

function bell(t, freqs, gain) {
  put(t, 3, x => {
    let v = 0;
    for (const f of freqs) {
      v += Math.sin(TAU * f * x) * Math.exp(-x / 1.4);
      v += 0.3 * Math.sin(TAU * f * 2.76 * x) * Math.exp(-x / 0.4);
    }
    return v * fadeIn(x, 0.004);
  }, { gain, send: 0.5 });
}

function whoosh(t, dur, gain, f0, f1) {
  let a1 = 0;
  let a2 = 0;
  put(t, dur, x => {
    const p = x / dur;
    const fc = f0 * Math.pow(f1 / f0, Math.sin(Math.PI * p * 0.5));
    const a = 1 - Math.exp(-TAU * fc / SR);
    const n = noise();
    a1 += a * (n - a1);
    a2 += a * 0.35 * (n - a2);
    return (a1 - a2) * Math.pow(Math.sin(Math.PI * p), 2);
  }, { gain, send: 0.25 });
}

for (let k = 0; k < 5; k++) {
  const t = 0.5 + k;
  tick(t, k % 2 ? 1800 : 2200, k % 2 ? 0.15 : -0.15);
  tick(t + 0.5, 1500, 0, 0.18);
  kick(t, 0.45 + 0.1 * k);
}

{
  let ph = 0;
  let lp = 0;
  const T = 5.55;
  put(0.3, T, x => {
    const p = x / T;
    const f = 180 * Math.pow(5, p);
    ph += TAU * f / SR;
    const fc = 300 + 6000 * p * p;
    const a = 1 - Math.exp(-TAU * fc / SR);
    lp += a * (noise() - lp);
    return (lp * 0.8 + Math.sin(ph) * 0.3 + Math.sin(ph * 1.5) * 0.12) * Math.pow(p, 2.2) * Math.min(1, (T - x) / 0.04);
  }, { gain: 0.35, send: 0.2 });
}

{
  let lp = 0;
  put(5.45, 0.4, x => {
    const p = x / 0.4;
    const n = noise();
    lp += 0.08 * (n - lp);
    return (n - lp) * Math.pow(p, 3) * Math.min(1, (0.4 - x) / 0.01);
  }, { gain: 0.3, send: 0.3 });
}

{
  let ph = 0;
  put(5.9, 2.5, x => {
    const f = 30 + 45 * Math.exp(-x / 0.25);
    ph += TAU * f / SR;
    return Math.sin(ph) * Math.exp(-x / 1.1) * fadeIn(x, 0.003);
  }, { gain: 0.9 });
  let lp = 0;
  put(5.9, 1.2, x => {
    const fc = 150 + 2500 * Math.exp(-x / 0.08);
    const a = 1 - Math.exp(-TAU * fc / SR);
    lp += a * (noise() - lp);
    return lp * Math.exp(-x / 0.35);
  }, { gain: 0.9, send: 0.35 });
  put(5.9, 0.15, x => noise() * Math.exp(-x / 0.02), { gain: 0.35, send: 0.3 });
}

for (let i = 0; i < 60; i++) {
  glint(5.95 + Math.pow(rnd(), 1.6) * 2.6, 2500 + rnd() * 4500, 0.05 + rnd() * 0.05, rnd() * 1.6 - 0.8);
}

blip(6.02, 1000, 0.09, 0.18);
blip(6.17, 1500, 0.12, 0.18);

for (const f0 of [146.83, 220, 293.66, 369.99, 659.25]) {
  for (const det of [-0.0025, 0.0025]) {
    let ph = 0;
    let lp = 0;
    const f = f0 * (1 + det);
    put(6.0, 9.0, x => {
      ph += TAU * f / SR;
      let v = 0;
      for (let h = 1; h <= 6; h++) v += Math.sin(ph * h) / h;
      lp += 0.08 * (v - lp);
      return lp * fadeIn(x, 1.2) * Math.min(1, (9 - x) / 1.2) * (0.85 + 0.15 * Math.sin(TAU * 0.25 * x));
    }, { gain: 0.05, pan: det > 0 ? 0.3 : -0.3, send: 0.3 });
  }
}

for (let b = 0; b < 6; b++) {
  kick(6.4 + b * 0.5, 0.35, 100, 45, 0.14);
  hat(6.65 + b * 0.5, 0.25);
}

const E = 9.9;
[587.33, 739.99, 880].forEach((f, i) => pluck(E + i * 0.11, f, 0.22));
whoosh(E + 0.85, 1.1, 1.2, 400, 3200);
blip(E + 1.85, 2637, 0.08, 0.1, 0.4, -0.2);
blip(E + 1.98, 3136, 0.08, 0.1, 0.4, 0.2);
whoosh(E + 2.0, 0.35, 0.5, 1500, 4000);
bell(E + 2.55, [587.33, 880, 1174.66], 0.1);
blip(E + 3.25, 1760, 0.1, 0.06, 0.4);

function reverb(inp, spread) {
  const size = delay => Math.round((delay + spread) * SR / 44100);
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map(delay => ({
    buffer: new Float32Array(size(delay)),
    index: 0,
    filter: 0,
  }));
  const allPasses = [556, 441, 341, 225].map(delay => ({ buffer: new Float32Array(size(delay)), index: 0 }));
  const out = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    const x = inp[n] * 0.015;
    let y = 0;
    for (const comb of combs) {
      const delayed = comb.buffer[comb.index];
      comb.filter = delayed * 0.75 + comb.filter * 0.25;
      comb.buffer[comb.index] = x + comb.filter * 0.82;
      comb.index = (comb.index + 1) % comb.buffer.length;
      y += delayed;
    }
    for (const allPass of allPasses) {
      const delayed = allPass.buffer[allPass.index];
      const value = -y + delayed;
      allPass.buffer[allPass.index] = y + delayed * 0.5;
      allPass.index = (allPass.index + 1) % allPass.buffer.length;
      y = value;
    }
    out[n] = y;
  }
  return out;
}

const wetL = reverb(SL, 0);
const wetR = reverb(SR2, 23);
let peak = 0;
for (let i = 0; i < N; i++) {
  L[i] = Math.tanh((L[i] + wetL[i] * 1.5) * 1.1);
  R[i] = Math.tanh((R[i] + wetR[i] * 1.5) * 1.1);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}

if (peak === 0) throw new Error('Generated audio is silent.');
const normalization = 0.89 / peak;
const audioDir = 'audio';
fs.mkdirSync(audioDir, { recursive: true });
const outputPath = `${audioDir}/live-countdown.wav`;
const wav = Buffer.alloc(44 + N * 4);
wav.write('RIFF', 0);
wav.writeUInt32LE(36 + N * 4, 4);
wav.write('WAVE', 8);
wav.write('fmt ', 12);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(SR, 24);
wav.writeUInt32LE(SR * 4, 28);
wav.writeUInt16LE(4, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(N * 4, 40);

for (let i = 0; i < N; i++) {
  const fade = i > N - SR * 0.5 ? (N - i) / (SR * 0.5) : 1;
  const left = Math.max(-1, Math.min(1, L[i] * normalization * fade));
  const right = Math.max(-1, Math.min(1, R[i] * normalization * fade));
  wav.writeInt16LE(Math.round(left * 32767), 44 + i * 4);
  wav.writeInt16LE(Math.round(right * 32767), 46 + i * 4);
}

fs.writeFileSync(outputPath, wav);
console.log(`Done: ${outputPath}`);
