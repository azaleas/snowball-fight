import {
  PLAYER_RADIUS, SNOWBALL_RADIUS, TEAM_COLORS, TEAM_COLORS_LIGHT,
  FORT_COLOR, FORT_BORDER, SNOWBALL_COLOR, SNOWBALL_SHADOW, MAX_HP,
} from "./constants.js";

const HAT_DRAW = {
  beanie(g, color) {
    g.beginFill(color);
    g.drawRoundedRect(-10, -PLAYER_RADIUS - 10, 20, 14, 4);
    g.endFill();
    g.beginFill(0xffffff);
    g.drawCircle(0, -PLAYER_RADIUS - 10, 5);
    g.endFill();
  },
  tophat(g, color) {
    g.beginFill(0x222222);
    g.drawRect(-8, -PLAYER_RADIUS - 20, 16, 20);
    g.endFill();
    g.beginFill(0x222222);
    g.drawRect(-12, -PLAYER_RADIUS - 4, 24, 4);
    g.endFill();
  },
  earmuffs(g, color) {
    g.beginFill(color);
    g.drawCircle(-PLAYER_RADIUS + 2, -6, 7);
    g.drawCircle(PLAYER_RADIUS - 2, -6, 7);
    g.endFill();
    g.beginFill(0x444444);
    g.drawRect(-PLAYER_RADIUS + 5, -PLAYER_RADIUS - 4, PLAYER_RADIUS * 2 - 10, 3);
    g.endFill();
  },
  santa(g, color) {
    g.beginFill(0xcc0000);
    g.moveTo(-12, -PLAYER_RADIUS + 2);
    g.lineTo(0, -PLAYER_RADIUS - 18);
    g.lineTo(12, -PLAYER_RADIUS + 2);
    g.closePath();
    g.endFill();
    g.beginFill(0xffffff);
    g.drawCircle(0, -PLAYER_RADIUS - 18, 5);
    g.endFill();
    g.beginFill(0xffffff);
    g.drawRect(-14, -PLAYER_RADIUS, 28, 5);
    g.endFill();
  },
  crown(g, color) {
    g.beginFill(0xffd700);
    g.moveTo(-12, -PLAYER_RADIUS);
    g.lineTo(-10, -PLAYER_RADIUS - 14);
    g.lineTo(-4, -PLAYER_RADIUS - 6);
    g.lineTo(0, -PLAYER_RADIUS - 16);
    g.lineTo(4, -PLAYER_RADIUS - 6);
    g.lineTo(10, -PLAYER_RADIUS - 14);
    g.lineTo(12, -PLAYER_RADIUS);
    g.closePath();
    g.endFill();
  },
  wizard(g, color) {
    g.beginFill(0x6b21a8);
    g.moveTo(-14, -PLAYER_RADIUS + 2);
    g.lineTo(0, -PLAYER_RADIUS - 25);
    g.lineTo(14, -PLAYER_RADIUS + 2);
    g.closePath();
    g.endFill();
    g.beginFill(0xffd700);
    g.moveTo(0, -PLAYER_RADIUS - 15);
    g.lineTo(3, -PLAYER_RADIUS - 10);
    g.lineTo(0, -PLAYER_RADIUS - 5);
    g.lineTo(-3, -PLAYER_RADIUS - 10);
    g.closePath();
    g.endFill();
  },
  cowboy(g, color) {
    g.beginFill(0x8B4513);
    g.drawEllipse(0, -PLAYER_RADIUS, 22, 5);
    g.endFill();
    g.beginFill(0x8B4513);
    g.drawRoundedRect(-10, -PLAYER_RADIUS - 12, 20, 12, 3);
    g.endFill();
  },
  beret(g, color) {
    g.beginFill(color);
    g.drawEllipse(2, -PLAYER_RADIUS - 2, 14, 7);
    g.endFill();
  },
  viking(g, color) {
    g.beginFill(0x888888);
    g.drawRoundedRect(-12, -PLAYER_RADIUS - 6, 24, 10, 3);
    g.endFill();
    g.beginFill(0xeeeeee);
    g.moveTo(-16, -PLAYER_RADIUS - 6);
    g.quadraticCurveTo(-14, -PLAYER_RADIUS - 20, -8, -PLAYER_RADIUS - 6);
    g.endFill();
    g.beginFill(0xeeeeee);
    g.moveTo(16, -PLAYER_RADIUS - 6);
    g.quadraticCurveTo(14, -PLAYER_RADIUS - 20, 8, -PLAYER_RADIUS - 6);
    g.endFill();
  },
  propeller(g, color) {
    g.beginFill(color);
    g.drawRoundedRect(-10, -PLAYER_RADIUS - 8, 20, 10, 4);
    g.endFill();
    g.beginFill(0x444444);
    g.drawRect(-12, -PLAYER_RADIUS - 10, 24, 3);
    g.endFill();
    g.beginFill(0xff4444);
    g.drawCircle(0, -PLAYER_RADIUS - 10, 3);
    g.endFill();
  },
  pirate(g, color) {
    g.beginFill(0x222222);
    g.drawRoundedRect(-12, -PLAYER_RADIUS - 6, 24, 10, 2);
    g.endFill();
    g.beginFill(0x222222);
    g.moveTo(-4, -PLAYER_RADIUS - 6);
    g.lineTo(0, -PLAYER_RADIUS - 16);
    g.lineTo(4, -PLAYER_RADIUS - 6);
    g.closePath();
    g.endFill();
    g.beginFill(0xffffff);
    g.drawRect(-2, -PLAYER_RADIUS - 14, 4, 3);
    g.endFill();
  },
  chef(g, color) {
    g.beginFill(0xffffff);
    g.drawCircle(0, -PLAYER_RADIUS - 8, 14);
    g.endFill();
    g.beginFill(0xffffff);
    g.drawRect(-12, -PLAYER_RADIUS - 2, 24, 4);
    g.endFill();
  },
};

export function drawCharacter(container, playerData) {
  const g = new PIXI.Graphics();

  // Shadow
  g.beginFill(0x000000, 0.15);
  g.drawEllipse(0, PLAYER_RADIUS - 2, PLAYER_RADIUS * 0.8, 6);
  g.endFill();

  const teamColor = TEAM_COLORS[playerData.team];

  // Body
  g.beginFill(teamColor);
  g.drawCircle(0, 0, PLAYER_RADIUS);
  g.endFill();
  g.lineStyle(2, 0x000000, 0.3);
  g.drawCircle(0, 0, PLAYER_RADIUS);
  g.lineStyle(0);

  // Eyes
  g.beginFill(0xffffff);
  g.drawCircle(-6, -4, 3);
  g.drawCircle(6, -4, 3);
  g.endFill();
  g.beginFill(0x222222);
  g.drawCircle(-5, -4, 1.5);
  g.drawCircle(7, -4, 1.5);
  g.endFill();

  // Hat
  const hatFn = HAT_DRAW[playerData.hat] || HAT_DRAW.beanie;
  hatFn(g, teamColor);

  container.addChild(g);
  return g;
}

export function drawEliminated(container, playerData) {
  const g = new PIXI.Graphics();
  g.beginFill(0x888888, 0.6);
  g.drawEllipse(0, 0, PLAYER_RADIUS * 1.2, PLAYER_RADIUS * 0.4);
  g.endFill();
  g.lineStyle(1, 0x666666, 0.4);
  g.drawEllipse(0, 0, PLAYER_RADIUS * 1.2, PLAYER_RADIUS * 0.4);
  g.lineStyle(0);

  // X eyes
  const s = 3;
  g.lineStyle(1.5, 0x444444);
  g.moveTo(-8 - s, -3 - s); g.lineTo(-8 + s, -3 + s);
  g.moveTo(-8 + s, -3 - s); g.lineTo(-8 - s, -3 + s);
  g.moveTo(8 - s, -3 - s); g.lineTo(8 + s, -3 + s);
  g.moveTo(8 + s, -3 - s); g.lineTo(8 - s, -3 + s);
  g.lineStyle(0);

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
