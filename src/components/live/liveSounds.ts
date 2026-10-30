"use client";

// The quiz's sound effects, made on the spot with the browser's audio engine (no sound files to host).
// A browser only allows sound after one tap or click on the page, so call unlockSounds() from that click.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted = false;

export function unlockSounds() {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    // no sound on this device; everything else still works
  }
}

export function setMuted(m: boolean) {
  muted = m;
}

export function isMuted() {
  return muted;
}

function ready(): AudioContext | null {
  return !muted && ctx && master ? ctx : null;
}

function tone(c: AudioContext, at: number, freq: number, dur: number, type: OscillatorType, vol: number, endFreq?: number, lowpass?: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  if (lowpass) {
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = lowpass;
    o.connect(f);
    f.connect(g);
  } else {
    o.connect(g);
  }
  g.connect(master!);
  o.start(at);
  o.stop(at + dur + 0.03);
}

// A burst of hiss, swept up or down in pitch: whooshes, drum hits, cymbals.
function hiss(c: AudioContext, at: number, dur: number, vol: number, fromHz: number, toHz: number, q = 1) {
  if (!noise) {
    noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = q;
  f.frequency.setValueAtTime(fromHz, at);
  f.frequency.exponentialRampToValueAtTime(toHz, at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + Math.min(0.04, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master!);
  src.start(at);
  src.stop(at + dur + 0.03);
}

export const sfx = {
  // The first team to buzz: a loud game-show buzzer.
  buzzFirst() {
    const c = ready();
    if (!c) return;
    const t = c.currentTime;
    tone(c, t, 196, 0.5, "sawtooth", 0.32, 180, 1800);
    tone(c, t, 207, 0.5, "sawtooth", 0.32, 190, 1800);
    tone(c, t + 0.02, 98, 0.5, "square", 0.18, 90, 900);
    tone(c, t + 0.5, 1175, 0.18, "sine", 0.18);
  },
  // Every later team: a short blip so the room hears it land in the queue.
  buzzOther() {
    const c = ready();
    if (!c) return;
    const t = c.currentTime;
    tone(c, t, 660, 0.14, "triangle", 0.24, 560);
  },
  correct() {
    const c = ready();
    if (!c) return;
    const t = c.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, t + i * 0.1, f, 0.22, "triangle", 0.28));
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone(c, t + 0.4, f, 0.9, "sine", 0.16));
    hiss(c, t + 0.4, 0.7, 0.12, 6000, 9000, 0.7);
  },
  wrong() {
    const c = ready();
    if (!c) return;
    const t = c.currentTime;
    tone(c, t, 311, 0.28, "sawtooth", 0.3, 233, 1400);
    tone(c, t + 0.3, 233, 0.5, "sawtooth", 0.3, 156, 1100);
  },
  skip() {
    const c = ready();
    if (!c) return;
    const t = c.currentTime;
    tone(c, t, 520, 0.12, "sine", 0.24, 480);
    tone(c, t + 0.14, 390, 0.2, "sine", 0.24, 340);
  },
  // Nobody got it: sad trombone.
  nobody() {
    const c = ready();
    if (!c) return;
    const t = c.currentTime;
    [392, 370, 349].forEach((f, i) => tone(c, t + i * 0.28, f, 0.3, "sawtooth", 0.24, f * 0.98, 1000));
    tone(c, t + 0.84, 330, 0.9, "sawtooth", 0.24, 262, 900);
  },
  question() {
    const c = ready();
    if (!c) return;
    const t = c.currentTime;
    tone(c, t, 784, 0.16, "sine", 0.24);
    tone(c, t + 0.14, 1046.5, 0.3, "sine", 0.24);
  },
  whoosh() {
    const c = ready();
    if (!c) return;
    const t = c.currentTime;
    hiss(c, t, 0.7, 0.4, 300, 3600, 1.2);
    tone(c, t + 0.55, 90, 0.5, "sine", 0.4, 40);
  },
  // Round over, scores coming: a short drum roll and a cymbal.
  results() {
    const c = ready();
    if (!c) return;
    const t = c.currentTime;
    for (let i = 0; i < 14; i++) hiss(c, t + i * 0.075 - i * i * 0.0016, 0.07, 0.16 + i * 0.015, 1800, 900, 1.5);
    hiss(c, t + 1.1, 1.2, 0.3, 7000, 11000, 0.6);
    tone(c, t + 1.1, 70, 0.5, "sine", 0.45, 40);
  },
  winners() {
    const c = ready();
    if (!c) return;
    const t = c.currentTime;
    [523.25, 523.25, 523.25, 659.25, 783.99].forEach((f, i) => tone(c, t + i * 0.16 + (i === 4 ? 0.1 : 0), f, i === 4 ? 1.3 : 0.2, "square", 0.17, undefined, 2600));
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone(c, t + 0.95, f, 1.6, "triangle", 0.2));
    hiss(c, t + 0.95, 1.5, 0.2, 6000, 10000, 0.6);
  },
  join() {
    const c = ready();
    if (!c) return;
    const t = c.currentTime;
    tone(c, t, 520, 0.12, "sine", 0.26, 900);
  },
  // A team phone: the click under your thumb.
  tap() {
    const c = ready();
    if (!c) return;
    const t = c.currentTime;
    tone(c, t, 880, 0.09, "square", 0.16, 440, 2200);
  },
};
