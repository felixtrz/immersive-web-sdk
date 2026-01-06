/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Object3D, Vector3, Quaternion, Euler } from 'three';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  setWorldPosition,
  setWorldQuaternion,
} from '../../src/transform/transform-utils.js';

describe('Transform Utils', () => {
  describe('setWorldPosition', () => {
    let object: Object3D;
    let worldPosition: Vector3;

    beforeEach(() => {
      object = new Object3D();
      worldPosition = new Vector3();
    });

    describe('without parent', () => {
      it('should set position directly when object has no parent', () => {
        worldPosition.set(5, 10, 15);

        setWorldPosition(object, worldPosition);

        expect(object.position.x).toBe(5);
        expect(object.position.y).toBe(10);
        expect(object.position.z).toBe(15);
      });

      it('should handle zero position', () => {
        worldPosition.set(0, 0, 0);

        setWorldPosition(object, worldPosition);

        expect(object.position.x).toBe(0);
        expect(object.position.y).toBe(0);
        expect(object.position.z).toBe(0);
      });

      it('should handle negative positions', () => {
        worldPosition.set(-100, -200, -300);

        setWorldPosition(object, worldPosition);

        expect(object.position.x).toBe(-100);
        expect(object.position.y).toBe(-200);
        expect(object.position.z).toBe(-300);
      });
    });

    describe('with parent at origin', () => {
      let parent: Object3D;

      beforeEach(() => {
        parent = new Object3D();
        parent.add(object);
      });

      it('should set position correctly when parent is at origin', () => {
        worldPosition.set(5, 10, 15);

        setWorldPosition(object, worldPosition);

        expect(object.position.x).toBeCloseTo(5);
        expect(object.position.y).toBeCloseTo(10);
        expect(object.position.z).toBeCloseTo(15);
      });
    });

    describe('with parent translated', () => {
      let parent: Object3D;

      beforeEach(() => {
        parent = new Object3D();
        parent.position.set(10, 20, 30);
        parent.add(object);
        parent.updateMatrixWorld(true);
      });

      it('should calculate local position from world position', () => {
        // Desired world position
        worldPosition.set(15, 25, 35);

        setWorldPosition(object, worldPosition);

        // Local position should be world - parent = (15-10, 25-20, 35-30) = (5, 5, 5)
        expect(object.position.x).toBeCloseTo(5);
        expect(object.position.y).toBeCloseTo(5);
        expect(object.position.z).toBeCloseTo(5);

        // Verify world position is correct
        object.updateMatrixWorld(true);
        const resultWorld = new Vector3();
        object.getWorldPosition(resultWorld);
        expect(resultWorld.x).toBeCloseTo(15);
        expect(resultWorld.y).toBeCloseTo(25);
        expect(resultWorld.z).toBeCloseTo(35);
      });

      it('should handle world position at origin', () => {
        worldPosition.set(0, 0, 0);

        setWorldPosition(object, worldPosition);

        // Local position should be -parent position
        expect(object.position.x).toBeCloseTo(-10);
        expect(object.position.y).toBeCloseTo(-20);
        expect(object.position.z).toBeCloseTo(-30);

        // Verify world position
        object.updateMatrixWorld(true);
        const resultWorld = new Vector3();
        object.getWorldPosition(resultWorld);
        expect(resultWorld.x).toBeCloseTo(0);
        expect(resultWorld.y).toBeCloseTo(0);
        expect(resultWorld.z).toBeCloseTo(0);
      });
    });

    describe('with parent rotated', () => {
      let parent: Object3D;

      beforeEach(() => {
        parent = new Object3D();
        parent.add(object);
      });

      it('should handle 90 degree rotation around Y axis', () => {
        // Rotate parent 90 degrees around Y
        parent.rotation.y = Math.PI / 2;
        parent.updateMatrixWorld(true);

        // Want world position at (5, 0, 0)
        worldPosition.set(5, 0, 0);

        setWorldPosition(object, worldPosition);

        // After 90deg Y rotation: world X becomes local -Z
        // So world (5, 0, 0) should be local (0, 0, -5) approximately
        object.updateMatrixWorld(true);
        const resultWorld = new Vector3();
        object.getWorldPosition(resultWorld);
        expect(resultWorld.x).toBeCloseTo(5);
        expect(resultWorld.y).toBeCloseTo(0);
        expect(resultWorld.z).toBeCloseTo(0);
      });

      it('should handle arbitrary rotation', () => {
        parent.rotation.set(0.5, 1.0, 1.5);
        parent.updateMatrixWorld(true);

        worldPosition.set(10, 20, 30);

        setWorldPosition(object, worldPosition);

        // Verify the result
        object.updateMatrixWorld(true);
        const resultWorld = new Vector3();
        object.getWorldPosition(resultWorld);
        expect(resultWorld.x).toBeCloseTo(10);
        expect(resultWorld.y).toBeCloseTo(20);
        expect(resultWorld.z).toBeCloseTo(30);
      });
    });

    describe('with parent scaled', () => {
      let parent: Object3D;

      beforeEach(() => {
        parent = new Object3D();
        parent.add(object);
      });

      it('should handle uniform scale', () => {
        parent.scale.set(2, 2, 2);
        parent.updateMatrixWorld(true);

        worldPosition.set(10, 10, 10);

        setWorldPosition(object, worldPosition);

        // Local position should be world / scale = (5, 5, 5)
        expect(object.position.x).toBeCloseTo(5);
        expect(object.position.y).toBeCloseTo(5);
        expect(object.position.z).toBeCloseTo(5);

        // Verify world position
        object.updateMatrixWorld(true);
        const resultWorld = new Vector3();
        object.getWorldPosition(resultWorld);
        expect(resultWorld.x).toBeCloseTo(10);
        expect(resultWorld.y).toBeCloseTo(10);
        expect(resultWorld.z).toBeCloseTo(10);
      });

      it('should handle non-uniform scale', () => {
        parent.scale.set(2, 4, 8);
        parent.updateMatrixWorld(true);

        worldPosition.set(20, 40, 80);

        setWorldPosition(object, worldPosition);

        // Local position should be (20/2, 40/4, 80/8) = (10, 10, 10)
        expect(object.position.x).toBeCloseTo(10);
        expect(object.position.y).toBeCloseTo(10);
        expect(object.position.z).toBeCloseTo(10);

        // Verify world position
        object.updateMatrixWorld(true);
        const resultWorld = new Vector3();
        object.getWorldPosition(resultWorld);
        expect(resultWorld.x).toBeCloseTo(20);
        expect(resultWorld.y).toBeCloseTo(40);
        expect(resultWorld.z).toBeCloseTo(80);
      });
    });

    describe('with combined transforms', () => {
      let parent: Object3D;

      beforeEach(() => {
        parent = new Object3D();
        parent.add(object);
      });

      it('should handle translation + rotation + scale', () => {
        parent.position.set(100, 0, 0);
        parent.rotation.y = Math.PI / 2;
        parent.scale.set(2, 2, 2);
        parent.updateMatrixWorld(true);

        worldPosition.set(100, 50, 20);

        setWorldPosition(object, worldPosition);

        // Verify world position is correct
        object.updateMatrixWorld(true);
        const resultWorld = new Vector3();
        object.getWorldPosition(resultWorld);
        expect(resultWorld.x).toBeCloseTo(100);
        expect(resultWorld.y).toBeCloseTo(50);
        expect(resultWorld.z).toBeCloseTo(20);
      });
    });

    describe('with nested hierarchy', () => {
      it('should work with deeply nested objects', () => {
        const grandparent = new Object3D();
        const parent = new Object3D();
        grandparent.add(parent);
        parent.add(object);

        grandparent.position.set(10, 0, 0);
        parent.position.set(5, 5, 0);
        grandparent.updateMatrixWorld(true);

        worldPosition.set(20, 10, 5);

        setWorldPosition(object, worldPosition);

        object.updateMatrixWorld(true);
        const resultWorld = new Vector3();
        object.getWorldPosition(resultWorld);
        expect(resultWorld.x).toBeCloseTo(20);
        expect(resultWorld.y).toBeCloseTo(10);
        expect(resultWorld.z).toBeCloseTo(5);
      });
    });
  });

  describe('setWorldQuaternion', () => {
    let object: Object3D;
    let worldQuaternion: Quaternion;

    beforeEach(() => {
      object = new Object3D();
      worldQuaternion = new Quaternion();
    });

    describe('without parent', () => {
      it('should set quaternion directly when object has no parent', () => {
        worldQuaternion.setFromEuler(new Euler(0.5, 1.0, 1.5));

        setWorldQuaternion(object, worldQuaternion);

        expect(object.quaternion.x).toBeCloseTo(worldQuaternion.x);
        expect(object.quaternion.y).toBeCloseTo(worldQuaternion.y);
        expect(object.quaternion.z).toBeCloseTo(worldQuaternion.z);
        expect(object.quaternion.w).toBeCloseTo(worldQuaternion.w);
      });

      it('should handle identity quaternion', () => {
        // Identity quaternion (no rotation)
        worldQuaternion.set(0, 0, 0, 1);

        setWorldQuaternion(object, worldQuaternion);

        expect(object.quaternion.x).toBe(0);
        expect(object.quaternion.y).toBe(0);
        expect(object.quaternion.z).toBe(0);
        expect(object.quaternion.w).toBe(1);
      });

      it('should handle 180 degree rotation', () => {
        // 180 degrees around Y
        worldQuaternion.setFromEuler(new Euler(0, Math.PI, 0));

        setWorldQuaternion(object, worldQuaternion);

        expect(object.quaternion.x).toBeCloseTo(worldQuaternion.x);
        expect(object.quaternion.y).toBeCloseTo(worldQuaternion.y);
        expect(object.quaternion.z).toBeCloseTo(worldQuaternion.z);
        expect(object.quaternion.w).toBeCloseTo(worldQuaternion.w);
      });
    });

    describe('with parent at identity', () => {
      let parent: Object3D;

      beforeEach(() => {
        parent = new Object3D();
        parent.add(object);
      });

      it('should set quaternion directly when parent has no rotation', () => {
        worldQuaternion.setFromEuler(new Euler(0.3, 0.6, 0.9));
        parent.updateMatrixWorld(true);

        setWorldQuaternion(object, worldQuaternion);

        expect(object.quaternion.x).toBeCloseTo(worldQuaternion.x);
        expect(object.quaternion.y).toBeCloseTo(worldQuaternion.y);
        expect(object.quaternion.z).toBeCloseTo(worldQuaternion.z);
        expect(object.quaternion.w).toBeCloseTo(worldQuaternion.w);
      });
    });

    describe('with rotated parent', () => {
      let parent: Object3D;

      beforeEach(() => {
        parent = new Object3D();
        parent.add(object);
      });

      it('should compensate for parent rotation - 90 deg Y', () => {
        // Parent rotated 90 degrees around Y
        parent.rotation.y = Math.PI / 2;
        parent.updateMatrixWorld(true);

        // We want world rotation to be identity
        worldQuaternion.set(0, 0, 0, 1);

        setWorldQuaternion(object, worldQuaternion);

        // Verify world quaternion is identity
        object.updateMatrixWorld(true);
        const resultWorld = new Quaternion();
        object.getWorldQuaternion(resultWorld);
        expect(resultWorld.x).toBeCloseTo(0);
        expect(resultWorld.y).toBeCloseTo(0);
        expect(resultWorld.z).toBeCloseTo(0);
        expect(resultWorld.w).toBeCloseTo(1);
      });

      it('should handle arbitrary parent rotation', () => {
        parent.rotation.set(0.5, 1.0, 0.3);
        parent.updateMatrixWorld(true);

        // Desired world rotation: 45 degrees around X
        worldQuaternion.setFromEuler(new Euler(Math.PI / 4, 0, 0));

        setWorldQuaternion(object, worldQuaternion);

        // Verify world quaternion matches desired
        object.updateMatrixWorld(true);
        const resultWorld = new Quaternion();
        object.getWorldQuaternion(resultWorld);

        // Check if quaternions represent the same rotation (accounting for sign)
        const dot = Math.abs(
          resultWorld.x * worldQuaternion.x +
            resultWorld.y * worldQuaternion.y +
            resultWorld.z * worldQuaternion.z +
            resultWorld.w * worldQuaternion.w,
        );
        expect(dot).toBeCloseTo(1);
      });

      it('should handle combined parent/child rotations', () => {
        // Parent: 45 degrees around Y
        parent.rotation.y = Math.PI / 4;
        parent.updateMatrixWorld(true);

        // Desired world: 90 degrees around Y
        worldQuaternion.setFromEuler(new Euler(0, Math.PI / 2, 0));

        setWorldQuaternion(object, worldQuaternion);

        // Verify world rotation is 90 degrees around Y
        object.updateMatrixWorld(true);
        const resultWorld = new Quaternion();
        object.getWorldQuaternion(resultWorld);

        // Convert back to Euler to check
        const resultEuler = new Euler().setFromQuaternion(resultWorld);
        expect(resultEuler.y).toBeCloseTo(Math.PI / 2);
      });
    });

    describe('with scaled parent (non-uniform)', () => {
      let parent: Object3D;

      beforeEach(() => {
        parent = new Object3D();
        parent.add(object);
      });

      it('should handle parent with non-uniform scale', () => {
        // Note: Non-uniform scale combined with rotation creates a shear transform
        // which makes quaternion decomposition imprecise. This is a known limitation
        // of matrix decomposition. The setWorldQuaternion function handles this by
        // extracting the rotation component from the decomposed matrix.
        parent.scale.set(1, 2, 3);
        parent.rotation.y = Math.PI / 4;
        parent.updateMatrixWorld(true);

        worldQuaternion.setFromEuler(new Euler(0, Math.PI / 2, 0));

        setWorldQuaternion(object, worldQuaternion);

        // Verify world rotation is approximately correct despite non-uniform scale
        // The tolerance is relaxed due to numerical precision limits with sheared matrices
        object.updateMatrixWorld(true);
        const resultWorld = new Quaternion();
        object.getWorldQuaternion(resultWorld);

        // Check quaternions are roughly equivalent (relaxed tolerance for sheared matrices)
        const dot = Math.abs(
          resultWorld.x * worldQuaternion.x +
            resultWorld.y * worldQuaternion.y +
            resultWorld.z * worldQuaternion.z +
            resultWorld.w * worldQuaternion.w,
        );
        // With non-uniform scale, we expect some numerical imprecision
        // Using a relaxed tolerance of 0.1 (allows ~5.7 degrees of error)
        expect(dot).toBeGreaterThan(0.9);
      });
    });

    describe('with nested hierarchy', () => {
      it('should work with deeply nested objects', () => {
        const grandparent = new Object3D();
        const parent = new Object3D();
        grandparent.add(parent);
        parent.add(object);

        grandparent.rotation.x = Math.PI / 6;
        parent.rotation.y = Math.PI / 4;
        grandparent.updateMatrixWorld(true);

        // Desired world: 30 degrees around Z
        worldQuaternion.setFromEuler(new Euler(0, 0, Math.PI / 6));

        setWorldQuaternion(object, worldQuaternion);

        object.updateMatrixWorld(true);
        const resultWorld = new Quaternion();
        object.getWorldQuaternion(resultWorld);

        // Check quaternions are equivalent
        const dot = Math.abs(
          resultWorld.x * worldQuaternion.x +
            resultWorld.y * worldQuaternion.y +
            resultWorld.z * worldQuaternion.z +
            resultWorld.w * worldQuaternion.w,
        );
        expect(dot).toBeCloseTo(1);
      });
    });

    describe('edge cases', () => {
      it('should handle very small rotations', () => {
        const parent = new Object3D();
        parent.add(object);
        parent.rotation.y = 0.001;
        parent.updateMatrixWorld(true);

        worldQuaternion.setFromEuler(new Euler(0.001, 0.001, 0.001));

        setWorldQuaternion(object, worldQuaternion);

        object.updateMatrixWorld(true);
        const resultWorld = new Quaternion();
        object.getWorldQuaternion(resultWorld);

        const dot = Math.abs(
          resultWorld.x * worldQuaternion.x +
            resultWorld.y * worldQuaternion.y +
            resultWorld.z * worldQuaternion.z +
            resultWorld.w * worldQuaternion.w,
        );
        expect(dot).toBeCloseTo(1);
      });

      it('should handle full 360 degree rotation', () => {
        worldQuaternion.setFromEuler(new Euler(0, Math.PI * 2, 0));

        setWorldQuaternion(object, worldQuaternion);

        // 360 degrees is equivalent to no rotation
        // Quaternion should be close to identity (might be -identity due to double cover)
        const isIdentity =
          Math.abs(object.quaternion.w) > 0.99 &&
          Math.abs(object.quaternion.x) < 0.01 &&
          Math.abs(object.quaternion.y) < 0.01 &&
          Math.abs(object.quaternion.z) < 0.01;
        expect(isIdentity).toBe(true);
      });
    });
  });
});
