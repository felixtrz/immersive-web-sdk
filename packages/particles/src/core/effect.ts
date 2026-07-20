/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AnyCurve, GradientDef, ScalarInit } from './curves.js';
import { ShapeDef, point } from './shapes.js';

/**
 * How a batch composites. `premultiplied` uses ONE/ONE_MINUS_SRC_ALPHA with
 * premultiplied output, letting per-particle alpha slide continuously between
 * additive (alpha 0) and normal (alpha 1) compositing inside one draw call —
 * effects that would otherwise split batches on blend state can share one.
 *
 * @category Particles
 */
export type ParticleBlending = 'additive' | 'normal' | 'premultiplied';

/** How instances are oriented. */
export type ParticleRenderMode =
  | 'billboard'
  | 'stretched'
  | 'horizontal'
  | 'vertical';

/**
 * Renderer-facing material descriptor. `map` is intentionally opaque here so
 * the simulation core stays renderer-agnostic; the Three.js batch renderer
 * interprets it as a `THREE.Texture`.
 *
 * @category Particles
 */
export interface ParticleMaterialDef {
  /** Texture (atlas) for the sprite; omit for untextured discs. */
  map?: unknown;
  blending?: ParticleBlending;
  /** Atlas tiling — flipbook frames index `u + v * uTiles` tiles. */
  tiles?: { u: number; v: number };
  depthWrite?: boolean;
}

/** One burst: `count` particles at `time` seconds into the emitter's life. */
export interface BurstDef {
  time?: number;
  count: number;
  /** Repeats: fire `cycles` times, `interval` seconds apart. */
  cycles?: number;
  interval?: number;
  probability?: number;
}

/** Spawn-time initialization ranges. */
export interface EffectInitDef {
  life: ScalarInit;
  speed?: ScalarInit;
  size: ScalarInit;
  /** Base color as 0xrrggbb. */
  color?: number;
  alpha?: ScalarInit;
  rotation?: ScalarInit;
  /** Starting flipbook tile. */
  tile?: ScalarInit;
  shape?: ShapeDef;
}

/** Over-life behavior stack; every entry compiles to one linear pass. */
export interface EffectOverLifeDef {
  /** Gradient multiplied against the spawn color/alpha. */
  color?: GradientDef;
  /** Size multiplier curve over life. */
  size?: AnyCurve;
  /** Displacement multiplier curve over life. */
  speed?: AnyCurve;
  /** Velocity damping factor (per second). */
  drag?: number;
  /** Constant acceleration, e.g. gravity: `[0, -9.8, 0]`. */
  force?: readonly [number, number, number];
  /** Angular velocity (radians/second), sampled per particle. */
  rotation?: ScalarInit;
  /** Flipbook tile curve over life. */
  frame?: AnyCurve;
}

/** Child effect triggered by parent particle lifecycle events. */
export interface ChildEffectDef {
  on: 'birth' | 'death';
  /** Name of a registered effect. */
  effect: string;
  count?: number;
  probability?: number;
}

/**
 * A complete particle effect definition. Immutable after
 * {@link ParticleEngine.register}; per-burst variation goes through
 * {@link BurstParams} instead of mutating the definition.
 *
 * @category Particles
 */
export interface EffectDef {
  name: string;
  /**
   * Hard ceiling on live particles — required, not defaulted. The pool and
   * the GPU buffers are sized to exactly this at registration, and a
   * saturated effect skips spawns (degrades to fewer particles) instead of
   * reallocating mid-frame.
   */
  capacity: number;
  /** Optional named budget group shared with other effects. */
  budget?: string;
  mode?: ParticleRenderMode;
  material?: ParticleMaterialDef;
  /** Stretched mode: how much velocity elongates the sprite. */
  stretch?: { speedFactor?: number; lengthFactor?: number };
  /** Continuous emission rate (particles/second) for attached emitters. */
  rate?: number;
  /** Emission per meter of attached-emitter travel (wakes and trails). */
  ratePerMeter?: number;
  bursts?: BurstDef[];
  init: EffectInitDef;
  overLife?: EffectOverLifeDef;
  children?: ChildEffectDef[];
}

/**
 * Per-burst parameter overrides — the sanctioned way to vary a shared,
 * immutable effect per event (tint an explosion to the victim's palette,
 * scale it to the blast radius) without touching the definition.
 *
 * @category Particles
 */
export interface BurstParams {
  /** Multiplies the spawn color as 0xrrggbb. */
  tint?: number;
  /** Multiplies spawn size and speed. */
  scale?: number;
  /** Multiplies spawn speed only. */
  speedScale?: number;
  /** Multiplies spawn life. */
  lifeScale?: number;
  /** Multiplies burst counts (rounded). */
  countScale?: number;
  /** Multiplies spawn alpha. */
  alphaScale?: number;
}

/**
 * Validates and freezes an effect definition.
 *
 * @category Particles
 * @example
 * ```ts
 * const explosion = defineEffect({
 *   name: 'explosion',
 *   capacity: 64,
 *   material: { map: atlas, blending: 'additive', tiles: { u: 4, v: 2 } },
 *   bursts: [{ count: 24 }],
 *   init: {
 *     life: range(0.3, 0.6),
 *     speed: range(0.5, 1.5),
 *     size: range(0.05, 0.12),
 *     color: 0xffaa55,
 *     shape: sphere({ radius: 0.05 }),
 *   },
 *   overLife: {
 *     color: gradient(
 *       [
 *         [0, 0xffffff],
 *         [1, 0x883322],
 *       ],
 *       [
 *         [0, 1],
 *         [1, 0],
 *       ],
 *     ),
 *     size: curve([
 *       [0, 1],
 *       [1, 0.2],
 *     ]),
 *     drag: 2,
 *   },
 * });
 * ```
 */
export function defineEffect(def: EffectDef): EffectDef {
  if (!def.name) {
    throw new Error('[particles] effect needs a name');
  }
  if (!Number.isInteger(def.capacity) || def.capacity <= 0) {
    throw new Error(
      `[particles] effect "${def.name}" needs a positive integer capacity`,
    );
  }
  if (!def.init || !def.init.life || !def.init.size) {
    throw new Error(
      `[particles] effect "${def.name}" needs init.life and init.size`,
    );
  }
  return Object.freeze({
    ...def,
    init: { shape: point(), ...def.init },
  });
}
