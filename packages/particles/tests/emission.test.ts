/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from 'vitest';
import {
  ParticleEngine,
  defineEffect,
  point,
  range,
  value,
} from '../src/index.js';

const dt = 1 / 72;

function baseInit() {
  return {
    life: value(10),
    size: value(0.1),
    speed: value(0),
    shape: point(),
  };
}

describe('emission', () => {
  it('spawns declared burst totals through burst()', () => {
    const engine = new ParticleEngine({ seed: 1 });
    const fx = engine.register(
      defineEffect({
        name: 'burst',
        capacity: 100,
        bursts: [{ count: 14 }, { count: 6 }],
        init: baseInit(),
      }),
    );
    const spawned = engine.burst(fx, 0, 0, 0);
    expect(spawned).toBe(20);
    engine.update(dt);
    expect(fx.pool.count).toBe(20);
  });

  it('applies countScale and clamps to capacity', () => {
    const engine = new ParticleEngine({ seed: 1 });
    const fx = engine.register(
      defineEffect({
        name: 'clamped',
        capacity: 32,
        bursts: [{ count: 20 }],
        init: baseInit(),
      }),
    );
    expect(engine.burst(fx, 0, 0, 0, { countScale: 3 })).toBe(32);
    expect(engine.stats.skippedThisFrame).toBeGreaterThan(0);
  });

  it('accumulates continuous rate across frames', () => {
    const engine = new ParticleEngine({ seed: 1 });
    const fx = engine.register(
      defineEffect({
        name: 'rate',
        capacity: 512,
        rate: 90,
        init: baseInit(),
      }),
    );
    engine.createEmitter(fx);
    for (let i = 0; i < 72; i++) {
      engine.update(dt);
    }
    expect(fx.pool.count).toBeGreaterThanOrEqual(89);
    expect(fx.pool.count).toBeLessThanOrEqual(91);
  });

  it('emits per meter of emitter travel', () => {
    const engine = new ParticleEngine({ seed: 1 });
    const fx = engine.register(
      defineEffect({
        name: 'wake',
        capacity: 512,
        ratePerMeter: 10,
        init: baseInit(),
      }),
    );
    const emitter = engine.createEmitter(fx);
    for (let i = 0; i <= 20; i++) {
      emitter.setFrame(i * 0.1, 0, 0); // 2 meters total
      engine.update(dt);
    }
    expect(fx.pool.count).toBe(20);
  });

  it('enforces named budget groups across effects', () => {
    const engine = new ParticleEngine({ seed: 1 });
    engine.setBudget('enemyFx', 24);
    const a = engine.register(
      defineEffect({
        name: 'a',
        capacity: 100,
        budget: 'enemyFx',
        bursts: [{ count: 20 }],
        init: baseInit(),
      }),
    );
    const b = engine.register(
      defineEffect({
        name: 'b',
        capacity: 100,
        budget: 'enemyFx',
        bursts: [{ count: 20 }],
        init: baseInit(),
      }),
    );
    expect(engine.burst(a, 0, 0, 0)).toBe(20);
    expect(engine.burst(b, 0, 0, 0)).toBe(4);
    expect(a.pool.count + b.pool.count).toBe(24);
  });

  it('applies tint and scale burst params at spawn', () => {
    const engine = new ParticleEngine({ seed: 1 });
    const fx = engine.register(
      defineEffect({
        name: 'tinted',
        capacity: 8,
        bursts: [{ count: 1 }],
        init: { ...baseInit(), color: 0xffffff, size: value(2) },
      }),
    );
    engine.burst(fx, 0, 0, 0, { tint: 0x0080ff, scale: 2 });
    expect(fx.pool.colR[0]).toBeCloseTo(0, 5);
    expect(fx.pool.colG[0]).toBeCloseTo(128 / 255, 5);
    expect(fx.pool.colB[0]).toBeCloseTo(1, 5);
    expect(fx.pool.size[0]).toBeCloseTo(4, 5);
  });

  it('spawns death children at the parent position', () => {
    const engine = new ParticleEngine({ seed: 1 });
    engine.register(
      defineEffect({
        name: 'wisp',
        capacity: 32,
        init: baseInit(),
      }),
    );
    const parent = engine.register(
      defineEffect({
        name: 'parent',
        capacity: 8,
        bursts: [{ count: 4 }],
        children: [{ on: 'death', effect: 'wisp', count: 2 }],
        init: { ...baseInit(), life: value(0.05), speed: value(1) },
      }),
    );
    engine.burst(parent, 3, 0, 0);
    for (let i = 0; i < 12; i++) {
      engine.update(dt);
    }
    const wisp = engine.getEffect('wisp')!;
    expect(parent.pool.count).toBe(0);
    expect(wisp.pool.count).toBe(8);
    // Children spawned near the parents' death positions (x ≈ 3 ± drift).
    expect(Math.abs(wisp.pool.posX[0] - 3)).toBeLessThan(0.3);
  });

  it('sweeps dead particles and keeps the live range dense', () => {
    const engine = new ParticleEngine({ seed: 1 });
    const fx = engine.register(
      defineEffect({
        name: 'sweep',
        capacity: 64,
        bursts: [{ count: 32 }],
        init: { ...baseInit(), life: range(0.05, 0.5) },
      }),
    );
    engine.burst(fx, 0, 0, 0);
    let previous = fx.pool.count;
    for (let i = 0; i < 40; i++) {
      engine.update(dt);
      expect(fx.pool.count).toBeLessThanOrEqual(previous);
      for (let row = 0; row < fx.pool.count; row++) {
        expect(fx.pool.age[row] * fx.pool.invLife[row]).toBeLessThan(1);
      }
      previous = fx.pool.count;
    }
    expect(fx.pool.count).toBe(0);
  });
});
