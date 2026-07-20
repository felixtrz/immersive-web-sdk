# Design: `@iwsdk/particles`

This package's architecture is the distilled result of a two-round
optimization study on a production WebXR title that shipped its VFX layer on
an established object-oriented three.js particle library, then rewrote that
library's engine core data-oriented under a bit-parity harness. The study's
conclusion: at XR gameplay scales the dominant costs are **memory layout,
dispatch shape, allocation, and GPU upload count** — not the math. This
engine makes those wins structural instead of retrofitted.

## Evidence base

Measured on a seeded, replayed combat schedule (Node, medians of interleaved
runs) against the object-engine baseline, plus in-browser probes on-device:

| Optimization step                                | Saturated-scene mean frame cost |
| ------------------------------------------------ | ------------------------------- |
| Object engine (baseline)                         | 0.116 ms                        |
| + targeted allocation/dead-work fixes            | 0.111 ms                        |
| + SoA lanes, compiled passes, interleaved buffer | 0.064 ms                        |
| + baked curve tables, single life division       | 0.050 ms                        |
| + single storage path (monomorphic call sites)   | **0.047 ms (−60%)**             |

Allocation rate fell ~70%; a fully saturated in-game layer (≈1,450 live
particles, 10 active batches) simulated and packed in 0.2–0.4 ms on a dev
build. A CPU profile of the baseline attributed ~17% of total time to
closed-form gradient/curve evaluation through polymorphic generator calls,
which motivated baked tables and compiled passes.

## Principles

1. **Particles are data, not entities, not scene nodes.** Emitters are
   components/handles; particle state lives in engine-owned `Float32Array`
   lanes. A 200-particle explosion adds zero `Object3D`s and zero ECS
   entities.
2. **Budgets are contracts.** `capacity` is required per effect; pools and
   GPU buffers are sized to it exactly at registration; saturated effects
   skip spawns. Named budget groups cap effect families. Nothing grows, so
   nothing reallocates mid-frame.
3. **Zero steady-state allocation.** Registration does all allocation (pools,
   pass closures, curve tables); the frame path allocates nothing. GC pauses
   are dropped frames on standalone headsets.
4. **Compiled passes are the only simulation model.** Each effect's
   over-life stack compiles to monomorphic linear sweeps at registration —
   no per-particle virtual dispatch. Curves and gradients bake to
   128-interval tables whose interpolation error is measured per bake and
   surfaced (`getCurveDiagnostics()`), keeping the fidelity trade a reported
   number instead of an assumption.
5. **Determinism is a feature.** Randomness flows only through per-effect
   seeded streams; identical seeds and call sequences produce bit-identical
   lanes. The test suite hashes lanes across a replayed scenario as a
   golden regression gate — the pattern that made the original engine
   rewrite verifiable is built into the package's own tests.
6. **One interleaved buffer per batch.** All instance attributes share one
   `InstancedInterleavedBuffer`: one allocation, one update range, one
   upload per batch per frame (the baseline uploaded 5–6 attribute buffers
   per batch). Batches key on material/mode; the `premultiplied` blend mode
   collapses the classic additive-vs-normal batch split by letting
   per-particle alpha choose the compositing.
7. **Engine space is anchor-relative.** All simulation happens relative to
   the `ParticleBatchSet` transform. Sliding that one node pins every live
   particle to a moving reference frame at zero per-particle cost, and
   keeping coordinates near the anchor preserves f32 precision in large
   worlds.
8. **Stable handles, no identity ghosts.** Rows recycle via swap-remove with
   a spawn-generation stamp; a `(row, generation)` handle that outlives its
   particle is dead — it never silently re-attaches to whatever reused the
   slot (a real bug class observed in pooled object engines, where a child
   smoke trail teleported to an unrelated later explosion).
9. **CPU-first.** At ≤ ~5k particles CPU SoA simulation is deeply
   sub-millisecond, keeps behaviors gameplay-coupled (budgets, params,
   children), and debugs in ordinary tooling. A GPU compute tier is an
   additive backend for pure-visual high-count systems, deliberately out of
   v1.

## Architecture

```
src/core/    renderer-agnostic kernel
  pool.ts      ParticlePool: f32 lanes, swap-remove, generations
  curves.ts    curve/gradient authoring + baked LUTs + error diagnostics
  passes.ts    compiled over-life passes (fixed, documented order)
  shapes.ts    point/sphere/hemisphere/cone/circle spawn sampling
  effect.ts    EffectDef authoring + validation (defineEffect)
  engine.ts    ParticleEngine: registration, budgets, emitters, bursts,
               children, the frame loop
  rng.ts       deterministic streams
src/three/   Three.js binding
  shaders.ts   one instanced sprite shader, modes via defines
  batch.ts     ParticleBatch: one interleaved buffer, one draw
  batch-set.ts ParticleBatchSet: batch registry + per-frame pack
```

`src/core` imports nothing from three; a future WebGPU binding sits beside
`src/three`.

### Frame loop (deterministic order)

```
engine.update(dt):
  attached emitters (creation order): rate, per-meter, burst schedules
  per effect (registration order):
    drain queued bursts (fire-and-forget + child spawns)
    lifeT prepass (one multiply per particle)
    compiled passes (color, size, speed, frame, rotation, force, drag)
    integrate + age
    death sweep (swap-remove; on-death children enqueue)
batchSet.update():
  per batch: pack member pools → one ranged upload; hide when empty
```

## ECS integration (`@iwsdk/core`)

Follows the `@iwsdk/locomotor` precedent: this package stays ECS-free; core
wraps it with a `ParticleEmitter` component and a `ParticleSystem` that owns
one engine + batch set per world, feeds emitter transforms from entities,
and exposes the fire-and-forget `burst()` path. Enabled via the `particles`
world feature flag.

## Deliberate v1 scope cuts (follow-ups)

- **Mesh-mode instances** (quaternion lanes + local-vertex shader variant).
- **Trails/ribbons** (same lanes, separate geometry builder).
- **Custom user passes** as a public API (the pass type is already exported;
  the authoring/validation surface is not).
- **Named clocks** (per-effect time domains for bullet-time/pause; today the
  host scales `dt`).
- **Frame-mode child emission** (continuous per-parent sub-emitters; birth/
  death children cover the common explosion→smoke case without cross-frame
  parent tracking).
- **Asset pipeline** (editor format compiled at build time, importer for
  existing three.quarks JSON packs).
- **GPU simulation tier** (WebGPU compute behind the same effect
  definitions).
