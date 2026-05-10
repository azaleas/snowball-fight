# Multiplayer Party Game Playbook

Reusable architecture, patterns, and hard-won lessons for building browser-based multiplayer party games. Designed for small teams deploying to resource-constrained environments (Railway free tier, Fly.io, etc).

---

## Tech Stack (Proven)

| Layer | Choice | Why |
|-------|--------|-----|
| Runtime | Bun | Fast startup, native TS support, low memory footprint — ideal for free-tier servers |
| Server framework | `@socket.io/bun-engine` + Socket.IO | Bun-native WebSocket handling, ~50% less memory than Node polyfill |
| Frontend rendering | PixiJS v7 (CDN) | Hardware-accelerated 2D, sprite management, z-sorting — handles 10+ players smoothly |
| Frontend logic | Vanilla JS (ES modules) | No build step, no bundler, instant iteration |
| Transport | WebSocket-only | Always set `transports: ["websocket"]` on client — mixed polling+WS causes routing issues on multi-machine deployments |
| Hosting | Railway (serverless mode) | $5 free credits, auto-sleep when idle, wakes on traffic, WebSocket support |

**No build step. No bundler. No database.** All game state lives in server memory. PixiJS from CDN, everything else is plain JS served as static files.

---

## Architecture: Server-Authoritative Model

The server owns all game state. Clients send inputs and render. This prevents cheating and keeps all players in sync.

```
Client                          Server
  |                               |
  |-- input (move, aim, action) -->
  |                               |-- validate & update state
  |<-- game state broadcast -------|
  |                               |
  (render from server state)
```

### Server Responsibilities
- Player positions, HP, alive/dead status
- Projectile positions, trajectories, lifetime
- Hit detection (circle-circle, circle-rect)
- Game phase transitions (lobby → playing → results)
- Tick rate: **20 updates/second** (50ms budget per tick)

### Client Responsibilities
- Capture input, send to server every frame
- Receive state snapshots, render from them
- Local-only effects (particles, screen flash, sound)
- HUD rendering (HP bars, kill feed, team roster)

### Key Rule
> Never trust the client. Validate everything server-side. The client is just a view.

---

## Smoothness & Responsiveness

### State Interpolation

The server sends state at 20fps (50ms ticks) but browsers render at 60fps. Without interpolation, characters "teleport" between positions every 50ms. Fix: store previous and current server states, lerp between them based on elapsed time.

```js
let prevState = null;
let currState = null;
let stateTimestamp = 0;

function onServerState(state) {
  prevState = currState;
  currState = state;
  stateTimestamp = Date.now();
}

function getInterpolatedPosition(playerId) {
  const t = Math.min((Date.now() - stateTimestamp) / TICK_MS, 1);
  const prev = prevState?.players.find(p => p.id === playerId);
  const curr = currState?.players.find(p => p.id === playerId);
  if (!prev || !curr) return curr;
  return { x: lerp(prev.x, curr.x, t), y: lerp(prev.y, curr.y, t) };
}
```

### Input Prediction (When to Skip It)

Prediction applies local movement instantly and blends toward server state. Sounds good in theory, but for **party games on the same network** (<10ms latency), it causes more harm than good:

- Client applies movement at 60fps, server at 20fps → 3x position drift per frame
- The blend-back causes visible rubber-banding and "double character" artifacts
- Direction changes feel mushy because the blend pulls the player backward

**Rule of thumb**: Only implement prediction if expected latency exceeds ~80ms (cross-region). For LAN/same-network party games, interpolation alone is smooth enough.

If you do need prediction (high-latency scenario):

```js
// On input: apply locally
predictedX += moveX * PLAYER_SPEED;
predictedY += moveY * PLAYER_SPEED;

// On server state: blend toward authoritative position
const serverPos = state.players.find(p => p.id === myId);
predictedX = lerp(predictedX, serverPos.x, 0.3);
predictedY = lerp(predictedY, serverPos.y, 0.3);

// If too far off (lag spike), snap
if (Math.abs(predictedX - serverPos.x) > PLAYER_SPEED * 3) {
  predictedX = serverPos.x;
}
```

---

## Resilience & Connection Handling

### Tab Visibility

When a browser tab goes background, `requestAnimationFrame` throttles to ~1fps and input stops. The player appears frozen to everyone else.

- Detect via `document.visibilitychange` event
- Send heartbeat immediately on tab return
- Server-side: track `lastInput` timestamp per player
- After 15s of no input: mark as AFK, stop their movement, broadcast to other players
- After 25s total: eliminate and kick (prevents permanent frozen snowmen)

### AFK Detection & Kick

```
0s        15s              25s
|─ active ─|── AFK warn ──|── kicked ──|
            broadcast       eliminate
            "X is AFK"     "X kicked for AFK"
```

Players are notified via kill feed. If the player returns (sends any input), the AFK state clears and "X is back!" is broadcast.

### Disconnect = Immediate Elimination

If a player disconnects mid-game (WiFi blip, refresh, close tab):
1. Server eliminates them immediately and broadcasts the elimination
2. If they come back (same name or new), they join as spectator until next round
3. No grace period — grace periods cause game freezes (stale state, win condition stalls)

This is simpler and more reliable than trying to hold slots. For a party game, losing your spot on disconnect is acceptable — the round is short anyway.

### Late Join as Spectator

Players joining mid-game get "late-join" event instead of "error — game in progress":
- They receive current game state (forts, teams) and watch as spectators
- When the current game ends and lobby resets, they auto-join the next round
- No need to refresh or re-enter name

### Heartbeat

Client sends a `heartbeat` event every 5 seconds regardless of input activity. This prevents the server from marking idle-but-watching players as AFK (e.g., someone reading the chat or waiting behind cover).

---

## Game Flow Pattern

Every game follows this three-screen pattern:

### Screen 1: Lobby
- Player enters name (persisted in localStorage)
- First player = host (can start game, toggle options)
- Player list updates in real-time
- Host sees options (toggles, checkboxes) and "Start Game" button
- If host disconnects, next player becomes host
- Minimum player check before start is allowed

### Screen 2: Game
- Server assigns teams/roles and spawns players
- Real-time gameplay at 20 ticks/second
- Eliminated players enter spectator mode
- Win condition checked after every relevant event

### Screen 3: Results
- Show "Victory!" or "Defeat!" personalized to each player's team
- Highlight player's own name in stats (bold + color + "(you)" suffix)
- Stats: eliminations, hits, first blood
- Host can restart → everyone auto-returns to lobby (no re-join required)

### Host Priority
For party settings, let a specific name always get host priority (e.g., the organizer):
```js
function updateHost() {
  for (const [id, p] of players) {
    if (p.name.toLowerCase() === "organizer_name") {
      hostId = id;
      return;
    }
  }
  if (!players.has(hostId)) {
    hostId = players.keys().next().value;
  }
}
```

---

## Team Assignment

### Two Teams
```js
function assignTeams(playerIds) {
  // Shuffle
  for (let i = playerIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [playerIds[i], playerIds[j]] = [playerIds[j], playerIds[i]];
  }
  const half = Math.ceil(playerIds.length / 2);
  // First half = team 0, second half = team 1
  // Balanced ±1 player
}
```

### Free-For-All
Each player is their own "team" — just skip the team assignment and allow damage to everyone.

---

## Funny Team Name Generator

Random combination: `The [Adjective] [Noun]` — Futurama-style absurdist/bureaucratic humor. Silly and safe.

Pick adjective and noun pairs without replacement within a game (no duplicate words across both names).

**Adjective pool (20+):** Bureaucratically Frozen, Technically Alive, Mildly Defrosted, Suspiciously Warm, Mostly Harmless, Legally Distinct, Emotionally Unavailable, Slightly Damp, Nominally Competent, Aggressively Mediocre, Tragically Hip, Weaponized, Sentient, Hyper-Caffeinated, Reluctantly Heroic, Suspiciously Cheerful, Gloriously Incompetent, Cosmically Unlucky, Diplomatically Immune, Existentially Confused

**Noun pool (20+):** Adjust per game theme. Keep them absurd, not edgy.

---

## Sound Design

### Philosophy
- **Muted by default** — party games are often played in groups with conversation; don't blast audio unexpectedly
- **Persisted in localStorage** — respect the player's choice across sessions
- **Preload at game start** — zero-latency playback when it matters
- **Random pitch/volume variation** — prevents repetitive audio fatigue

### Implementation Approach
1. **Phase 1**: No sound. Get gameplay working first.
2. **Phase 2**: Kenney CC0 audio packs for basic SFX (impacts, whooshes). Free, no attribution required.
3. **Phase 3**: Procedural Web Audio API for unique sounds (jingles, buzzers). No file dependencies.

### Recommended Sources
- [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds) (CC0)
- [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio) (CC0)
- Procedural Web Audio for distinctive game events

---

## Performance: Critical Lessons

### The #1 Rule for PixiJS Games

> **Never create display objects inside the render loop.** Allocate at init, reuse via pools, destroy only on cleanup.

Violations of this rule cause:
- GPU texture leaks → blank screen after 15-20 minutes
- GC pressure → frame stutters and freezes
- Browser GPU process OOM → tab crash (especially Chrome)

### Object Pooling Pattern

```js
let pool = [];

function getFromPool() {
  for (const item of pool) {
    if (!item.active) return item;
  }
  const newItem = { graphics: new PIXI.Graphics(), active: false };
  pool.push(newItem);
  return newItem;
}

// In render loop: reuse, don't recreate
function render(state) {
  for (const item of pool) item.active = false;

  for (const entity of state.entities) {
    const pooled = getFromPool();
    pooled.active = true;
    pooled.graphics.clear();
    // ... redraw
  }
}

// On cleanup: destroy everything
function cleanup() {
  for (const item of pool) {
    item.graphics.destroy({ children: true, texture: true, baseTexture: true });
  }
  pool = [];
}
```

### PIXI.Text is Expensive
Each `new PIXI.Text()` creates an offscreen canvas, renders text to it, and uploads a texture to the GPU. With 10 players at 20fps, that's 200 texture uploads/second.

**Fix**: Create one Text object per player at join time. Update `.text` property when the name changes (rare). Cache it in a Map keyed by player ID.

### Resolution Cap
Always cap `resolution` to prevent 3x Retina screens from rendering 9x pixels:
```js
new PIXI.Application({
  resolution: Math.min(window.devicePixelRatio || 1, 2),
  autoDensity: true,
});
```

### removeChildren() vs destroy()
- `container.removeChildren()` removes from display list but does NOT free GPU memory
- You must call `.destroy({ children: true, texture: true, baseTexture: true })` to actually free resources
- In a pool-based system: `removeChildren()` each frame is fine (we re-add from pool), but `destroy()` only on full cleanup

### Network Payload
- Round positions to integers (saves ~30% payload size over floats)
- Round angles to 2 decimal places
- Don't send unchanged static fields every tick if you can avoid it
- Socket.IO adds overhead — keep individual messages small

---

## Rendering Best Practices

### Container Hierarchy (back to front)
1. **Ground** — static background, drawn once
2. **Terrain/obstacles** — drawn once at game start
3. **Entities** — players, projectiles, effects — `sortableChildren = true`, use `zIndex = y` for depth
4. **UI overlay** — HP bars, name labels, attached to entity containers
5. **HUD** — DOM-based (team roster, kill feed, score) — don't render HTML in canvas

### Code-Drawn vs Sprites
For party games, code-drawn graphics (PixiJS Graphics) are often better than sprites:
- Zero external dependencies
- Full control over colors, animations, team tinting
- No asset pipeline or loading screens
- Easy to generate unique variations per player
- Works at any resolution

### Scaling
```js
function scaleCanvas() {
  const scaleX = container.clientWidth / ARENA_W;
  const scaleY = container.clientHeight / ARENA_H;
  const scale = Math.min(scaleX, scaleY, 1); // never upscale
  app.view.style.width = `${ARENA_W * scale}px`;
  app.view.style.height = `${ARENA_H * scale}px`;
}
```

---

## Deployment: Resource-Constrained Environments

### Railway (Recommended)
- $5 free credits, 30-day trial, no credit card
- Enable **Serverless** mode → $0 when idle, auto-wakes on traffic (~5s cold start)
- Actual cost: ~$0.04/hour during active play
- WebSocket support works out of the box

### Key Deployment Rules
1. **Always use WebSocket-only transport** — mixed polling+WS breaks on multi-machine setups
2. **Single instance** — in-memory game state means you can't scale horizontally (fine for party games)
3. **Stateless between games** — no database needed, state resets naturally
4. **Environment variables**: only `PORT` (Railway sets this automatically)

### Bun-Native Server Setup

Use `@socket.io/bun-engine` instead of Node's `createServer` — it uses Bun's native HTTP/WebSocket for ~50% less memory:

```js
import { Server as Engine } from "@socket.io/bun-engine";
import { Server } from "socket.io";

const io = new Server();
const engine = new Engine({ path: "/socket.io/" });
io.bind(engine);

const engineHandler = engine.handler();

export default {
  port: process.env.PORT || 3000,
  idleTimeout: 30, // MUST exceed Socket.IO's pingInterval (25s default)
  fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/socket.io/")) {
      return engineHandler.fetch(req, server);
    }
    return serveStatic(url.pathname);
  },
  websocket: engineHandler.websocket,
};
```

**Key:** `idleTimeout: 30` is required. If it's less than Socket.IO's 25s ping interval, connections will be silently dropped.

### Static File Serving

Handle it in the `fetch` handler (no Express needed):
```js
function serveStatic(pathname) {
  const filePath = pathname === "/" ? "/index.html" : pathname;
  const fullPath = join(publicDir, filePath);

  if (existsSync(fullPath) && !statSync(fullPath).isDirectory()) {
    const ext = filePath.substring(filePath.lastIndexOf("."));
    return new Response(readFileSync(fullPath), {
      headers: { "Content-Type": MIME[ext] || "application/octet-stream" },
    });
  }
  return new Response("Not found", { status: 404 });
}
```

**Always check `isDirectory()`** — Socket.IO can hit paths that resolve to directories, crashing with EISDIR.

---

## Stress Testing

### Bot Stress Test Pattern
A script that spawns N fake players via Socket.IO. Each bot:
- Connects and joins lobby
- First bot is host, auto-starts when all bots are in
- Sends random inputs at 20fps (matches server tick)
- Changes behavior every 0.5-2s (move, strafe, stop, aim)
- Reacts to hits (dodge) and eliminations (stop inputs)
- Host auto-restarts after game over

### Bot Behavior Tips

- Bots must aim at enemies, not random directions — random aim means snowballs fly into walls and games never finish
- Track nearest enemy from state broadcasts, smoothly interpolate aim angle toward target (with slight jitter for realism)
- Higher throw rate (~15% per tick) with good power (0.5-1.0) ensures games complete in reasonable time
- Movement should be tactical: strafe up/down, advance toward center, retreat when hit
- Without smart aiming, 8 bots can play for 60s+ without a single elimination

### Browser Spectator View

Add a `/spectate.html` page that connects via Socket.IO but never joins as a player — just receives `state`, `elimination`, and `game-over` events. This lets you visually watch bot games without interfering. Server-side, add a `spectate` event that sends current game state to the spectator on connect.

### Live Metrics Dashboard

Add a `/stress.html` page that polls `/stats` every second and renders:
- Tick timing cards (color-coded green/yellow/red)
- Rolling 60s charts for tick p95 and heap memory
- Threshold lines at budget limits
- Connection status indicator

### What to Measure

**Server-side (via `/stats` endpoint):**
- Tick execution time: avg, p95, p99, max
- Tick overruns (exceeded 50ms budget)
- Heap memory usage over time (leak detection)
- Player count, snowball/projectile count

**Bot-side (in stress test report):**
- Round-trip latency (RTT) via ping-measure event
- State broadcast interval consistency (should be ~50ms)
- Disconnection count

**Browser-side (perf overlay, toggle with backtick):**
- FPS (color-coded: green ≥55, yellow ≥30, red <30)
- Frame time: avg, p95, max
- State event interval (are server updates arriving on time?)
- JS heap usage with leak detection (Chrome-only, graceful fallback)

### Stress Test Usage
```bash
# Quick local test
BOTS=8 DURATION=60 bun run stress-test.js

# Extended soak test (find memory leaks)
BOTS=10 DURATION=300 bun run stress-test.js

# Test remote deployment
SERVER=https://your-app.up.railway.app BOTS=8 DURATION=120 bun run stress-test.js

# Manual host mode (you join in browser, bots fill lobby)
AUTO_START=false BOTS=6 bun run stress-test.js
```

### Health Check Thresholds
- Tick p95 > 40ms → approaching budget, investigate
- Tick max > 50ms → budget exceeded, players will notice lag
- Heap > 100MB → possible memory leak
- RTT p95 > 100ms → network issues or server overload
- Any bot disconnections → stability problem

---

## Browser Compatibility Notes

| Feature | Chrome | Firefox | Safari |
|---------|--------|---------|--------|
| WebSocket | Yes | Yes | Yes |
| PixiJS / WebGL | Yes | Yes | Yes |
| performance.memory (heap) | Yes | No | No |
| requestAnimationFrame | Yes | Yes | Yes |
| Web Audio API | Yes | Yes | Yes (needs user gesture) |

- **Firefox handles GPU texture churn more gracefully** than Chrome — Chrome's GPU process will OOM-crash, Firefox degrades more gradually
- **Safari requires a user gesture** before playing audio — always gate sound behind a click/keypress
- **Mobile Safari** aggressively throttles background tabs and requestAnimationFrame
- The perf overlay's heap tracking returns "N/A" on Firefox/Safari (graceful fallback, no crash)

---

## Project Structure Template

```
game-name/
├── server.js              # Bun HTTP + Socket.IO, game loop, all server logic
├── stress-test.js         # Bot stress test (dev only)
├── package.json           # Minimal deps: socket.io, @socket.io/bun-engine, socket.io-client
├── .gitignore             # node_modules/, .DS_Store, *.log, .env, .claude/
├── public/
│   ├── index.html         # Single HTML file, loads PixiJS from CDN
│   ├── spectate.html      # Spectator view (watch games without joining)
│   ├── stress.html        # Live metrics dashboard
│   ├── css/
│   │   └── style.css      # Lobby, HUD, results styling
│   ├── sounds/            # Kenney CC0 audio files (.ogg)
│   └── js/
│       ├── main.js        # Entry point, screen manager
│       ├── lobby.js       # Lobby screen (DOM-based)
│       ├── game.js        # PixiJS app, game loop, input, object pools
│       ├── renderer.js    # Drawing functions (characters, terrain, projectiles)
│       ├── sounds.js      # Audio playback, preloading, mute toggle
│       ├── network.js     # Socket.IO client wrapper
│       ├── constants.js   # Shared config (speeds, sizes, cooldowns)
│       └── perf-overlay.js # FPS/memory/state metrics overlay
├── PLAN.md                # Game design doc
└── README.md              # How to run + deploy
```

---

## Common Gotchas

1. **EISDIR crash**: Always check `statSync(path).isDirectory()` before `readFileSync()` in your static file handler. Socket.IO polling will hit directory paths.

2. **Host disconnect**: If the host leaves mid-game, clear all players from server state, emit a `host-left` event, and have clients auto-rejoin lobby using their saved name. Without this, non-host players get a permanent black screen (game canvas with no state updates).

3. **Refresh protection**: Add `beforeunload` warning during active gameplay. Players WILL accidentally hit Cmd+R.

4. **Player name persistence**: Save to localStorage so players don't re-type every refresh.

5. **Center line / boundary enforcement**: If teams have sides, enforce server-side. Never trust client positioning.

6. **Friendly fire**: Make it a toggle. Default off. When on, use distinct sound + visual (different color floating text) so players know it was a teammate.

7. **Min player count**: Set MIN_PLAYERS to 2 for dev/testing, but the game should be designed for 4+ in practice.

8. **Event listener cleanup**: On game end, remove ALL event listeners (keyboard, resize, network). Leaked listeners from previous rounds cause double-firing bugs.

9. **Socket.IO `.off()` before `.on()`**: When reinitializing a game, always remove previous listeners before adding new ones, or you get duplicate event handlers.

10. **Non-host disconnect mid-game**: Eliminate the player immediately. Don't use grace periods — they cause game freezes (stale player state, win condition stalls). If they reconnect, they spectate until next round.

11. **PixiJS container destroy in render loop**: Never `.destroy()` a container that's still a child of the stage. The sequence `destroy()` → `parent.removeChildren()` crashes the ticker silently (canvas freezes, DOM keeps working). Instead: detach from parent, remove from your tracking map, defer `.destroy()` to game cleanup.

12. **Input send rate**: Don't send input every frame (60fps). Throttle to 30fps or match your server tick rate. At 60fps, diagonal keys register on different frames causing jitter — the server briefly sees (1,0) before (1,1).

13. **Lobby-update safety net**: If a client receives a `lobby-update` with `phase === "lobby"` while it thinks it's in-game, force-return to lobby. This catches race conditions where `host-left` was missed.

14. **DOM HUD rebuild rate**: Don't rebuild DOM (innerHTML) on every state tick (20fps). Clicks get swallowed because the button is destroyed before the handler fires. Only rebuild when data actually changes (compare a key string).

15. **pointer-events inheritance**: If your game HUD overlay uses `pointer-events: none` (so clicks pass to canvas), all children inherit it. Add `pointer-events: auto` to any interactive child containers (buttons, kick icons).

16. **Host kick feature**: Always include a way for the host to manually kick players. Essential for dealing with trolls, AFK bots that slip through, or stuck connections. Server-side: verify the kicker is the host, force-disconnect the target socket.

17. **Tick timing**: Use `setInterval` for the game loop, not `requestAnimationFrame` on the server. The server tick must be independent of any rendering.

18. **Screen transition listeners**: Don't register event listeners mid-flow (e.g., inside `showResults`). Chrome can fire events before listeners are attached. Use a single global handler that checks current screen state and forces the transition regardless of which screen the player is on.

19. **Results screen personalization**: Always show win/loss relative to the player ("Victory!" vs "Defeat!"), not just which team won. Highlight the player's own name in stats with a visual cue (bold + color + "(you)"). Players will ask "was that me?" if you don't.

---

## Development Workflow

1. `bun install` → `bun run server.js`
2. Open multiple browser tabs for manual multiplayer testing
3. Use stress test for sustained load testing
4. Check `/stats` endpoint for server health
5. Press backtick in browser for client-side metrics
6. Deploy: `railway up` (or equivalent)

No HMR, no hot reload for client — just refresh the browser. Server restart with `bun --watch run server.js` in dev.

---

## Dev UI Mode (Tuning Playground)

When building a game, you'll spend a lot of time tweaking numeric values — player speed, projectile velocity, cooldown duration, gravity, knockback force, etc. Guessing values and restarting is slow. Instead, build a **Dev UI mode** that exposes live controls for tuning these values in real-time.

### When to Use

Only available in dev/stress mode (never in production). Activate via query param `?dev=true` or a keyboard shortcut (e.g., `Ctrl+Shift+D`).

### What It Looks Like

A collapsible panel (sidebar or overlay) with sliders, number inputs, and dropdowns for every tunable game constant. Changes apply instantly — no restart, no refresh.

```
┌─── Dev Tuning Panel ───────────────────┐
│ Player Speed        [====●====] 4.2    │
│ Projectile Speed    [======●==] 8.0    │
│ Fire Cooldown (ms)  [==●======] 300    │
│ Knockback Force     [===●=====] 2.5    │
│ Gravity             [●========] 0.1    │
│ Arena Width         [=======●=] 1200   │
│ Respawn Delay (ms)  [====●====] 3000   │
│                                        │
│ [Reset All to Defaults] [Copy Config]  │
└────────────────────────────────────────┘
```

### Implementation Pattern

1. **Centralize all tunables in `constants.js`** — every numeric game value lives here with a default:

   ```js
   export const DEFAULTS = {
     PLAYER_SPEED: 4,
     PROJECTILE_SPEED: 8,
     FIRE_COOLDOWN: 500,
     KNOCKBACK: 2.0,
     GRAVITY: 0.0,
   };
   export const config = { ...DEFAULTS };
   ```

2. **Dev panel reads from and writes to `config`** — the game loop already references `config.PLAYER_SPEED` etc., so changes take effect on the next tick/frame.

3. **Generate controls from config keys** — loop over `DEFAULTS`, create a slider + number input for each:

   ```js
   function buildDevPanel() {
     const panel = document.createElement('div');
     panel.id = 'dev-panel';
     for (const [key, defaultVal] of Object.entries(DEFAULTS)) {
       const row = createSliderRow(key, defaultVal, (newVal) => {
         config[key] = newVal;
         socket.emit('dev-config-update', { key, value: newVal });
       });
       panel.appendChild(row);
     }
     document.body.appendChild(panel);
   }
   ```

4. **Server must accept config updates in dev mode** — when the server receives `dev-config-update`, it updates its own config object so authoritative simulation uses the new value:

   ```js
   if (DEV_MODE) {
     socket.on('dev-config-update', ({ key, value }) => {
       if (key in config) config[key] = value;
     });
   }
   ```

5. **"Copy Config" button** — exports current tuned values as a JSON snippet or a `constants.js` block you can paste directly into your source:

   ```js
   function copyConfig() {
     const output = Object.entries(config)
       .map(([k, v]) => `  ${k}: ${v},`)
       .join('\n');
     navigator.clipboard.writeText(`{\n${output}\n}`);
   }
   ```

### Key Rules

- **Dev mode only** — gate behind `DEV_MODE` flag (env var or query param). Never ship to players.
- **Server + client sync** — if you change speed on the dev panel, both the client prediction (if any) and the server simulation must update. Emit the change to the server.
- **Reset button** — one click restores all values to `DEFAULTS`. Essential when you've tuned yourself into a broken state.
- **Persist across refresh** — save current tuning to localStorage so you don't lose 20 minutes of slider tweaking on an accidental refresh.
- **Range hints** — each slider should have sensible min/max/step derived from the default (e.g., speed 0–20 step 0.1, cooldown 50–5000 step 50).

### Workflow

1. Start game in dev mode: `bun run server.js` + open `?dev=true`
2. Play the game while adjusting sliders — feel the difference immediately
3. Once values feel right, click "Copy Config"
4. Paste into `constants.js` as the new defaults
5. Remove `?dev=true`, test with final values

This eliminates the guess-restart-test loop and lets you find granular values through direct experimentation.

---

## Finalization Checklist

### Create CLAUDE.md from Game Plan + Playbook

Once the game plan (PLAN.md) is finalized and you're ready to start implementation:

> **Reminder:** Generate a `CLAUDE.md` file that combines the game-specific plan with relevant playbook patterns into a single implementation guide.

The CLAUDE.md should include:

- Project-specific tech decisions (from PLAN.md)
- Relevant architecture patterns (from this playbook)
- File structure with descriptions
- Key constants and their values
- Implementation order / phasing
- Game-specific gotchas and constraints
- Commands to run (dev, test, deploy)

This gives the AI assistant (or any developer) a single source of truth for the project without needing to cross-reference multiple documents during implementation.

---

## What NOT to Do

- Don't use Express — `@socket.io/bun-engine` with Bun's native serve is enough and uses less memory
- Don't add a database — in-memory state is fine for party games that reset between rounds
- Don't add a build step — ES modules + CDN libraries = instant iteration
- Don't create display objects in the render loop — pool everything
- Don't trust client input — validate and clamp server-side
- Don't use polling transport — WebSocket-only, always
- Don't deploy multiple instances — in-memory state can't be shared
- Don't skip the stress test before a real playtest — 20 minutes of 8 players will find bugs that 2 minutes of 2 tabs won't
