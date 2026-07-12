# Tin Can Alley — Verification Report (2026-07-11, commit ea138c4)

Environment: headless Linux, managed Playwright Chromium + IWER emulation,
`npx iwsdk` CLI against the live dev server (port 8081). Typecheck clean
(`npx tsc --noEmit`).

| #   | Success criterion                                          | Result   | Evidence                                                                                                                                                                                                  |
| --- | ---------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Scene renders and XR session enters, clean console         | **PASS** | design/verify/m2-pyramid3.png (pyramid standing, panel live); `xr enter` ok:true; only environmental ERR_CONNECTION_RESET (vite HMR socket during dev restart) in console — zero app errors               |
| S2  | Ball can be distance-grabbed (ray + trigger pulls to hand) | **PASS** | ball 40: counter slot [0, 0.955, −2.2] → held at [0.25, 1.5, −0.4]; `Grabbed` tag present in `ecs find`                                                                                                   |
| S3  | Thrown ball knocks cans over                               | **PASS** | swing (animate-to 0.25 s) + release → `ecs find`: 6/6 cans `Downed`; design/verify/m2-throw.png shows toppled cans; reproduced twice                                                                      |
| S4  | Score increments ≤1 s of a can going down                  | **PASS** | console: `[GAME] score=1…6` interleaved with hits; panel showed 6/CLEARED live (m2-throw.png); binding is a synchronous signal→setProperties push                                                         |
| S5  | Reset restores pyramid and ball count                      | **PASS** | ray press-release on RESET → `[GAME] ui=reset-pressed`, `[GAME] round=reset`; `ecs find`: 0 Downed, cans parked body-less; design/verify/m4-after-reset.png (pyramid restacked, 3 balls, SCORE 0, THROW!) |
| S6  | Hit audio fires on knockdown                               | **PASS** | `[GAME] sfx=hit` ×6 at AudioUtils.play call sites, `[GAME] sfx=clear` on pyramid clear (headless CI asserts the play request; audibility is autoplay-gated by design)                                     |

## Full-loop transcript (final clean run)

```
[GAME] ready → pieces=spawned → round=live
[GAME] score=1..6 (each with sfx=hit) → sfx=clear → round=cleared
[GAME] balls=2 → ui=reset-pressed → round=reset
post-reset: cans Downed=0, bodies=0 (parked), panel SCORE 0 / THROW! / BALLS 3
```

Commands: `xr enter` → `xr look-at` ball → `set-select-value 1` (grab) →
`animate-to` swing → `set-select-value 0` (throw) → `look-at` panel →
`set-gamepad-state` trigger 1→0 (button press).

## Headless-environment findings (fixed during Phase 5)

1. **Delta-spike tunneling** — physics steps on raw frame delta; reload/
   screenshot stalls create multi-second steps that tunnel thin colliders
   and explode stacked contacts. Fixed: solid-block statics, extended floor,
   spawn gate (5 stable frames), physics-on-demand cans.
2. **Unclamped distance-grab lerp** — pull alpha = moveSpeedFactor·Δt·100;
   > 50 ms frames overshoot and diverge. Fixed: factor 0.03 + ball bounds
   > recovery.
3. **`xr select` wedges the 0.4.2 headless runtime** — use
   `set-select-value`/`set-gamepad-state` press-release instead; UIKit
   buttons need a `pointerup` listener (emulated paths don't synthesize
   `click`).
4. **Live-query iteration + component re-add = hang** — iterate over
   `Array.from(query.entities)` when handlers remove/re-add components.
5. **Pyramid stacking** — upper cans must rest on the rims of two cans
   (spacing ≈ 2·radius); designer-pretty spacing collapses.

## Deferred / known gaps

- Throw-feel tuning (ThrowAssist ring buffer) — MVP throw is strong enough
  to clear the pyramid in one hit; deferred as designed.
- Whoosh-on-throw SFX — needs an asset; stretch item.
- `ecs snapshot`/`diff` for S5 positional epsilon was replaced by component
  - visual assertions after snapshots proved to be a delta-spike source
    mid-interaction (full-state serialize stalls the tab).
