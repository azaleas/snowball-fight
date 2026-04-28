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
  const g = new PIXI.Graphics();
  const accent = getAccentColor(playerData.hat);

  // Shadow
  g.beginFill(0x000000, 0.12);
  g.drawEllipse(0, 18, 16, 5);
  g.endFill();

  // Body (bottom snowball)
  g.beginFill(0xf0f0f0);
  g.drawCircle(0, 8, 16);
  g.endFill();
  g.lineStyle(1.5, 0xcccccc, 0.5);
  g.drawCircle(0, 8, 16);
  g.lineStyle(0);

  // Snow highlight on body
  g.beginFill(0xffffff, 0.6);
  g.drawCircle(-4, 3, 5);
  g.endFill();

  // Buttons
  g.beginFill(0x333333);
  g.drawCircle(0, 5, 1.8);
  g.drawCircle(0, 11, 1.8);
  g.endFill();

  // Stick arms
  g.lineStyle(2, 0x8B6914);
  g.moveTo(-16, 4);
  g.lineTo(-26, -4);
  g.moveTo(-24, -2);
  g.lineTo(-28, -7);
  g.moveTo(-24, -2);
  g.lineTo(-22, -8);
  g.moveTo(16, 4);
  g.lineTo(26, -4);
  g.moveTo(24, -2);
  g.lineTo(28, -7);
  g.moveTo(24, -2);
  g.lineTo(22, -8);
  g.lineStyle(0);

  // Head (top snowball)
  g.beginFill(0xf0f0f0);
  g.drawCircle(0, -10, 12);
  g.endFill();
  g.lineStyle(1.5, 0xcccccc, 0.5);
  g.drawCircle(0, -10, 12);
  g.lineStyle(0);

  // Snow highlight on head
  g.beginFill(0xffffff, 0.6);
  g.drawCircle(-3, -14, 4);
  g.endFill();

  // Eyes (coal)
  g.beginFill(0x111111);
  g.drawCircle(-4, -12, 2);
  g.drawCircle(4, -12, 2);
  g.endFill();

  // Carrot nose
  g.beginFill(0xff8c00);
  g.moveTo(0, -9);
  g.lineTo(8, -8);
  g.lineTo(0, -7);
  g.closePath();
  g.endFill();

  // Mouth (coal dots)
  g.beginFill(0x222222);
  g.drawCircle(-4, -5, 1);
  g.drawCircle(-2, -4, 1);
  g.drawCircle(0, -3.5, 1);
  g.drawCircle(2, -4, 1);
  g.drawCircle(4, -5, 1);
  g.endFill();

  // Scarf
  g.beginFill(accent);
  g.drawRoundedRect(-13, -2, 26, 5, 2);
  g.endFill();
  g.beginFill(accent, 0.85);
  g.drawRoundedRect(6, -1, 6, 14, 2);
  g.endFill();
  // Scarf highlight
  g.beginFill(0xffffff, 0.15);
  g.drawRoundedRect(-12, -1, 24, 2, 1);
  g.endFill();

  // Top hat with accent band
  g.beginFill(0x222222);
  g.drawEllipse(0, -22, 14, 4);
  g.endFill();
  g.beginFill(0x222222);
  g.drawRoundedRect(-9, -36, 18, 16, 2);
  g.endFill();
  // Hat band in accent color
  g.beginFill(accent);
  g.drawRect(-9, -24, 18, 3);
  g.endFill();

  container.addChild(g);
  return g;
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

export function drawFort(container, fort) {
  const g = new PIXI.Graphics();
  g.beginFill(FORT_COLOR, 0.7);
  g.drawRoundedRect(fort.x - fort.w / 2, fort.y - fort.h / 2, fort.w, fort.h, 8);
  g.endFill();
  g.lineStyle(2, FORT_BORDER);
  g.drawRoundedRect(fort.x - fort.w / 2, fort.y - fort.h / 2, fort.w, fort.h, 8);
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
