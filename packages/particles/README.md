# @iwsdk/particles

Data-oriented particle engine for WebXR applications: budgeted
structure-of-arrays pools, compiled behavior passes with baked curve tables,
deterministic per-effect random streams, and single-upload instanced batching
for Three.js.

Built from the measured lessons of shipping and then rewriting a particle
layer for a production WebXR title (see [DESIGN.md](./DESIGN.md) for the
architecture rationale and numbers): at frame-budget scales the wins are
memory layout, dispatch shape, and allocation discipline — so this engine
makes them non-optional.

## Quick start (standalone Three.js)

```ts
import {
  ParticleEngine,
  ParticleBatchSet,
  defineEffect,
  gradient,
  curve,
  range,
  sphere,
} from '@iwsdk/particles';

const explosion = defineEffect({
  name: 'explosion',
  capacity: 64, // hard ceiling; pool + GPU buffers sized to exactly this
  material: { map: atlasTexture, blending: 'premultiplied' },
  bursts: [{ count: 24 }],
  init: {
    life: range(0.3, 0.6),
    speed: range(0.5, 1.5),
    size: range(0.05, 0.12),
    color: 0xffaa55,
    shape: sphere({ radius: 0.05 }),
  },
  overLife: {
    color: gradient(
      [
        [0, 0xffffff],
        [0.4, 0xff8844],
        [1, 0x220000],
      ],
      [
        [0, 1],
        [1, 0],
      ],
    ),
    size: curve([
      [0, 1],
      [1, 0.15],
    ]),
    drag: 2,
    force: [0, -0.8, 0],
  },
});

const engine = new ParticleEngine();
const fx = engine.register(explosion);
const batchSet = new ParticleBatchSet(engine);
scene.add(batchSet);

// Fire-and-forget — no scene object, no entity, no allocation:
engine.burst(fx, x, y, z, { tint: 0x53d7ff, scale: 1.5 });

// Per frame:
engine.update(dt);
batchSet.update();
```

With `@iwsdk/core`, enable the `particles` world feature instead and use the
`ParticleSystem` / `ParticleEmitter` component integration.

## The contract

- **Budgets, not growth.** `capacity` is required. A saturated effect skips
  spawns (fewer sparks) — it never reallocates mid-frame or queues work.
  Named budget groups (`engine.setBudget('enemyFx', 512)`) cap families of
  effects collectively.
- **Zero steady-state allocation.** Pools, passes, and curve tables are
  built at `register()`; the per-frame path allocates nothing.
- **Determinism.** All randomness flows through per-effect seeded streams —
  same seeds + same call sequence ⇒ bit-identical particle state (enforced
  by the package's golden-hash tests, and independent of `Math.random`
  consumers elsewhere in the app).
- **Bounded curve approximation.** Over-life curves bake into 128-interval
  tables at registration; measured interpolation error is exposed via
  `getCurveDiagnostics()` (typically < one 8-bit color quantum).
- **One draw + one upload per material.** Effects sharing a material key
  pack into a single interleaved instanced buffer; idle batches are hidden.
  The `premultiplied` blend mode lets per-particle alpha slide between
  additive and normal compositing inside one batch.
- **Engine space.** All particles simulate relative to the `ParticleBatchSet`
  transform: slide it to pin every effect to a moving reference frame, and
  keep coordinates near it for f32 precision in large worlds.

## Feature summary

| Area      | v1                                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------- |
| Emission  | bursts (cycles/interval/probability), continuous rate, per-meter, birth/death child effects                     |
| Init      | life/speed/size/alpha/rotation/tile ranges, point/sphere/hemisphere/cone/circle shapes                          |
| Over-life | color gradient, size curve, speed curve, flipbook frame curve, rotation rate, constant force, drag              |
| Render    | billboard, stretched (velocity-elongated), horizontal, vertical; texture atlases; additive/normal/premultiplied |
| Variation | per-burst params: `tint`, `scale`, `speedScale`, `lifeScale`, `countScale`, `alphaScale`                        |

Follow-ups tracked in [DESIGN.md](./DESIGN.md): mesh-mode instances, trails,
custom user passes, named clocks, GPU simulation tier.
