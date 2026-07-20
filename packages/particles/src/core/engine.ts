/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ScalarInit } from './curves.js';
import { BurstParams, ChildEffectDef, EffectDef } from './effect.js';
import { ParticlePass, compilePasses } from './passes.js';
import { ParticlePool } from './pool.js';
import { ParticleRng, deriveSeed } from './rng.js';
import { ShapeSample, sampleShape } from './shapes.js';

/**
 * A registered, compiled effect: immutable definition, fixed-capacity pool,
 * compiled pass list, and an owned random stream.
 *
 * @category Particles
 */
export interface CompiledEffect {
  readonly id: number;
  readonly def: EffectDef;
  readonly pool: ParticlePool;
  readonly passes: ReadonlyArray<ParticlePass>;
  /** @internal */
  readonly rng: ParticleRng;
  /** @internal resolved lazily from names to ids */
  childBindings?: Array<{ child: ChildEffectDef; target: CompiledEffect }>;
}

/** Spawn frame: position plus optional column-major 3x3 basis (rot*scale). */
export interface SpawnFrame {
  px: number;
  py: number;
  pz: number;
  /** Column-major rotation*scale basis; identity when omitted. */
  basis?: Float32Array;
}

interface QueuedBurst {
  effect: CompiledEffect;
  count: number;
  px: number;
  py: number;
  pz: number;
  basis?: Float32Array;
  params?: BurstParams;
}

interface BurstScheduleState {
  index: number;
  cycle: number;
  nextTime: number;
}

/**
 * A continuous emitter attached to a transform (typically an entity).
 * Feed {@link setFrame} each frame; rate, per-meter, and burst-schedule
 * emission all originate from it.
 *
 * @category Particles
 */
export class ParticleEmitterHandle {
  /** Multiplies the effect's continuous rate. */
  rate = 1;
  enabled = true;
  /** @internal */
  readonly frame: SpawnFrame = { px: 0, py: 0, pz: 0 };
  /** @internal */
  rateAccumulator = 0;
  /** @internal */
  time = 0;
  /** @internal */
  distanceAccumulator = 0;
  /** @internal */
  hasPreviousPosition = false;
  /** @internal */
  prevX = 0;
  /** @internal */
  prevY = 0;
  /** @internal */
  prevZ = 0;
  /** @internal */
  burstStates: BurstScheduleState[] = [];
  /** @internal */
  disposed = false;

  /** @internal */
  constructor(readonly effect: CompiledEffect) {
    const bursts = effect.def.bursts ?? [];
    for (const burst of bursts) {
      this.burstStates.push({
        index: 0,
        cycle: 0,
        nextTime: burst.time ?? 0,
      });
    }
  }

  /** Updates the emitter's spawn transform (engine-space). */
  setFrame(px: number, py: number, pz: number, basis?: Float32Array): void {
    this.frame.px = px;
    this.frame.py = py;
    this.frame.pz = pz;
    this.frame.basis = basis;
  }

  dispose(): void {
    this.disposed = true;
  }
}

/** Per-frame and lifetime counters for tooling. */
export interface ParticleEngineStats {
  live: number;
  spawnedThisFrame: number;
  /** Spawns skipped because a pool or budget group was saturated. */
  skippedThisFrame: number;
  simulateMs: number;
}

const scratchShape: ShapeSample = {
  px: 0,
  py: 0,
  pz: 0,
  dx: 0,
  dy: 0,
  dz: 0,
};

function sampleScalar(
  init: ScalarInit | undefined,
  fallback: number,
  rng: ParticleRng,
): number {
  if (!init) {
    return fallback;
  }
  return init.kind === 'value' ? init.value : rng.range(init.min, init.max);
}

/**
 * Renderer-agnostic particle simulation: budgeted pools, compiled passes,
 * deterministic per-effect random streams, attached emitters, and
 * fire-and-forget bursts. Pair with a renderer such as
 * {@link ParticleBatchSet} which packs the pools into instanced batches.
 *
 * @remarks
 * All simulation happens in "engine space" — the renderer's root transform
 * defines where that sits in the scene (an application can slide the root to
 * pin effects to moving reference frames, and keeping coordinates near the
 * root preserves f32 precision in large worlds).
 *
 * @category Particles
 * @example
 * ```ts
 * const engine = new ParticleEngine();
 * const explosion = engine.register(explosionDef);
 * engine.burst(explosion, x, y, z, { tint: 0x53d7ff, scale: 1.5 });
 * // per frame:
 * engine.update(dt);
 * ```
 */
export class ParticleEngine {
  private effects: CompiledEffect[] = [];
  private byName = new Map<string, CompiledEffect>();
  private emitters: ParticleEmitterHandle[] = [];
  private queues = new Map<CompiledEffect, QueuedBurst[]>();
  private budgets = new Map<string, { capacity: number }>();
  private readonly seed: number;
  private spawnedThisFrame = 0;
  private skippedThisFrame = 0;
  private lastSimulateMs = 0;

  /** Bumped whenever an effect is registered; renderers watch it. */
  version = 0;

  constructor(options: { seed?: number } = {}) {
    this.seed = options.seed ?? 0x19c0ffee;
  }

  /** Registered effects in registration order (stable). */
  get compiled(): ReadonlyArray<CompiledEffect> {
    return this.effects;
  }

  /**
   * Compiles and registers an effect: allocates its pool, bakes its curves,
   * and compiles its pass list. Load-time work by design — nothing here
   * runs on a live frame.
   */
  register(def: EffectDef): CompiledEffect {
    if (this.byName.has(def.name)) {
      throw new Error(`[particles] effect "${def.name}" already registered`);
    }
    const compiledEffect: CompiledEffect = {
      id: this.effects.length,
      def,
      pool: new ParticlePool(def.capacity),
      passes: compilePasses(def.overLife),
      rng: new ParticleRng(deriveSeed(this.seed, this.effects.length)),
    };
    this.effects.push(compiledEffect);
    this.byName.set(def.name, compiledEffect);
    this.queues.set(compiledEffect, []);
    this.version++;
    return compiledEffect;
  }

  /** Looks up a registered effect by name. */
  getEffect(name: string): CompiledEffect | undefined {
    return this.byName.get(name);
  }

  /**
   * Declares a named budget group: the summed live count of every effect
   * declaring `budget: name` never exceeds `capacity` (spawns skip).
   */
  setBudget(name: string, capacity: number): void {
    this.budgets.set(name, { capacity });
  }

  /** Creates a continuous emitter for an effect. */
  createEmitter(effect: CompiledEffect | string): ParticleEmitterHandle {
    const resolved = this.resolve(effect);
    const emitter = new ParticleEmitterHandle(resolved);
    this.emitters.push(emitter);
    return emitter;
  }

  /**
   * Fire-and-forget burst of `count ??` the effect's declared burst total at
   * a position — no emitter, no scene object, no allocation on the hot path.
   * Returns the number of particles actually spawned after budget clamping.
   */
  burst(
    effect: CompiledEffect | string,
    px: number,
    py: number,
    pz: number,
    params?: BurstParams,
    basis?: Float32Array,
  ): number {
    const resolved = this.resolve(effect);
    let count = 0;
    const bursts = resolved.def.bursts ?? [];
    for (const burst of bursts) {
      count += burst.count;
    }
    if (count === 0) {
      count = 1;
    }
    if (params?.countScale !== undefined) {
      count = Math.round(count * params.countScale);
    }
    return this.spawn(resolved, count, px, py, pz, basis, params);
  }

  /** Live particle total across all effects. */
  get live(): number {
    let total = 0;
    for (const effect of this.effects) {
      total += effect.pool.count;
    }
    return total;
  }

  get stats(): ParticleEngineStats {
    return {
      live: this.live,
      spawnedThisFrame: this.spawnedThisFrame,
      skippedThisFrame: this.skippedThisFrame,
      simulateMs: this.lastSimulateMs,
    };
  }

  /**
   * Advances the whole engine by `dt` seconds: attached-emitter emission,
   * queued bursts, compiled passes, integration, and the death sweep (which
   * triggers `on: 'death'` children). Deterministic given identical call
   * sequences and seeds.
   */
  update(dt: number): void {
    const started =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.spawnedThisFrame = 0;
    this.skippedThisFrame = 0;

    // Attached emitters (creation order) — rate, schedule, and per-meter.
    for (let e = 0; e < this.emitters.length; e++) {
      const emitter = this.emitters[e];
      if (emitter.disposed) {
        this.emitters.splice(e, 1);
        e--;
        continue;
      }
      if (emitter.enabled) {
        this.updateEmitter(emitter, dt);
      }
      emitter.time += dt;
    }

    // Pools in registration order: queued bursts, then simulate.
    for (const effect of this.effects) {
      const queue = this.queues.get(effect)!;
      for (let i = 0; i < queue.length; i++) {
        const q = queue[i];
        this.spawn(q.effect, q.count, q.px, q.py, q.pz, q.basis, q.params);
      }
      queue.length = 0;
      this.simulatePool(effect, dt);
    }

    this.lastSimulateMs =
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) -
      started;
  }

  private resolve(effect: CompiledEffect | string): CompiledEffect {
    if (typeof effect !== 'string') {
      return effect;
    }
    const resolved = this.byName.get(effect);
    if (!resolved) {
      throw new Error(`[particles] unknown effect "${effect}"`);
    }
    return resolved;
  }

  private budgetRoom(effect: CompiledEffect): number {
    let room = effect.pool.room;
    const budgetName = effect.def.budget;
    if (budgetName !== undefined) {
      const budget = this.budgets.get(budgetName);
      if (budget) {
        let groupLive = 0;
        for (const other of this.effects) {
          if (other.def.budget === budgetName) {
            groupLive += other.pool.count;
          }
        }
        room = Math.min(room, budget.capacity - groupLive);
      }
    }
    return room;
  }

  private updateEmitter(emitter: ParticleEmitterHandle, dt: number): void {
    const effect = emitter.effect;
    const def = effect.def;
    const frame = emitter.frame;

    if (def.rate !== undefined && def.rate > 0) {
      emitter.rateAccumulator += def.rate * emitter.rate * dt;
      const n = Math.floor(emitter.rateAccumulator);
      if (n > 0) {
        emitter.rateAccumulator -= n;
        this.spawn(effect, n, frame.px, frame.py, frame.pz, frame.basis);
      }
    }

    if (def.ratePerMeter !== undefined && def.ratePerMeter > 0) {
      if (emitter.hasPreviousPosition) {
        const dx = frame.px - emitter.prevX;
        const dy = frame.py - emitter.prevY;
        const dz = frame.pz - emitter.prevZ;
        emitter.distanceAccumulator +=
          Math.sqrt(dx * dx + dy * dy + dz * dz) * def.ratePerMeter;
        const n = Math.floor(emitter.distanceAccumulator);
        if (n > 0) {
          emitter.distanceAccumulator -= n;
          this.spawn(effect, n, frame.px, frame.py, frame.pz, frame.basis);
        }
      }
      emitter.hasPreviousPosition = true;
      emitter.prevX = frame.px;
      emitter.prevY = frame.py;
      emitter.prevZ = frame.pz;
    }

    const bursts = def.bursts ?? [];
    for (let b = 0; b < bursts.length; b++) {
      const burst = bursts[b];
      const state = emitter.burstStates[b];
      const cycles = burst.cycles ?? 1;
      while (state.cycle < cycles && emitter.time >= state.nextTime) {
        const probability = burst.probability ?? 1;
        if (probability >= 1 || effect.rng.next() < probability) {
          this.spawn(
            effect,
            burst.count,
            frame.px,
            frame.py,
            frame.pz,
            frame.basis,
          );
        }
        state.cycle++;
        state.nextTime += burst.interval ?? 0.1;
      }
    }
  }

  private spawn(
    effect: CompiledEffect,
    count: number,
    px: number,
    py: number,
    pz: number,
    basis?: Float32Array,
    params?: BurstParams,
  ): number {
    const room = this.budgetRoom(effect);
    const spawnCount = Math.min(count, Math.max(0, room));
    if (spawnCount < count) {
      this.skippedThisFrame += count - spawnCount;
    }
    if (spawnCount <= 0) {
      return 0;
    }

    const pool = effect.pool;
    const rng = effect.rng;
    const init = effect.def.init;
    const baseColor = init.color ?? 0xffffff;
    let baseR = ((baseColor >> 16) & 255) / 255;
    let baseG = ((baseColor >> 8) & 255) / 255;
    let baseB = (baseColor & 255) / 255;
    if (params?.tint !== undefined) {
      baseR *= ((params.tint >> 16) & 255) / 255;
      baseG *= ((params.tint >> 8) & 255) / 255;
      baseB *= (params.tint & 255) / 255;
    }
    const scale = params?.scale ?? 1;
    const speedScale = (params?.speedScale ?? 1) * scale;
    const lifeScale = params?.lifeScale ?? 1;
    const alphaScale = params?.alphaScale ?? 1;

    for (let i = 0; i < spawnCount; i++) {
      const row = pool.claimRow();
      // Fixed draw order keeps spawning deterministic per effect stream:
      // life, speed, size, alpha, rotation, tile, seeds, then the shape.
      const life = sampleScalar(init.life, 1, rng) * lifeScale;
      const speed = sampleScalar(init.speed, 0, rng) * speedScale;
      const size = sampleScalar(init.size, 1, rng) * scale;
      const alpha = sampleScalar(init.alpha, 1, rng) * alphaScale;
      const rotation = sampleScalar(init.rotation, 0, rng);
      const tile = sampleScalar(init.tile, 0, rng);
      pool.seedA[row] = rng.next();
      pool.seedB[row] = rng.next();
      sampleShape(init.shape!, rng, scratchShape);

      let lpx = scratchShape.px * scale;
      let lpy = scratchShape.py * scale;
      let lpz = scratchShape.pz * scale;
      let dx = scratchShape.dx;
      let dy = scratchShape.dy;
      let dz = scratchShape.dz;
      if (basis) {
        const bx = lpx;
        const by = lpy;
        const bz = lpz;
        lpx = basis[0] * bx + basis[3] * by + basis[6] * bz;
        lpy = basis[1] * bx + basis[4] * by + basis[7] * bz;
        lpz = basis[2] * bx + basis[5] * by + basis[8] * bz;
        const vx = dx;
        const vy = dy;
        const vz = dz;
        dx = basis[0] * vx + basis[3] * vy + basis[6] * vz;
        dy = basis[1] * vx + basis[4] * vy + basis[7] * vz;
        dz = basis[2] * vx + basis[5] * vy + basis[8] * vz;
      }

      pool.posX[row] = px + lpx;
      pool.posY[row] = py + lpy;
      pool.posZ[row] = pz + lpz;
      pool.velX[row] = dx * speed;
      pool.velY[row] = dy * speed;
      pool.velZ[row] = dz * speed;
      pool.age[row] = 0;
      pool.invLife[row] = life > 0 ? 1 / life : Infinity;
      pool.size[row] = size;
      pool.startSize[row] = size;
      pool.colR[row] = baseR;
      pool.colG[row] = baseG;
      pool.colB[row] = baseB;
      pool.colA[row] = alpha;
      pool.startColR[row] = baseR;
      pool.startColG[row] = baseG;
      pool.startColB[row] = baseB;
      pool.startColA[row] = alpha;
      pool.rotation[row] = rotation;
      pool.frame[row] = tile;
      pool.speedScale[row] = 1;
    }
    this.spawnedThisFrame += spawnCount;

    this.triggerChildren(effect, 'birth', pool.count - spawnCount, pool.count);
    return spawnCount;
  }

  private childBindings(
    effect: CompiledEffect,
  ): Array<{ child: ChildEffectDef; target: CompiledEffect }> {
    let bindings = effect.childBindings;
    if (!bindings) {
      bindings = [];
      for (const child of effect.def.children ?? []) {
        const target = this.byName.get(child.effect);
        if (!target) {
          throw new Error(
            `[particles] effect "${effect.def.name}" references unregistered child "${child.effect}"`,
          );
        }
        if (target === effect) {
          throw new Error(
            `[particles] effect "${effect.def.name}" cannot be its own child`,
          );
        }
        bindings.push({ child, target });
      }
      (effect as { childBindings?: typeof bindings }).childBindings = bindings;
    }
    return bindings;
  }

  private triggerChildren(
    effect: CompiledEffect,
    on: 'birth' | 'death',
    fromRow: number,
    toRow: number,
  ): void {
    if (!effect.def.children || effect.def.children.length === 0) {
      return;
    }
    const bindings = this.childBindings(effect);
    const pool = effect.pool;
    for (const { child, target } of bindings) {
      if (child.on !== on) {
        continue;
      }
      const probability = child.probability ?? 1;
      const count = child.count ?? 1;
      for (let row = fromRow; row < toRow; row++) {
        if (probability >= 1 || effect.rng.next() < probability) {
          this.queues.get(target)!.push({
            effect: target,
            count,
            px: pool.posX[row],
            py: pool.posY[row],
            pz: pool.posZ[row],
          });
        }
      }
    }
  }

  private simulatePool(effect: CompiledEffect, dt: number): void {
    const pool = effect.pool;
    const count = pool.count;
    if (count === 0) {
      return;
    }

    // One life-fraction multiply per particle; passes read the lane.
    const { lifeT, age, invLife } = pool;
    for (let i = 0; i < count; i++) {
      lifeT[i] = age[i] * invLife[i];
    }

    const passes = effect.passes;
    for (let p = 0; p < passes.length; p++) {
      passes[p](pool, count, dt);
    }

    // Integrate + age.
    const { posX, posY, posZ, velX, velY, velZ, speedScale } = pool;
    for (let i = 0; i < count; i++) {
      const step = dt * speedScale[i];
      posX[i] += velX[i] * step;
      posY[i] += velY[i] * step;
      posZ[i] += velZ[i] * step;
      age[i] += dt;
    }

    // Death sweep (swap-remove; re-examine the swapped-in row).
    const hasDeathChildren = (effect.def.children ?? []).some(
      (child) => child.on === 'death',
    );
    for (let i = 0; i < pool.count; i++) {
      if (age[i] * invLife[i] >= 1) {
        if (hasDeathChildren) {
          this.triggerChildren(effect, 'death', i, i + 1);
        }
        pool.removeRow(i);
        i--;
      }
    }
  }
}
