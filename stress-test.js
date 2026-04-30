import { io } from "socket.io-client";

const SERVER = process.env.SERVER || "http://localhost:3000";
const BOT_COUNT = parseInt(process.env.BOTS || "8", 10);
const DURATION = parseInt(process.env.DURATION || "60", 10); // seconds
const AUTO_START = process.env.AUTO_START !== "false";

const NAMES = [
  "StressBot1", "StressBot2", "StressBot3", "StressBot4",
  "StressBot5", "StressBot6", "StressBot7", "StressBot8",
  "StressBot9", "StressBot10", "StressBot11",
];

const bots = [];
let gamesCompleted = 0;
const startTime = Date.now();

function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

class Bot {
  constructor(name, isHost) {
    this.name = name;
    this.isHost = isHost;
    this.socket = io(SERVER, { transports: ["websocket"] });
    this.alive = true;
    this.aimAngle = Math.random() * Math.PI * 2;
    this.moveDir = { x: 0, y: 0 };
    this.inputInterval = null;
    this.behaviorInterval = null;
    this.pingInterval = null;

    // Metrics
    this.latencies = [];
    this.stateEventsReceived = 0;
    this.lastStateTime = 0;
    this.stateIntervals = [];

    this.socket.on("connect", () => {
      console.log(`[${this.name}] connected`);
      this.socket.emit("join", { name: this.name });
      this.startPingMeasure();
    });

    this.socket.on("lobby-update", (data) => {
      if (this.isHost && AUTO_START && data.players.length >= BOT_COUNT) {
        setTimeout(() => {
          console.log(`[${this.name}] starting game with ${data.players.length} players`);
          this.socket.emit("start-game");
        }, 1000);
      }
    });

    this.socket.on("game-start", () => {
      this.startBehavior();
    });

    this.socket.on("state", () => {
      this.stateEventsReceived++;
      const now = Date.now();
      if (this.lastStateTime > 0) {
        this.stateIntervals.push(now - this.lastStateTime);
        if (this.stateIntervals.length > 200) this.stateIntervals.shift();
      }
      this.lastStateTime = now;
    });

    this.socket.on("hit", ({ targetId }) => {
      if (targetId === this.socket.id) this.changeDirection();
    });

    this.socket.on("elimination", ({ playerId }) => {
      if (playerId === this.socket.id) {
        this.alive = false;
        this.stopBehavior();
      }
    });

    this.socket.on("game-over", () => {
      gamesCompleted++;
      this.stopBehavior();
      if (this.isHost) {
        setTimeout(() => this.socket.emit("play-again"), 2000);
      }
    });

    this.socket.on("host-left", () => this.stopBehavior());
    this.socket.on("disconnect", () => this.stopBehavior());
  }

  startPingMeasure() {
    this.pingInterval = setInterval(() => {
      const sent = Date.now();
      this.socket.emit("ping-measure", (serverTime) => {
        const rtt = Date.now() - sent;
        this.latencies.push(rtt);
        if (this.latencies.length > 100) this.latencies.shift();
      });
    }, 2000);
  }

  startBehavior() {
    this.alive = true;
    this.inputInterval = setInterval(() => {
      if (!this.alive) return;
      const throwing = Math.random() < 0.08;
      this.socket.emit("input", {
        move: this.moveDir,
        aimAngle: this.aimAngle,
        throwing,
        power: throwing ? randomBetween(0.3, 1.0) : 0,
      });
    }, 50);

    this.behaviorInterval = setInterval(() => {
      if (!this.alive) return;
      this.changeBehavior();
    }, randomBetween(500, 2000));

    this.changeBehavior();
  }

  changeBehavior() {
    const action = Math.random();
    if (action < 0.3) {
      this.moveDir = { x: Math.random() < 0.5 ? -1 : 1, y: 0 };
    } else if (action < 0.6) {
      this.moveDir = { x: 0, y: Math.random() < 0.5 ? -1 : 1 };
    } else if (action < 0.8) {
      this.moveDir = { x: Math.random() < 0.5 ? -1 : 1, y: Math.random() < 0.5 ? -1 : 1 };
    } else {
      this.moveDir = { x: 0, y: 0 };
    }
    this.aimAngle += randomBetween(-1, 1);
  }

  changeDirection() {
    this.moveDir = { x: Math.random() < 0.5 ? -1 : 1, y: Math.random() < 0.5 ? -1 : 1 };
  }

  stopBehavior() {
    if (this.inputInterval) clearInterval(this.inputInterval);
    if (this.behaviorInterval) clearInterval(this.behaviorInterval);
    this.inputInterval = null;
    this.behaviorInterval = null;
  }

  disconnect() {
    this.stopBehavior();
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.socket.disconnect();
  }

  getMetrics() {
    const lat = this.latencies;
    const sortedLat = [...lat].sort((a, b) => a - b);
    const si = this.stateIntervals;
    const sortedSI = [...si].sort((a, b) => a - b);

    return {
      name: this.name,
      connected: this.socket.connected,
      latency: lat.length ? {
        avg: Math.round(lat.reduce((a, b) => a + b, 0) / lat.length),
        min: sortedLat[0] || 0,
        max: sortedLat[sortedLat.length - 1] || 0,
        p95: sortedLat[Math.floor(sortedLat.length * 0.95)] || 0,
      } : null,
      stateEvents: this.stateEventsReceived,
      stateInterval: si.length ? {
        avg: Math.round(si.reduce((a, b) => a + b, 0) / si.length),
        p95: sortedSI[Math.floor(sortedSI.length * 0.95)] || 0,
      } : null,
    };
  }
}

// --- Main ---
console.log(`\n=== Stress Test ===`);
console.log(`Server: ${SERVER}`);
console.log(`Bots: ${BOT_COUNT}`);
console.log(`Duration: ${DURATION}s`);
console.log(`Auto-start: ${AUTO_START}\n`);

for (let i = 0; i < BOT_COUNT; i++) {
  const bot = new Bot(NAMES[i] || `Bot${i + 1}`, i === 0);
  bots.push(bot);
  await new Promise(r => setTimeout(r, 200));
}

// Progress logging
const progressInterval = setInterval(() => {
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const connected = bots.filter(b => b.socket.connected).length;
  const alive = bots.filter(b => b.alive && b.socket.connected).length;
  console.log(`[${elapsed}s] connected: ${connected}/${BOT_COUNT}, alive: ${alive}, games: ${gamesCompleted}`);
}, 5000);

// End after duration
setTimeout(async () => {
  clearInterval(progressInterval);

  // Fetch server stats
  let serverStats = null;
  try {
    const res = await fetch(`${SERVER}/stats`);
    serverStats = await res.json();
  } catch {}

  // Collect bot metrics
  const botMetrics = bots.map(b => b.getMetrics());
  const allLatencies = bots.flatMap(b => b.latencies);
  const sortedAll = [...allLatencies].sort((a, b) => a - b);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  STRESS TEST REPORT`);
  console.log(`${"=".repeat(60)}\n`);
  console.log(`Duration: ${DURATION}s | Bots: ${BOT_COUNT} | Games completed: ${gamesCompleted}`);

  if (serverStats) {
    console.log(`\n--- Server Metrics ---`);
    console.log(`  Uptime: ${serverStats.uptime}s`);
    console.log(`  Memory: ${serverStats.memory.heapUsedMB}MB heap / ${serverStats.memory.rssMB}MB RSS`);
    console.log(`  Tick avg: ${serverStats.tick.avgMs}ms | p95: ${serverStats.tick.p95Ms}ms | p99: ${serverStats.tick.p99Ms}ms | max: ${serverStats.tick.maxMs}ms`);
    console.log(`  Tick overruns (>${DURATION}ms): ${serverStats.tick.overruns}/${serverStats.tick.total}`);
  }

  if (allLatencies.length > 0) {
    const avgLat = Math.round(allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length);
    console.log(`\n--- Network Latency (RTT) ---`);
    console.log(`  Avg: ${avgLat}ms | Min: ${sortedAll[0]}ms | Max: ${sortedAll[sortedAll.length - 1]}ms`);
    console.log(`  p95: ${sortedAll[Math.floor(sortedAll.length * 0.95)]}ms | p99: ${sortedAll[Math.floor(sortedAll.length * 0.99)]}ms`);
  }

  const allStateIntervals = bots.flatMap(b => b.stateIntervals);
  if (allStateIntervals.length > 0) {
    const avgSI = Math.round(allStateIntervals.reduce((a, b) => a + b, 0) / allStateIntervals.length);
    const sortedSI = [...allStateIntervals].sort((a, b) => a - b);
    console.log(`\n--- State Broadcast Interval ---`);
    console.log(`  Expected: 50ms | Actual avg: ${avgSI}ms`);
    console.log(`  p95: ${sortedSI[Math.floor(sortedSI.length * 0.95)]}ms | max: ${sortedSI[sortedSI.length - 1]}ms`);
  }

  // Warnings
  console.log(`\n--- Health Check ---`);
  const issues = [];
  if (serverStats && serverStats.tick.p95Ms > 40) issues.push(`⚠ Tick p95 (${serverStats.tick.p95Ms}ms) approaching budget (50ms)`);
  if (serverStats && serverStats.tick.maxMs > 50) issues.push(`⚠ Tick max (${serverStats.tick.maxMs}ms) exceeded budget`);
  if (serverStats && serverStats.memory.heapUsedMB > 100) issues.push(`⚠ High heap usage: ${serverStats.memory.heapUsedMB}MB`);
  if (sortedAll.length && sortedAll[Math.floor(sortedAll.length * 0.95)] > 100) issues.push(`⚠ High latency p95: ${sortedAll[Math.floor(sortedAll.length * 0.95)]}ms`);
  const disconnected = bots.filter(b => !b.socket.connected).length;
  if (disconnected > 0) issues.push(`⚠ ${disconnected} bots disconnected during test`);

  if (issues.length === 0) {
    console.log(`  ✓ All metrics within acceptable range`);
  } else {
    issues.forEach(i => console.log(`  ${i}`));
  }

  console.log(`\n${"=".repeat(60)}\n`);

  bots.forEach(b => b.disconnect());
  setTimeout(() => process.exit(0), 500);
}, DURATION * 1000);

process.on("SIGINT", () => {
  console.log("\nShutting down bots...");
  bots.forEach(b => b.disconnect());
  setTimeout(() => process.exit(0), 500);
});
