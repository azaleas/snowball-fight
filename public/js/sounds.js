let audioCtx = null;
let muted = true;

const STORAGE_KEY = "snowball-fight-muted";
const saved = localStorage.getItem(STORAGE_KEY);
if (saved !== null) {
  muted = saved === "true";
}

export function isMuted() { return muted; }

export function toggleMute() {
  muted = !muted;
  localStorage.setItem(STORAGE_KEY, muted);
  return muted;
}

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

// Pre-load audio buffers from files
const bufferCache = {};

async function loadBuffer(url) {
  if (bufferCache[url]) return bufferCache[url];
  try {
    const ctx = getCtx();
    const resp = await fetch(url);
    const arrayBuf = await resp.arrayBuffer();
    const audioBuf = await ctx.decodeAudioData(arrayBuf);
    bufferCache[url] = audioBuf;
    return audioBuf;
  } catch {
    return null;
  }
}

function playBuffer(buffer, volume = 0.3, rate = 1) {
  if (!buffer) return;
  const ctx = getCtx();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  source.connect(gain).connect(ctx.destination);
  source.start();
}

// Pre-load all sound files
const FOOTSTEP_URLS = Array.from({ length: 5 }, (_, i) => `/sounds/footstep_snow_00${i}.ogg`);
const THROW_URLS = Array.from({ length: 3 }, (_, i) => `/sounds/throw_00${i}.ogg`);
const HIT_URLS = Array.from({ length: 3 }, (_, i) => `/sounds/impactSoft_heavy_00${i}.ogg`);
const SPLAT_URLS = Array.from({ length: 3 }, (_, i) => `/sounds/impactSoft_medium_00${i}.ogg`);

export function preloadSounds() {
  const all = [...FOOTSTEP_URLS, ...THROW_URLS, ...HIT_URLS, ...SPLAT_URLS];
  all.forEach((url) => loadBuffer(url));
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// --- Footsteps ---
let lastFootstepTime = 0;
const FOOTSTEP_INTERVAL = 250;

export function playFootstep() {
  if (muted) return;
  const now = Date.now();
  if (now - lastFootstepTime < FOOTSTEP_INTERVAL) return;
  lastFootstepTime = now;

  const url = pickRandom(FOOTSTEP_URLS);
  const buf = bufferCache[url];
  if (buf) {
    playBuffer(buf, 0.25 + Math.random() * 0.1, 0.9 + Math.random() * 0.2);
  }
}

// --- Throw ---
export function playThrow() {
  if (muted) return;
  const url = pickRandom(THROW_URLS);
  const buf = bufferCache[url];
  if (buf) {
    playBuffer(buf, 0.3, 1.2 + Math.random() * 0.3);
  }
}

// --- Hit ---
export function playHit() {
  if (muted) return;
  const url = pickRandom(HIT_URLS);
  const buf = bufferCache[url];
  if (buf) {
    playBuffer(buf, 0.35, 0.9 + Math.random() * 0.2);
  }
}

// --- Splat ---
export function playSplat() {
  if (muted) return;
  const url = pickRandom(SPLAT_URLS);
  const buf = bufferCache[url];
  if (buf) {
    playBuffer(buf, 0.2, 1.0 + Math.random() * 0.3);
  }
}

// --- Elimination (procedural — comedic wa-wa-waaaa) ---
export function playElimination() {
  if (muted) return;
  const ctx = getCtx();

  const notes = [400, 350, 200];
  const noteDur = 0.15;

  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * noteDur);
    if (i === notes.length - 1) {
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + i * noteDur + noteDur * 2);
    }

    const gain = ctx.createGain();
    const startTime = ctx.currentTime + i * noteDur;
    const endTime = i === notes.length - 1 ? startTime + noteDur * 2 : startTime + noteDur;
    gain.gain.setValueAtTime(0.08, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, endTime);

    osc.connect(gain).connect(ctx.destination);
    osc.start(startTime);
    osc.stop(endTime);
  });
}

// --- Friendly fire (procedural — dissonant buzzer) ---
export function playFriendlyFire() {
  if (muted) return;
  const ctx = getCtx();
  const duration = 0.3;

  const osc1 = ctx.createOscillator();
  osc1.type = "sawtooth";
  osc1.frequency.setValueAtTime(120, ctx.currentTime);
  osc1.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + duration);

  const osc2 = ctx.createOscillator();
  osc2.type = "sawtooth";
  osc2.frequency.setValueAtTime(127, ctx.currentTime);
  osc2.frequency.exponentialRampToValueAtTime(85, ctx.currentTime + duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc1.connect(gain).connect(ctx.destination);
  osc2.connect(gain);

  osc1.start();
  osc1.stop(ctx.currentTime + duration);
  osc2.start();
  osc2.stop(ctx.currentTime + duration);
}
