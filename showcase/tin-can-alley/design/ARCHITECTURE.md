# Tin Can Alley — Architecture

## Scaffold

Done at Scaffold Checkpoint: `npx @iwsdk/create@latest tin-can-alley --yes
--mode vr --physics --grabbing --no-locomotion --no-metaspatial` (resolved
0.4.2, recipes served from the locally-built starter-assets dist). Baseline is
the untouched scaffold; starter gameplay files (robot.ts, panel.ts,
welcome.uikitml, unused gltf/textures) are removed at M1.

## File tree (one system per file; no barrel index)

```
src/
  index.ts                    # World.create, globals, registrations, scene assembly (MAIN AGENT ONLY)
  constants.ts                # positions/dims/palette shared by scene + systems (from layout.svg)
  components/game-state.ts    # GameGlobals interface + typed accessor
  components/tin-can.ts       # Can, Downed
  components/softball.ts      # Ball
  scene/environment.ts        # night dome/IBL on level root, floor, string lights
  scene/booth.ts              # booth meshes + static colliders (counter, shelf, frame)
  scene/spawn.ts              # spawnCan/spawnBall/pyramid+counter layout (shared with reset)
  systems/scoring-system.ts   # ScoringSystem
  systems/round-system.ts     # RoundSystem (incl. doReset)
  systems/scoreboard-system.ts# ScoreboardSystem
ui/scoreboard.uikitml
public/audio/chime.mp3        # (starter, kept)
```

## Components

| Component | Field              | Type    | Default   |
| --------- | ------------------ | ------- | --------- |
| Can       | initialPosition    | Vec3    | [0,0,0]   |
| Can       | initialOrientation | Vec4    | [0,0,0,1] |
| Downed    | — (tag)            |         |           |
| Ball      | initialPosition    | Vec3    | [0,0,0]   |
| Ball      | thrown             | Boolean | false     |

## Systems

| System           | Priority | Queries                                                         | Purpose                                               |
| ---------------- | -------- | --------------------------------------------------------------- | ----------------------------------------------------- |
| ScoringSystem    | 12 (sim) | standing[Can,Transform,PhysicsBody,¬Downed]; downed[Can,Downed] | tip/zone detection → Downed; score/log/SFX on qualify |
| RoundSystem      | 15 (sim) | balls[Ball,Transform,PhysicsBody]; heldBalls[Ball,Grabbed]      | throw counting, settle timer, round state, doReset()  |
| ScoreboardSystem | 30 (ui)  | scorePanel[PanelUI,PanelDocument,config='./ui/scoreboard.json'] | signal→text binding; reset click → resetRequested++   |

Registration order in index.ts: globals → registerComponent(Can,Downed,Ball) →
registerSystem(Scoring 12, Round 15, Scoreboard 30) → build scene → spawn
cans/balls (systems registered BEFORE spawn ⇒ qualify events fire naturally).

## Entity placement (from design/concept/layout.svg)

| Entity             | Components                              | Position [x,y,z]                                                                                                     |
| ------------------ | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| floor              | Static Box [4,0.1,4]                    | [0,−0.05,0] (top at 0)                                                                                               |
| counter            | Static Box [2,0.08,0.5]                 | [0,0.86,−2.2] (top 0.9)                                                                                              |
| shelf              | Static Box [2,0.05,0.35]                | [0,1.075,−2.8] (top 1.1)                                                                                             |
| booth frame/awning | meshes only (no physics)                | around booth                                                                                                         |
| balls ×3           | Ball, DistanceGrabbable, Sphere/Dynamic | [−0.3/0/0.3, 0.95, −2.2]                                                                                             |
| cans ×6            | Can, Cylinder/Dynamic                   | pyramid rows y 1.16/1.42/1.68 (h=0.12 → centers 1.16, base row 3 @ x −0.18/0/0.18, mid 2 @ ∓0.09, top 1 @ 0), z −2.8 |
| score panel        | PanelUI+Interactable                    | [0,1.9,−2.9]                                                                                                         |
| hitSfx             | AudioSource positional                  | [0,1.1,−2.8]                                                                                                         |
| clearSfx           | AudioSource non-positional              | [0,1.6,−2.5]                                                                                                         |

(Can rows: base centers y=1.16 (shelf 1.1 + h/2 0.06), +0.26 per row per
layout table — verify visually at M2.)

## Globals

Per TECH_PLAN: score, ballsLeft, roundState, resetRequested signals + sfx
entity refs. `@preact/signals-core` added to dependencies.

## Milestones

### M0 — scaffold baseline (untouched)

Demo: starter scene serves, renders, enters XR.
Assertions: dev status running; screenshot non-black; `xr enter` ok; logs clean.

### M1 — night booth world

Demo: dark indigo sky, amber IBL, striped booth, floor, string lights; starter
robot/panel gone.
Assertions: screenshot shows night booth; `ecs find` DomeGradient+IBLGradient
on level-root entity; console clean; tsc clean.

### M2 — balls, cans, grab & throw (core loop feel)

Demo: 3 balls on counter, 6-can pyramid; distance-grab a ball, throw, cans
tumble.
Assertions (S2, S3): ecs find Ball/Can entities; snapshot → simulate ray grab
(look-at + set-select-value 1) → diff shows ball moved toward controller;
release with swing (animate-to + set-select-value 0) → snapshot/diff shows ≥1
can displaced/tipped.

### M3 — scoring & round systems

Demo: browser logs show `[GAME] score=…` as cans fall, round transitions.
Assertions (S4 partial, S6): logs patterns `[GAME] score=`, `[GAME] sfx=hit`
after knockdown; roundState transitions in logs; tsc clean.

### M4 — scoreboard panel + reset + clear sting

Demo: panel shows live score/balls/state; clicking RESET restacks everything.
Assertions (S4, S5): panel text updates ≤1 s (log + screenshot); `xr select`
on reset button → step ≥3 frames → `ecs diff` cans ≈ initial poses;
`[GAME] round=reset` log; ballsLeft back to 3.

### M5 — full Phase 6 verification pass

All S1–S6 with recorded evidence in design/VERIFICATION.md.

## Build fan-out plan (Phase 5)

- Main agent: constants.ts, components/\*, scene/spawn.ts, index.ts, systems/
  scoring+round (core loop), integration, dev server, all verification.
- Sub-agent A (parallel, disjoint): scene/environment.ts + scene/booth.ts
  (visual world; no ECS logic beyond static physics components).
- Sub-agent B (parallel, disjoint): ui/scoreboard.uikitml +
  systems/scoreboard-system.ts (reads only the signals contract above).
- Both sub-agents: read TECH_PLAN + api-reference; tsc --noEmit before
  returning; no servers, no package.json edits.
- `[ASSUMED] auto-commit milestones` (repo is the monorepo working tree —
  showcase committed on the session branch).
