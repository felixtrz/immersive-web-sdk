/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Group } from 'three';
import { ParticleEngine } from '../core/engine.js';
import { ParticleBatch } from './batch.js';

/**
 * The Three.js face of a {@link ParticleEngine}: owns one
 * {@link ParticleBatch} per material key and packs every pool into them each
 * frame. Add it to the scene once; its transform defines "engine space" —
 * slide it to pin all particles to a moving reference frame (a scrolling
 * world, a vehicle interior) without touching a single particle.
 *
 * @category Particles
 * @example
 * ```ts
 * const batchSet = new ParticleBatchSet(engine);
 * scene.add(batchSet);
 * // per frame, after engine.update(dt):
 * batchSet.update();
 * ```
 */
export class ParticleBatchSet extends Group {
  private readonly batches = new Map<string, ParticleBatch>();
  private seenVersion = -1;

  constructor(private readonly engine: ParticleEngine) {
    super();
    this.name = 'ParticleBatchSet';
  }

  /** Number of batches (== worst-case draw calls for the layer). */
  get batchCount(): number {
    return this.batches.size;
  }

  /** Batches with live particles this frame (== actual draw calls). */
  get activeBatchCount(): number {
    let active = 0;
    for (const batch of this.batches.values()) {
      if (batch.visible) {
        active++;
      }
    }
    return active;
  }

  private sync(): void {
    if (this.seenVersion === this.engine.version) {
      return;
    }
    this.seenVersion = this.engine.version;
    for (const effect of this.engine.compiled) {
      const key = ParticleBatch.keyOf(effect);
      const existing = this.batches.get(key);
      if (existing) {
        existing.addMember(effect);
      } else {
        const batch = new ParticleBatch(effect);
        this.batches.set(key, batch);
        this.add(batch);
      }
    }
  }

  /** Packs and uploads every batch. Call after {@link ParticleEngine.update}. */
  update(): void {
    this.sync();
    for (const batch of this.batches.values()) {
      batch.pack();
    }
  }

  dispose(): void {
    for (const batch of this.batches.values()) {
      batch.dispose();
      this.remove(batch);
    }
    this.batches.clear();
  }
}
