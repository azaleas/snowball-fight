import {
  PLAYER_RADIUS, SNOWBALL_RADIUS, TEAM_COLORS, TEAM_COLORS_LIGHT,
  FORT_COLOR, FORT_BORDER, SNOWBALL_COLOR, SNOWBALL_SHADOW, MAX_HP,
} from "./constants.js";

const SNOWMAN_COLORS = {
  beanie:    0xe74c3c,
  tophat:    0x2ecc71,
  earmuffs:  0x3498db,
  santa:     0xe67e22,
  crown:     0x9b59b6,
  wizard:    0x1abc9c,
  cowboy:    0xf1c40f,
  beret:     0xe91e63,
  viking:    0x00bcd4,
  propeller: 0x8bc34a,
  pirate:    0xff7043,
  chef:      0x7c4dff,
};

function getAccentColor(hat) {
  return SNOWMAN_COLORS[hat] || 0xe74c3c;
}

export function drawCharacter(container, playerData) {
  const accent = getAccentColor(playerData.hat);
  const throwing = playerData.isThrowing;
  const aimAngle = playerData.aimAngle || 0;

  // --- Layer 1: Shadow + Body ---
  const body = new PIXI.Graphics();

  // Shadow
  body.beginFill(0x000000, 0.12);
  body.drawEllipse(0, 18, 16, 5);
  body.endFill();

  // Body (bottom snowball)
  body.beginFill(0xf0f0f0);
  body.drawCircle(0, 8, 16);
  body.endFill();
  body.lineStyle(1.5, 0xcccccc, 0.5);
  body.drawCircle(0, 8, 16);
  body.lineStyle(0);

  // Snow highlight on body
  body.beginFill(0xffffff, 0.6);
  body.drawCircle(-4, 3, 5);
  body.endFill();

  // Buttons
  body.beginFill(0x333333);
  body.drawCircle(0, 5, 1.8);
  body.drawCircle(0, 11, 1.8);
  body.endFill();

  const throwsRight = playerData.team === 1;
  const restSide = throwsRight ? -1 : 1;
  const throwSide = throwsRight ? 1 : -1;
  const charging = playerData.isCharging;

  container.addChild(body);

  if (charging) {
    // Both arms come together in front, rolling a snowball
    const t = (playerData.chargeTime || 0) / 120;
    const roll = Math.sin(t) * 4;

    const leftArm = new PIXI.Graphics();
    leftArm.lineStyle(2, 0x8B6914);
    leftArm.moveTo(0, 0);
    leftArm.lineTo(8 + roll, 6 + Math.cos(t) * 3);
    leftArm.lineStyle(0);
    leftArm.x = -16;
    leftArm.y = 4;
    container.addChild(leftArm);

    const rightArm = new PIXI.Graphics();
    rightArm.lineStyle(2, 0x8B6914);
    rightArm.moveTo(0, 0);
    rightArm.lineTo(-8 - roll, 6 - Math.cos(t) * 3);
    rightArm.lineStyle(0);
    rightArm.x = 16;
    rightArm.y = 4;
    container.addChild(rightArm);

    // Growing snowball between hands (in front of body)
    const chargePct = Math.min((playerData.chargeTime || 0) / 800, 1);
    const ballSize = 2 + chargePct * 4;
    const snowball = new PIXI.Graphics();
    snowball.beginFill(0xffffff);
    snowball.drawCircle(0, 14, ballSize);
    snowball.endFill();
    snowball.lineStyle(1, 0xdddddd);
    snowball.drawCircle(0, 14, ballSize);
    snowball.lineStyle(0);
    snowball.beginFill(0xffffff, 0.8);
    snowball.drawCircle(-1, 13, ballSize * 0.3);
    snowball.endFill();
    container.addChild(snowball);
  } else {
    // Resting arm
    body.lineStyle(2, 0x8B6914);
    body.moveTo(restSide * 16, 4);
    body.lineTo(restSide * 26, -4);
    body.moveTo(restSide * 24, -2);
    body.lineTo(restSide * 28, -7);
    body.moveTo(restSide * 24, -2);
    body.lineTo(restSide * 22, -8);
    body.lineStyle(0);

    // Throwing arm
    const arm = new PIXI.Graphics();
    arm.lineStyle(2, 0x8B6914);
    if (throwing) {
      const dx = Math.cos(aimAngle);
      const dy = Math.sin(aimAngle);
      arm.moveTo(0, 0);
      arm.lineTo(dx * 18, dy * 18);
      arm.moveTo(dx * 15, dy * 15);
      arm.lineTo(dx * 15 - dy * 5, dy * 15 + dx * 5);
      arm.moveTo(dx * 15, dy * 15);
      arm.lineTo(dx * 15 + dy * 5, dy * 15 - dx * 5);
    } else {
      arm.moveTo(0, 0);
      arm.lineTo(throwSide * 10, -8);
      arm.moveTo(throwSide * 8, -6);
      arm.lineTo(throwSide * 12, -11);
      arm.moveTo(throwSide * 8, -6);
      arm.lineTo(throwSide * 6, -12);
    }
    arm.lineStyle(0);
    arm.x = throwSide * 16;
    arm.y = 4;
    container.addChild(arm);
  }

  // --- Layer 3: Head, face, scarf, hat ---
  const head = new PIXI.Graphics();

  // Scarf (behind head)
  head.beginFill(accent);
  head.drawRoundedRect(-13, -2, 26, 5, 2);
  head.endFill();
  head.beginFill(accent, 0.85);
  head.drawRoundedRect(6, -1, 6, 14, 2);
  head.endFill();
  head.beginFill(0xffffff, 0.15);
  head.drawRoundedRect(-12, -1, 24, 2, 1);
  head.endFill();

  // Head (top snowball)
  head.beginFill(0xf0f0f0);
  head.drawCircle(0, -10, 12);
  head.endFill();
  head.lineStyle(1.5, 0xcccccc, 0.5);
  head.drawCircle(0, -10, 12);
  head.lineStyle(0);

  // Snow highlight on head
  head.beginFill(0xffffff, 0.6);
  head.drawCircle(-3, -14, 4);
  head.endFill();

  // Eyes (coal)
  head.beginFill(0x111111);
  head.drawCircle(-4, -12, 2);
  head.drawCircle(4, -12, 2);
  head.endFill();

  // Carrot nose
  head.beginFill(0xff8c00);
  head.moveTo(0, -9);
  head.lineTo(8, -8);
  head.lineTo(0, -7);
  head.closePath();
  head.endFill();

  // Mouth (coal dots)
  head.beginFill(0x222222);
  head.drawCircle(-4, -5, 1);
  head.drawCircle(-2, -4, 1);
  head.drawCircle(0, -3.5, 1);
  head.drawCircle(2, -4, 1);
  head.drawCircle(4, -5, 1);
  head.endFill();

  // Top hat with accent band
  head.beginFill(0x222222);
  head.drawEllipse(0, -22, 14, 4);
  head.endFill();
  head.beginFill(0x222222);
  head.drawRoundedRect(-9, -36, 18, 16, 2);
  head.endFill();
  head.beginFill(accent);
  head.drawRect(-9, -24, 18, 3);
  head.endFill();

  container.addChild(head);
  return container;
}

export function drawEliminated(container, playerData) {
  const g = new PIXI.Graphics();
  const accent = getAccentColor(playerData.hat);

  // Melted snowman: flat puddle with accessories
  g.beginFill(0xdde4ea, 0.6);
  g.drawEllipse(0, 0, 22, 8);
  g.endFill();
  g.lineStyle(1, 0xbbc5ce, 0.4);
  g.drawEllipse(0, 0, 22, 8);
  g.lineStyle(0);

  // Smaller puddle
  g.beginFill(0xe8edf2, 0.5);
  g.drawEllipse(-3, -2, 12, 5);
  g.endFill();

  // Fallen hat
  g.beginFill(0x222222, 0.7);
  g.drawEllipse(8, -2, 8, 3);
  g.endFill();

  // Fallen scarf
  g.beginFill(accent, 0.5);
  g.drawRoundedRect(-10, 1, 14, 3, 1);
  g.endFill();

  // Coal eyes in the puddle
  g.beginFill(0x333333, 0.5);
  g.drawCircle(-5, -2, 1.5);
  g.drawCircle(0, -2, 1.5);
  g.endFill();

  // Carrot nose
  g.beginFill(0xff8c00, 0.6);
  g.moveTo(2, -1);
  g.lineTo(7, 0);
  g.lineTo(2, 1);
  g.closePath();
  g.endFill();

  container.addChild(g);
  return g;
}

export function drawAimArrow(container, angle) {
  const g = new PIXI.Graphics();
  const len = PLAYER_RADIUS + 20;
  const startX = Math.cos(angle) * PLAYER_RADIUS;
  const startY = Math.sin(angle) * PLAYER_RADIUS;
  const endX = Math.cos(angle) * len;
  const endY = Math.sin(angle) * len;

  g.lineStyle(2, 0xffffff, 0.8);
  g.moveTo(startX, startY);
  g.lineTo(endX, endY);

  // Arrowhead
  const headLen = 8;
  const headAngle = 0.5;
  g.moveTo(endX, endY);
  g.lineTo(
    endX - Math.cos(angle - headAngle) * headLen,
    endY - Math.sin(angle - headAngle) * headLen,
  );
  g.moveTo(endX, endY);
  g.lineTo(
    endX - Math.cos(angle + headAngle) * headLen,
    endY - Math.sin(angle + headAngle) * headLen,
  );
  g.lineStyle(0);

  container.addChild(g);
  return g;
}

export function drawSnowball(container, x, y) {
  const g = new PIXI.Graphics();
  // Shadow
  g.beginFill(SNOWBALL_SHADOW, 0.3);
  g.drawEllipse(x, y + 4, SNOWBALL_RADIUS * 0.7, 3);
  g.endFill();
  // Ball
  g.beginFill(SNOWBALL_COLOR);
  g.drawCircle(x, y, SNOWBALL_RADIUS);
  g.endFill();
  g.lineStyle(1, 0xdddddd);
  g.drawCircle(x, y, SNOWBALL_RADIUS);
  g.lineStyle(0);
  // Highlight
  g.beginFill(0xffffff, 0.8);
  g.drawCircle(x - 2, y - 2, 2);
  g.endFill();

  container.addChild(g);
  return g;
}

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function drawFort(container, fort) {
  const g = new PIXI.Graphics();
  const hw = fort.w / 2;
  const hh = fort.h / 2;
  const cx = fort.x;
  const cy = fort.y;
  const rand = seededRandom(Math.floor(cx * 1000 + cy));

  // Generate jagged ice polygon points around the bounding box
  const points = [];
  const steps = 10 + Math.floor(rand() * 4);
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const baseX = Math.cos(angle) * hw;
    const baseY = Math.sin(angle) * hh;
    const jag = 0.7 + rand() * 0.5;
    points.push(cx + baseX * jag, cy + baseY * jag);
  }

  // Shadow underneath
  g.beginFill(0x000000, 0.08);
  g.drawEllipse(cx, cy + hh * 0.4, hw * 0.9, hh * 0.4);
  g.endFill();

  // Main ice body
  g.beginFill(0x9dd5e8, 0.75);
  g.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) {
    g.lineTo(points[i], points[i + 1]);
  }
  g.closePath();
  g.endFill();

  // Ice edge
  g.lineStyle(1.5, 0x6db8d4, 0.6);
  g.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) {
    g.lineTo(points[i], points[i + 1]);
  }
  g.closePath();
  g.lineStyle(0);

  // Ice spikes on top (2-3 jagged peaks)
  const spikeCount = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < spikeCount; i++) {
    const sx = cx - hw * 0.5 + rand() * hw;
    const spikeH = 8 + rand() * 12;
    const spikeW = 4 + rand() * 6;
    g.beginFill(0xc4eaf5, 0.8);
    g.moveTo(sx - spikeW / 2, cy - hh * 0.5);
    g.lineTo(sx + rand() * 3 - 1, cy - hh * 0.5 - spikeH);
    g.lineTo(sx + spikeW / 2, cy - hh * 0.5);
    g.closePath();
    g.endFill();
  }

  // Highlight / shine streaks
  g.beginFill(0xffffff, 0.25);
  g.drawEllipse(cx - hw * 0.2, cy - hh * 0.2, hw * 0.3, hh * 0.15);
  g.endFill();
  g.beginFill(0xffffff, 0.15);
  g.drawEllipse(cx + hw * 0.15, cy + hh * 0.1, hw * 0.2, hh * 0.1);
  g.endFill();

  // Small crack lines
  g.lineStyle(1, 0x7fc8de, 0.3);
  const crackX = cx - hw * 0.1 + rand() * hw * 0.2;
  g.moveTo(crackX, cy - hh * 0.3);
  g.lineTo(crackX + 6, cy);
  g.lineTo(crackX + 2, cy + hh * 0.2);
  g.lineStyle(0);

  container.addChild(g);
  return g;
}

export function drawHPBar(container, hp, maxHp) {
  const g = new PIXI.Graphics();
  const w = 36;
  const h = 5;
  const x = -w / 2;
  const y = -PLAYER_RADIUS - 30;

  // BG
  g.beginFill(0x000000, 0.3);
  g.drawRoundedRect(x, y, w, h, 2);
  g.endFill();

  // Fill
  const pct = hp / maxHp;
  const color = pct > 0.5 ? 0x22c55e : pct > 0.25 ? 0xeab308 : 0xef4444;
  if (pct > 0) {
    g.beginFill(color);
    g.drawRoundedRect(x, y, w * pct, h, 2);
    g.endFill();
  }

  container.addChild(g);
  return g;
}

export function drawGround(container, w, h) {
  const g = new PIXI.Graphics();
  g.beginFill(0xf0f4f8);
  g.drawRect(0, 0, w, h);
  g.endFill();

  // Subtle snow dots
  for (let i = 0; i < 80; i++) {
    const sx = Math.random() * w;
    const sy = Math.random() * h;
    const sr = 1 + Math.random() * 2;
    g.beginFill(0xffffff, 0.5 + Math.random() * 0.3);
    g.drawCircle(sx, sy, sr);
    g.endFill();
  }

  // Center line (dashed effect)
  const cx = w / 2;
  g.lineStyle(2, 0xbbccdd, 0.5);
  for (let y = 0; y < h; y += 16) {
    g.moveTo(cx, y);
    g.lineTo(cx, y + 8);
  }
  g.lineStyle(0);

  container.addChild(g);
  return g;
}
