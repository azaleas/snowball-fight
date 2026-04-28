import { network } from "./network.js";
import {
  ARENA_W, ARENA_H, PLAYER_RADIUS, AIM_ROTATE_SPEED, THROW_COOLDOWN,
  TEAM_CSS, TEAM_COLORS,
} from "./constants.js";
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
let splats = [];
const MAX_SPLATS = 40;
const SPLAT_LIFETIME = 5000;
const SNOWBALL_ARC_HEIGHT = 40;

// Player tracking for HUD
let currentPlayers = [];

export function initGame(data, onGameOver) {
  const container = document.getElementById("game-canvas-container");
  container.innerHTML = "";

  app = new PIXI.Application({
    width: ARENA_W,
    height: ARENA_H,
    backgroundColor: 0xcce5ff,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
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

  document.getElementById("spectator-banner").classList.add("hidden");
  updateTeamHUD(data.players);

  // Input
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  // Remove any previous listeners before adding new ones
  network.socket.off("state");
  network.socket.off("hit");
  network.socket.off("elimination");
  network.socket.off("game-over");
  network.socket.off("splat");

  // Network events
  network.on("state", (state) => {
    renderState(state);
    currentPlayers = state.players;
    updateTeamHUD(state.players);
    updateCooldownBar();
  });

  network.on("hit", ({ targetId, attackerId, hpLeft }) => {
    const target = currentPlayers.find((p) => p.id === targetId);
    const attacker = currentPlayers.find((p) => p.id === attackerId);
    if (target && attacker) {
      addKillFeedEntry(`${attacker.name} hit ${target.name} (${hpLeft} HP)`);
    }
    if (targetId === network.id) {
      flashScreen();
    }
  });

  network.on("elimination", ({ playerId, killerId }) => {
    const dead = currentPlayers.find((p) => p.id === playerId);
    const killer = currentPlayers.find((p) => p.id === killerId);
    if (dead && killer) {
      addKillFeedEntry(`${killer.name} eliminated ${dead.name}!`);
    }
    if (playerId === network.id) {
      isSpectating = true;
      document.getElementById("spectator-banner").classList.remove("hidden");
    }
  });

  network.on("splat", ({ x, y }) => {
    addSplat(x, y);
  });

  network.on("game-over", (result) => {
    cleanup();
    onGameOver(result);
  });

  // Game loop for sending input
  app.ticker.add(sendInput);
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
  // Start charging on first space press (ignore repeats)
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
  // Release space = throw with accumulated power
  if (key === "space" && isCharging) {
    const chargeTime = Date.now() - chargeStart;
    const power = Math.min(chargeTime / THROW_CHARGE_TIME, 1);
    isCharging = false;
    lastThrowTime = Date.now();
    pendingThrow = power;
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
  entityContainer.removeChildren();
  uiContainer.removeChildren();

  // Draw eliminated players first (lower z)
  for (const p of state.players) {
    if (p.alive) continue;
    const c = new PIXI.Container();
    c.x = p.x;
    c.y = p.y;
    c.zIndex = p.y - 1;
    drawEliminated(c, p);
    entityContainer.addChild(c);
  }

  // Draw alive players
  for (const p of state.players) {
    if (!p.alive) continue;
    const c = new PIXI.Container();
    c.x = p.x;
    c.y = p.y;
    c.zIndex = p.y;

    drawCharacter(c, p);

    // Aim arrow (only for self)
    if (p.id === network.id) {
      drawAimArrow(c, aimAngle);
    }

    // HP bar
    drawHPBar(c, p.hp, p.maxHp);

    // Name label
    const nameText = new PIXI.Text(p.name, {
      fontSize: 11,
      fill: 0x333333,
      fontFamily: "Segoe UI, sans-serif",
      fontWeight: "bold",
    });
    nameText.anchor.set(0.5, 1);
    nameText.y = -PLAYER_RADIUS - 34;
    c.addChild(nameText);

    entityContainer.addChild(c);
  }

  // Draw splats (snow marks on the ground)
  const now = Date.now();
  splats = splats.filter(sp => now - sp.time < SPLAT_LIFETIME);
  for (const sp of splats) {
    const age = (now - sp.time) / SPLAT_LIFETIME;
    const alpha = 0.4 * (1 - age);
    const g = new PIXI.Graphics();
    g.beginFill(0xffffff, alpha);
    g.drawEllipse(0, 0, 18 + Math.random() * 4, 10 + Math.random() * 3);
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

  // Draw snowballs with arc
  for (const s of state.snowballs) {
    const p = s.progress || 0;
    const arcHeight = Math.sin(p * Math.PI) * SNOWBALL_ARC_HEIGHT;
    const scale = 1 + Math.sin(p * Math.PI) * 0.3;

    const g = new PIXI.Graphics();
    g.zIndex = s.y + 1000;

    // Shadow on the ground (spreads as ball goes higher)
    const shadowScale = 1 + arcHeight / 30;
    const shadowAlpha = 0.15 - (arcHeight / SNOWBALL_ARC_HEIGHT) * 0.08;
    g.beginFill(0x000000, Math.max(0.04, shadowAlpha));
    g.drawEllipse(0, arcHeight, 5 * shadowScale, 2.5 * shadowScale);
    g.endFill();

    // Ball (drawn offset upward by arc height)
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
        ${teamPlayers.map((p) =>
          `<li class="${p.alive ? "" : "eliminated"}">${p.name}${p.id === network.id ? " (you)" : ""} - ${p.hp} HP</li>`
        ).join("")}
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
    // Show charge power
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
  splats.push({ x, y, time: Date.now() });
  if (splats.length > MAX_SPLATS) splats.shift();
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
  window.removeEventListener("resize", scaleCanvas);
  if (app) {
    app.ticker.remove(sendInput);
    app.destroy(true);
    app = null;
  }
  document.getElementById("kill-feed").innerHTML = "";
  document.getElementById("team-info").innerHTML = "";
  Object.keys(keys).forEach((k) => delete keys[k]);
  splats = [];
}
