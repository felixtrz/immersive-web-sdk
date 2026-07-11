# Tin Can Alley — Game Spec

**Pitch.** A neon-lit carnival booth in VR: grab softballs off the counter —
by hand or force-pull them from a distance — and hurl them at a pyramid of
tin cans. Knock cans off the shelf to score, clear the pyramid before you run
out of balls, slap the big reset button and go again. A 3-minute
pick-up-and-throw toy that shows off IWSDK physics, grabbing, spatial UI,
audio, and environment theming in one booth.

**Pillars.**

- **Ten seconds to fun** — no menus, no tutorial; a ball is in reach when the
  scene loads and the cans are begging for it.
- **Physics is the toy** — every point comes from real simulated tumbling,
  never scripted animations; misses that clip a can edge still feel fair.
- **The booth is the UI** — score lives on a panel over the booth; the reset
  is a physical button; nothing floats in your face.

## Platform & Mode

- Session: **dual** — ImmersiveVR primary (`offer: 'once'`) + browser-testable
  (`canvasPointerEvents`, mouse ray) `[ASSUMED]`
- Device target: Quest-class headset; desktop browser for dev/CI `[ASSUMED]`
- Play space: **standing, stationary** — booth is 2.5 m in front of the
  player; no locomotion `[ASSUMED]`
- Comfort: stationary (no artificial motion) — nothing to mitigate

## Core Loop

Grab a ball (near squeeze-grab from the counter, or trigger force-pull from
afar) → aim → throw at the can pyramid → cans tumble off the shelf, each
scoring with a clang → pyramid cleared or balls exhausted → hit RESET →
pyramid restacks, balls return. ~30 s per round.

1. grab → 2. throw → 3. score/tumble → 4. reset → repeat (chase a clear).

## Mechanics

| #   | Mechanic                  | Player verb               | Notes                                                              |
| --- | ------------------------- | ------------------------- | ------------------------------------------------------------------ |
| M1  | Near grab ball            | squeeze-grab, either hand | `OneHandGrabbable`-style; ball follows hand                        |
| M2  | Distance grab ball        | point ray + hold trigger  | force-pull from counter/floor                                      |
| M3  | Throw                     | release while swinging    | release velocity carries the ball (physics)                        |
| M4  | Can knockdown scoring     | (emergent)                | can counts as "down" when it leaves its shelf zone / tips past 45° |
| M5  | Round state & ball budget | (system)                  | 3 balls per round; round ends on clear or empty                    |
| M6  | Reset round               | click/press reset button  | restacks pyramid, returns balls, zeroes round                      |

## Space & Locomotion

- World size: 4 × 4 m play area; booth front at z = −2.5 m, counter 0.9 m
  high, can shelf at 1.1 m, 2 m wide `[ASSUMED]`
- Locomotion: **none** (stationary) → no collision-geometry prerequisite
- Floor: static physics plane so dropped balls rest and stray cans settle

## UI Surfaces

- **Score panel** (spatial `PanelUI`, above the can shelf): score, balls
  remaining, round state ("THROW!", "CLEARED!", "OUT OF BALLS")
- **Reset control**: panel button (`Interactable` UI) — doubles as the
  round-start affordance
- Browser mode: same panel visible in-scene (no separate HUD) `[ASSUMED]`

## Audio

- `throw` — soft whoosh on release `[stretch — needs asset]`
- `hit` — clang when a can is knocked down (starter `chime.mp3` at low pitch
  acceptable for MVP) `[ASSUMED]`
- `clear` — celebratory sting on pyramid clear (starter `chime.mp3` reuse,
  overlap mode) `[ASSUMED]`
- No ambient loop in MVP (no sourced asset) `[ASSUMED]`

## Art Direction

- **"Neon carnival night"** `[ASSUMED]`: deep indigo dome gradient sky, warm
  amber IBL accents; booth in red-and-cream stripes; cans in silver with a
  red band; balls in cream. All geometry code-built primitives (boxes,
  cylinders, spheres) — zero asset sourcing risk.

## Scope

- **MVP:** M1–M6, one booth, 6-can pyramid (3-2-1), 3 balls/round, score
  panel + reset, dome/IBL theming, hit + clear audio.
- **Target:** MVP + throw whoosh, can-hit particle flash, best-score memory
  (in-session), subtle booth string-lights (emissive strips).
- **Stretch (non-goals for now):** locomotion between multiple booth games,
  leaderboards/persistence, haptics, hand-tracking pinch throw tuning,
  multiplayer.

## Success Criteria (asserted in Phase 6)

| #   | Criterion (observable)                                             | How it will be checked                                                                                        |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| S1  | Scene renders and XR session enters with a clean console           | screenshot non-black; `xr enter` ok; `browser logs` no errors                                                 |
| S2  | A ball can be distance-grabbed: ray + trigger pulls it to the hand | `ecs snapshot/diff`: ball Transform moves toward controller while trigger held                                |
| S3  | A thrown ball knocks at least one can over                         | `ecs snapshot/diff`: ≥1 can position/rotation changes past threshold after simulated throw                    |
| S4  | Score increments within 1 s of a can going down                    | `browser logs` pattern `[GAME] score=` + panel text bound to score signal                                     |
| S5  | Reset restores the pyramid and ball count                          | after `xr select` on reset button: cans within ε of initial transforms (`ecs diff`), `[GAME] round=reset` log |
| S6  | Hit audio fires on can knockdown                                   | `browser logs` pattern `[GAME] sfx=hit` emitted at AudioUtils.play call site                                  |

## Decisions & Assumptions

| Decision         | Chosen                                    | Why                                                | Source    |
| ---------------- | ----------------------------------------- | -------------------------------------------------- | --------- |
| Platform         | VR + browser-testable dual                | headless CI verifiability; broadest demo           | [ASSUMED] |
| Locomotion       | none (stationary booth)                   | comfort-safe, avoids collision prereq, keeps scope | [ASSUMED] |
| Art              | code-built primitives, neon night palette | zero sourcing risk, stylized reads well            | [ASSUMED] |
| Audio            | starter chime.mp3 for hit/clear           | only guaranteed-present asset                      | [ASSUMED] |
| Cans "down" rule | left shelf zone OR tipped >45°            | robust to partial hits; assertable                 | [ASSUMED] |
| Ball budget      | 3 per round, 6 cans                       | tight loop, clearable in one good round            | [ASSUMED] |

## Questions I would have asked (autonomous mode)

- VR-only or dual-runtime? — chose dual (testability); VR-only would drop
  `canvasPointerEvents` and simplify input a hair.
- Realistic carnival assets or stylized primitives? — chose primitives; GLTF
  sourcing would change the asset manifest and art slides.
- Should misses cost points or just balls? — chose balls only (friendlier);
  a "hard mode" toggle would add one settings row to the panel.
- Sound design mattering much? — assumed minimal (one reused chime); real SFX
  sourcing would add an asset-acquisition step.
