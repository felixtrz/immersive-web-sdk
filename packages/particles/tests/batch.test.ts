/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { InstancedBufferGeometry, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import {
  ParticleBatch,
  ParticleBatchSet,
  ParticleEngine,
  defineEffect,
  point,
  value,
} from '../src/index.js';

function makeEngine() {
  return new ParticleEngine({ seed: 9 });
}

const init = {
  life: value(5),
  size: value(0.25),
  speed: value(0),
  color: 0xff0000,
  shape: point(),
};

describe('batching', () => {
  it('shares one batch between effects with equal material keys', () => {
    const engine = makeEngine();
    const map = new Texture();
    engine.register(
      defineEffect({
        name: 'a',
        capacity: 8,
        bursts: [{ count: 2 }],
        material: { map, blending: 'additive' },
        init,
      }),
    );
    engine.register(
      defineEffect({
        name: 'b',
        capacity: 8,
        bursts: [{ count: 3 }],
        material: { map, blending: 'additive' },
        init,
      }),
    );
    const set = new ParticleBatchSet(engine);
    engine.burst('a', 0, 0, 0);
    engine.burst('b', 0, 0, 0);
    engine.update(1 / 72);
    set.update();
    expect(set.batchCount).toBe(1);
    expect(set.activeBatchCount).toBe(1);
    const batch = set.children[0] as ParticleBatch;
    const geometry = batch.geometry as InstancedBufferGeometry;
    expect(geometry.instanceCount).toBe(5);
  });

  it('splits batches on blending and hides empty ones', () => {
    const engine = makeEngine();
    engine.register(
      defineEffect({
        name: 'add',
        capacity: 8,
        bursts: [{ count: 1 }],
        material: { blending: 'additive' },
        init,
      }),
    );
    engine.register(
      defineEffect({
        name: 'pre',
        capacity: 8,
        bursts: [{ count: 1 }],
        material: { blending: 'premultiplied' },
        init,
      }),
    );
    const set = new ParticleBatchSet(engine);
    engine.burst('add', 0, 0, 0);
    engine.update(1 / 72);
    set.update();
    expect(set.batchCount).toBe(2);
    expect(set.activeBatchCount).toBe(1);
  });

  it('packs interleaved instance data from the pool lanes', () => {
    const engine = makeEngine();
    const fx = engine.register(
      defineEffect({
        name: 'pack',
        capacity: 4,
        bursts: [{ count: 1 }],
        init: { ...init, size: value(0.5) },
      }),
    );
    const set = new ParticleBatchSet(engine);
    engine.burst(fx, 1, 2, 3);
    engine.update(1 / 72);
    set.update();
    const batch = set.children[0] as ParticleBatch;
    const geometry = batch.geometry as InstancedBufferGeometry;
    const offset = geometry.getAttribute('instanceOffset');
    const color = geometry.getAttribute('instanceColor');
    const size = geometry.getAttribute('instanceSize');
    expect(offset.getX(0)).toBeCloseTo(1, 4);
    expect(offset.getY(0)).toBeCloseTo(2, 4);
    expect(offset.getZ(0)).toBeCloseTo(3, 4);
    expect(color.getX(0)).toBeCloseTo(1, 4); // red
    expect(color.getY(0)).toBeCloseTo(0, 4);
    expect(size.getX(0)).toBeCloseTo(0.5, 4);
  });

  it('sizes buffers to summed member capacities', () => {
    const engine = makeEngine();
    engine.register(
      defineEffect({
        name: 'cap1',
        capacity: 10,
        material: { blending: 'normal' },
        init,
      }),
    );
    engine.register(
      defineEffect({
        name: 'cap2',
        capacity: 22,
        material: { blending: 'normal' },
        init,
      }),
    );
    const set = new ParticleBatchSet(engine);
    set.update();
    const batch = set.children[0] as ParticleBatch;
    const geometry = batch.geometry as InstancedBufferGeometry;
    const offset = geometry.getAttribute('instanceOffset');
    // 32 instances * stride 10 floats.
    expect(offset.array.length).toBe(320);
  });
});
