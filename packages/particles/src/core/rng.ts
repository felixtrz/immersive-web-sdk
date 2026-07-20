/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Deterministic per-stream pseudo-random source (mulberry32).
 *
 * @remarks
 * Every random draw in the particle engine flows through an owned stream —
 * never `Math.random` — so two runs with the same seeds and the same call
 * sequence produce bit-identical particle state. That property is what makes
 * golden-hash regression tests (and replay debugging) possible, and it keeps
 * the engine's determinism independent of unrelated `Math.random` consumers
 * elsewhere in an application.
 *
 * @category Particles
 */
export class ParticleRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Returns a float in [0, 1), advancing the stream. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns a float in [a, b). */
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
}

/**
 * Derives a well-mixed 32-bit seed from a base seed and a stream index, so
 * each effect pool gets an independent stream from one engine-level seed.
 *
 * @category Particles
 */
export function deriveSeed(base: number, stream: number): number {
  let h = (base ^ Math.imul(stream + 1, 0x9e3779b9)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
