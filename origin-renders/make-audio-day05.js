// make-audio-day05.js — original upbeat track (120 BPM) synced to day05-departures.html
// Usage: node make-audio-day05.js  ->  audio/day05-departures.wav
const fs = require('fs');
const SR = 48000, DUR = 15, N = SR * DUR, TAU = Math.PI * 2, BEAT = 0.5;
const L = new Float32Array(N), R = new Float32Array(N), SL = new Float32Array(N), SR2 = new Float32Array(N);
let seed = 2027;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const noise = () => rnd() * 2 - 1;
const fadeIn = (x, a) => (x < a ? x / a : 1);
const duck = t => 1 - 0.55 * Math.exp(-(t % BEAT) / 0.09); // sidechain pump

function put(t0, dur, fn, { gain = 1, pan = 0, send = 0 } = {}) {
  const s0 = Math.floor(t0 * SR), n = Math.floor(dur * SR);
  const gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < n; i++) {
    const k = s0 + i; if (k < 0 || k >= N) continue;
    const v = fn(i / SR);
    L[k] += v * gl; R[k] += v * gr;
    if (send) { SL[k] += v * gl * send; SR2[k] += v * gr * send; }
  }
}
const saw = (ph, H) => { let v = 0; for (let h = 1; h <= H; h++) v += Math.sin(ph * h) / h; return v * 0.55; };

// ---------- instruments ----------
function kick(t, gain, f0 = 130, f1 = 45, dec = 0.16) {
  let ph = 0;
  put(t, 0.6, x => { const f = f1 + (f0 - f1) * Math.exp(-x / 0.035); ph += TAU * f / SR; return Math.sin(ph) * Math.exp(-x / dec) * fadeIn(x, 0.002); }, { gain });
}
function hat(t, gain, open = false) {
  let lp = 0; const d = open ? 0.07 : 0.014;
  put(t, open ? 0.25 : 0.06, x => { const n = noise(); lp += 0.5 * (n - lp); return (n - lp) * Math.exp(-x / d); }, { gain, pan: 0.2, send: 0.08 });
}
function clap(t, gain) {
  let lp = 0;
  put(t, 0.3, x => { const n = noise(); lp += 0.3 * (n - lp); let e = 0; for (const d of [0, 0.011, 0.022]) if (x >= d) e += Math.exp(-(x - d) / (d === 0.022 ? 0.07 : 0.008)); return (n - lp) * e; }, { gain, send: 0.3 });
}
function crash(t, gain) {
  let lp = 0;
  put(t, 1.4, x => { const n = noise(); lp += 0.6 * (n - lp); return (n - lp) * Math.exp(-x / 0.45); }, { gain, send: 0.4 });
}
function bass(t, f, dur, gain, cut) {
  let ph = 0, lp = 0;
  put(t, dur, x => { ph += TAU * f / SR; const fc = cut * (0.35 + 0.65 * Math.exp(-x / 0.08)), a = 1 - Math.exp(-TAU * fc / SR); lp += a * (saw(ph, 10) - lp); return lp * fadeIn(x, 0.003) * Math.min(1, (dur - x) / 0.01) * duck(t + x); }, { gain });
}
function stab(t, fr, dur, gain, cut) {
  const o = fr.map(() => ({ p: 0, l: 0 })), a = 1 - Math.exp(-TAU * cut / SR);
  put(t, dur, x => { let s = 0; fr.forEach((f, i) => { const q = o[i]; q.p += TAU * f / SR; q.l += a * (saw(q.p, 8) - q.l); s += q.l; }); return s * Math.exp(-x / 0.14) * fadeIn(x, 0.004) * Math.min(1, (dur - x) / 0.01); }, { gain, send: 0.35 });
}
function flutter(t, dur, gain) { // split-flap clatter
  for (let k = 0; ; k++) {
    const tt = k * 0.028 + rnd() * 0.008; if (tt > dur) break;
    if (rnd() > 1 - (tt / dur) * 0.6) continue;
    const f = 1800 + rnd() * 1500, g = gain * (0.6 + 0.4 * rnd()), p = rnd() * 0.8 - 0.4;
    put(t + tt, 0.02, x => (noise() * 0.7 + Math.sin(TAU * f * x) * 0.5) * Math.exp(-x / 0.003), { gain: g, pan: p, send: 0.05 });
  }
}
function whoosh(t, dur, gain, f0, f1) {
  let a1 = 0, a2 = 0;
  put(t, dur, x => { const p = x / dur, fc = f0 * Math.pow(f1 / f0, Math.sin(Math.PI * p * 0.5)), a = 1 - Math.exp(-TAU * fc / SR), n = noise(); a1 += a * (n - a1); a2 += a * 0.35 * (n - a2); return (a1 - a2) * Math.pow(Math.sin(Math.PI * p), 2); }, { gain, send: 0.25 });
}
function riser(t0, dur, gain) {
  let lp = 0, ph = 0;
  put(t0, dur, x => { const p = x / dur, fc = 300 + 8000 * p * p, a = 1 - Math.exp(-TAU * fc / SR); lp += a * (noise() - lp); ph += TAU * (200 * Math.pow(4, p)) / SR; return (lp * 0.8 + Math.sin(ph) * 0.25) * p * p * Math.min(1, (dur - x) / 0.02); }, { gain, send: 0.2 });
}
function swell(t0, dur, gain) {
  let lp = 0;
  put(t0, dur, x => { const p = x / dur, n = noise(); lp += 0.08 * (n - lp); return (n - lp) * p * p * p * Math.min(1, (dur - x) / 0.01); }, { gain, send: 0.3 });
}
function impact(t, gain) {
  kick(t, 0.9 * gain, 150, 40, 0.3);
  let ph = 0;
  put(t, 2, x => { const f = 30 + 45 * Math.exp(-x / 0.25); ph += TAU * f / SR; return Math.sin(ph) * Math.exp(-x / 0.9) * fadeIn(x, 0.003); }, { gain: 0.7 * gain });
  crash(t, 0.3 * gain);
}
function pluck(t, f, gain) {
  put(t, 1.5, x => { let v = 0; for (let h = 1; h <= 4; h++) v += Math.sin(TAU * f * h * x) * Math.exp(-x * h / 0.35) / Math.pow(h, 1.5); return v * fadeIn(x, 0.003); }, { gain, send: 0.45 });
}
function bell(t, freqs, gain) {
  put(t, 2.5, x => { let v = 0; for (const f of freqs) { v += Math.sin(TAU * f * x) * Math.exp(-x / 1.2); v += 0.3 * Math.sin(TAU * f * 2.76 * x) * Math.exp(-x / 0.4); } return v * fadeIn(x, 0.004); }, { gain, send: 0.5 });
}
function blip(t, f, dur, gain, pan = 0) {
  put(t, dur, x => Math.sin(TAU * f * x) * fadeIn(x, 0.004) * Math.min(1, (dur - x) / 0.01), { gain, send: 0.4, pan });
}

// ---------- harmony: Am – F – C – G, one chord per bar (2s) ----------
const CH = [{ r: 110, n: [220, 261.63, 329.63] }, { r: 87.31, n: [174.61, 220, 261.63] }, { r: 130.81, n: [196, 261.63, 329.63] }, { r: 98, n: [196, 246.94, 293.66] }];
const chordAt = t => CH[Math.floor(t / 2) % 4];

// ---------- 0.5–5.0  Intro: "Leave these behind" ----------
for (let k = 1; k < 10; k++) kick(k * BEAT, 0.55);
for (let k = 1; k < 10; k++) { const t = k * BEAT + 0.25; hat(t, 0.22); stab(t, chordAt(t).n, 0.22, 0.09, 700); }
[0.5, 1.5, 2.5, 3.5, 5.5, 6, 6.5, 7].forEach(t => flutter(t, 0.55, 0.22)); // board flips
[4, 4.25, 4.5, 4.75].forEach((t, i) => whoosh(t, 0.22, 0.6, 1200 + i * 300, 5000)); // strikes
riser(4, 0.98, 0.3);

// ---------- 5.0–8.75  Drop: "Take with you" ----------
impact(5, 1);
for (let k = 10; k < 18; k++) kick(k * BEAT, 0.7);
for (let k = 11; k < 18; k += 2) clap(k * BEAT, 0.45);
for (let k = 20; k < 35; k++) { const t = k * 0.25; if (k % 2) hat(t, 0.24, true); else hat(t, 0.12); }
for (let k = 20; k < 35; k++) { const t = k * 0.25; bass(t, chordAt(t).r * (k % 2 ? 2 : 1), 0.22, 0.5, 900); }
for (let k = 10; k < 17; k++) { const t = k * BEAT + 0.25; stab(t, chordAt(t).n, 0.24, 0.13, 2400); }

// ---------- 8.75–11.0  Break + "Less noise. / More story." ----------
swell(8.5, 0.48, 0.3);
[9, 9.5].forEach(t => { kick(t, 0.8); stab(t, chordAt(t).n.map(f => f * 2), 0.6, 0.16, 3500); crash(t, 0.22); });
for (let k = 20; k < 22; k++) kick(k * BEAT, 0.6);
for (let k = 40; k < 44; k++) { const t = k * 0.25; if (k % 2) hat(t, 0.2, true); bass(t, chordAt(t).r * (k % 2 ? 2 : 1), 0.22, 0.4, 700); }

// ---------- 11.0–15  Logo end card ----------
kick(11, 0.7); crash(11, 0.25);
for (const f0 of [130.81, 196, 329.63, 392]) {
  let ph = 0, lp = 0;
  put(11, 4, x => { ph += TAU * f0 / SR; lp += 0.08 * (saw(ph, 6) - lp); return lp * fadeIn(x, 0.3) * Math.min(1, (4 - x) / 1.2); }, { gain: 0.05, send: 0.35 });
}
[523.25, 659.25, 783.99].forEach((f, i) => pluck(11 + i * 0.11, f, 0.22));
whoosh(11.85, 1.1, 1.2, 400, 3200);
blip(12.85, 2637, 0.08, 0.1, -0.2); blip(12.98, 3136, 0.08, 0.1, 0.2);
bell(13.55, [523.25, 783.99, 1046.5], 0.1);
blip(14.25, 1760, 0.1, 0.06);

// ---------- reverb + master ----------
function reverb(inp, spread) {
  const sc = d => Math.round((d + spread) * SR / 44100);
  const cb = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map(d => ({ b: new Float32Array(sc(d)), i: 0, f: 0 }));
  const ab = [556, 441, 341, 225].map(d => ({ b: new Float32Array(sc(d)), i: 0 }));
  const out = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    const x = inp[n] * 0.015; let y = 0;
    for (const c of cb) { const o = c.b[c.i]; c.f = o * 0.75 + c.f * 0.25; c.b[c.i] = x + c.f * 0.8; c.i = (c.i + 1) % c.b.length; y += o; }
    for (const a of ab) { const o = a.b[a.i], v = -y + o; a.b[a.i] = y + o * 0.5; a.i = (a.i + 1) % a.b.length; y = v; }
    out[n] = y;
  }
  return out;
}
const wl = reverb(SL, 0), wr = reverb(SR2, 23);
let peak = 0;
for (let i = 0; i < N; i++) {
  L[i] = Math.tanh((L[i] + wl[i] * 1.5) * 1.2); R[i] = Math.tanh((R[i] + wr[i] * 1.5) * 1.2);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const g = 0.89 / peak;
fs.mkdirSync('audio', { recursive: true });
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const fo = i > N - SR * 0.4 ? (N - i) / (SR * 0.4) : 1;
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * g * fo)) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * g * fo)) * 32767), 46 + i * 4);
}
fs.writeFileSync('audio/day05-departures.wav', buf);
console.log('Done: audio/day05-departures.wav');