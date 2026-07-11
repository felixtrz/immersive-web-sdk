# Tin Can Alley — Tech Plan

Grounded against **installed @iwsdk/core 0.4.2** (elics 3.4.2, Havok physics)
via the reference CLI + `node_modules/@iwsdk/core/dist/**` source. Where the
bundled api-reference.md disagrees with 0.4.2, the installed source wins —
two such cases are flagged ⚠️ below.

## World.create block (decided)

```typescript
World.create(container, {
  assets: {
    chime: {
      url: '/audio/chime.mp3',
      type: AssetType.Audio,
      priority: 'critical',
    },
  },
  xr: { sessionMode: SessionMode.ImmersiveVR, offer: 'once' }, // dual-runtime: browser works via canvasPointerEvents default
  render: { defaultLighting: false }, // we own the night look — avoids double-add on level root
  features: {
    physics: true, // cans/balls dynamics (boolean-only flag)
    grabbing: true, // GrabSystem @ -3; distance grab via ray+trigger
    // locomotion omitted (stationary booth) — no collision-geometry prereq
    // spatialUI defaults ON (PanelUI/PanelUISystem auto-registered)
    // audio has NO flag — AudioSystem is always-on
  },
});
```

Prerequisites checked: locomotion off → none; spatialUI → ui/scoreboard.uikitml
compiled by the already-wired compileUIKit plugin; physics → explicit shapes on
every body (never Auto).

## Mechanics grounding

| Mechanic                     | Class           | IWSDK pieces                                                                                                                                                                                                                                                                                                           | Custom work                                                                                                                                 | Risk                                                                                                                                                                                                                                         |
| ---------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1+M2 grab ball (near & far) | BUILT-IN        | `DistanceGrabbable` { movementMode: MoveTowardsTarget, moveSpeedFactor 0.2, translate/rotate true, scale **false**, returnToOrigin **false** } + `grabbing` flag. Ray+trigger works at any range (force-pull snaps to hand ≤5 mm)                                                                                      | none                                                                                                                                        | ⚠️ **One-Handle conflict**: an entity cannot have both OneHandGrabbable and DistanceGrabbable (GrabSystem creates one Handle; deny-ray vs deny-grab). Spec M1 deviates: _trigger_, not squeeze, grabs at close range. `[ASSUMED]` acceptable |
| M3 throw                     | BUILT-IN        | Emergent: while `Grabbed`, PhysicsSystem drives the Dynamic body via `HP_Body_SetTargetQTransform` (chase velocity ≈ hand velocity); on release the body keeps its velocity → ballistic flight. Zero custom code (physics example precedent)                                                                           | optional ThrowAssist (deferred): avg grip velocity ring-buffer → `PhysicsManipulation{linearVelocity}` boost                                | feel risk: single-frame chase sampling; verify S3 before adding assist                                                                                                                                                                       |
| M4 can knockdown             | CUSTOM          | Transform-based: **no collision events exist** (PhysicsSystem never pumps Havok events). Post-step pose read in sim band                                                                                                                                                                                               | `ScoringSystem` (prio 12): canUp·worldUp < cos45° OR outside shelf AABB → add `Downed` tag; qualify-sub does score++/log/SFX                | poll 6 cans/frame — trivial                                                                                                                                                                                                                  |
| M5 round & ball budget       | CUSTOM          | `Grabbed` tag disqualify on `{required:[Ball,Grabbed]}` = release detection                                                                                                                                                                                                                                            | `RoundSystem` (prio 15): first-throw marks `Ball.thrown`, decrements ballsLeft; 3 s settle timer before 'out'; 'cleared' when 6th can downs | guard `resetting` flag (destroy fires disqualify too)                                                                                                                                                                                        |
| M6 reset                     | BUILT-IN+CUSTOM | Physics teleport idiom: remove **both** PhysicsBody+PhysicsShape → write pose (getVectorView from Can/Ball initial fields) → re-add both (fresh body, zero velocity, awake). UI click → `resetRequested` counter signal                                                                                                | `doReset()` in RoundSystem + shared spawn helpers                                                                                           | ⚠️ 0.4.2 has **no GrabSystem.forceRelease** (api-reference is ahead) — held balls at reset are `entity.destroy()`ed + respawned. Body recreation takes ~2 frames: S5 must step ≥3 frames before diff                                         |
| Score panel                  | BUILT-IN+CUSTOM | `PanelUI{config:'./ui/scoreboard.json', maxWidth 1.4, maxHeight 0.6}` + **`Interactable` on the panel entity** (else no clicks at all) + `PanelDocument` qualify-sub → `UIKitDocument.getElementById(...).setProperties({text})`; `addEventListener('click')` covers XR ray AND mouse (CanvasPointerSystem default-on) | `ScoreboardSystem` (prio 30): bind score/ballsLeft/roundState signals → text; reset click → resetRequested++                                | panel loads async — wire only in qualify; config string must byte-match the where-clause                                                                                                                                                     |
| Hit/clear audio              | BUILT-IN+CUSTOM | Two SFX entities sharing `/audio/chime.mp3` (URL-cached buffer): hit = positional at shelf, vol .85, `PlaybackMode.Overlap`, maxInstances 3, steal Oldest; clear = non-positional vol 1.0, 3 staggered plays 120 ms apart (arpeggio — **no pitch API exists**; do NOT touch private \_pool)                            | play call sites + `[GAME] sfx=` logs in ScoringSystem/RoundSystem; stagger timer in update                                                  | same-entity same-frame plays collapse to one (fine); autoplay policy → S6 asserts logs, not sound                                                                                                                                            |
| Night environment            | CONFIGURE       | `defaultLighting:false` + on `world.activeLevel.value` (exists & has LevelRoot before .then): `addComponent(DomeGradient,{...night})` + `addComponent(IBLGradient,{...amber})` (\_needsUpdate defaults true)                                                                                                           | ~15 lines in index.ts; booth/floor meshes                                                                                                   | IBL intensity is applied ~squared — keep 1.0, tune colors; never move the level root; env comps only work on LevelRoot                                                                                                                       |
| Booth & floor                | BUILT-IN        | Static bodies: `PhysicsShape{shape:Box, dimensions:FULL extents}` + `PhysicsBody{state:Static}`. Floor box [4,0.1,4] top at y=0; counter [2,0.08,0.5] top 0.9; shelf [2,0.05,0.35] top 1.1. Meshes: MeshStandardMaterial, all imports from `@iwsdk/core`                                                               | booth builder module                                                                                                                        | no infinite planes; thin-box tunneling — use thick boxes; physics entities must be scene-root-parented at identity (physics treats object3D pose as world) and **never scaled**                                                              |

## Physics material/mass table

| Body          | Shape (dims)              | density    | friction | restitution                   | ~mass    |
| ------------- | ------------------------- | ---------- | -------- | ----------------------------- | -------- |
| Can           | Cylinder [0.035, 0.12, 0] | 150        | 0.6      | 0.05                          | 0.069 kg |
| Ball          | Sphere [0.05, 0, 0]       | 700        | 0.5      | 0.3 (max-combine — keep ≤0.3) | 0.37 kg  |
| Floor         | Box [4, 0.1, 4]           | — (static) | 0.8      | 0.05                          | —        |
| Counter/shelf | Box (see above)           | — (static) | 0.6      | 0.05                          | —        |

Defaults trap: density defaults to 1 (near-massless cans) — always explicit.
All PhysicsBody/Shape fields are creation-time-only; tuning = remove/re-add.

## Custom systems

### ScoringSystem (priority 12 — sim band)

- Queries: `standing: { required: [Can, Transform, PhysicsBody], excluded: [Downed] }`, `downed: { required: [Can, Downed] }`
- Config signals: shelfY 1.1, shelfHalfWidth 1.0, shelfZ −2.8, shelfDepthTol 0.35, tipDegrees 45
- update: per standing can — `getWorldQuaternion` → up·y < cos(tip) OR pos outside AABB → collect; after loop add `Downed`
- downed qualify-sub: score++ (`signal.value`), `console.log('[GAME] score=N')`, `AudioUtils.play(hitSfx)` + `[GAME] sfx=hit`, clear-check → roundState 'cleared' + clear sting
- Preallocated Vector3/Quaternion class fields; no per-frame allocations

### RoundSystem (priority 15 — sim band, after scoring)

- Queries: `balls: {required:[Ball,Transform,PhysicsBody]}`, `heldBalls: {required:[Ball,Grabbed]}`, `resetPanelClicks` via resetRequested signal (not a query)
- heldBalls qualify: roundState 'ready'→'live'. disqualify (release): if !resetting && !ball.thrown → thrown=true, ballsLeft−−; ballsLeft==0 → 3 s settle timer → 'out' unless 'cleared'
- resetRequested subscribe: `doReset()` — for each can/ball: remove Downed; if ball held → destroy+respawn; else remove PhysicsBody+PhysicsShape, pose from initial fields (getVectorView → obj.position/quaternion.fromArray), re-add both; score=0, ballsLeft=3, roundState 'ready', `[GAME] round=reset`
- Clear sting stagger: 3 plays, 120 ms apart, driven by delta timer in update

### ScoreboardSystem (priority 30 — ui band)

- Query: `scorePanel: { required: [PanelUI, PanelDocument], where: [eq(PanelUI,'config','./ui/scoreboard.json')] }`
- qualify: null-guard doc; cache #score-value/#balls-value/#round-state/#reset-button; cleanupFuncs-subscribe the 3 signals → `setProperties({text})` (state map: ready→"THROW!", live→"—", cleared→"CLEARED!", out→"OUT OF BALLS"); reset-button click → resetRequested++
- ⚠️ elics 3.4.2: `setValue/getValue` **throw on vector fields** — use `getVectorView` everywhere (scalars/strings/booleans are fine via setValue)

## Custom components

| Component | Fields (Type, default)                                          | On                             |
| --------- | --------------------------------------------------------------- | ------------------------------ |
| Can       | initialPosition Vec3 [0,0,0]; initialOrientation Vec4 [0,0,0,1] | 6 can entities                 |
| Downed    | (tag)                                                           | knocked cans, cleared on reset |
| Ball      | initialPosition Vec3; thrown Boolean false                      | 3 ball entities                |

## Globals & signals (`@preact/signals-core` — add to package.json; NOT re-exported by core)

| Key               | Type                                      | Writers             | Readers             |
| ----------------- | ----------------------------------------- | ------------------- | ------------------- |
| score             | Signal<number>                            | ScoringSystem       | ScoreboardSystem    |
| ballsLeft         | Signal<number>                            | RoundSystem         | ScoreboardSystem    |
| roundState        | Signal<'ready'\|'live'\|'cleared'\|'out'> | Round/ScoringSystem | ScoreboardSystem    |
| resetRequested    | Signal<number> (monotonic counter)        | ScoreboardSystem    | RoundSystem         |
| hitSfx / clearSfx | Entity refs                               | index.ts            | Scoring/RoundSystem |

## Asset manifest

| Asset                                     | Type                  | Source                            | Path                   |
| ----------------------------------------- | --------------------- | --------------------------------- | ---------------------- |
| chime                                     | Audio                 | starter (4 KB, confirmed present) | public/audio/chime.mp3 |
| all geometry                              | code-built primitives | —                                 | src/scene/\*           |
| starter robot/plant/desk gltf + webxr.png | **delete at M1**      | —                                 | —                      |

## Risks & mitigations

| Risk                                                          | Impact                                         | Mitigation                                                                               |
| ------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Throw feel weak (single-frame chase velocity)                 | S3 fails                                       | verify early (M2); ThrowAssist ring-buffer plan ready                                    |
| Held-visual vs body divergence through colliders              | ball pops on release                           | simple box colliders, counter front open                                                 |
| qualify subs don't replay existing entities (elics)           | missed events if system registered after spawn | register systems BEFORE spawning, or pass replayExisting — we register first, spawn last |
| Panel JSON absent until vite runs                             | S4 setup fails on fresh checkout               | dev server compiles ui/ on start; never hand-write JSON                                  |
| Reset asserted too early (2-frame body recreation)            | S5 flaky                                       | `ecs step 3` before diffing; settle window in assertion                                  |
| api-reference vs 0.4.2 drift (forceRelease, setValue vectors) | runtime throws                                 | flagged ⚠️; use destroy+respawn & getVectorView; retro will fix the skill                |

## Reinvention audit (vs api-reference risk table)

- Throw physics: NOT custom — built-in chase-velocity covers it ✓
- Knockdown events: custom is CORRECT — no collision-event surface exists ✓
- Panel text binding: custom bridge is correct — no signal↔UIKit auto-binding ✓
- Pitch-shifted audio: dropped — no public API; volume/stagger instead ✓
- No raycasting/grab/sky/HUD reinvention anywhere ✓
