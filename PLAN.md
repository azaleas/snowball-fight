# Snowball Fight - Multiplayer Browser Game

*Inspired by the classic Snowcraft (ActionScript, early 2000s)*

## Overview

A casual multiplayer snowball fight game for 4-11 players. No login, no auth — just enter a name and play. Players are split into two teams with funny auto-generated names, each player gets a random avatar, and teams battle until one side is fully eliminated.

The game aims to capture the **Snowcraft feel**: isometric 3/4 top-down view, clean white snow arena, chunky cartoon characters in team colors, snow fort cover, and direct-line snowball throws. The key difference — each player controls a single character in real-time multiplayer, rather than commanding a squad against AI.

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Runtime | Bun (native serve + @socket.io/bun-engine) | ~50% less memory than Node polyfill, native WebSocket handling |
| Frontend Rendering | PixiJS (v7, via CDN) | Sprite management, z-sorting, tinting, animation — handles rendering grunt work |
| Frontend Logic | Vanilla JS | No framework needed — lobby is simple DOM, game is all PixiJS canvas |
| Real-time | Socket.IO | Proven WebSocket lib, auto-reconnect, rooms |
| Assets | Hand-drawn (canvas/PixiJS Graphics) + Kenney UI Pack + freesound.org | No external sprite deps for core game |
| Hosting | Railway (serverless mode) | $5 free credits, auto-sleep when idle, WebSocket support, no credit card |

No build step. No bundler. PixiJS loaded from CDN, everything else is plain JS served as static files.

No database. All game state lives in server memory — fine for a party game that resets between rounds.

---

## Visual Style (Snowcraft Reference)

All game visuals are drawn programmatically using PixiJS Graphics — no external sprite sheets needed for the core game. This keeps the build simple and dependency-free.

- **Perspective:** Top-down (bird's eye). Simpler than isometric, no projection math, still captures the Snowcraft arena feel.
- **Ground:** Clean white/light-blue gradient or subtle noise texture, drawn as a full-screen rectangle.
- **Characters:** Colored circles (~30px radius) with:
  - A small hat/beanie on top (triangle or semicircle, matches team color)
  - Simple face (two dot eyes, optional)
  - Team color fill (blue team = blue circle, red team = red circle)
  - A darker outline for readability
  - Subtle shadow ellipse underneath
  - Each player gets a unique hat style or accessory (scarf, earmuffs, top hat, etc.) to differentiate avatars
- **Snow forts:** Rounded rectangles, semi-transparent icy blue with white border. Simple and clean.
- **Snowballs:** Small white filled circles (~8px) with a light grey shadow underneath.
- **Eliminated players:** Character circle goes flat (squash to ellipse), turns grey, stays visible on field.
- **Aim arrow:** Thin line + arrowhead extending from the player circle in the aim direction.
- **Overall feel:** Bright, clean, charming — like a whiteboard doodle game. Readable at a glance, distinct teams, no visual clutter.

---

## Game Flow

### Screen 1: Lobby

- Player enters their name (text input, max 16 chars)
- First player to join becomes the "host" (can start the game)
- Player list shows everyone who has joined (4-11 players)
- Host sees a "Start Game" button (enabled when 4+ players have joined)
- If host disconnects, next player becomes host
- Simple winter-themed lobby UI (snowflake background, clean fonts)

### Screen 2: Game

- Server randomly assigns players to 2 teams and gives each a random avatar
- Isometric snowy arena with pre-placed snow forts for cover
- Players move and throw snowballs using keyboard only
- Each player has 5 HP — each snowball hit = 1 damage
- At 0 HP a player is eliminated (falls flat, Snowcraft style) and enters spectator mode
- Game ends when all players on one team are eliminated

### Screen 3: Results

- Winning team name displayed with celebration
- Stats: eliminations per player, MVP (most hits), first blood
- "Play Again" button returns everyone to lobby

---

## Controls (Keyboard Only)

| Key | Action |
|-----|--------|
| W / Up Arrow | Move up |
| S / Down Arrow | Move down |
| A / Left Arrow | Move left |
| D / Right Arrow | Move right |
| Q / E | Rotate aim direction counter-clockwise / clockwise |
| Space (tap) | Quick short throw in aim direction |
| Space (hold + release) | Charge throw — longer hold = farther/faster throw (0.8s full charge) |

- Movement is straightforward — WASD maps directly to screen directions
- An **aim arrow** extends from the player showing current throw direction
- The aim arrow rotates smoothly with Q/E at a comfortable speed
- **Charge-to-throw**: hold Space to charge (power bar fills green → red), release to throw. Full charge reaches entire arena.
- Cooldown of **~0.6 seconds** between throws — fast enough for rapid fire
- Movement speed is constant; players can move while the aim arrow stays in its last direction
- Players cannot move through snow forts (collision)
- **Teams cannot cross the center line** (Snowcraft style) — dashed line marks the boundary

---

## Arena Design

```
+-------------------------:-------------------------+
|                         :                         |
|     [Fort]              :          [Fort]         |
|                         :                         |
|          [Fort]         :              [Fort]     |
|   BLUE                  :                  RED    |
|   TEAM        [Fort]  [Fort]           TEAM       |
|   SPAWN                 :              SPAWN      |
|          [Fort]         :              [Fort]     |
|                         :                         |
|     [Fort]              :          [Fort]         |
|                         :                         |
+-------------------------:-------------------------+
         BLUE SIDE     center     RED SIDE
                       line
```

- Dashed center line separates team territories — players cannot cross

- Roughly symmetrical layout — fair for both teams
- Teams spawn on opposite sides
- Snow forts are **pre-placed obstacles/cover** (not buildable, keeping it simple)
- Forts block snowball travel (snowballs collide and disappear on hitting a fort)
- Forts block player movement (must go around)
- Arena size scaled for 10 players — 1600x1000 logical units
- Subtle details: scattered snowflake particles, tree sprites at edges, footprint trails (optional polish)

---

## Core Mechanics

### Health & Elimination

- Every player starts with 5 HP
- Each snowball hit deals 1 damage
- Visual feedback on hit: character flashes white, brief knockback, floating "-1" text
- HP bar displayed above each player (green->yellow->red as HP drops)
- At 0 HP: character falls flat on the ground (stays visible as a "body" on the field)
- Eliminated player enters spectator mode (can pan camera freely, no interaction)

### Snowballs

- Travel in a **straight line** from the player in the aim direction
- **Visual arc**: snowballs rise and fall in a parabolic arc as they travel (visual only — collision stays on the ground plane). They scale up slightly at peak height with a shadow underneath that spreads as the ball goes higher.
- **Charge-based power**: tap Space for a short/slow throw, hold Space for a long/fast throw
  - Speed range: 18 (tap) to 30 (full charge)
  - Distance range: ~15% of arena (tap) to ~120% of arena (full charge — covers the whole map)
- Disappear on: hitting an enemy, hitting a snow fort, or traveling max distance
- **Splat marks**: when a snowball lands (miss, hit fort, or hit player), a white/grey elliptical splat appears on the ground and fades out over 5 seconds (max 40 on screen)
- **No friendly fire** — snowballs pass through teammates
- Cooldown: 0.6s between throws

### Snow Forts (Cover)

- Pre-placed on the arena at game start (same layout every game for fairness)
- Block both snowball travel and player movement
- Semi-transparent icy-blue appearance (Snowcraft aesthetic)
- Indestructible (keeps it simple — no building, no breaking)
- Players can hide behind them for cover, peek out to throw

### Teams

- Server randomly splits players into 2 teams (balanced +-1 player)
- Each team gets a randomly generated funny name
- **Blue team** vs **Red team** (character outfits/tint reflect team color)
- Players spawn on their respective side of the arena
- Players can only damage the opposing team

### Avatars

- Assigned randomly from a pool of ~12 character sprites on game start
- Each player in the match gets a unique avatar
- Purely cosmetic, no gameplay difference
- Characters are distinguishable by shape/look even at small size

---

## Funny Team Name Generator

Random combination: `The [Adjective] [Noun]` — Futurama-style absurdist/bureaucratic humor. Silly and safe, not raunchy.

**Adjectives:** Bureaucratically Frozen, Technically Alive, Mildly Defrosted, Suspiciously Warm, Mostly Harmless, Legally Distinct, Emotionally Unavailable, Slightly Damp, Nominally Competent, Aggressively Mediocre, Tragically Hip, Weaponized, Sentient, Hyper-Caffeinated, Reluctantly Heroic, Suspiciously Cheerful, Gloriously Incompetent, Cosmically Unlucky, Diplomatically Immune, Existentially Confused

**Nouns:** Bureaucrats, Snowbots, Penguins, Ice Weasels, Yetis, Zambonis, Icicle Merchants, Frost Lobsters, Snow Owls, Huskies, Polar Bears, Slush Puppies, Avalanche Enthusiasts, Fridge Magnets, Snowplow Pilots, Arctic Foxes, Tundra Nerds, Blizzard Wizards, Frozen Accountants, Glacier Inspectors

Pairs are picked without replacement within a game (no duplicate words across both team names).

---

## Multiplayer Architecture

### Server-Authoritative Model

The server owns all game state. Clients are input senders and renderers. This prevents cheating and keeps all players in sync.

```
Client                          Server
  |                               |
  |-- input (move dir, aim, throw) -->
  |                               |-- validate & update state
  |<-- game state broadcast -------|
  |                               |
  (render from server state)
```

### What the Server Manages

- Player positions, HP, alive/dead status
- Snowball positions, trajectories, lifetime
- Hit detection (circle-circle collision)
- Fort collision (rectangle-circle for snowballs, rectangle-rectangle for players)
- Team assignment, game phase transitions (lobby → game → results)
- Tick rate: **20 updates/second** (50ms intervals)

### What the Client Does

- Captures keyboard input, sends to server every frame
- Receives game state snapshots, interpolates between them for smooth rendering
- Renders isometric view: arena, forts, players, snowballs, UI
- Plays local animations (hit flash, elimination, packing snow)
- Shows HUD: HP bars, team rosters, kill feed

### Client-Side Prediction (Optional Polish)

- Apply own movement immediately for responsiveness
- Reconcile with server state on each update
- Not critical for 10 players on decent connections — can skip for v1

### Networking Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `join` | Client → Server | `{ name }` |
| `lobby-update` | Server → Client | `{ players[], hostId }` |
| `start-game` | Client → Server | *(host only)* |
| `game-start` | Server → Client | `{ teams[], avatars, teamNames, forts[] }` |
| `input` | Client → Server | `{ move: {x,y}, aimAngle, throwing }` |
| `state` | Server → Client | `{ players[], snowballs[] }` |
| `hit` | Server → Client | `{ targetId, attackerId, hpLeft }` |
| `elimination` | Server → Client | `{ playerId, killerId }` |
| `game-over` | Server → Client | `{ winningTeam, stats }` |
| `play-again` | Client → Server | *(host only)* |

---

## Rendering (Top-Down, PixiJS)

### Coordinate System

- Game logic and screen coordinates are the same — no projection needed
- Game world is 1200x800 logical units; PixiJS canvas scales to fit the browser window
- Y-axis points down (standard screen coordinates)

### Rendering Layers (PixiJS Containers, back to front)

1. **Ground container** — snow background rectangle, static decorative details (snowflake dots, subtle drifts)
2. **Fort container** — snow fort rounded rectangles, drawn with PixiJS Graphics
3. **Entity container** — eliminated players (grey squashed ellipses), active players (colored circles + hats), snowballs — sorted by Y via `zIndex`
4. **UI container** — HP bars, name labels, aim arrows (positioned relative to parent sprites)
5. **HUD overlay** — DOM-based: team rosters, kill feed, score

### Drawing Characters (PixiJS Graphics)

Each player is a PixiJS Container with child Graphics objects:

- Shadow: dark ellipse at feet, slight transparency
- Body: filled circle, team color (blue/red), dark stroke outline
- Hat: unique shape per avatar (beanie triangle, top hat rectangle, earmuff circles, etc.)
- Name: PixiJS Text above the character
- HP bar: small colored rectangle above the name

---

## Project Structure

```
snowthrowing/
├── server.js                # Bun HTTP server + Socket.IO, game loop, all server logic
├── package.json             # Only deps: socket.io (Bun handles HTTP natively)
├── public/
│   ├── index.html           # Single HTML file, loads PixiJS from CDN + our modules
│   ├── css/
│   │   └── style.css        # Lobby styling, HUD, results screen
│   ├── sounds/              # Kenney CC0 audio files (.ogg)
│   ├── js/
│   │   ├── main.js          # Entry point, screen manager
│   │   ├── lobby.js         # Lobby screen logic (DOM-based, no PixiJS)
│   │   ├── game.js          # PixiJS app, game loop, character drawing, input
│   │   ├── renderer.js      # Drawing functions (characters, forts, snowballs, HUD)
│   │   ├── sounds.js        # Audio playback (file-based + procedural), preloading, mute toggle
│   │   ├── network.js       # Socket.IO client wrapper
│   │   └── constants.js     # Shared config (speeds, cooldowns, arena size)
└── README.md                # How to run locally + deploy instructions
```

---

## Assets Plan

All core visuals are **drawn programmatically** with PixiJS Graphics — no sprite sheets or image files needed for gameplay.

| Asset | Source | How |
|-------|--------|-----|
| Player characters | Drawn in code | Colored circles + hat shapes + shadow ellipses |
| Snowballs | Drawn in code | Small white circles with grey shadow |
| Snow forts | Drawn in code | Rounded rectangles, semi-transparent icy blue |
| Arena ground | Drawn in code | White/light-blue gradient fill |
| Arena decorations | Drawn in code | Scattered dots (snowflakes), small tree triangles at edges |
| HP bars | Drawn in code | Colored rectangles above players |
| Aim arrow | Drawn in code | Line + arrowhead from player center |
| UI (lobby, results) | HTML/CSS | DOM-based, no canvas needed for menus |
| Sound effects | Kenney CC0 audio files + procedural (Web Audio API) | Footsteps, throw, hit, splat from Kenney packs; elimination jingle + friendly fire buzzer procedural |

Sound effects use a mix of **Kenney CC0 audio files** (snow footsteps, throw whoosh, hit impact, splat) and **procedural Web Audio API** (elimination jingle, friendly fire buzzer). All audio files are from [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds) and [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio) packs (CC0 / public domain). Sound is muted by default; players can toggle via in-game button (persisted in localStorage). Audio buffers are preloaded at game start for zero-latency playback with random variation in pitch and volume.

---

## Graphics Upgrade (Phase 5) — COMPLETE

Replaced the original colored-circle characters with code-drawn snowmen. After evaluating external sprite packs ("Winter Story" by Brosnya on OpenGameArt, LPC character generators, itch.io packs), we decided that free sprite assets didn't fit well — mismatched art styles, background removal issues, and limited character variety. Code-drawn snowmen turned out to be the best approach: zero external dependencies, full control, and perfectly thematic.

### What Changed

- **Characters → Snowmen**: Two stacked white snowballs (body + head), coal dot eyes, carrot nose, coal dot smile, stick arms with twig branches, black top hat with colored band, colored scarf
- **12 unique accent colors**: Each player gets a distinct scarf + hat band color (red, green, blue, orange, purple, teal, yellow, pink, cyan, lime, coral, violet) — mapped from the existing `hat` style field
- **Eliminated state → Melted puddle**: Flat snow puddle with fallen hat, scarf remnants, coal eyes, and carrot nose
- **Team identification**: No team coloring on characters — the center line boundary makes teams clear
- **Server**: Added `moving` flag to player state broadcast for potential animation use
- **Throwing arm animation**: When throwing, the snowman's arm swings out in the aim direction (team 0 throws with left arm, team 1 with right arm — facing toward the opponent's side)
- **Snowball charging animation**: While holding space, both arms come together and roll a growing snowball in front of the body. Ball size reflects charge power (0–100%)
- **Ice glacier forts**: Replaced rounded rectangles with jagged ice/glacier shapes — irregular polygons with ice spikes, shine highlights, crack lines, and shadows. Each fort has a unique shape via seeded random (consistent across redraws)
- **Removed aim arrow**: No more arrow indicator on the player snowman
- **Expanded arena**: 1600x1000 (up from 1200x800) to accommodate 4-5 players per side
- **Random barrier positions**: Forts are randomly placed each game (5-7 per side), with different layouts on each team's side
- **Barriers toggle**: Host can enable/disable barriers via checkbox in lobby before starting. Barriers on by default
- **Refresh protection**: Browser shows "Leave site?" warning during active game to prevent accidental refresh
- **Host disconnect handling**: If host leaves during a game, all players are returned to lobby automatically
- **Player-player collision**: Players can no longer pass through each other — they push apart on overlap, applies to all alive players
- **Friendly fire toggle**: Host can enable/disable in lobby (off by default). When on, hitting a teammate damages the teammate (traditional friendly fire)
- **Friendly fire sound**: Distinct buzzer sound effect for friendly fire hits, orange floating text, and unique kill feed message to distinguish from normal hits
- **No external assets**: Everything remains 100% code-drawn with PixiJS Graphics

---

## Development & Testing

### Local Development

```bash
bun install
bun run server.js
# Open http://localhost:3000
```

### Local Multiplayer Testing

To test multiplayer locally, open **multiple browser tabs** pointing at `http://localhost:3000` — each tab acts as a separate player. Steps:

1. Tab 1: enter a name, join lobby (becomes host)
2. Tab 2-N: enter different names, join lobby
3. Tab 1: click "Start Game" once 4+ players have joined
4. Play from each tab using different keyboard focus

For quick testing during development, add a `?bot=3` query param that spawns 3 server-side dummy players who stand still (Phase 2 dev convenience — not shipped to prod).

### Stress Testing

Bot stress test to simulate multiplayer load without needing real players:

```bash
# 8 bots, 60s duration, auto-starts game
bun run stress-test.js

# Custom options
BOTS=10 DURATION=120 bun run stress-test.js

# Against remote deployment
SERVER=https://your-app.up.railway.app BOTS=8 DURATION=60 bun run stress-test.js

# Don't auto-start (join manually as host, bots fill the lobby)
AUTO_START=false BOTS=6 bun run stress-test.js
```

Outputs a report with tick timing, RTT latency, state intervals, and health warnings.

**Server metrics**: Visit `http://localhost:3000/stats` during play for live JSON stats.

**Browser overlay**: Press `` ` `` (backtick) during a game to toggle FPS/frame/state metrics. Heap tracking is Chrome-only; FPS and state intervals work in all browsers.

### Hot Reload (Dev Only)

Bun supports `--watch` for server restarts on file change:

```bash
bun --watch run server.js
```

Client-side: just refresh the browser (no build step, no HMR needed).

---

## Deployment

### Railway (Recommended)

Railway offers $5 free credits (30-day trial, no credit card required). With serverless/app-sleeping enabled, it costs nothing when idle and auto-wakes on traffic.

1. Install Railway CLI: `brew install railway` (or `npm i -g @railway/cli`)
2. Sign up / log in: `railway login`
3. Create project: `railway init`
4. Deploy: `railway up`
5. Generate a public URL: `railway domain`
6. Enable **Serverless** in service Settings (scales to zero when idle, wakes on traffic)

**Actual cost (measured):**
- ~$0.04/hour during active play (2 browsers)
- ~$1/day if running 24/7 non-stop
- With serverless enabled: **$0 when idle**, only bills during active sessions
- $5 credits lasts weeks with normal usage patterns

**Pros:** No credit card, serverless auto-sleep, generous credits, WebSocket support.
**Cons:** Credits expire after 30 days; no custom domain on free tier; ~5s cold start when waking.

**Live deployment:** https://snowball-fight-production-25e4.up.railway.app/

### Why not Fly.io?

We tried Fly.io first but found it impractical for free-tier use:
- Free trial only gives **2 machine-hours total** (not per day)
- Creates 2 machines by default, burning hours 2x faster
- Multi-machine setup causes Socket.IO polling errors (need WebSocket-only transport)
- Requires credit card to continue past trial
- Suspend-on-idle helps but still burns hours when anyone visits

### Cleanup

- Stop Railway service: via dashboard Settings or `railway down`
- Redeploy: `railway up`

---

## Production Learnings (Post-Playtest)

After ~20 minutes of real multiplayer play, multiple players experienced blank screens and browser crashes. Root causes:

1. **GPU texture leak**: `renderState()` called `removeChildren()` 20x/second without `.destroy()`, leaking GPU textures. Each `new PIXI.Text()` per frame generated texture uploads that never got cleaned up.
2. **Object churn**: Creating hundreds of PIXI.Graphics and PIXI.Text objects per second caused severe GC pressure and long pauses.
3. **Firefox performed better** because its WebGL implementation handles texture churn differently — Chrome's GPU process would OOM-crash entirely.
4. **High-DPI screens compounded the issue**: 3x Retina displays rendered 9x more pixels, hitting GPU limits faster.

**Fix**: Object pooling. Player containers, splats, snowballs, footprints, and floating text are now allocated once and reused via active/inactive flags. PIXI.Text objects are cached per-player. Resolution is capped at 2x. All objects are properly `.destroy()`ed with texture cleanup on game end.

**Key rule**: In a PixiJS game loop, never `new` display objects inside the render function. Allocate at init, reuse via pools, destroy only on cleanup.

### Bun-Native Engine Migration

Replaced Node.js `createServer` polyfill with `@socket.io/bun-engine`, which uses Bun's native HTTP/WebSocket server. Results:

- **Memory**: 3.5MB heap vs 6.7MB — ~50% reduction
- **Setup**: `export default { port, idleTimeout: 30, fetch, websocket }` pattern instead of `httpServer.listen()`
- **Critical**: `idleTimeout` must exceed Socket.IO's `pingInterval` (25s default) or connections silently drop
- **Static files**: Served via the `fetch` handler using Bun's `Response` API instead of Node's `res.writeHead()`/`res.end()`
- **Gotcha**: Always check `statSync(path).isDirectory()` before `readFileSync()` — Socket.IO can hit directory paths causing EISDIR crash

### Stress Testing Findings

Bot stress test (8 bots, 60s) with `@socket.io/bun-engine`:
- Tick avg: 0.57ms (budget: 50ms) — 1.1% utilization
- p95: 1.32ms, max: 8.51ms, zero overruns
- Memory stable at ~5MB heap, no leaks detected
- RTT: 1ms avg, 2ms p95
- State intervals: 51ms avg (target: 50ms)
- 8 games completed in 45s with realistic bot behavior

The 3s max state interval spike is expected during game-over → lobby → restart transitions (no state events broadcast during that gap).

### Input Prediction: When NOT to Use

Client-side prediction was implemented (apply local movement instantly, reconcile with server via 0.3 blend factor) but **removed after playtesting** because:

- At <10ms latency (LAN/same machine), prediction causes visible rubber-banding — the client moves 3x faster than server (60fps × speed vs 20fps × speed), then the blend yanks it back
- Players see their character in two places simultaneously during direction changes
- Interpolation alone produces smooth movement at low latency since the 50ms tick gap is small enough

**Rule**: Only add prediction if latency exceeds ~80ms (cross-region play). For party games on the same network, interpolation is sufficient and simpler.

### Host Disconnect Handling

When the host refreshes mid-game, all other players must return to lobby. Key details:
- Server clears all players from the game state on host disconnect
- Server emits `host-left` event followed by `lobby-update` (safety net)
- Clients auto-rejoin lobby using their saved name (localStorage)
- Without this, non-host players get a black screen (game canvas with no state updates)
- Safety net: clients that receive `lobby-update` while `inGame=true` force-return to lobby (covers race conditions)

### Non-Host Disconnect Handling

When a non-host player disconnects (refresh, wifi, close tab) mid-game:
- **Eliminate immediately** — no grace period. Their character dies and the game continues.
- If they come back, they join as spectator until next round.
- Grace period reconnection sounds good in theory but causes game freezes (stale player in state, team balance issues, win condition stalls).

### PixiJS Container Lifecycle in Render Loop

When removing players from the render loop mid-game, **never `.destroy()` a container that might still be referenced by the stage**. The sequence `destroyContainer()` → `entityContainer.removeChildren()` crashes because PixiJS tries to manipulate a destroyed object, killing the ticker silently (canvas freezes, DOM keeps working).

**Fix**: Detach from parent and remove from tracking map, but defer `.destroy()` to game cleanup. Containers without active references use negligible memory.

### Input Throttling

Sending input every frame (60fps) causes diagonal movement jitter — keys register on different frames, so the server briefly sees (1,0) before (1,1). Throttle input sends to 30fps (still well above the 20Hz tick rate). Throws bypass the throttle for instant response.

### DOM HUD in a 20fps Game Loop

Rebuilding DOM (innerHTML) on every state tick (20fps) swallows click events — buttons get destroyed before the click handler fires. Fix: only rebuild the HUD when underlying data changes (use a key string comparison). This also reduces layout thrashing.

### pointer-events Inheritance

If a game HUD overlay uses `pointer-events: none` (so clicks pass through to the canvas), ALL children inherit this. Any interactive elements (buttons) need explicit `pointer-events: auto` on their container. This is a common gotcha with overlay UIs.

---

## Implementation Order

### Phase 1: Skeleton
- [x] Initialize Bun project (`bun init`), install Socket.IO
- [x] Bun HTTP server serving static files
- [x] Lobby screen: name input, player list, host start button
- [x] Socket.IO connection, join/lobby-update events

### Phase 2: Core Game
- [x] Server-side game state: players, positions, teams, forts
- [x] Team assignment + funny name generator
- [x] PixiJS app setup, top-down rendering containers
- [x] Draw arena: snow ground, fort rounded rectangles
- [x] Draw characters: colored circles + hats + shadows + name labels
- [x] Keyboard input: WASD movement, Q/E aim rotation
- [x] Aim arrow rendering (line + arrowhead from player)
- [x] Snowball throwing with cooldown + server-side trajectory
- [x] Fort collision (blocks snowballs and movement)
- [x] Server-side hit detection (circle-circle)
- [x] HP tracking, HP bars above players
- [x] Elimination (squash to grey ellipse) + spectator mode
- [x] Win condition check + game-over event

### Phase 3: Polish
- [x] Unique hat/accessory per avatar (12 styles drawn in code)
- [x] Hit feedback (screen flash on hit)
- [x] Kill feed / event log
- [x] Results screen with stats (MVP, eliminations, first blood)
- [x] Play again flow
- [x] Arena decoration (snow dots, dashed center line)
- [x] Snowball arc animation (parabolic rise/fall with shadow)
- [x] Splat marks where snowballs land (fade over 5s)
- [x] Charge-to-throw mechanic (hold space for power)
- [x] Center line boundary (teams can't cross)
- [x] Player name persistence (localStorage)
- [x] Floating "-1" damage text on hit (rises and fades)
- [x] "Packing snow" visual during throw cooldown (swirling snow particles)
- [x] Sound effects: Kenney CC0 audio files (footsteps, throw, hit, splat) + procedural Web Audio (elimination, friendly fire buzzer) with preloading and random variation
- [x] Footprint trails in snow (fade over 3s, own player only)

### Phase 4: Deploy & Test
- [x] Deploy to Railway (serverless, auto-sleep, $5 free credits)
- [ ] Test with real players on multiple devices
- [ ] Tweak balance: movement speed, throw speed, cooldown, arena size, fort placement
- [ ] Mobile considerations: if needed, add on-screen touch controls (stretch goal)

### Phase 8: Smoothness & Resilience

- [x] State interpolation — lerp between server snapshots for 60fps-smooth movement despite 20fps updates
- [x] ~~Input prediction~~ — removed after playtesting (caused rubber-banding/double-player at <10ms latency, interpolation alone is sufficient)
- [x] Tab visibility detection — sends heartbeat on return, prevents ghost frozen players
- [x] AFK detection & kick — 15s no input = marked AFK, 10s more = eliminated and kicked
- [x] ~~Reconnection grace period~~ — removed (caused game freezes); disconnect = immediate elimination, rejoin as spectator
- [x] Late join as spectator — players joining mid-game watch current round, auto-join next lobby
- [x] AFK/disconnect events broadcast to all players via kill feed
- [x] Heartbeat system — client pings server every 5s to stay alive even when idle

### Phase 9: Stability Fixes (Post-Playtest #2)

- [x] Removed input prediction — caused jank/double player at low latency; interpolation alone is smooth
- [x] Fixed AFK not clearing — heartbeat now properly clears AFK flag and broadcasts `player-returned`
- [x] Fixed host refresh black screen — all players kicked to lobby and auto-rejoin with saved name
- [x] Late join spectator client UI — late joiners see game canvas with "Spectating" banner, auto-join next lobby
- [x] Non-host disconnect = immediate elimination (no grace period that freezes the game)
- [x] Fixed PixiJS ticker crash on player leave — detach containers instead of destroying mid-render
- [x] Added lobby-update safety net — clients force-return to lobby if they receive it while in-game
- [x] Throttled input sends to 30fps — fixes diagonal movement jitter from per-frame key sampling

### Phase 10: Host Kick Feature

- [x] Server-side `kick-player` event (host-only, prevents self-kick)
- [x] Kick button in lobby (red "✕" next to each non-host player)
- [x] Kick button in-game HUD (next to alive players in team roster)
- [x] Kicked player's socket is forcefully disconnected, receives alert
- [x] `hostId` included in state broadcast — enables host UI for spectators/late-joiners
- [x] `updateHost()` checks spectators too — "alan" is always host even as spectator
- [x] HUD only rebuilds on data change (prevents click-swallowing from 20fps DOM rebuilds)
- [x] Fixed `pointer-events` on team roster (parent HUD uses `pointer-events: none` for canvas passthrough)

### Phase 6: Performance Fix — Object Pooling & Memory Management

- [x] Diagnosed crash after ~20 minutes: GPU texture leak from recreating PIXI objects every frame
- [x] Implemented object pooling for player containers, splats, snowballs, footprints, floating text
- [x] Cached PIXI.Text objects per player (was creating 200+ texture uploads/second)
- [x] Proper `.destroy()` calls with texture cleanup on game end
- [x] Capped resolution to 2x max (prevents 3x Retina screens from overloading GPU)
- [x] Fixed splat jitter (stored random offsets once instead of regenerating per frame)
- [x] Reduced network payload size (rounded floats to integers, aim angles to 2 decimal places)
- [x] Pool-based lifecycle: objects are deactivated/reactivated, not created/destroyed each frame

### Phase 7: Stress Testing & Metrics

- [x] Bot stress test script (`stress-test.js`) — spawns N bots that play autonomously
- [x] Server metrics endpoint (`/stats`) — tick timing (avg/p95/p99/max), memory, player count
- [x] Bot-side RTT latency measurement via `ping-measure` event
- [x] State broadcast interval tracking (detects server lag)
- [x] Automated health check report with warnings for overruns/memory/latency
- [x] Browser performance overlay (press backtick to toggle) — FPS, frame times, state intervals
- [x] JS heap tracking with leak detection (Chrome only, graceful fallback on Firefox/Safari)
- [x] Fixed server crash on directory path requests (EISDIR)

### Phase 5: Graphics Upgrade — Snowman Characters
- [x] Evaluated external sprite packs (Winter Story, LPC, itch.io) — poor fit
- [x] Designed code-drawn snowman character (body, head, hat, scarf, arms, face)
- [x] 12 unique accent colors per player (scarf + hat band)
- [x] Melted puddle eliminated state (fallen hat, scarf, coal, carrot)
- [x] Added `moving` flag to server state broadcast
- [x] Removed unused sprite assets and sprite loader module
- [x] Updated PLAN.md documentation

---

## Future Ideas

- [ ] **Destructible barriers** — forts take damage from snowball hits (3 hits to destroy), removing cover mid-game and forcing teams to adapt positioning
- [ ] Power-ups (speed boost, rapid fire, shield)
- [ ] Different snowball types (curve ball, split shot)
- [ ] Shrinking arena over time (forces engagement)
- [ ] Post-game stats screen (MVP, accuracy %, longest snipe)
