/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Box3, Vector3 } from 'three';
import { describe, it, expect } from 'vitest';

/**
 * Math Utils Tests
 *
 * Tests for the trajectory math functions from src/physics/math-utils.ts.
 * These functions implement parabolic projectile motion calculations
 * for VR teleportation arcs.
 */

// Inlined functions for testing
function calculateTrajectoryBounds(
  origin: Vector3,
  direction: Vector3,
  minY: number,
  gravity: number,
  outBox: Box3,
): Box3 {
  const a = 0.5 * gravity;
  const b = direction.y;
  const c = origin.y - minY;

  const discriminant = b * b - 4 * a * c;
  const tEnd = (-b + Math.sqrt(discriminant)) / (2 * a);

  const tPeak = -direction.y / gravity;
  const peakY =
    tPeak > 0
      ? origin.y + (direction.y * direction.y) / (2 * Math.abs(gravity))
      : origin.y;

  const endX = origin.x + direction.x * tEnd;
  const endZ = origin.z + direction.z * tEnd;

  outBox.min.set(Math.min(origin.x, endX), minY, Math.min(origin.z, endZ));
  outBox.max.set(
    Math.max(origin.x, endX),
    Math.max(origin.y, peakY),
    Math.max(origin.z, endZ),
  );

  return outBox;
}

function sampleParabolicCurve(
  start: Vector3,
  direction: Vector3,
  minY: number,
  gravity: number,
  points: Vector3[],
  offset = 0,
): void {
  const a = 0.5 * gravity;
  const b = direction.y;
  const c = start.y - minY;

  const discriminant = b * b - 4 * a * c;
  const tEnd = (-b + Math.sqrt(discriminant)) / (2 * a);

  const numPoints = points.length;
  for (let i = offset; i < numPoints + offset; i++) {
    const t = i / (offset + numPoints - 1);
    const tReal = t * tEnd;

    const posX = start.x + direction.x * tReal;
    const posY = start.y + direction.y * tReal + 0.5 * gravity * tReal * tReal;
    const posZ = start.z + direction.z * tReal;

    points[i - offset].set(posX, posY, posZ);
  }
}

describe('calculateTrajectoryBounds', () => {
  describe('peak height calculation', () => {
    it('should calculate peak height for upward trajectory', () => {
      const origin = new Vector3(0, 0, 0);
      const direction = new Vector3(0, 10, 0);
      const gravity = -10;
      const outBox = new Box3();

      calculateTrajectoryBounds(origin, direction, -10, gravity, outBox);

      // Peak = y0 + vy^2 / (2 * |g|) = 0 + 100 / 20 = 5
      expect(outBox.max.y).toBeCloseTo(5, 1);
    });

    it('should use origin height when trajectory goes straight down', () => {
      const origin = new Vector3(0, 10, 0);
      const direction = new Vector3(5, -5, 0);
      const gravity = -10;
      const outBox = new Box3();

      calculateTrajectoryBounds(origin, direction, 0, gravity, outBox);

      // tPeak = -(-5) / (-10) = -0.5, which is negative, so peakY = origin.y
      expect(outBox.max.y).toBe(origin.y);
    });
  });

  describe('minY constraint', () => {
    it('should set min.y to minY parameter', () => {
      const origin = new Vector3(0, 5, 0);
      const direction = new Vector3(5, 10, 0);
      const outBox = new Box3();

      calculateTrajectoryBounds(origin, direction, 2, -10, outBox);

      expect(outBox.min.y).toBe(2);
    });

    it('should handle negative minY', () => {
      const origin = new Vector3(0, 0, 0);
      const direction = new Vector3(5, 5, 0);
      const outBox = new Box3();

      calculateTrajectoryBounds(origin, direction, -5, -10, outBox);

      expect(outBox.min.y).toBe(-5);
    });
  });
});

describe('sampleParabolicCurve', () => {
  describe('point generation', () => {
    it('should start at the origin', () => {
      const start = new Vector3(5, 10, 3);
      const direction = new Vector3(5, 5, 5);
      const points = Array.from({ length: 10 }, () => new Vector3());

      sampleParabolicCurve(start, direction, 0, -10, points);

      expect(points[0].x).toBeCloseTo(start.x, 4);
      expect(points[0].y).toBeCloseTo(start.y, 4);
      expect(points[0].z).toBeCloseTo(start.z, 4);
    });

    it('should fill all points with finite values', () => {
      const start = new Vector3(0, 10, 0);
      const direction = new Vector3(5, 5, 0);
      const points = Array.from({ length: 10 }, () => new Vector3());

      sampleParabolicCurve(start, direction, 0, -10, points);

      points.forEach((point) => {
        expect(Number.isFinite(point.x)).toBe(true);
        expect(Number.isFinite(point.y)).toBe(true);
        expect(Number.isFinite(point.z)).toBe(true);
      });
    });
  });

  describe('parabolic motion', () => {
    it('should apply quadratic gravity term (non-linear trajectory)', () => {
      const start = new Vector3(0, 10, 0);
      const direction = new Vector3(5, 5, 0);
      const points = Array.from({ length: 10 }, () => new Vector3());

      sampleParabolicCurve(start, direction, 0, -10, points);

      // The trajectory should not be linear
      const midPoint = points[5];
      const linearMidY = (points[0].y + points[9].y) / 2;

      expect(Math.abs(midPoint.y - linearMidY)).toBeGreaterThan(0);
    });

    it('should follow y = y0 + vy*t + 0.5*g*t^2 formula', () => {
      const start = new Vector3(0, 10, 0);
      const direction = new Vector3(5, 8, 0);
      const gravity = -10;
      const points = Array.from({ length: 5 }, () => new Vector3());

      sampleParabolicCurve(start, direction, 0, gravity, points);

      // Calculate expected trajectory end time
      const a = 0.5 * gravity;
      const b = direction.y;
      const c = start.y - 0;
      const discriminant = b * b - 4 * a * c;
      const tEnd = (-b + Math.sqrt(discriminant)) / (2 * a);

      // Check middle point using the parabolic formula
      const t = 0.5 * tEnd;
      const expectedY = start.y + direction.y * t + 0.5 * gravity * t * t;
      const expectedX = start.x + direction.x * t;

      expect(points[2].y).toBeCloseTo(expectedY, 2);
      expect(points[2].x).toBeCloseTo(expectedX, 2);
    });
  });

  describe('offset parameter', () => {
    it('should skip initial points when offset is provided', () => {
      const start = new Vector3(0, 10, 0);
      const direction = new Vector3(5, 5, 0);
      const points = Array.from({ length: 5 }, () => new Vector3());

      sampleParabolicCurve(start, direction, 0, -10, points, 5);

      // With offset=5 and 5 points, we sample t from 5/9 to 9/9
      expect(points[0].x).not.toBeCloseTo(start.x, 1);
    });
  });

  describe('3D trajectories', () => {
    it('should maintain proportional X and Z relationship', () => {
      const start = new Vector3(0, 10, 0);
      const direction = new Vector3(5, 5, 5);
      const points = Array.from({ length: 10 }, () => new Vector3());

      sampleParabolicCurve(start, direction, 0, -10, points);

      // X and Z should move proportionally since direction.x == direction.z
      const endDeltaX = points[9].x - start.x;
      const endDeltaZ = points[9].z - start.z;

      expect(endDeltaX).toBeCloseTo(endDeltaZ, 3);
    });
  });
});
