# Snowball Fight - Multiplayer Browser Game

*Inspired by the classic Snowcraft (ActionScript, early 2000s)*

## Overview

A casual multiplayer snowball fight game for 4-11 players. No login, no auth — just enter a name and play. Players are split into two teams with funny auto-generated names, each player gets a random avatar, and teams battle until one side is fully eliminated.

The game aims to capture the **Snowcraft feel**: isometric 3/4 top-down view, clean white snow arena, chunky cartoon characters in team colors, snow fort cover, and direct-line snowball throws. The key difference — each player controls a single character in real-time multiplayer, rather than commanding a squad against AI.

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Runtime | Bun | Faster than Node, built-in HTTP server (no Express needed), fewer deps |
| Frontend Rendering | PixiJS (v8, via CDN) | Sprite management, z-sorting, tinting, animation — handles isometric rendering grunt work |
| Frontend Logic | Vanilla JS | No framework needed — lobby is simple DOM, game is all PixiJS canvas |
| Real-time | Socket.IO | Proven WebSocket lib, auto-reconnect, rooms |
| Assets | Hand-drawn (canvas/PixiJS Graphics) + Kenney UI Pack + freesound.org | No external sprite deps for core game |
| Hosting | Render.com free tier | Serves static files + WebSockets from one app, free, supports Bun |

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
| Space | Throw snowball in current aim direction |

- Movement is straightforward — WASD maps directly to screen directions
- An **aim arrow** extends from the player showing current throw direction
- The aim arrow rotates smoothly with Q/E at a comfortable speed
- Cooldown of **~1.5 seconds** between throws ("packing snow" — character briefly bends down)
- Movement speed is constant; players can move while the aim arrow stays in its last direction
- Players cannot move through snow forts (collision)

---

## Arena Design

```
+--------------------------------------------------+
|                                                    |
|     [Fort]              [Fort]                     |
|                                                    |
|          [Fort]                    [Fort]          |
|   BLUE                                RED          |
|   TEAM        [Fort]  [Fort]         TEAM          |
|   SPAWN                              SPAWN         |
|          [Fort]                    [Fort]          |
|                                                    |
|     [Fort]              [Fort]                     |
|                                                    |
+--------------------------------------------------+
```

- Roughly symmetrical layout — fair for both teams
- Teams spawn on opposite sides
- Snow forts are **pre-placed obstacles/cover** (not buildable, keeping it simple)
- Forts block snowball travel (snowballs collide and disappear on hitting a fort)
- Forts block player movement (must go around)
- Arena size scaled for 10 players — roughly 1200x800 logical units
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

- Travel in a **straight line** from the player in the aim direction (Snowcraft style — no arc)
- Speed: ~3x player movement speed
- Disappear on: hitting an enemy, hitting a snow fort, or traveling max distance (~60% of arena width)
- **No friendly fire** — snowballs pass through teammates
- Visually: small white filled circle (~8px) with a light grey shadow underneath

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

Random combination: `[Adjective] [Noun]` — adult comedy tone.

**Adjectives:** Frostbitten, Absolutely Hammered, Ice Cold, Polar, Snowblind, Frigid, Rock Hard, Slippery, Barely Clothed, Stiff, Half-Frozen, Unhinged, Throbbing, Moist, Stone Cold, Fully Loaded, Raw Dogging, Butt-Naked, Lubed Up, Dangerously Horny

**Nouns:** Chads, Snowflakes, Pounders, Yetis, Icicles, Penguins, Flurries, Avalanches, Dumplings, Numb Nuts, Snowblowers, Frostbites, Shivers, Swingers, Cougars, Sugar Daddies, MILFs, Hot Messes, Mouth Breathers, Degenerates

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
│   ├── js/
│   │   ├── main.js          # Entry point, screen manager
│   │   ├── lobby.js         # Lobby screen logic (DOM-based, no PixiJS)
│   │   ├── game.js          # PixiJS app, game loop, character drawing, input
│   │   ├── renderer.js      # Drawing functions (characters, forts, snowballs, HUD)
│   │   ├── network.js       # Socket.IO client wrapper
│   │   └── constants.js     # Shared config (speeds, cooldowns, arena size)
│   └── assets/
│       └── sounds/          # Impact/throw SFX from freesound.org (CC0)
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
| Impact SFX | freesound.org (CC0) | Snowball hit, throw whoosh, elimination thud |
| UI SFX | Kenney Impact Sounds | Button clicks, game start chime |

**Total external file downloads: only a few small audio files.** Everything visual is code-generated, keeping the project lightweight and eliminating asset pipeline complexity.

---

## Future Graphics Upgrade (Phase 5)

The code-drawn visuals (circles + shapes) are the v1 approach — fast to build, zero asset dependencies. Once gameplay is solid, upgrade to proper sprite art from free asset sources.

### What to Upgrade

| Element | Current (v1) | Upgrade Target |
|---------|-------------|----------------|
| Characters | Colored circles + hat shapes | Sprite sheets with 4-directional walk animations |
| Snow forts | Rounded rectangles | Detailed ice/snow wall sprites |
| Arena ground | Flat gradient | Tiled snow texture with subtle variation |
| Snowballs | White circles | Textured snowball with motion trail |
| Trees/decoration | Triangles | Proper snow-covered tree sprites |
| Elimination | Grey squashed ellipse | Character lying flat / snow angel sprite |

### Free Asset Sources (Ranked)

1. **OpenGameArt.org** — https://opengameart.org
   Largest open-license game art repo. Licenses vary (CC0, CC-BY, CC-BY-SA). The LPC (Liberated Pixel Cup) collection has excellent top-down characters with walk cycles. Best for: characters, tilesets, environment.

2. **itch.io Free Assets** — https://itch.io/game-assets/free
   Huge variety, quality varies. Check license per pack. Best for: finding niche themed packs (winter, snow).

3. **Kenney.nl** — https://kenney.nl
   All CC0. No winter-specific isometric/top-down packs, but good for UI elements, particles, and general-purpose sprites.

4. **CraftPix.net Freebies** — https://craftpix.net/freebies/
   Professionally polished top-down tilesets and characters. Proprietary-permissive license (free, no resale). Best for: high-quality environment tiles, UI.

5. **GameArt2D.com** — https://www.gameart2d.com/freebies.html
   Free character sprites and tilesets including winter/Christmas themes. Royalty-free. Best for: themed props and backgrounds.

6. **Game-icons.net** — https://game-icons.net
   4000+ SVG/PNG icons, CC-BY 3.0. Best for: HUD icons (health, snowball count, team indicators).

7. **Universal LPC Spritesheet Generator** — https://sanderfrenken.github.io/Universal-LPC-Spritesheet-Character-Generator/
   Web tool to compose top-down characters with customizable clothing, hair, skin. CC-BY-SA 3.0. Best for: generating unique per-player avatars with team-colored outfits.

### Specific Winter/Snow Packs Found

- **"Winter Story" by Brosnya** (OpenGameArt) — CC0. Top-down snow/soil tiles, 4-directional character walk animations, craftable items. Directly applicable.
- **"Christmas Village Asset Pack" by murphysdad** (OpenGameArt) — CC0. Top-down 4-direction characters, snow tilesets, trees, snowman.
- **"LPC Winter Tiles"** (OpenGameArt) — CC-BY-SA 3.0. Snow-covered pine trees and winter ground tiles. Pairs with the LPC Character Generator.

### Upgrade Strategy

The renderer is isolated in `renderer.js` — swapping from Graphics-drawn shapes to loaded sprites means changing the draw functions, not the game logic. PixiJS handles both Graphics and Sprites uniformly, so the entity container / z-sorting / HUD code stays the same.

1. Pick a consistent art style from one source (mixing styles looks jarring)
2. Replace `renderer.js` draw functions one element at a time (characters first, then forts, then ground)
3. Add spritesheet loading to `game.js` init
4. Keep the code-drawn version as a fallback if sprites fail to load

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

### Hot Reload (Dev Only)

Bun supports `--watch` for server restarts on file change:

```bash
bun --watch run server.js
```

Client-side: just refresh the browser (no build step, no HMR needed).

---

## Deployment

### Production (Render.com)

1. Push to GitHub
2. Create a new Web Service on Render, point to the repo
3. Environment: **Bun** (Render supports it natively)
4. Build command: `bun install`
5. Start command: `bun run server.js`
6. Free tier — sleeps after 15 min inactivity, ~30s cold start

Share the Render URL with players. No DNS or SSL setup needed.

---

## Implementation Order

### Phase 1: Skeleton
- [ ] Initialize Bun project (`bun init`), install Socket.IO
- [ ] Bun HTTP server serving static files
- [ ] Lobby screen: name input, player list, host start button
- [ ] Socket.IO connection, join/lobby-update events

### Phase 2: Core Game
- [ ] Server-side game state: players, positions, teams, forts
- [ ] Team assignment + funny name generator
- [ ] PixiJS app setup, top-down rendering containers
- [ ] Draw arena: snow ground, fort rounded rectangles
- [ ] Draw characters: colored circles + hats + shadows + name labels
- [ ] Keyboard input: WASD movement, Q/E aim rotation
- [ ] Aim arrow rendering (line + arrowhead from player)
- [ ] Snowball throwing with cooldown + server-side trajectory
- [ ] Fort collision (blocks snowballs and movement)
- [ ] Server-side hit detection (circle-circle)
- [ ] HP tracking, HP bars above players
- [ ] Elimination (squash to grey ellipse) + spectator mode
- [ ] Win condition check + game-over event

### Phase 3: Polish
- [ ] Unique hat/accessory per avatar (12 styles drawn in code)
- [ ] Hit feedback (flash white, knockback, floating "-1" text)
- [ ] "Packing snow" visual during throw cooldown
- [ ] Kill feed / event log
- [ ] Results screen with stats (MVP, eliminations, first blood)
- [ ] Play again flow
- [ ] Arena decoration (scattered snowflake dots, tree triangles at edges)
- [ ] Sound effects: throw whoosh, hit splat, elimination thud (freesound.org CC0)
- [ ] Footprint trails in snow (optional)

### Phase 4: Deploy & Test
- [ ] Push to GitHub
- [ ] Deploy to Render.com
- [ ] Test with real players on multiple devices
- [ ] Tweak balance: movement speed, throw speed, cooldown, arena size, fort placement
- [ ] Mobile considerations: if needed, add on-screen touch controls (stretch goal)
