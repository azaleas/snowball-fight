import { createServer } from "http";
import { readFileSync, existsSync, statSync } from "fs";
import { join } from "path";
import { Server } from "socket.io";

const PORT = process.env.PORT || 3000;
const TICK_RATE = 20;
const TICK_MS = 1000 / TICK_RATE;

// ── Game constants ──
const ARENA_W = 1600;
const ARENA_H = 1000;
const PLAYER_RADIUS = 20;
const PLAYER_SPEED = 7;
const SNOWBALL_RADIUS = 8;
const SNOWBALL_SPEED_MIN = 18;
const SNOWBALL_SPEED_MAX = 30;
const SNOWBALL_MAX_DIST_MIN = ARENA_W * 0.15;
const SNOWBALL_MAX_DIST_MAX = ARENA_W * 1.2;
const THROW_COOLDOWN = 600;
const THROW_CHARGE_TIME = 800; // ms to reach full charge
const MAX_HP = 5;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 11;
const FORT_W = 60;
const FORT_H = 40;

// ── Fort generation ──
let activeForts = [];
let barriersEnabled = true;
let friendlyFireEnabled = false;

function generateForts() {
  if (!barriersEnabled) return [];
  const forts = [];
  const margin = 80;
  const halfW = ARENA_W / 2;
  const fortCount = 5 + Math.floor(Math.random() * 3); // 5-7 per side

  for (let side = 0; side < 2; side++) {
    const minX = side === 0 ? margin : halfW + margin;
    const maxX = side === 0 ? halfW - margin : ARENA_W - margin;

    for (let i = 0; i < fortCount; i++) {
      let x, y, overlaps;
      let attempts = 0;
      do {
        x = minX + Math.random() * (maxX - minX);
        y = margin + Math.random() * (ARENA_H - margin * 2);
        overlaps = forts.some(f =>
          Math.abs(f.x - x) < FORT_W + 30 && Math.abs(f.y - y) < FORT_H + 30
        );
        attempts++;
      } while (overlaps && attempts < 20);

      if (!overlaps) {
        forts.push({ x: Math.round(x), y: Math.round(y) });
      }
    }
  }
  return forts;
}

// ── Funny team names ──
const ADJECTIVES = [
  "Bureaucratically Frozen", "Technically Alive", "Mildly Defrosted", "Suspiciously Warm",
  "Mostly Harmless", "Legally Distinct", "Emotionally Unavailable", "Slightly Damp",
  "Nominally Competent", "Aggressively Mediocre", "Tragically Hip", "Weaponized",
  "Sentient", "Hyper-Caffeinated", "Reluctantly Heroic", "Suspiciously Cheerful",
  "Gloriously Incompetent", "Cosmically Unlucky", "Diplomatically Immune", "Existentially Confused",
];

const NOUNS = [
  "Bureaucrats", "Snowbots", "Penguins", "Ice Weasels", "Yetis",
  "Zambonis", "Icicle Merchants", "Frost Lobsters", "Snow Owls", "Huskies",
  "Polar Bears", "Slush Puppies", "Avalanche Enthusiasts", "Fridge Magnets",
  "Snowplow Pilots", "Arctic Foxes", "Tundra Nerds", "Blizzard Wizards",
  "Frozen Accountants", "Glacier Inspectors",
];

const HAT_STYLES = [
  "beanie", "tophat", "earmuffs", "santa", "crown",
  "wizard", "cowboy", "beret", "viking", "propeller",
  "pirate", "chef",
];

function generateTeamNames() {
  const adj1 = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  let adj2 = adj1;
  while (adj2 === adj1) adj2 = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];

  const noun1 = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  let noun2 = noun1;
  while (noun2 === noun1) noun2 = NOUNS[Math.floor(Math.random() * NOUNS.length)];

  return [`The ${adj1} ${noun1}`, `The ${adj2} ${noun2}`];
}

// ── Game state ──
let phase = "lobby"; // lobby | playing | results
let players = new Map();
let snowballs = [];
let hostId = null;
let teamNames = [];
let stats = { hits: {}, eliminations: {}, firstBlood: null };

function resetGame() {
  phase = "lobby";
  snowballs = [];
  stats = { hits: {}, eliminations: {}, firstBlood: null };
  for (const [id, p] of players) {
    p.team = null;
    p.hp = MAX_HP;
    p.alive = true;
    p.x = 0;
    p.y = 0;
    p.aimAngle = 0;
    p.lastThrow = 0;
    p.moveX = 0;
    p.moveY = 0;
  }
}

function assignTeams() {
  const ids = [...players.keys()];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const half = Math.ceil(ids.length / 2);
  const hats = [...HAT_STYLES];
  for (let i = hats.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [hats[i], hats[j]] = [hats[j], hats[i]];
  }

  ids.forEach((id, i) => {
    const p = players.get(id);
    const team = i < half ? 0 : 1;
    p.team = team;
    p.hp = MAX_HP;
    p.alive = true;
    p.hat = hats[i % hats.length];
    p.aimAngle = team === 0 ? 0 : Math.PI;
    p.lastThrow = 0;
    p.moveX = 0;
    p.moveY = 0;

    const teamPlayers = ids.filter((_, idx) => (idx < half) === (i < half));
    const indexInTeam = teamPlayers.indexOf(id);
    const teamCount = team === 0 ? half : ids.length - half;
    const spacing = ARENA_H / (teamCount + 1);

    p.x = team === 0 ? 100 : ARENA_W - 100;
    p.y = spacing * (indexInTeam + 1);
  });

  teamNames = generateTeamNames();
}

// ── Collision helpers ──
function circleRect(cx, cy, cr, rx, ry, rw, rh) {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < cr * cr;
}

function circleCircle(x1, y1, r1, x2, y2, r2) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy < (r1 + r2) * (r1 + r2);
}

function rectRect(x1, y1, w1, h1, x2, y2, w2, h2) {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

function clampPlayerToArenaAndForts(p) {
  p.x = Math.max(PLAYER_RADIUS, Math.min(ARENA_W - PLAYER_RADIUS, p.x));
  p.y = Math.max(PLAYER_RADIUS, Math.min(ARENA_H - PLAYER_RADIUS, p.y));

  // Teams can't cross the center line
  const center = ARENA_W / 2;
  if (p.team === 0) {
    p.x = Math.min(p.x, center - PLAYER_RADIUS);
  } else {
    p.x = Math.max(p.x, center + PLAYER_RADIUS);
  }

  for (const fort of activeForts) {
    if (circleRect(p.x, p.y, PLAYER_RADIUS, fort.x - FORT_W / 2, fort.y - FORT_H / 2, FORT_W, FORT_H)) {
      const dx = p.x - fort.x;
      const dy = p.y - fort.y;
      if (Math.abs(dx) / FORT_W > Math.abs(dy) / FORT_H) {
        p.x = dx > 0 ? fort.x + FORT_W / 2 + PLAYER_RADIUS : fort.x - FORT_W / 2 - PLAYER_RADIUS;
      } else {
        p.y = dy > 0 ? fort.y + FORT_H / 2 + PLAYER_RADIUS : fort.y - FORT_H / 2 - PLAYER_RADIUS;
      }
    }
  }
}

// ── Game tick ──
function tick() {
  if (phase !== "playing") return;

  // Update player positions
  for (const [id, p] of players) {
    if (!p.alive) continue;
    p.x += p.moveX * PLAYER_SPEED;
    p.y += p.moveY * PLAYER_SPEED;
    clampPlayerToArenaAndForts(p);
  }

  // Player-player collision (push apart)
  const alive = [...players.values()].filter(p => p.alive);
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i];
      const b = alive[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = PLAYER_RADIUS * 2;
      if (dist < minDist && dist > 0) {
        const overlap = (minDist - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;
        clampPlayerToArenaAndForts(a);
        clampPlayerToArenaAndForts(b);
      }
    }
  }

  // Update snowballs
  for (let i = snowballs.length - 1; i >= 0; i--) {
    const s = snowballs[i];
    s.x += Math.cos(s.angle) * s.speed;
    s.y += Math.sin(s.angle) * s.speed;
    s.dist += s.speed;

    s.progress = s.dist / s.maxDist;

    // Out of bounds or max distance
    if (s.x < 0 || s.x > ARENA_W || s.y < 0 || s.y > ARENA_H || s.dist > s.maxDist) {
      io.emit("splat", { x: s.x, y: s.y });
      snowballs.splice(i, 1);
      continue;
    }

    // Fort collision
    let hitFort = false;
    for (const fort of activeForts) {
      if (circleRect(s.x, s.y, SNOWBALL_RADIUS, fort.x - FORT_W / 2, fort.y - FORT_H / 2, FORT_W, FORT_H)) {
        hitFort = true;
        break;
      }
    }
    if (hitFort) {
      io.emit("splat", { x: s.x, y: s.y });
      snowballs.splice(i, 1);
      continue;
    }

    // Player collision
    let hitPlayer = false;
    for (const [pid, p] of players) {
      if (!p.alive || pid === s.ownerId) continue;
      const sameTeam = p.team === s.team;
      if (sameTeam && !friendlyFireEnabled) continue;
      if (circleCircle(s.x, s.y, SNOWBALL_RADIUS, p.x, p.y, PLAYER_RADIUS)) {
        hitPlayer = true;

        if (sameTeam) {
          // Friendly fire: teammate takes damage
          p.hp--;
          io.emit("hit", { targetId: pid, attackerId: s.ownerId, hpLeft: p.hp, friendlyFire: true });
          if (p.hp <= 0) {
            p.alive = false;
            io.emit("elimination", { playerId: pid, killerId: s.ownerId, friendlyFire: true });
            checkWinCondition();
          }
        } else {
          // Enemy hit
          p.hp--;

          if (!stats.hits[s.ownerId]) stats.hits[s.ownerId] = 0;
          stats.hits[s.ownerId]++;
          if (!stats.firstBlood) stats.firstBlood = s.ownerId;

          io.emit("hit", { targetId: pid, attackerId: s.ownerId, hpLeft: p.hp });

          if (p.hp <= 0) {
            p.alive = false;
            if (!stats.eliminations[s.ownerId]) stats.eliminations[s.ownerId] = 0;
            stats.eliminations[s.ownerId]++;
            io.emit("elimination", { playerId: pid, killerId: s.ownerId });
            checkWinCondition();
          }
        }
        break;
      }
    }
    if (hitPlayer) {
      io.emit("splat", { x: s.x, y: s.y });
      snowballs.splice(i, 1);
    }
  }

  // Broadcast state (compact: round positions to integers, skip unchanged static fields)
  const now = Date.now();
  const playerStates = [];
  for (const [id, p] of players) {
    playerStates.push({
      id, name: p.name, team: p.team,
      x: Math.round(p.x), y: Math.round(p.y),
      hp: p.hp, maxHp: MAX_HP, alive: p.alive, hat: p.hat,
      aimAngle: Math.round(p.aimAngle * 100) / 100,
      isThrowing: now - p.lastThrow < 300,
      moving: p.moveX !== 0 || p.moveY !== 0,
    });
  }

  const snowballStates = snowballs.map(s => ({
    x: Math.round(s.x), y: Math.round(s.y),
    team: s.team, progress: Math.round(s.progress * 100) / 100,
  }));

  io.emit("state", { players: playerStates, snowballs: snowballStates });
}

function checkWinCondition() {
  const teamsAlive = [false, false];
  for (const [, p] of players) {
    if (p.alive && p.team !== null) teamsAlive[p.team] = true;
  }
  if (!teamsAlive[0] || !teamsAlive[1]) {
    const winningTeam = teamsAlive[0] ? 0 : 1;
    phase = "results";
    io.emit("game-over", {
      winningTeam,
      winningTeamName: teamNames[winningTeam],
      teamNames,
      stats: {
        hits: stats.hits,
        eliminations: stats.eliminations,
        firstBlood: stats.firstBlood,
      },
    });
  }
}

function updateHost() {
  if (players.size === 0) {
    hostId = null;
    return;
  }
  // "alan" always gets host priority
  for (const [id, p] of players) {
    if (p.name.toLowerCase() === "alan") {
      hostId = id;
      return;
    }
  }
  if (!players.has(hostId)) {
    hostId = players.keys().next().value;
  }
}

function broadcastLobby() {
  const list = [];
  for (const [id, p] of players) {
    list.push({ id, name: p.name });
  }
  io.emit("lobby-update", { players: list, hostId, phase, barriersEnabled, friendlyFireEnabled });
}

// ── HTTP server ──
const publicDir = join(import.meta.dir, "public");

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".png": "image/png",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
};

const httpServer = createServer((req, res) => {
  let filePath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const fullPath = join(publicDir, filePath);

  if (existsSync(fullPath) && !statSync(fullPath).isDirectory()) {
    const ext = filePath.substring(filePath.lastIndexOf("."));
    const contentType = MIME[ext] || "application/octet-stream";
    const data = readFileSync(fullPath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

// ── Socket.IO ──
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log(`Connected: ${socket.id}`);

  socket.on("join", ({ name }) => {
    if (players.size >= MAX_PLAYERS) {
      socket.emit("error-msg", { message: "Game is full" });
      return;
    }
    if (phase === "playing") {
      socket.emit("error-msg", { message: "Game already in progress" });
      return;
    }

    name = (name || "Player").trim().slice(0, 16);
    players.set(socket.id, {
      name,
      team: null,
      hp: MAX_HP,
      alive: true,
      x: 0,
      y: 0,
      aimAngle: 0,
      lastThrow: 0,
      moveX: 0,
      moveY: 0,
      hat: "beanie",
    });

    updateHost();
    broadcastLobby();
    console.log(`${name} joined (${players.size} players)`);
  });

  socket.on("toggle-barriers", () => {
    if (socket.id !== hostId) return;
    if (phase !== "lobby") return;
    barriersEnabled = !barriersEnabled;
    broadcastLobby();
  });

  socket.on("toggle-friendly-fire", () => {
    if (socket.id !== hostId) return;
    if (phase !== "lobby") return;
    friendlyFireEnabled = !friendlyFireEnabled;
    broadcastLobby();
  });

  socket.on("start-game", () => {
    if (socket.id !== hostId) return;
    if (players.size < MIN_PLAYERS) return;
    if (phase !== "lobby") return;

    activeForts = generateForts();
    assignTeams();
    phase = "playing";

    const playerStates = [];
    for (const [id, p] of players) {
      playerStates.push({
        id, name: p.name, team: p.team, x: p.x, y: p.y,
        hp: p.hp, maxHp: MAX_HP, alive: p.alive, hat: p.hat,
        aimAngle: p.aimAngle,
      });
    }

    io.emit("game-start", {
      players: playerStates,
      teamNames,
      forts: activeForts.map(f => ({ x: f.x, y: f.y, w: FORT_W, h: FORT_H })),
    });
  });

  socket.on("input", (data) => {
    if (phase !== "playing") return;
    const p = players.get(socket.id);
    if (!p || !p.alive) return;

    if (data.move) {
      let mx = data.move.x || 0;
      let my = data.move.y || 0;
      const len = Math.sqrt(mx * mx + my * my);
      if (len > 1) { mx /= len; my /= len; }
      p.moveX = mx;
      p.moveY = my;
    }

    if (data.aimAngle !== undefined) {
      p.aimAngle = data.aimAngle;
    }

    if (data.throwing) {
      const now = Date.now();
      if (now - p.lastThrow >= THROW_COOLDOWN) {
        p.lastThrow = now;
        const power = Math.max(0, Math.min(1, data.power || 0));
        const speed = SNOWBALL_SPEED_MIN + power * (SNOWBALL_SPEED_MAX - SNOWBALL_SPEED_MIN);
        const maxDist = SNOWBALL_MAX_DIST_MIN + power * (SNOWBALL_MAX_DIST_MAX - SNOWBALL_MAX_DIST_MIN);
        snowballs.push({
          x: p.x + Math.cos(p.aimAngle) * (PLAYER_RADIUS + SNOWBALL_RADIUS + 2),
          y: p.y + Math.sin(p.aimAngle) * (PLAYER_RADIUS + SNOWBALL_RADIUS + 2),
          angle: p.aimAngle,
          speed,
          maxDist,
          team: p.team,
          ownerId: socket.id,
          dist: 0,
        });
      }
    }
  });

  socket.on("play-again", () => {
    if (socket.id !== hostId) return;
    if (phase !== "results") return;
    resetGame();
    broadcastLobby();
  });

  socket.on("ping-measure", (cb) => {
    if (typeof cb === "function") cb(Date.now());
  });

  socket.on("disconnect", () => {
    const p = players.get(socket.id);
    if (p) console.log(`${p.name} disconnected`);
    const wasHost = socket.id === hostId;
    players.delete(socket.id);
    updateHost();

    if (phase === "lobby") {
      broadcastLobby();
    } else if (phase === "playing" || phase === "results") {
      if (wasHost) {
        resetGame();
        io.emit("host-left");
        broadcastLobby();
      } else if (phase === "playing") {
        checkWinCondition();
      }
    }
  });
});

// ── Server metrics ──
const metrics = {
  tickTimes: [],
  maxTickTime: 0,
  tickOverruns: 0,
  totalTicks: 0,
  startTime: Date.now(),
};

function tickWithMetrics() {
  const start = performance.now();
  tick();
  const elapsed = performance.now() - start;
  metrics.totalTicks++;
  metrics.tickTimes.push(elapsed);
  if (metrics.tickTimes.length > 200) metrics.tickTimes.shift();
  if (elapsed > metrics.maxTickTime) metrics.maxTickTime = elapsed;
  if (elapsed > TICK_MS) metrics.tickOverruns++;
}

// ── Game loop ──
setInterval(tickWithMetrics, TICK_MS);

// ── Stats endpoint ──
const statsHandler = (req, res) => {
  if (req.url === "/stats") {
    const times = metrics.tickTimes;
    const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    const sorted = [...times].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
    const mem = process.memoryUsage();

    const data = {
      uptime: Math.round((Date.now() - metrics.startTime) / 1000),
      players: players.size,
      phase,
      snowballs: snowballs.length,
      tick: {
        avgMs: Math.round(avg * 100) / 100,
        p95Ms: Math.round(p95 * 100) / 100,
        p99Ms: Math.round(p99 * 100) / 100,
        maxMs: Math.round(metrics.maxTickTime * 100) / 100,
        overruns: metrics.tickOverruns,
        total: metrics.totalTicks,
      },
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100,
        rssMB: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
      },
    };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data, null, 2));
    return true;
  }
  return false;
};

// Patch the http handler to check /stats first
const originalListeners = httpServer.listeners("request");
httpServer.removeAllListeners("request");
httpServer.on("request", (req, res) => {
  if (statsHandler(req, res)) return;
  for (const listener of originalListeners) listener.call(httpServer, req, res);
});

httpServer.listen(PORT, () => {
  console.log(`Snowball Fight server running on http://localhost:${PORT}`);
  console.log(`Server metrics available at http://localhost:${PORT}/stats`);
});
