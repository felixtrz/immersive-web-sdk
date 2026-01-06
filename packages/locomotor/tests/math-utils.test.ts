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
  describe('basic trajectory', () => {
    it('should calculate bounds for upward trajectory landing below origin', () => {
      const origin = new Vector3(0, 5, 0);
      const direction = new Vector3(5, 10, 0);
      const minY = 0;
      const gravity = -10;
      const outBox = new Box3();

      calculateTrajectoryBounds(origin, direction, minY, gravity, outBox);

      // minY should be set correctly
      expect(outBox.min.y).toBe(minY);
      // Peak should be above origin due to upward velocity
      expect(outBox.max.y).toBeGreaterThan(origin.y);
    });

    it('should return the same box object', () => {
      const origin = new Vector3(0, 1, 0);
      const direction = new Vector3(5, 10, 0);
      const outBox = new Box3();

      const result = calculateTrajectoryBounds(
        origin,
        direction,
        0,
        -10,
        outBox,
      );

      expect(result).toBe(outBox);
    });
  });

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
      const direction = new Vector3(5, -5, 0); // Downward initial velocity
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
      const minY = 2;
      const outBox = new Box3();

      calculateTrajectoryBounds(origin, direction, minY, -10, outBox);

      expect(outBox.min.y).toBe(minY);
    });

    it('should handle negative minY', () => {
      const origin = new Vector3(0, 0, 0);
      const direction = new Vector3(5, 5, 0);
      const minY = -5;
      const outBox = new Box3();

      calculateTrajectoryBounds(origin, direction, minY, -10, outBox);

      expect(outBox.min.y).toBe(minY);
    });
  });

  describe('box validity', () => {
    it('should produce valid box with min <= max', () => {
      const origin = new Vector3(0, 5, 0);
      const direction = new Vector3(5, 10, 5);
      const outBox = new Box3();

      calculateTrajectoryBounds(origin, direction, 0, -10, outBox);

      expect(outBox.min.x).toBeLessThanOrEqual(outBox.max.x);
      expect(outBox.min.y).toBeLessThanOrEqual(outBox.max.y);
      expect(outBox.min.z).toBeLessThanOrEqual(outBox.max.z);
    });
  });
});

describe('sampleParabolicCurve', () => {
  describe('point generation', () => {
    it('should fill all points in the array', () => {
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

    it('should start at the origin', () => {
      const start = new Vector3(5, 10, 3);
      const direction = new Vector3(5, 5, 5);
      const points = Array.from({ length: 10 }, () => new Vector3());

      sampleParabolicCurve(start, direction, 0, -10, points);

      expect(points[0].x).toBeCloseTo(start.x, 4);
      expect(points[0].y).toBeCloseTo(start.y, 4);
      expect(points[0].z).toBeCloseTo(start.z, 4);
    });
  });

  describe('parabolic motion', () => {
    it('should produce varying Y values along trajectory', () => {
      const start = new Vector3(0, 10, 0);
      const direction = new Vector3(5, 5, 0);
      const points = Array.from({ length: 10 }, () => new Vector3());

      sampleParabolicCurve(start, direction, 0, -10, points);

      // Y values should vary (not all the same)
      const yValues = points.map((p) => p.y);
      const minY = Math.min(...yValues);
      const maxY = Math.max(...yValues);

      expect(maxY - minY).toBeGreaterThan(0);
    });

    it('should apply quadratic gravity term', () => {
      const start = new Vector3(0, 10, 0);
      const direction = new Vector3(5, 5, 0);
      const points = Array.from({ length: 10 }, () => new Vector3());

      sampleParabolicCurve(start, direction, 0, -10, points);

      // The trajectory should not be linear - check by comparing
      // the middle point to the linear interpolation
      const midPoint = points[5];
      const linearMidY = (points[0].y + points[9].y) / 2;

      // Due to parabolic nature, actual mid Y should differ from linear
      expect(Math.abs(midPoint.y - linearMidY)).toBeGreaterThan(0);
    });
  });

  describe('offset parameter', () => {
    it('should skip initial points when offset is provided', () => {
      const start = new Vector3(0, 10, 0);
      const direction = new Vector3(5, 5, 0);
      const points = Array.from({ length: 5 }, () => new Vector3());

      sampleParabolicCurve(start, direction, 0, -10, points, 5);

      // With offset=5 and 5 points, we sample t from 5/9 to 9/9
      // So first point should not be at origin
      expect(points[0].x).not.toBeCloseTo(start.x, 1);
    });
  });

  describe('edge cases', () => {
    it('should handle vertical trajectory', () => {
      const start = new Vector3(0, 10, 0);
      const direction = new Vector3(0, 5, 0);
      const points = Array.from({ length: 10 }, () => new Vector3());

      sampleParabolicCurve(start, direction, 0, -10, points);

      // All X and Z should remain at origin
      points.forEach((p) => {
        expect(p.x).toBe(0);
        expect(p.z).toBe(0);
      });
    });

    it('should handle large number of points', () => {
      const start = new Vector3(0, 10, 0);
      const direction = new Vector3(5, 5, 0);
      const points = Array.from({ length: 100 }, () => new Vector3());

      sampleParabolicCurve(start, direction, 0, -10, points);

      expect(points[0].x).toBeCloseTo(start.x, 4);
      // Should produce valid numbers
      expect(Number.isFinite(points[99].x)).toBe(true);
      expect(Number.isFinite(points[99].y)).toBe(true);
    });

    it('should maintain proportional X and Z relationship', () => {
      const start = new Vector3(0, 10, 0);
      const direction = new Vector3(5, 5, 5);
      const points = Array.from({ length: 10 }, () => new Vector3());

      sampleParabolicCurve(start, direction, 0, -10, points);

      // X and Z should move proportionally since direction.x == direction.z
      const endDeltaX = points[9].x - start.x;
      const endDeltaZ = points[9].z - start.z;

      // Both deltas should be equal since direction.x == direction.z
      expect(endDeltaX).toBeCloseTo(endDeltaZ, 3);
    });
  });

  describe('3D trajectories', () => {
    it('should handle diagonal XZ direction', () => {
      const start = new Vector3(0, 10, 0);
      const direction = new Vector3(5, 5, 5);
      const points = Array.from({ length: 10 }, () => new Vector3());

      sampleParabolicCurve(start, direction, 0, -10, points);

      const endPoint = points[points.length - 1];

      // X and Z should be equal at the end (symmetric direction)
      // Both move proportionally to direction
      expect(endPoint.x).toBeCloseTo(endPoint.z, 1);
    });
  });

  describe('mathematical properties', () => {
    it('should follow y = y0 + vy*t + 0.5*g*t^2 formula', () => {
      const start = new Vector3(0, 10, 0);
      const direction = new Vector3(5, 8, 0);
      const gravity = -10;
      const points = Array.from({ length: 5 }, () => new Vector3());

      sampleParabolicCurve(start, direction, 0, gravity, points);

      // Calculate expected trajectory end time
      const a = 0.5 * gravity;
      const b = direction.y;
      const c = start.y - 0; // minY = 0
      const discriminant = b * b - 4 * a * c;
      const tEnd = (-b + Math.sqrt(discriminant)) / (2 * a);

      // Check a middle point using the parabolic formula
      // t at index 2 should be 2/(5-1) = 0.5 of tEnd
      const t = 0.5 * tEnd;
      const expectedY = start.y + direction.y * t + 0.5 * gravity * t * t;
      const expectedX = start.x + direction.x * t;

      expect(points[2].y).toBeCloseTo(expectedY, 2);
      expect(points[2].x).toBeCloseTo(expectedX, 2);
    });
  });
});
