/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ParticleRng } from './rng.js';

/**
 * Emitter shape definitions: where particles appear and which direction they
 * initially travel, in the emitter's local frame (+Z is the cone axis).
 *
 * @category Particles
 */
export type ShapeDef =
  | { kind: 'point' }
  | { kind: 'sphere'; radius: number; thickness: number }
  | { kind: 'hemisphere'; radius: number; thickness: number; arc: number }
  | { kind: 'cone'; radius: number; angle: number; arc: number }
  | { kind: 'circle'; radius: number; thickness: number; arc: number };

/** Emit from a single point in random spherical directions. */
export function point(): ShapeDef {
  return { kind: 'point' };
}

/**
 * Emit from a sphere shell/volume, moving outward.
 *
 * @param thickness - 1 fills the whole volume, 0 emits only from the surface.
 */
export function sphere(
  options: { radius?: number; thickness?: number } = {},
): ShapeDef {
  return {
    kind: 'sphere',
    radius: options.radius ?? 1,
    thickness: options.thickness ?? 1,
  };
}

/** Emit from the +Z hemisphere, moving outward. */
export function hemisphere(
  options: { radius?: number; thickness?: number; arc?: number } = {},
): ShapeDef {
  return {
    kind: 'hemisphere',
    radius: options.radius ?? 1,
    thickness: options.thickness ?? 1,
    arc: options.arc ?? Math.PI * 2,
  };
}

/**
 * Emit from a disc, spraying along +Z spread by `angle` (radians from the
 * axis).
 */
export function cone(
  options: { radius?: number; angle?: number; arc?: number } = {},
): ShapeDef {
  return {
    kind: 'cone',
    radius: options.radius ?? 1,
    angle: options.angle ?? Math.PI / 6,
    arc: options.arc ?? Math.PI * 2,
  };
}

/** Emit from a ring/disc in the XY plane, moving radially outward. */
export function circle(
  options: { radius?: number; thickness?: number; arc?: number } = {},
): ShapeDef {
  return {
    kind: 'circle',
    radius: options.radius ?? 1,
    thickness: options.thickness ?? 1,
    arc: options.arc ?? Math.PI * 2,
  };
}

/** Spawn-time output: local position and unit-ish direction. */
export interface ShapeSample {
  px: number;
  py: number;
  pz: number;
  dx: number;
  dy: number;
  dz: number;
}

/**
 * Samples a shape into `out` using the pool's random stream. All draws come
 * from `rng`, keeping spawn randomness deterministic per pool.
 */
export function sampleShape(
  shape: ShapeDef,
  rng: ParticleRng,
  out: ShapeSample,
): void {
  switch (shape.kind) {
    case 'point': {
      const theta = rng.next() * Math.PI * 2;
      const phi = Math.acos(2 * rng.next() - 1);
      const sinPhi = Math.sin(phi);
      out.dx = sinPhi * Math.cos(theta);
      out.dy = sinPhi * Math.sin(theta);
      out.dz = Math.cos(phi);
      out.px = 0;
      out.py = 0;
      out.pz = 0;
      return;
    }
    case 'sphere': {
      const theta = rng.next() * Math.PI * 2;
      const phi = Math.acos(2 * rng.next() - 1);
      const shell = 1 - shape.thickness * rng.next();
      const sinPhi = Math.sin(phi);
      out.dx = sinPhi * Math.cos(theta);
      out.dy = sinPhi * Math.sin(theta);
      out.dz = Math.cos(phi);
      const r = shape.radius * shell;
      out.px = out.dx * r;
      out.py = out.dy * r;
      out.pz = out.dz * r;
      return;
    }
    case 'hemisphere': {
      const theta = rng.next() * shape.arc;
      const phi = Math.acos(rng.next());
      const shell = 1 - shape.thickness * rng.next();
      const sinPhi = Math.sin(phi);
      out.dx = sinPhi * Math.cos(theta);
      out.dy = sinPhi * Math.sin(theta);
      out.dz = Math.cos(phi);
      const r = shape.radius * shell;
      out.px = out.dx * r;
      out.py = out.dy * r;
      out.pz = out.dz * r;
      return;
    }
    case 'cone': {
      const theta = rng.next() * shape.arc;
      const r = Math.sqrt(rng.next());
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      out.px = r * cosT * shape.radius;
      out.py = r * sinT * shape.radius;
      out.pz = 0;
      const spread = shape.angle * r;
      const sinSpread = Math.sin(spread);
      out.dx = sinSpread * cosT;
      out.dy = sinSpread * sinT;
      out.dz = Math.cos(spread);
      return;
    }
    case 'circle': {
      const theta = rng.next() * shape.arc;
      const shell = 1 - shape.thickness * rng.next();
      out.dx = Math.cos(theta);
      out.dy = Math.sin(theta);
      out.dz = 0;
      const r = shape.radius * shell;
      out.px = out.dx * r;
      out.py = out.dy * r;
      out.pz = 0;
      return;
    }
  }
}
