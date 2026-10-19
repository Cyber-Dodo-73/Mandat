// Synthesizes the placeholder sound effects used by the mobile app.
// Output: 44.1 kHz, mono, 16-bit PCM WAV files in mobile/assets/sounds/.
// Everything is generated from math (no samples), so the result is royalty-free
// and fully reproducible (noise uses a seeded PRNG).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 44100;
const PEAK = 0.89; // about -1 dBFS
const EDGE_FADE_SECONDS = 0.003;

const outDir = join(dirname(fileURLToPath(import.meta.url)), '../../mobile/assets/sounds');

// ---------- primitives ----------

function createBuffer(seconds) {
  return new Float32Array(Math.ceil(seconds * SAMPLE_RATE));
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Attack / exponential decay envelope. */
function envelope(t, duration, attack, release) {
  if (t < 0 || t > duration) return 0;
  const a = attack > 0 ? Math.min(1, t / attack) : 1;
  const r = release > 0 ? Math.min(1, (duration - t) / release) : 1;
  return a * r;
}

const midi = (note) => 440 * 2 ** ((note - 69) / 12);

/**
 * Adds a bell-like or plucked tone.
 * partials: [ratio, gain][] ; decay: exponential decay rate (1/s)
 */
function addTone(buf, { start, duration, freq, gain = 0.5, attack = 0.005, release = 0.05, decay = 4, partials = [[1, 1]], glideTo = null, vibrato = 0 }) {
  const startIndex = Math.floor(start * SAMPLE_RATE);
  const length = Math.floor(duration * SAMPLE_RATE);
  const phases = partials.map(() => 0);
  for (let i = 0; i < length && startIndex + i < buf.length; i++) {
    const t = i / SAMPLE_RATE;
    const progress = t / duration;
    let f = glideTo ? freq * (glideTo / freq) ** progress : freq;
    if (vibrato) f *= 1 + vibrato * Math.sin(2 * Math.PI * 5.5 * t);
    const env = envelope(t, duration, attack, release) * Math.exp(-decay * t);
    let sample = 0;
    partials.forEach(([ratio, g], p) => {
      phases[p] += (2 * Math.PI * f * ratio) / SAMPLE_RATE;
      sample += g * Math.sin(phases[p]);
    });
    buf[startIndex + i] += gain * env * sample;
  }
}

/** Adds filtered noise. lowpass / highpass are one-pole cutoffs in Hz (can be functions of progress). */
function addNoise(buf, { start, duration, gain = 0.3, attack = 0.005, release = 0.05, decay = 0, lowpass = 8000, highpass = 200, seed = 1, crackle = 0 }) {
  const random = seededRandom(seed);
  const startIndex = Math.floor(start * SAMPLE_RATE);
  const length = Math.floor(duration * SAMPLE_RATE);
  let lp = 0;
  let hpPrevIn = 0;
  let hpPrevOut = 0;
  for (let i = 0; i < length && startIndex + i < buf.length; i++) {
    const t = i / SAMPLE_RATE;
    const progress = t / duration;
    const lpCut = typeof lowpass === 'function' ? lowpass(progress) : lowpass;
    const hpCut = typeof highpass === 'function' ? highpass(progress) : highpass;
    const lpAlpha = 1 - Math.exp((-2 * Math.PI * lpCut) / SAMPLE_RATE);
    const hpAlpha = Math.exp((-2 * Math.PI * hpCut) / SAMPLE_RATE);
    let x = random() * 2 - 1;
    if (crackle && random() < crackle) x *= 4 + random() * 4;
    lp += lpAlpha * (x - lp);
    const hp = hpAlpha * (hpPrevOut + lp - hpPrevIn);
    hpPrevIn = lp;
    hpPrevOut = hp;
    const env = envelope(t, duration, attack, release) * Math.exp(-decay * t);
    buf[startIndex + i] += gain * env * hp;
  }
}

/** Simple feedback delay to add space / shimmer. */
function addEcho(buf, { delay = 0.09, feedback = 0.35, mix = 0.3 }) {
  const d = Math.floor(delay * SAMPLE_RATE);
  const wet = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    wet[i] = buf[i] + (i >= d ? wet[i - d] * feedback : 0);
  }
  for (let i = 0; i < buf.length; i++) buf[i] = buf[i] * (1 - mix) + wet[i] * mix;
}

function finalize(buf, peakTarget = PEAK) {
  let peak = 0;
  for (const s of buf) peak = Math.max(peak, Math.abs(s));
  const scale = peak > 0 ? peakTarget / peak : 1;
  const fade = Math.floor(EDGE_FADE_SECONDS * SAMPLE_RATE);
  for (let i = 0; i < buf.length; i++) {
    let g = scale;
    if (i < fade) g *= i / fade;
    if (i > buf.length - 1 - fade) g *= (buf.length - 1 - i) / fade;
    buf[i] *= g;
  }
  return buf;
}

function writeWav(name, buf) {
  const data = Buffer.alloc(buf.length * 2);
  buf.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(join(outDir, `${name}.wav`), Buffer.concat([header, data]));
}

// ---------- timbres ----------

const BELL = [[1, 1], [2.01, 0.35], [3.02, 0.15], [4.2, 0.08]];
const CHIME = [[1, 1], [2, 0.25], [3, 0.1], [5.4, 0.05]];
const SOFT = [[1, 1], [2, 0.15]];
const BRASS = [[1, 1], [2, 0.6], [3, 0.4], [4, 0.25], [5, 0.15], [6, 0.08]];

function sparkle(buf, { start, count, spread, baseNote, seed, gain = 0.12 }) {
  const random = seededRandom(seed);
  for (let i = 0; i < count; i++) {
    const note = baseNote + [0, 4, 7, 12, 16, 19, 24][Math.floor(random() * 7)];
    addTone(buf, { start: start + random() * spread, duration: 0.25, freq: midi(note), gain, decay: 14, partials: CHIME });
  }
}

// ---------- sounds ----------

// Sustained sounds feel louder at the same peak: lower their target to keep levels even.
const PEAK_OVERRIDES = { answer_wrong: 0.45 };

const sounds = {
  tap() {
    const buf = createBuffer(0.045);
    addTone(buf, { start: 0, duration: 0.045, freq: 900, glideTo: 520, gain: 0.7, attack: 0.001, release: 0.01, decay: 70, partials: SOFT });
    addNoise(buf, { start: 0, duration: 0.012, gain: 0.25, attack: 0.0005, release: 0.006, lowpass: 6000, highpass: 1500, seed: 3 });
    return buf;
  },

  tear() {
    const buf = createBuffer(0.42);
    addNoise(buf, { start: 0, duration: 0.42, gain: 0.8, attack: 0.02, release: 0.12, lowpass: (p) => 3500 + 3000 * p, highpass: 700, seed: 7, crackle: 0.02 });
    addNoise(buf, { start: 0.05, duration: 0.3, gain: 0.35, attack: 0.03, release: 0.1, lowpass: 9000, highpass: 3000, seed: 8, crackle: 0.05 });
    return buf;
  },

  flip() {
    const buf = createBuffer(0.16);
    addNoise(buf, { start: 0, duration: 0.16, gain: 0.8, attack: 0.05, release: 0.08, lowpass: (p) => 900 + 3500 * Math.sin(Math.PI * p), highpass: 250, seed: 11 });
    addTone(buf, { start: 0.1, duration: 0.05, freq: 300, glideTo: 180, gain: 0.25, attack: 0.001, release: 0.02, decay: 50, partials: SOFT });
    return buf;
  },

  reveal_common() {
    const buf = createBuffer(0.45);
    addTone(buf, { start: 0, duration: 0.45, freq: midi(76), gain: 0.5, decay: 8, partials: BELL });
    addTone(buf, { start: 0.06, duration: 0.39, freq: midi(83), gain: 0.25, decay: 9, partials: BELL });
    return buf;
  },

  reveal_uncommon() {
    const buf = createBuffer(0.55);
    addTone(buf, { start: 0, duration: 0.55, freq: midi(79), gain: 0.5, decay: 7, partials: BELL });
    addTone(buf, { start: 0.06, duration: 0.49, freq: midi(86), gain: 0.3, decay: 7, partials: BELL });
    addTone(buf, { start: 0.12, duration: 0.43, freq: midi(91), gain: 0.15, decay: 9, partials: CHIME });
    return buf;
  },

  reveal_rare() {
    const buf = createBuffer(0.8);
    addTone(buf, { start: 0, duration: 0.8, freq: midi(84), gain: 0.45, decay: 5, partials: BELL });
    addTone(buf, { start: 0.05, duration: 0.75, freq: midi(88), gain: 0.3, decay: 5, partials: BELL });
    addTone(buf, { start: 0.1, duration: 0.7, freq: midi(91), gain: 0.25, decay: 5, partials: BELL });
    sparkle(buf, { start: 0.05, count: 8, spread: 0.4, baseNote: 91, seed: 21 });
    addEcho(buf, { delay: 0.08, feedback: 0.3, mix: 0.25 });
    return buf;
  },

  reveal_epic() {
    const buf = createBuffer(1.1);
    [69, 72, 76, 81, 84].forEach((note, i) => {
      addTone(buf, { start: i * 0.08, duration: 1.1 - i * 0.08, freq: midi(note), gain: 0.35, decay: 3.5, partials: BELL });
    });
    addNoise(buf, { start: 0.3, duration: 0.8, gain: 0.08, attack: 0.1, release: 0.4, lowpass: 12000, highpass: 6000, seed: 31 });
    sparkle(buf, { start: 0.35, count: 14, spread: 0.6, baseNote: 93, seed: 32 });
    addEcho(buf, { delay: 0.11, feedback: 0.35, mix: 0.3 });
    return buf;
  },

  reveal_legendary() {
    const buf = createBuffer(2.1);
    // swell
    addNoise(buf, { start: 0, duration: 0.9, gain: 0.35, attack: 0.85, release: 0.05, lowpass: (p) => 400 + 6000 * p * p, highpass: 150, seed: 41 });
    addTone(buf, { start: 0, duration: 0.9, freq: midi(48), glideTo: midi(60), gain: 0.25, attack: 0.8, release: 0.05, decay: 0, partials: SOFT });
    // fanfare chord (C major) with a short pickup
    addTone(buf, { start: 0.78, duration: 0.12, freq: midi(67), gain: 0.3, decay: 4, partials: BRASS });
    [60, 64, 67, 72, 76].forEach((note, i) => {
      addTone(buf, { start: 0.9 + i * 0.015, duration: 1.2, freq: midi(note), gain: 0.22, attack: 0.02, release: 0.4, decay: 1.2, partials: BRASS, vibrato: 0.004 });
    });
    addTone(buf, { start: 0.9, duration: 1.2, freq: midi(36), gain: 0.3, attack: 0.01, release: 0.4, decay: 1.5, partials: SOFT });
    sparkle(buf, { start: 0.95, count: 18, spread: 0.9, baseNote: 96, seed: 42, gain: 0.08 });
    addEcho(buf, { delay: 0.13, feedback: 0.35, mix: 0.25 });
    return buf;
  },

  reveal_mythic() {
    const buf = createBuffer(3.6);
    // shimmering pad underneath
    addNoise(buf, { start: 0, duration: 3.6, gain: 0.1, attack: 1.5, release: 1.2, lowpass: (p) => 2000 + 10000 * p, highpass: 3000, seed: 51 });
    // three rising arpeggios, each a step higher (C -> E -> G#), "prismatic"
    const roots = [60, 64, 68];
    roots.forEach((root, r) => {
      [0, 4, 7, 11, 12, 16].forEach((interval, i) => {
        addTone(buf, { start: r * 0.55 + i * 0.07, duration: 0.6, freq: midi(root + interval + 12), gain: 0.22, decay: 5, partials: BELL });
      });
    });
    // chord bloom (C major 9 over a wide voicing)
    [48, 55, 64, 67, 71, 74, 79].forEach((note, i) => {
      addTone(buf, { start: 1.75 + i * 0.03, duration: 1.85, freq: midi(note), gain: 0.16, attack: 0.08, release: 0.8, decay: 0.7, partials: i < 2 ? SOFT : BELL, vibrato: 0.003 });
    });
    sparkle(buf, { start: 1.7, count: 40, spread: 1.6, baseNote: 96, seed: 52, gain: 0.07 });
    addEcho(buf, { delay: 0.15, feedback: 0.45, mix: 0.3 });
    return buf;
  },

  new_card() {
    const buf = createBuffer(0.55);
    addTone(buf, { start: 0, duration: 0.3, freq: midi(83), gain: 0.5, decay: 9, partials: BELL });
    addTone(buf, { start: 0.12, duration: 0.43, freq: midi(88), gain: 0.55, decay: 6, partials: BELL });
    return buf;
  },

  mission_complete() {
    const buf = createBuffer(0.85);
    [[72, 0], [76, 0.09], [79, 0.18]].forEach(([note, start]) => {
      addTone(buf, { start, duration: 0.25, freq: midi(note), gain: 0.4, decay: 7, partials: BELL });
    });
    [72, 76, 79, 84].forEach((note) => {
      addTone(buf, { start: 0.3, duration: 0.55, freq: midi(note), gain: 0.22, decay: 4, partials: BELL });
    });
    addEcho(buf, { delay: 0.09, feedback: 0.25, mix: 0.2 });
    return buf;
  },

  level_up() {
    const buf = createBuffer(1.25);
    [[67, 0], [67, 0.1], [67, 0.2]].forEach(([note, start]) => {
      addTone(buf, { start, duration: 0.09, freq: midi(note), gain: 0.35, attack: 0.005, release: 0.02, decay: 3, partials: BRASS });
    });
    [60, 64, 67, 72].forEach((note, i) => {
      addTone(buf, { start: 0.32 + i * 0.01, duration: 0.9, freq: midi(note), gain: 0.25, attack: 0.015, release: 0.3, decay: 1.8, partials: BRASS, vibrato: 0.004 });
    });
    sparkle(buf, { start: 0.35, count: 10, spread: 0.5, baseNote: 91, seed: 61, gain: 0.08 });
    return buf;
  },

  answer_correct() {
    const buf = createBuffer(0.4);
    addTone(buf, { start: 0, duration: 0.18, freq: midi(76), gain: 0.5, decay: 6, partials: CHIME });
    addTone(buf, { start: 0.1, duration: 0.3, freq: midi(83), gain: 0.55, decay: 5, partials: CHIME });
    return buf;
  },

  answer_wrong() {
    const buf = createBuffer(0.42);
    const lowBuzz = [[1, 1], [2, 0.3], [3, 0.12]];
    addTone(buf, { start: 0, duration: 0.2, freq: 220, glideTo: 200, gain: 0.5, attack: 0.01, release: 0.04, decay: 3, partials: lowBuzz, vibrato: 0.02 });
    addTone(buf, { start: 0.18, duration: 0.24, freq: 175, glideTo: 140, gain: 0.5, attack: 0.01, release: 0.1, decay: 3, partials: lowBuzz, vibrato: 0.02 });
    return buf;
  },
};

mkdirSync(outDir, { recursive: true });
for (const [name, build] of Object.entries(sounds)) {
  writeWav(name, finalize(build(), PEAK_OVERRIDES[name] ?? PEAK));
  console.log(`generated ${name}.wav`);
}
