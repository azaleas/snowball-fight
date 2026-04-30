import { network } from "./network.js";
import {
  ARENA_W, ARENA_H, PLAYER_RADIUS, AIM_ROTATE_SPEED, THROW_COOLDOWN,
  TEAM_CSS, TEAM_COLORS,
} from "./constants.js";
import { playThrow, playHit, playElimination, playSplat, playFriendlyFire, playFootstep, preloadSounds, toggleMute, isMuted } from "./sounds.js";
import {
  drawCharacter, drawEliminated, drawAimArrow, drawSnowball,
  drawFort, drawHPBar, drawGround,
} from "./renderer.js";

let app = null;
let groundContainer, fortContainer, entityContainer, uiContainer;
let forts = [];
let teamNames = [];
let myTeam = null;
let lastThrowTime = 0;
let isSpectating = false;

// Input state
const keys = {};
let aimAngle = 0;
let chargeStart = 0;
let isCharging = false;

const MAX_SPLATS = 40;
const SPLAT_LIFETIME = 5000;
const SNOWBALL_ARC_HEIGHT = 40;

const FLOAT_LIFETIME = 800;
const FLOAT_RISE = 30;

const MAX_FOOTPRINTS = 60;
const FOOTPRINT_LIFETIME = 3000;
const FOOTPRINT_INTERVAL = 150;
let lastFootprintTime = 0;
let prevPlayerPos = null;

// Player tracking for HUD
let currentPlayers = [];

// --- State interpolation ---
let prevState = null;
let currState = null;
let stateTimestamp = 0;
let prevStateTimestamp = 0;
const TICK_MS = 50; // server sends at 20fps

// --- Input prediction ---
const PLAYER_SPEED = 7;
let predictedX = 0;
let predictedY = 0;
let hasPrediction = false;

// --- Tab visibility ---
let tabHidden = false;
let tabHiddenSince = 0;
let heartbeatInterval = null;

// --- Object pools ---
let playerContainers = new Map();
let splatPool = [];
let snowballPool = [];
let footprintPool = [];
let floatingTextPool = [];

function getOrCreatePlayerContainer(p) {
  if (playerContainers.has(p.id)) return playerContainers.get(p.id);

  const container = new PIXI.Container();
  container.sortableChildren = false;

  const nameText = new PIXI.Text(p.name, {
    fontSize: 11,
    fill: 0x333333,
    fontFamily: "Segoe UI, sans-serif",
    fontWeight: "bold",
  });
  nameText.anchor.set(0.5, 1);
  nameText.y = -PLAYER_RADIUS - 34;

  const entry = { container, nameText, lastAlive: p.alive, lastHat: p.hat };
  playerContainers.set(p.id, entry);
  return entry;
}

function removePlayerContainer(id) {
  const entry = playerContainers.get(id);
  if (entry) {
    entry.container.destroy({ children: true, texture: true, baseTexture: true });
    entry.nameText.destroy(true);
    playerContainers.delete(id);
  }
}

function getPooledSplat() {
  for (const s of splatPool) {
    if (!s.active) return s;
  }
  const graphics = new PIXI.Graphics();
  const entry = { graphics, active: false, time: 0, x: 0, y: 0 };
  splatPool.push(entry);
  return entry;
}

function getPooledSnowball() {
  for (const s of snowballPool) {
    if (!s.active) return s;
  }
  const graphics = new PIXI.Graphics();
  const entry = { graphics, active: false };
  snowballPool.push(entry);
  return entry;
}

function getPooledFootprint() {
  for (const f of footprintPool) {
    if (!f.active) return f;
  }
  const graphics = new PIXI.Graphics();
  const entry = { graphics, active: false, time: 0, x: 0, y: 0 };
  footprintPool.push(entry);
  return entry;
}

function getPooledFloatingText() {
  for (const f of floatingTextPool) {
    if (!f.active) return f;
  }
  const text = new PIXI.Text("-1", {
    fontSize: 16,
    fontWeight: "bold",
    fill: 0xff4444,
    fontFamily: "Segoe UI, sans-serif",
    stroke: 0xffffff,
    strokeThickness: 3,
  });
  text.anchor.set(0.5);
  const entry = { text, active: false, time: 0, x: 0, y: 0, color: 0xff4444 };
  floatingTextPool.push(entry);
  return entry;
}

// --- Interpolation helper ---
function lerp(a, b, t) {
  return a + (b - a) * t;
}

function getInterpolatedPlayers() {
  if (!prevState || !currState) return currState ? currState.players : [];

  const now = Date.now();
  const elapsed = now - stateTimestamp;
  const t = Math.min(elapsed / TICK_MS, 1);

  return currState.players.map(cp => {
    const pp = prevState.players.find(p => p.id === cp.id);
    if (!pp) return cp;

    // For own player with prediction, use predicted position
    if (cp.id === network.id && hasPrediction) {
      return { ...cp, x: predictedX, y: predictedY };
    }

    return {
      ...cp,
      x: lerp(pp.x, cp.x, t),
      y: lerp(pp.y, cp.y, t),
    };
  });
}

export function initGame(data, onGameOver) {
  const container = document.getElementById("game-canvas-container");
  container.innerHTML = "";

  app = new PIXI.Application({
    width: ARENA_W,
    height: ARENA_H,
    backgroundColor: 0xcce5ff,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  container.appendChild(app.view);

  scaleCanvas();
  window.addEventListener("resize", scaleCanvas);

  // Containers
  groundContainer = new PIXI.Container();
  fortContainer = new PIXI.Container();
  entityContainer = new PIXI.Container();
  entityContainer.sortableChildren = true;
  uiContainer = new PIXI.Container();

  app.stage.addChild(groundContainer, fortContainer, entityContainer, uiContainer);

  // Draw ground
  drawGround(groundContainer, ARENA_W, ARENA_H);

  // Draw forts
  forts = data.forts;
  for (const fort of forts) {
    drawFort(fortContainer, fort);
  }

  // Team info
  teamNames = data.teamNames;
  const me = data.players.find((p) => p.id === network.id);
  myTeam = me ? me.team : 0;
  aimAngle = me ? me.aimAngle : 0;
  lastThrowTime = 0;
  isSpectating = false;
  prevState = null;
  currState = null;
  hasPrediction = false;

  if (me) {
    predictedX = me.x;
    predictedY = me.y;
  }

  document.getElementById("spectator-banner").classList.add("hidden");
  updateTeamHUD(data.players);

  preloadSounds();

  // Mute button
  const muteBtn = document.getElementById("mute-btn");
  muteBtn.textContent = isMuted() ? "Muted" : "Sound On";
  muteBtn.onclick = () => {
    const nowMuted = toggleMute();
    muteBtn.textContent = nowMuted ? "Muted" : "Sound On";
  };

  // Input
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  // Tab visibility
  document.addEventListener("visibilitychange", onVisibilityChange);
  tabHidden = false;
  tabHiddenSince = 0;

  // Heartbeat (keeps server aware we're alive even if not moving)
  heartbeatInterval = setInterval(() => {
    network.emit("heartbeat");
  }, 5000);

  // Remove any previous listeners before adding new ones
  network.socket.off("state");
  network.socket.off("hit");
  network.socket.off("elimination");
  network.socket.off("game-over");
  network.socket.off("splat");
  network.socket.off("player-afk");
  network.socket.off("player-returned");

  // Network events
  network.on("state", (state) => {
    // Interpolation: shift states
    prevState = currState;
    prevStateTimestamp = stateTimestamp;
    currState = state;
    stateTimestamp = Date.now();

    // Reconcile prediction with server state
    const me = state.players.find(p => p.id === network.id);
    if (me) {
      const dx = Math.abs(predictedX - me.x);
      const dy = Math.abs(predictedY - me.y);
      // If prediction drifted too far, snap to server
      if (dx > PLAYER_SPEED * 3 || dy > PLAYER_SPEED * 3) {
        predictedX = me.x;
        predictedY = me.y;
      } else {
        // Blend toward server position
        predictedX = lerp(predictedX, me.x, 0.3);
        predictedY = lerp(predictedY, me.y, 0.3);
      }
    }

    currentPlayers = state.players;
    updateTeamHUD(state.players);
    updateCooldownBar();
  });

  network.on("hit", ({ targetId, attackerId, hpLeft, friendlyFire }) => {
    const target = currentPlayers.find((p) => p.id === targetId);
    const attacker = currentPlayers.find((p) => p.id === attackerId);
    if (target && attacker) {
      if (friendlyFire) {
        addKillFeedEntry(`${attacker.name} hit teammate ${target.name}! (${hpLeft} HP)`);
      } else {
        addKillFeedEntry(`${attacker.name} hit ${target.name} (${hpLeft} HP)`);
      }
    }
    if (target) {
      addFloatingText(target.x, target.y, "-1", friendlyFire ? 0xff8800 : 0xff4444);
      if (friendlyFire) {
        playFriendlyFire();
      } else {
        playHit();
      }
    }
    if (targetId === network.id) {
      flashScreen();
    }
  });

  network.on("elimination", ({ playerId, killerId, afkKick }) => {
    const dead = currentPlayers.find((p) => p.id === playerId);
    if (afkKick) {
      if (dead) addKillFeedEntry(`${dead.name} was kicked for being AFK`);
    } else {
      const killer = currentPlayers.find((p) => p.id === killerId);
      if (dead && killer) {
        addKillFeedEntry(`${killer.name} eliminated ${dead.name}!`);
        playElimination();
      }
    }
    if (playerId === network.id) {
      isSpectating = true;
      document.getElementById("spectator-banner").classList.remove("hidden");
    }
  });

  network.on("player-afk", ({ name, reason }) => {
    if (reason === "disconnected") {
      addKillFeedEntry(`${name} disconnected (waiting to reconnect...)`);
    } else {
      addKillFeedEntry(`${name} is AFK`);
    }
  });

  network.on("player-returned", ({ name }) => {
    addKillFeedEntry(`${name} is back!`);
  });

  network.on("splat", ({ x, y }) => {
    addSplat(x, y);
    playSplat();
  });

  network.on("game-over", (result) => {
    cleanup();
    onGameOver(result);
  });

  // Render loop (runs at display refresh rate for smooth interpolation)
  app.ticker.add(renderLoop);
  app.ticker.add(sendInput);
}

function renderLoop() {
  if (!currState) return;
  const interpolatedPlayers = getInterpolatedPlayers();
  renderState({ players: interpolatedPlayers, snowballs: currState.snowballs });
}

function scaleCanvas() {
  if (!app) return;
  const container = document.getElementById("game-canvas-container");
  const scaleX = container.clientWidth / ARENA_W;
  const scaleY = container.clientHeight / ARENA_H;
  const scale = Math.min(scaleX, scaleY, 1);
  app.view.style.width = `${ARENA_W * scale}px`;
  app.view.style.height = `${ARENA_H * scale}px`;
}

const THROW_CHARGE_TIME = 800;
let pendingThrow = null;

function onKeyDown(e) {
  const key = e.key === " " ? "space" : e.key.toLowerCase();
  keys[key] = true;
  if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(e.key.toLowerCase()) ||
      ["w", "a", "s", "d", "q", "e", "space"].includes(key)) {
    e.preventDefault();
  }
  if (key === "space" && !e.repeat && !isCharging && !isSpectating) {
    const now = Date.now();
    if (now - lastThrowTime >= THROW_COOLDOWN) {
      isCharging = true;
      chargeStart = now;
    }
  }
}

function onKeyUp(e) {
  const key = e.key === " " ? "space" : e.key.toLowerCase();
  keys[key] = false;
  if (key === "space" && isCharging) {
    const chargeTime = Date.now() - chargeStart;
    const power = Math.min(chargeTime / THROW_CHARGE_TIME, 1);
    isCharging = false;
    lastThrowTime = Date.now();
    pendingThrow = power;
    playThrow();
  }
}

function onVisibilityChange() {
  if (document.hidden) {
    tabHidden = true;
    tabHiddenSince = Date.now();
  } else {
    tabHidden = false;
    // Send heartbeat immediately on return
    network.emit("heartbeat");
  }
}

function sendInput() {
  if (isSpectating) return;

  let mx = 0, my = 0;
  if (keys["w"] || keys["arrowup"]) my = -1;
  if (keys["s"] || keys["arrowdown"]) my = 1;
  if (keys["a"] || keys["arrowleft"]) mx = -1;
  if (keys["d"] || keys["arrowright"]) mx = 1;

  if (keys["q"]) aimAngle -= AIM_ROTATE_SPEED;
  if (keys["e"]) aimAngle += AIM_ROTATE_SPEED;

  if (mx !== 0 || my !== 0) playFootstep();

  // Local prediction: apply movement immediately
  if (mx !== 0 || my !== 0) {
    hasPrediction = true;
    const len = Math.sqrt(mx * mx + my * my);
    const nmx = len > 1 ? mx / len : mx;
    const nmy = len > 1 ? my / len : my;
    predictedX += nmx * PLAYER_SPEED;
    predictedY += nmy * PLAYER_SPEED;
    // Basic bounds clamping
    predictedX = Math.max(PLAYER_RADIUS, Math.min(ARENA_W / 2 - PLAYER_RADIUS, predictedX));
    predictedY = Math.max(PLAYER_RADIUS, Math.min(ARENA_H - PLAYER_RADIUS, predictedY));
  }

  const msg = {
    move: { x: mx, y: my },
    aimAngle,
    throwing: false,
  };

  if (pendingThrow !== null) {
    msg.throwing = true;
    msg.power = pendingThrow;
    pendingThrow = null;
  }

  network.emit("input", msg);
}

function renderState(state) {
  const now = Date.now();

  // Remove containers for players no longer in the game
  const activeIds = new Set(state.players.map(p => p.id));
  for (const [id] of playerContainers) {
    if (!activeIds.has(id)) {
      removePlayerContainer(id);
    }
  }

  entityContainer.removeChildren();
  uiContainer.removeChildren();

  // Track own player for footprints
  const me = state.players.find(p => p.id === network.id);
  if (me && me.alive && prevPlayerPos) {
    const dx = me.x - prevPlayerPos.x;
    const dy = me.y - prevPlayerPos.y;
    if (Math.abs(dx) + Math.abs(dy) > 1 && now - lastFootprintTime > FOOTPRINT_INTERVAL) {
      addFootprint(me.x, me.y);
      lastFootprintTime = now;
    }
  }
  if (me) prevPlayerPos = { x: me.x, y: me.y };

  // Draw footprints (pooled)
  for (const fp of footprintPool) {
    if (!fp.active) continue;
    if (now - fp.time >= FOOTPRINT_LIFETIME) {
      fp.active = false;
      continue;
    }
    const age = (now - fp.time) / FOOTPRINT_LIFETIME;
    const g = fp.graphics;
    g.clear();
    g.beginFill(0xd8e2ec, 0.3 * (1 - age));
    g.drawEllipse(-3, 0, 3, 5);
    g.drawEllipse(3, 0, 3, 5);
    g.endFill();
    g.x = fp.x;
    g.y = fp.y;
    g.zIndex = -1;
    entityContainer.addChild(g);
  }

  // Draw eliminated players
  for (const p of state.players) {
    if (p.alive) continue;
    const entry = getOrCreatePlayerContainer(p);
    const c = entry.container;
    c.removeChildren();
    c.x = p.x;
    c.y = p.y;
    c.zIndex = p.y - 1;
    drawEliminated(c, p);
    entityContainer.addChild(c);
  }

  // Draw alive players
  for (const p of state.players) {
    if (!p.alive) continue;
    const entry = getOrCreatePlayerContainer(p);
    const c = entry.container;
    c.removeChildren();
    c.x = p.x;
    c.y = p.y;
    c.zIndex = p.y;

    const drawData = { ...p };
    if (p.id === network.id && isCharging) {
      drawData.isCharging = true;
      drawData.chargeTime = Date.now() - chargeStart;
    }
    drawCharacter(c, drawData);

    // AFK indicator
    if (p.afk) {
      const afkText = new PIXI.Text("AFK", {
        fontSize: 10,
        fill: 0xff8800,
        fontFamily: "Segoe UI, sans-serif",
        fontWeight: "bold",
      });
      afkText.anchor.set(0.5);
      afkText.y = -PLAYER_RADIUS - 46;
      afkText.alpha = 0.5 + Math.sin(now / 300) * 0.5;
      c.addChild(afkText);
    }

    // Self-only visuals: packing snow during cooldown
    if (p.id === network.id) {
      const cooldownElapsed = now - lastThrowTime;
      if (cooldownElapsed < THROW_COOLDOWN) {
        const pct = cooldownElapsed / THROW_COOLDOWN;
        const pg = new PIXI.Graphics();
        const snowAngle = pct * Math.PI * 4;
        for (let i = 0; i < 3; i++) {
          const a = snowAngle + (i * Math.PI * 2) / 3;
          const r = 10 + pct * 5;
          const sx = Math.cos(a) * r;
          const sy = Math.sin(a) * r + PLAYER_RADIUS * 0.5;
          pg.beginFill(0xffffff, 0.6 * (1 - pct));
          pg.drawCircle(sx, sy, 2);
          pg.endFill();
        }
        c.addChild(pg);
      }
    }

    // HP bar
    drawHPBar(c, p.hp, p.maxHp);

    // Name label (reuse cached text)
    const nameText = entry.nameText;
    if (nameText.text !== p.name) nameText.text = p.name;
    nameText.y = -PLAYER_RADIUS - 34;
    c.addChild(nameText);

    entityContainer.addChild(c);
  }

  // Draw splats (pooled, stable random via stored offsets)
  for (const sp of splatPool) {
    if (!sp.active) continue;
    if (now - sp.time >= SPLAT_LIFETIME) {
      sp.active = false;
      continue;
    }
    const age = (now - sp.time) / SPLAT_LIFETIME;
    const alpha = 0.4 * (1 - age);
    const g = sp.graphics;
    g.clear();
    g.beginFill(0xffffff, alpha);
    g.drawEllipse(0, 0, 18 + sp.rx, 10 + sp.ry);
    g.endFill();
    g.beginFill(0xe8eef4, alpha * 0.6);
    g.drawEllipse(-6, 3, 9, 5);
    g.drawEllipse(7, -2, 7, 4);
    g.drawEllipse(2, 5, 6, 3);
    g.endFill();
    g.x = sp.x;
    g.y = sp.y;
    g.zIndex = sp.y - 2;
    entityContainer.addChild(g);
  }

  // Draw snowballs (pooled)
  for (const s of snowballPool) s.active = false;

  for (let i = 0; i < state.snowballs.length; i++) {
    const s = state.snowballs[i];
    const p = s.progress || 0;
    const arcHeight = Math.sin(p * Math.PI) * SNOWBALL_ARC_HEIGHT;
    const scale = 1 + Math.sin(p * Math.PI) * 0.3;

    const pooled = getPooledSnowball();
    pooled.active = true;
    const g = pooled.graphics;
    g.clear();
    g.zIndex = s.y + 1000;

    // Shadow
    const shadowScale = 1 + arcHeight / 30;
    const shadowAlpha = 0.15 - (arcHeight / SNOWBALL_ARC_HEIGHT) * 0.08;
    g.beginFill(0x000000, Math.max(0.04, shadowAlpha));
    g.drawEllipse(0, arcHeight, 5 * shadowScale, 2.5 * shadowScale);
    g.endFill();

    // Ball
    g.beginFill(0xffffff);
    g.drawCircle(0, -arcHeight, 8 * scale);
    g.endFill();
    g.lineStyle(1, 0xdddddd);
    g.drawCircle(0, -arcHeight, 8 * scale);
    g.lineStyle(0);

    // Highlight
    g.beginFill(0xffffff, 0.9);
    g.drawCircle(-2, -arcHeight - 2, 2);
    g.endFill();

    g.x = s.x;
    g.y = s.y;
    entityContainer.addChild(g);
  }

  // Draw floating damage texts (pooled)
  for (const ft of floatingTextPool) {
    if (!ft.active) continue;
    if (now - ft.time >= FLOAT_LIFETIME) {
      ft.active = false;
      continue;
    }
    const age = (now - ft.time) / FLOAT_LIFETIME;
    const t = ft.text;
    t.style.fill = ft.color;
    t.x = ft.x;
    t.y = ft.y - PLAYER_RADIUS - 20 - age * FLOAT_RISE;
    t.alpha = 1 - age;
    t.zIndex = 2000;
    entityContainer.addChild(t);
  }
}

function updateTeamHUD(players) {
  const teamInfo = document.getElementById("team-info");
  teamInfo.innerHTML = "";

  for (let t = 0; t < 2; t++) {
    const div = document.createElement("div");
    div.className = `team-roster team-${t}`;
    const teamPlayers = players.filter((p) => p.team === t);
    const alive = teamPlayers.filter((p) => p.alive).length;
    div.innerHTML = `
      <h3>${teamNames[t]} (${alive}/${teamPlayers.length})</h3>
      <ul>
        ${teamPlayers.map((p) => {
          const you = p.id === network.id ? " (you)" : "";
          const afk = p.afk ? " [AFK]" : "";
          const cls = p.alive ? (p.afk ? "afk" : "") : "eliminated";
          return `<li class="${cls}">${p.name}${you}${afk} - ${p.hp} HP</li>`;
        }).join("")}
      </ul>
    `;
    teamInfo.appendChild(div);
  }
}

function updateCooldownBar() {
  const bar = document.getElementById("cooldown-bar");
  const elapsed = Date.now() - lastThrowTime;
  const cooldownPct = Math.min(elapsed / THROW_COOLDOWN, 1);

  if (isCharging) {
    const chargeTime = Date.now() - chargeStart;
    const chargePct = Math.min(chargeTime / THROW_CHARGE_TIME, 1);
    bar.style.width = `${chargePct * 100}%`;
    bar.style.background = chargePct >= 1 ? "#ef4444" : "#22c55e";
  } else {
    bar.style.width = `${cooldownPct * 100}%`;
    bar.style.background = cooldownPct >= 1 ? "#60a5fa" : "#f59e0b";
  }
}

function addSplat(x, y) {
  let activeCount = 0;
  let oldest = null;
  for (const s of splatPool) {
    if (s.active) {
      activeCount++;
      if (!oldest || s.time < oldest.time) oldest = s;
    }
  }
  if (activeCount >= MAX_SPLATS && oldest) {
    oldest.active = false;
  }

  const entry = getPooledSplat();
  entry.active = true;
  entry.time = Date.now();
  entry.x = x;
  entry.y = y;
  entry.rx = Math.random() * 4;
  entry.ry = Math.random() * 3;
}

function addFloatingText(x, y, text, color) {
  const entry = getPooledFloatingText();
  entry.active = true;
  entry.time = Date.now();
  entry.x = x;
  entry.y = y;
  entry.color = color;
}

function addFootprint(x, y) {
  let activeCount = 0;
  let oldest = null;
  for (const f of footprintPool) {
    if (f.active) {
      activeCount++;
      if (!oldest || f.time < oldest.time) oldest = f;
    }
  }
  if (activeCount >= MAX_FOOTPRINTS && oldest) {
    oldest.active = false;
  }

  const entry = getPooledFootprint();
  entry.active = true;
  entry.time = Date.now();
  entry.x = x;
  entry.y = y;
}

function addKillFeedEntry(text) {
  const feed = document.getElementById("kill-feed");
  const entry = document.createElement("div");
  entry.className = "kill-entry";
  entry.textContent = text;
  feed.prepend(entry);
  while (feed.children.length > 8) {
    feed.removeChild(feed.lastChild);
  }
}

function flashScreen() {
  const view = app.view;
  view.style.filter = "brightness(2)";
  setTimeout(() => { view.style.filter = ""; }, 100);
}

export function cleanup() {
  document.removeEventListener("keydown", onKeyDown);
  document.removeEventListener("keyup", onKeyUp);
  document.removeEventListener("visibilitychange", onVisibilityChange);
  window.removeEventListener("resize", scaleCanvas);

  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  for (const [id] of playerContainers) {
    removePlayerContainer(id);
  }
  playerContainers.clear();

  for (const s of splatPool) {
    s.graphics.destroy({ children: true, texture: true, baseTexture: true });
  }
  splatPool = [];

  for (const s of snowballPool) {
    s.graphics.destroy({ children: true, texture: true, baseTexture: true });
  }
  snowballPool = [];

  for (const f of footprintPool) {
    f.graphics.destroy({ children: true, texture: true, baseTexture: true });
  }
  footprintPool = [];

  for (const f of floatingTextPool) {
    f.text.destroy(true);
  }
  floatingTextPool = [];

  if (app) {
    app.ticker.remove(renderLoop);
    app.ticker.remove(sendInput);
    app.destroy(true, { children: true, texture: true, baseTexture: true });
    app = null;
  }
  document.getElementById("kill-feed").innerHTML = "";
  document.getElementById("team-info").innerHTML = "";
  Object.keys(keys).forEach((k) => delete keys[k]);
  prevState = null;
  currState = null;
  prevPlayerPos = null;
  hasPrediction = false;
}
