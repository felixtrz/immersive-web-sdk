/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from 'vitest';
import {
  ParticleEngine,
  ParticlePool,
  curve,
  defineEffect,
  gradient,
  range,
  sphere,
} from '../src/index.js';

function makeEffect(name: string) {
  return defineEffect({
    name,
    capacity: 128,
    bursts: [{ count: 16 }],
    rate: 30,
    init: {
      life: range(0.2, 0.6),
      speed: range(0.5, 1.5),
      size: range(0.05, 0.15),
      color: 0xff8844,
      rotation: range(-Math.PI, Math.PI),
      shape: sphere({ radius: 0.1 }),
    },
    overLife: {
      color: gradient(
        [
          [0, 0xffffff],
          [0.5, 0xff8844],
          [1, 0x220000],
        ],
        [
          [0, 1],
          [1, 0],
        ],
      ),
      size: curve([
        [0, 1],
        [1, 0.1],
      ]),
      rotation: range(-2, 2),
      drag: 1.5,
      force: [0, -0.5, 0],
    },
  });
}

function hashPool(pool: ParticlePool): number {
  const view = new DataView(new ArrayBuffer(8));
  let h = 2166136261 >>> 0;
  const mix = (v: number) => {
    view.setFloat64(0, v, true);
    h = Math.imul(h ^ view.getUint32(0, true), 16777619) >>> 0;
    h = Math.imul(h ^ view.getUint32(4, true), 16777619) >>> 0;
  };
  mix(pool.count);
  for (let i = 0; i < pool.count; i++) {
    mix(pool.posX[i]);
    mix(pool.posY[i]);
    mix(pool.posZ[i]);
    mix(pool.velX[i]);
    mix(pool.velY[i]);
    mix(pool.velZ[i]);
    mix(pool.colR[i]);
    mix(pool.colA[i]);
    mix(pool.size[i]);
    mix(pool.rotation[i]);
    mix(pool.age[i]);
  }
  return h;
}

function runScenario(seed: number): number {
  const engine = new ParticleEngine({ seed });
  const fx = engine.register(makeEffect('boom'));
  const emitter = engine.createEmitter(fx);
  let hash = 2166136261 >>> 0;
  for (let frame = 0; frame < 240; frame++) {
    emitter.setFrame(Math.sin(frame * 0.1), 0, Math.cos(frame * 0.1));
    if (frame % 30 === 0) {
      engine.burst(fx, 1, 0.5, -1, { tint: 0x88ccff, scale: 1.25 });
    }
    engine.update(1 / 72);
    hash = (Math.imul(hash ^ hashPool(fx.pool), 16777619) >>> 0) >>> 0;
  }
  return hash;
}

describe('determinism', () => {
  it('produces bit-identical state for identical seeds and call sequences', () => {
    expect(runScenario(1234)).toBe(runScenario(1234));
  });

  it('produces different streams for different seeds', () => {
    expect(runScenario(1234)).not.toBe(runScenario(4321));
  });

  it('is independent of Math.random consumers', () => {
    const a = runScenario(77);
    for (let i = 0; i < 1000; i++) {
      Math.random();
    }
    expect(runScenario(77)).toBe(a);
  });
});
