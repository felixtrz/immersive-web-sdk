/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  BurstParams,
  CompiledEffect,
  EffectDef,
  ParticleBatchSet,
  ParticleEmitterHandle,
  ParticleEngine,
  ParticleEngineStats,
} from '@iwsdk/particles';
import { Types, createComponent } from '../ecs/component.js';
import { Entity } from '../ecs/entity.js';
import { createSystem } from '../ecs/system.js';

/**
 * Attaches a continuous particle effect to an entity: the effect's rate,
 * per-meter, and burst-schedule emission follow the entity's transform every
 * frame. Fire-and-forget bursts don't need this component — use
 * {@link ParticleSystem.burst}.
 *
 * @remarks
 * `effect` names an effect registered through
 * {@link ParticleSystem.registerEffect}; registration order doesn't matter
 * (entities whose effect isn't registered yet activate when it appears).
 *
 * @category Particles
 * @example
 * ```ts
 * const thruster = world.createTransformEntity(nozzle);
 * thruster.addComponent(ParticleEmitter, { effect: 'thruster-flame' });
 * ```
 */
export const ParticleEmitter = createComponent(
  'ParticleEmitter',
  {
    /** Name of a registered particle effect. */
    effect: { type: Types.String, default: '' },
    /** Multiplier on the effect's continuous emission rate. */
    rate: { type: Types.Float32, default: 1 },
    /** Pauses emission without removing the component. */
    enabled: { type: Types.Boolean, default: true },
  },
  'Continuous particle emitter following the entity transform',
);

/**
 * World-level particle simulation and rendering, backed by the
 * {@link @iwsdk/particles!ParticleEngine} data-oriented engine: budgeted
 * structure-of-arrays pools, compiled behavior passes, and one interleaved
 * instanced draw per material.
 *
 * @remarks
 * - Enable via {@link WorldOptions.features.particles}, or register manually.
 * - Register effects once (typically at load) with {@link registerEffect},
 *   then either attach {@link ParticleEmitter} components or call
 *   {@link burst} for fire-and-forget explosions/impacts — no scene objects,
 *   no entities, no per-burst allocation.
 * - The whole layer costs one draw call per active material batch and zero
 *   draws while idle.
 *
 * @category Particles
 * @example
 * ```ts
 * const particles = world.getSystem(ParticleSystem)!;
 * particles.registerEffect(explosionDef);
 * particles.burst('explosion', hit.x, hit.y, hit.z, { tint: 0x53d7ff });
 * ```
 */
export class ParticleSystem extends createSystem({
  emitters: { required: [ParticleEmitter] },
}) {
  /** The underlying renderer-agnostic engine (advanced use). */
  readonly engine = new ParticleEngine();
  /** The scene-facing batch root; move it to re-anchor all particles. */
  readonly batchSet = new ParticleBatchSet(this.engine);

  private handles = new Map<Entity, ParticleEmitterHandle>();
  private pending = new Set<Entity>();
  private bases = new Map<Entity, Float32Array>();

  init(): void {
    this.scene.add(this.batchSet);
    this.queries.emitters.entities.forEach((entity) => {
      this.attach(entity);
    });
    this.queries.emitters.subscribe('qualify', (entity) => {
      this.attach(entity);
    });
    this.queries.emitters.subscribe('disqualify', (entity) => {
      this.detach(entity);
    });
    this.cleanupFuncs.push(() => {
      for (const handle of this.handles.values()) {
        handle.dispose();
      }
      this.handles.clear();
      this.pending.clear();
      this.bases.clear();
      this.scene.remove(this.batchSet);
      this.batchSet.dispose();
    });
  }

  /**
   * Registers an effect definition with this world's engine. Compiles
   * passes, bakes curves, and allocates the pool — do it at load time.
   */
  registerEffect(def: EffectDef): CompiledEffect {
    const compiledEffect = this.engine.register(def);
    if (this.pending.size > 0) {
      for (const entity of [...this.pending]) {
        this.attach(entity);
      }
    }
    return compiledEffect;
  }

  /** Declares a shared live-particle budget across effects. */
  setBudget(name: string, capacity: number): void {
    this.engine.setBudget(name, capacity);
  }

  /**
   * Fire-and-forget burst at a position (batch-set space, which is world
   * space unless {@link batchSet} has been re-anchored). Returns particles
   * actually spawned after budget clamping.
   */
  burst(
    effect: CompiledEffect | string,
    x: number,
    y: number,
    z: number,
    params?: BurstParams,
  ): number {
    return this.engine.burst(effect, x, y, z, params);
  }

  /** Live counters for tooling and probes. */
  get stats(): ParticleEngineStats & {
    batches: number;
    activeBatches: number;
  } {
    return {
      ...this.engine.stats,
      batches: this.batchSet.batchCount,
      activeBatches: this.batchSet.activeBatchCount,
    };
  }

  private attach(entity: Entity): void {
    if (this.handles.has(entity)) {
      return;
    }
    const name = ParticleEmitter.data.effect[entity.index] as string;
    const effect = this.engine.getEffect(name);
    if (!effect) {
      this.pending.add(entity);
      return;
    }
    this.pending.delete(entity);
    this.handles.set(entity, this.engine.createEmitter(effect));
    this.bases.set(entity, new Float32Array(9));
  }

  private detach(entity: Entity): void {
    this.pending.delete(entity);
    const handle = this.handles.get(entity);
    if (handle) {
      handle.dispose();
      this.handles.delete(entity);
      this.bases.delete(entity);
    }
  }

  update(delta: number): void {
    for (const [entity, handle] of this.handles) {
      handle.rate = ParticleEmitter.data.rate[entity.index] as number;
      handle.enabled = ParticleEmitter.data.enabled[entity.index] === 1;
      const object3D = entity.object3D;
      if (object3D) {
        const m = object3D.matrixWorld.elements;
        const basis = this.bases.get(entity)!;
        basis[0] = m[0];
        basis[1] = m[1];
        basis[2] = m[2];
        basis[3] = m[4];
        basis[4] = m[5];
        basis[5] = m[6];
        basis[6] = m[8];
        basis[7] = m[9];
        basis[8] = m[10];
        handle.setFrame(m[12], m[13], m[14], basis);
      }
    }
    this.engine.update(delta);
    this.batchSet.update();
  }
}
