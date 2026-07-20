/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  CURVE_LUT_SIZE,
  bakeCurve,
  bakeGradient,
  sampleCurve,
} from './curves.js';
import { EffectOverLifeDef } from './effect.js';
import { ParticlePool } from './pool.js';

/**
 * One compiled over-life behavior: a monomorphic linear sweep across the
 * pool's live rows. Compiling the behavior stack once per effect — instead
 * of dispatching a virtual `update(particle)` per particle per behavior —
 * plus baked-table curve evaluation is where most of this engine's headroom
 * over object-graph particle engines comes from.
 *
 * @category Particles
 */
export type ParticlePass = (
  pool: ParticlePool,
  count: number,
  dt: number,
) => void;

function colorPass(lut: Float32Array): ParticlePass {
  return (pool, count) => {
    const { lifeT, colR, colG, colB, colA } = pool;
    const { startColR, startColG, startColB, startColA } = pool;
    for (let i = 0; i < count; i++) {
      const x = lifeT[i] * CURVE_LUT_SIZE;
      let k = x | 0;
      if (k >= CURVE_LUT_SIZE) {
        k = CURVE_LUT_SIZE - 1;
      }
      const f = x - k;
      const base = k * 4;
      colR[i] = (lut[base] + (lut[base + 4] - lut[base]) * f) * startColR[i];
      colG[i] =
        (lut[base + 1] + (lut[base + 5] - lut[base + 1]) * f) * startColG[i];
      colB[i] =
        (lut[base + 2] + (lut[base + 6] - lut[base + 2]) * f) * startColB[i];
      colA[i] =
        (lut[base + 3] + (lut[base + 7] - lut[base + 3]) * f) * startColA[i];
    }
  };
}

function sizePass(lut: Float32Array): ParticlePass {
  return (pool, count) => {
    const { lifeT, size, startSize } = pool;
    for (let i = 0; i < count; i++) {
      size[i] = startSize[i] * sampleCurve(lut, lifeT[i]);
    }
  };
}

function speedPass(lut: Float32Array): ParticlePass {
  return (pool, count) => {
    const { lifeT, speedScale } = pool;
    for (let i = 0; i < count; i++) {
      speedScale[i] = sampleCurve(lut, lifeT[i]);
    }
  };
}

function framePass(lut: Float32Array): ParticlePass {
  return (pool, count) => {
    const { lifeT, frame } = pool;
    for (let i = 0; i < count; i++) {
      frame[i] = sampleCurve(lut, lifeT[i]);
    }
  };
}

function dragPass(drag: number): ParticlePass {
  return (pool, count, dt) => {
    const { velX, velY, velZ } = pool;
    const factor = Math.max(0, 1 - drag * dt);
    for (let i = 0; i < count; i++) {
      velX[i] *= factor;
      velY[i] *= factor;
      velZ[i] *= factor;
    }
  };
}

function forcePass(fx: number, fy: number, fz: number): ParticlePass {
  return (pool, count, dt) => {
    const { velX, velY, velZ } = pool;
    const ax = fx * dt;
    const ay = fy * dt;
    const az = fz * dt;
    for (let i = 0; i < count; i++) {
      velX[i] += ax;
      velY[i] += ay;
      velZ[i] += az;
    }
  };
}

/**
 * Rotation rate sampled per particle at spawn from the seedA lane:
 * `rate = min + (max - min) * seedA`.
 */
function rotationPass(min: number, max: number): ParticlePass {
  const span = max - min;
  return (pool, count, dt) => {
    const { rotation, seedA } = pool;
    for (let i = 0; i < count; i++) {
      rotation[i] += dt * (min + span * seedA[i]);
    }
  };
}

/**
 * Compiles an effect's over-life stack into an ordered pass list. Order is
 * fixed and documented: color, size, speed, frame, rotation, force, drag.
 */
export function compilePasses(
  overLife: EffectOverLifeDef | undefined,
): ParticlePass[] {
  const passes: ParticlePass[] = [];
  if (!overLife) {
    return passes;
  }
  if (overLife.color) {
    passes.push(colorPass(bakeGradient(overLife.color)));
  }
  if (overLife.size) {
    passes.push(sizePass(bakeCurve(overLife.size)));
  }
  if (overLife.speed) {
    passes.push(speedPass(bakeCurve(overLife.speed)));
  }
  if (overLife.frame) {
    passes.push(framePass(bakeCurve(overLife.frame)));
  }
  if (overLife.rotation) {
    const r = overLife.rotation;
    if (r.kind === 'value') {
      passes.push(rotationPass(r.value, r.value));
    } else {
      passes.push(rotationPass(r.min, r.max));
    }
  }
  if (overLife.force) {
    passes.push(forcePass(...overLife.force));
  }
  if (overLife.drag !== undefined && overLife.drag > 0) {
    passes.push(dragPass(overLife.drag));
  }
  return passes;
}
