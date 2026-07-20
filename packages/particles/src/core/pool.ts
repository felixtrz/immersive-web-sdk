/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Structure-of-arrays particle storage.
 *
 * @remarks
 * Particles are rows in flat `Float32Array` lanes rather than heap objects:
 * simulation passes sweep contiguous memory, the renderer packs straight from
 * the lanes, and nothing allocates after the pool is built. Capacity is fixed
 * at construction — budgets are contracts, so a saturated pool skips spawns
 * instead of growing (a data-oriented rewrite along these lines measured
 * 2.5x faster simulation and ~70% less allocation than an object-per-particle
 * engine in a production WebXR title).
 *
 * Rows are recycled with swap-remove; each spawn stamps a generation so a
 * `(row, generation)` pair is a stable handle — a stale handle is dead,
 * never silently re-attached to whatever reused the row.
 *
 * @category Particles
 */
export class ParticlePool {
  readonly capacity: number;

  /** Live particle count; rows `[0, count)` are alive. */
  count = 0;

  readonly posX: Float32Array;
  readonly posY: Float32Array;
  readonly posZ: Float32Array;
  readonly velX: Float32Array;
  readonly velY: Float32Array;
  readonly velZ: Float32Array;
  readonly age: Float32Array;
  /** 1 / life; `t = age * invLife`, death at `t >= 1`. */
  readonly invLife: Float32Array;
  /** Current scalar size (world units). */
  readonly size: Float32Array;
  readonly startSize: Float32Array;
  readonly colR: Float32Array;
  readonly colG: Float32Array;
  readonly colB: Float32Array;
  readonly colA: Float32Array;
  readonly startColR: Float32Array;
  readonly startColG: Float32Array;
  readonly startColB: Float32Array;
  readonly startColA: Float32Array;
  /** Billboard rotation angle (radians). */
  readonly rotation: Float32Array;
  /** Flipbook tile index (fractional; floored in the shader). */
  readonly frame: Float32Array;
  /** Displacement multiplier written by speed-over-life passes. */
  readonly speedScale: Float32Array;
  /** Per-particle uniform random draws sampled at spawn, for passes. */
  readonly seedA: Float32Array;
  readonly seedB: Float32Array;
  /** Normalized life, precomputed once per frame before the passes run. */
  readonly lifeT: Float32Array;
  /** Spawn generation per row (identity handle component). */
  readonly generation: Float32Array;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('[particles] pool capacity must be a positive integer');
    }
    this.capacity = capacity;
    this.posX = new Float32Array(capacity);
    this.posY = new Float32Array(capacity);
    this.posZ = new Float32Array(capacity);
    this.velX = new Float32Array(capacity);
    this.velY = new Float32Array(capacity);
    this.velZ = new Float32Array(capacity);
    this.age = new Float32Array(capacity);
    this.invLife = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.startSize = new Float32Array(capacity);
    this.colR = new Float32Array(capacity);
    this.colG = new Float32Array(capacity);
    this.colB = new Float32Array(capacity);
    this.colA = new Float32Array(capacity);
    this.startColR = new Float32Array(capacity);
    this.startColG = new Float32Array(capacity);
    this.startColB = new Float32Array(capacity);
    this.startColA = new Float32Array(capacity);
    this.rotation = new Float32Array(capacity);
    this.frame = new Float32Array(capacity);
    this.speedScale = new Float32Array(capacity);
    this.seedA = new Float32Array(capacity);
    this.seedB = new Float32Array(capacity);
    this.lifeT = new Float32Array(capacity);
    this.generation = new Float32Array(capacity);
  }

  /** Free rows remaining. */
  get room(): number {
    return this.capacity - this.count;
  }

  /**
   * Claims the next row (caller must have checked {@link room}) and stamps
   * its generation. Returns the row index.
   */
  claimRow(): number {
    const row = this.count++;
    this.generation[row] += 1;
    return row;
  }

  /**
   * Swap-removes row `i`, keeping the live range dense. The dying row's data
   * moves to the freed slot at the end of the live range.
   */
  removeRow(i: number): void {
    const last = this.count - 1;
    if (i !== last) {
      this.swapRows(i, last);
    }
    this.count = last;
  }

  private swapLane(lane: Float32Array, a: number, b: number): void {
    const v = lane[a];
    lane[a] = lane[b];
    lane[b] = v;
  }

  private swapRows(a: number, b: number): void {
    this.swapLane(this.posX, a, b);
    this.swapLane(this.posY, a, b);
    this.swapLane(this.posZ, a, b);
    this.swapLane(this.velX, a, b);
    this.swapLane(this.velY, a, b);
    this.swapLane(this.velZ, a, b);
    this.swapLane(this.age, a, b);
    this.swapLane(this.invLife, a, b);
    this.swapLane(this.size, a, b);
    this.swapLane(this.startSize, a, b);
    this.swapLane(this.colR, a, b);
    this.swapLane(this.colG, a, b);
    this.swapLane(this.colB, a, b);
    this.swapLane(this.colA, a, b);
    this.swapLane(this.startColR, a, b);
    this.swapLane(this.startColG, a, b);
    this.swapLane(this.startColB, a, b);
    this.swapLane(this.startColA, a, b);
    this.swapLane(this.rotation, a, b);
    this.swapLane(this.frame, a, b);
    this.swapLane(this.speedScale, a, b);
    this.swapLane(this.seedA, a, b);
    this.swapLane(this.seedB, a, b);
    this.swapLane(this.generation, a, b);
  }
}
