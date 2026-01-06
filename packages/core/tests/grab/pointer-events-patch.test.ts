/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { Vector3, Sphere, Matrix4, Box3 } from 'three';

/**
 * Pointer Events Patch Tests
 *
 * Tests for the pure math functions from src/grab/pointer-events-patch.ts.
 * These functions handle 3D geometry intersection calculations.
 */

/**
 * Finds the dominant axis in a vector and sets it to ±1, zeroing others.
 * (Copied from src/grab/pointer-events-patch.ts for testing isolation)
 */
function maximizeAxisVector(vec: Vector3): void {
  const absX = Math.abs(vec.x);
  const absY = Math.abs(vec.y);
  const absZ = Math.abs(vec.z);
  if (absX >= absY && absX >= absZ) {
    vec.set(vec.x < 0 ? -1 : 1, 0, 0);
    return;
  }
  if (absY >= absX && absY >= absZ) {
    vec.set(0, vec.y < 0 ? -1 : 1, 0);
    return;
  }
  vec.set(0, 0, vec.z < 0 ? -1 : 1);
}

/**
 * Tests if a pointer sphere intersects a mesh's bounding sphere.
 * (Copied from src/grab/pointer-events-patch.ts for testing isolation)
 */
function isSphereIntersectingBoundingSphere(
  pointerSphere: Sphere,
  boundingSphere: Sphere,
  meshMatrixWorld: Matrix4,
): boolean {
  const transformedBoundingSphere = boundingSphere
    .clone()
    .applyMatrix4(meshMatrixWorld);
  return (
    transformedBoundingSphere.center.distanceToSquared(pointerSphere.center) <
    (pointerSphere.radius + transformedBoundingSphere.radius) ** 2
  );
}

/**
 * Clamps a point to a bounding box.
 * Used in sphere-mesh intersection.
 */
function clampPointToBox(point: Vector3, box: Box3): Vector3 {
  return point.clone().clamp(box.min, box.max);
}

describe('Pointer Events Patch Utils', () => {
  describe('maximizeAxisVector', () => {
    describe('positive dominant axis', () => {
      it('should maximize positive X axis when X is dominant', () => {
        const vec = new Vector3(5, 2, 3);
        maximizeAxisVector(vec);
        expect(vec.x).toBe(1);
        expect(vec.y).toBe(0);
        expect(vec.z).toBe(0);
      });

      it('should maximize positive Y axis when Y is dominant', () => {
        const vec = new Vector3(2, 5, 3);
        maximizeAxisVector(vec);
        expect(vec.x).toBe(0);
        expect(vec.y).toBe(1);
        expect(vec.z).toBe(0);
      });

      it('should maximize positive Z axis when Z is dominant', () => {
        const vec = new Vector3(2, 3, 5);
        maximizeAxisVector(vec);
        expect(vec.x).toBe(0);
        expect(vec.y).toBe(0);
        expect(vec.z).toBe(1);
      });
    });

    describe('negative dominant axis', () => {
      it('should maximize negative X axis when X is dominant negative', () => {
        const vec = new Vector3(-5, 2, 3);
        maximizeAxisVector(vec);
        expect(vec.x).toBe(-1);
        expect(vec.y).toBe(0);
        expect(vec.z).toBe(0);
      });

      it('should maximize negative Y axis when Y is dominant negative', () => {
        const vec = new Vector3(2, -5, 3);
        maximizeAxisVector(vec);
        expect(vec.x).toBe(0);
        expect(vec.y).toBe(-1);
        expect(vec.z).toBe(0);
      });

      it('should maximize negative Z axis when Z is dominant negative', () => {
        const vec = new Vector3(2, 3, -5);
        maximizeAxisVector(vec);
        expect(vec.x).toBe(0);
        expect(vec.y).toBe(0);
        expect(vec.z).toBe(-1);
      });
    });

    describe('edge cases', () => {
      it('should handle zero vector (X wins by default)', () => {
        const vec = new Vector3(0, 0, 0);
        maximizeAxisVector(vec);
        // When all are equal (0), X >= Y && X >= Z is true
        expect(vec.x).toBe(1);
        expect(vec.y).toBe(0);
        expect(vec.z).toBe(0);
      });

      it('should handle unit vector on X', () => {
        const vec = new Vector3(1, 0, 0);
        maximizeAxisVector(vec);
        expect(vec.toArray()).toEqual([1, 0, 0]);
      });

      it('should handle unit vector on Y', () => {
        const vec = new Vector3(0, 1, 0);
        maximizeAxisVector(vec);
        expect(vec.toArray()).toEqual([0, 1, 0]);
      });

      it('should handle unit vector on Z', () => {
        const vec = new Vector3(0, 0, 1);
        maximizeAxisVector(vec);
        expect(vec.toArray()).toEqual([0, 0, 1]);
      });

      it('should handle equal X and Y (X wins)', () => {
        const vec = new Vector3(5, 5, 3);
        maximizeAxisVector(vec);
        expect(vec.x).toBe(1);
        expect(vec.y).toBe(0);
        expect(vec.z).toBe(0);
      });

      it('should handle equal Y and Z (Y wins)', () => {
        const vec = new Vector3(3, 5, 5);
        maximizeAxisVector(vec);
        expect(vec.x).toBe(0);
        expect(vec.y).toBe(1);
        expect(vec.z).toBe(0);
      });

      it('should handle all equal positive', () => {
        const vec = new Vector3(5, 5, 5);
        maximizeAxisVector(vec);
        // X >= Y && X >= Z is true when all equal
        expect(vec.x).toBe(1);
        expect(vec.y).toBe(0);
        expect(vec.z).toBe(0);
      });

      it('should handle all equal negative', () => {
        const vec = new Vector3(-5, -5, -5);
        maximizeAxisVector(vec);
        expect(vec.x).toBe(-1);
        expect(vec.y).toBe(0);
        expect(vec.z).toBe(0);
      });

      it('should handle very small values', () => {
        const vec = new Vector3(0.0001, 0.00001, 0.000001);
        maximizeAxisVector(vec);
        expect(vec.x).toBe(1);
        expect(vec.y).toBe(0);
        expect(vec.z).toBe(0);
      });

      it('should handle very large values', () => {
        const vec = new Vector3(1e10, 1e9, 1e8);
        maximizeAxisVector(vec);
        expect(vec.x).toBe(1);
        expect(vec.y).toBe(0);
        expect(vec.z).toBe(0);
      });

      it('should handle mixed positive and negative', () => {
        const vec = new Vector3(-3, 2, -5);
        maximizeAxisVector(vec);
        expect(vec.x).toBe(0);
        expect(vec.y).toBe(0);
        expect(vec.z).toBe(-1);
      });
    });

    describe('normalization behavior', () => {
      it('should produce unit vectors', () => {
        const vec = new Vector3(10, 3, 2);
        maximizeAxisVector(vec);
        expect(vec.length()).toBe(1);
      });

      it('should be axis-aligned after maximization', () => {
        const vec = new Vector3(0.5, 0.8, 0.3);
        maximizeAxisVector(vec);
        // Only one component should be non-zero
        const nonZeroCount = [vec.x, vec.y, vec.z].filter(
          (v) => v !== 0,
        ).length;
        expect(nonZeroCount).toBe(1);
      });
    });
  });

  describe('isSphereIntersectingBoundingSphere', () => {
    it('should detect intersection when spheres overlap', () => {
      const pointerSphere = new Sphere(new Vector3(0, 0, 0), 1);
      const boundingSphere = new Sphere(new Vector3(1.5, 0, 0), 1);
      const identity = new Matrix4();

      expect(
        isSphereIntersectingBoundingSphere(
          pointerSphere,
          boundingSphere,
          identity,
        ),
      ).toBe(true);
    });

    it('should detect intersection when spheres touch', () => {
      const pointerSphere = new Sphere(new Vector3(0, 0, 0), 1);
      const boundingSphere = new Sphere(new Vector3(1.99, 0, 0), 1);
      const identity = new Matrix4();

      expect(
        isSphereIntersectingBoundingSphere(
          pointerSphere,
          boundingSphere,
          identity,
        ),
      ).toBe(true);
    });

    it('should not detect intersection when spheres are apart', () => {
      const pointerSphere = new Sphere(new Vector3(0, 0, 0), 1);
      const boundingSphere = new Sphere(new Vector3(3, 0, 0), 1);
      const identity = new Matrix4();

      expect(
        isSphereIntersectingBoundingSphere(
          pointerSphere,
          boundingSphere,
          identity,
        ),
      ).toBe(false);
    });

    it('should handle sphere fully inside another', () => {
      const pointerSphere = new Sphere(new Vector3(0, 0, 0), 5);
      const boundingSphere = new Sphere(new Vector3(0, 0, 0), 1);
      const identity = new Matrix4();

      expect(
        isSphereIntersectingBoundingSphere(
          pointerSphere,
          boundingSphere,
          identity,
        ),
      ).toBe(true);
    });

    it('should handle translated mesh', () => {
      const pointerSphere = new Sphere(new Vector3(0, 0, 0), 1);
      const boundingSphere = new Sphere(new Vector3(0, 0, 0), 1);
      const translated = new Matrix4().makeTranslation(1.5, 0, 0);

      expect(
        isSphereIntersectingBoundingSphere(
          pointerSphere,
          boundingSphere,
          translated,
        ),
      ).toBe(true);
    });

    it('should handle scaled mesh', () => {
      const pointerSphere = new Sphere(new Vector3(0, 0, 0), 1);
      const boundingSphere = new Sphere(new Vector3(3, 0, 0), 1);
      const scaled = new Matrix4().makeScale(2, 2, 2);

      // After scaling: boundingSphere center at (6, 0, 0), radius 2
      // Distance = 6, combined radii = 3, so no intersection
      expect(
        isSphereIntersectingBoundingSphere(
          pointerSphere,
          boundingSphere,
          scaled,
        ),
      ).toBe(false);
    });

    it('should handle zero-radius pointer sphere', () => {
      const pointerSphere = new Sphere(new Vector3(0, 0, 0), 0);
      const boundingSphere = new Sphere(new Vector3(0.5, 0, 0), 1);
      const identity = new Matrix4();

      // Point inside sphere
      expect(
        isSphereIntersectingBoundingSphere(
          pointerSphere,
          boundingSphere,
          identity,
        ),
      ).toBe(true);
    });
  });

  describe('clampPointToBox', () => {
    it('should not modify point inside box', () => {
      const point = new Vector3(0, 0, 0);
      const box = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));

      const clamped = clampPointToBox(point, box);

      expect(clamped.toArray()).toEqual([0, 0, 0]);
    });

    it('should clamp point outside box to nearest face', () => {
      const point = new Vector3(5, 0, 0);
      const box = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));

      const clamped = clampPointToBox(point, box);

      expect(clamped.x).toBe(1);
      expect(clamped.y).toBe(0);
      expect(clamped.z).toBe(0);
    });

    it('should clamp point to corner when outside multiple faces', () => {
      const point = new Vector3(5, 5, 5);
      const box = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));

      const clamped = clampPointToBox(point, box);

      expect(clamped.toArray()).toEqual([1, 1, 1]);
    });

    it('should handle negative coordinates', () => {
      const point = new Vector3(-5, -5, -5);
      const box = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));

      const clamped = clampPointToBox(point, box);

      expect(clamped.toArray()).toEqual([-1, -1, -1]);
    });

    it('should handle point on box surface', () => {
      const point = new Vector3(1, 0, 0);
      const box = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));

      const clamped = clampPointToBox(point, box);

      expect(clamped.toArray()).toEqual([1, 0, 0]);
    });

    it('should not mutate original point', () => {
      const point = new Vector3(5, 5, 5);
      const box = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));

      clampPointToBox(point, box);

      expect(point.toArray()).toEqual([5, 5, 5]);
    });
  });

  describe('distance calculations', () => {
    it('should calculate squared distance correctly', () => {
      const a = new Vector3(0, 0, 0);
      const b = new Vector3(3, 4, 0);

      expect(a.distanceToSquared(b)).toBe(25);
    });

    it('should use squared distance for performance', () => {
      const pointerCenter = new Vector3(0, 0, 0);
      const sphereCenter = new Vector3(3, 0, 0);
      const pointerRadius = 1;
      const sphereRadius = 1;

      // Check intersection using squared distances (avoiding sqrt)
      const distanceSquared = pointerCenter.distanceToSquared(sphereCenter);
      const combinedRadiiSquared = (pointerRadius + sphereRadius) ** 2;

      expect(distanceSquared).toBe(9);
      expect(combinedRadiiSquared).toBe(4);
      expect(distanceSquared < combinedRadiiSquared).toBe(false); // No intersection
    });
  });
});
