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

export function playThrow() {
  if (muted) return;
  const ctx = getCtx();
  const duration = 0.15;

  // White noise burst for whoosh
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(2000, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + duration);
  filter.Q.value = 1;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start();
  source.stop(ctx.currentTime + duration);
}

export function playHit() {
  if (muted) return;
  const ctx = getCtx();
  const duration = 0.2;

  // Soft thud — low frequency sine with noise
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + duration);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.2, ctx.currentTime);
  oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  // Noise crunch
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) * 0.5;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.value = 500;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.12, ctx.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc.connect(oscGain).connect(ctx.destination);
  noise.connect(noiseFilter).connect(noiseGain).connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + duration);
  noise.start();
  noise.stop(ctx.currentTime + duration);
}

export function playElimination() {
  if (muted) return;
  const ctx = getCtx();

  // Descending comedic tone (wa-wa-waaaa)
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

export function playSplat() {
  if (muted) return;
  const ctx = getCtx();
  const duration = 0.1;

  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 800;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start();
  source.stop(ctx.currentTime + duration);
}
