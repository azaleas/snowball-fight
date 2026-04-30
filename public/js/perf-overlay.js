const overlay = document.createElement("div");
overlay.id = "perf-overlay";
overlay.style.cssText = `
  position: fixed; top: 4px; right: 4px; z-index: 99999;
  background: rgba(0,0,0,0.8); color: #0f0; font: 11px monospace;
  padding: 6px 10px; border-radius: 4px; pointer-events: none;
  display: none; line-height: 1.5;
`;
document.body.appendChild(overlay);

let visible = false;
let frames = [];
let frameTimes = [];
let lastFrame = performance.now();
let stateEvents = 0;
let stateIntervals = [];
let lastStateTime = 0;
let memSamples = [];

// Toggle with backtick key
document.addEventListener("keydown", (e) => {
  if (e.key === "`") {
    visible = !visible;
    overlay.style.display = visible ? "block" : "none";
  }
});

// Track FPS
function onFrame(now) {
  const dt = now - lastFrame;
  lastFrame = now;
  frameTimes.push(dt);
  if (frameTimes.length > 120) frameTimes.shift();
  frames.push(now);
  frames = frames.filter(t => now - t < 1000);

  if (visible) updateOverlay();
  requestAnimationFrame(onFrame);
}
requestAnimationFrame(onFrame);

// Track state event frequency (listen for socket.io state events)
const origEmit = EventTarget.prototype.dispatchEvent;
export function trackStateEvent() {
  stateEvents++;
  const now = Date.now();
  if (lastStateTime > 0) {
    stateIntervals.push(now - lastStateTime);
    if (stateIntervals.length > 100) stateIntervals.shift();
  }
  lastStateTime = now;
}

// Memory sampling (if available)
setInterval(() => {
  if (performance.memory) {
    memSamples.push(performance.memory.usedJSHeapSize / 1024 / 1024);
    if (memSamples.length > 60) memSamples.shift();
  }
}, 1000);

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * p)] || 0;
}

function updateOverlay() {
  const fps = frames.length;
  const avgFrame = frameTimes.length
    ? frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length
    : 0;
  const p95Frame = percentile(frameTimes, 0.95);
  const maxFrame = frameTimes.length ? Math.max(...frameTimes) : 0;

  const avgState = stateIntervals.length
    ? Math.round(stateIntervals.reduce((a, b) => a + b, 0) / stateIntervals.length)
    : 0;
  const p95State = percentile(stateIntervals, 0.95);

  const mem = performance.memory
    ? `${Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)}MB`
    : "N/A";

  const memTrend = memSamples.length >= 10
    ? (memSamples[memSamples.length - 1] - memSamples[0] > 5 ? " ↑LEAK?" : " stable")
    : "";

  // Count PIXI objects if available
  let pixiObjects = "?";
  const canvas = document.querySelector("#game-canvas-container canvas");
  if (window.__PIXI_APP__) {
    try {
      pixiObjects = window.__PIXI_APP__.stage.children.reduce(
        (sum, c) => sum + (c.children ? c.children.length : 0), 0
      );
    } catch {}
  }

  overlay.innerHTML = [
    `<span style="color:${fps >= 55 ? '#0f0' : fps >= 30 ? '#ff0' : '#f00'}">FPS: ${fps}</span>`,
    `Frame: ${avgFrame.toFixed(1)}ms avg | ${p95Frame.toFixed(1)}ms p95 | ${maxFrame.toFixed(0)}ms max`,
    `State: ${avgState}ms avg | ${p95State}ms p95 | ${stateEvents} total`,
    `Heap: ${mem}${memTrend}`,
  ].join("<br>");
}
