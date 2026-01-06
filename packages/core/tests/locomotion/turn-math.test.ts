/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { MathUtils, Vector3, Quaternion, Euler } from 'three';

/**
 * Locomotion Math Tests
 *
 * Tests for the pure math functions used in locomotion systems:
 * - Turn angle conversions (degrees to radians)
 * - Lerp functions for smooth movement
 * - Vector normalization and scaling
 */

describe('Locomotion Math', () => {
  describe('turn angle conversion', () => {
    /**
     * The TurnSystem converts degrees to radians for rotation:
     * turningSpeedRadian = (turningSpeed / 180) * Math.PI
     * turningAngleRadian = (turningAngle / 180) * Math.PI
     */

    it('should convert 45 degrees to radians correctly', () => {
      const degrees = 45;
      const radians = (degrees / 180) * Math.PI;

      expect(radians).toBeCloseTo(Math.PI / 4);
    });

    it('should convert 90 degrees to radians correctly', () => {
      const degrees = 90;
      const radians = (degrees / 180) * Math.PI;

      expect(radians).toBeCloseTo(Math.PI / 2);
    });

    it('should convert 180 degrees to radians correctly', () => {
      const degrees = 180;
      const radians = (degrees / 180) * Math.PI;

      expect(radians).toBeCloseTo(Math.PI);
    });

    it('should convert 360 degrees to radians correctly', () => {
      const degrees = 360;
      const radians = (degrees / 180) * Math.PI;

      expect(radians).toBeCloseTo(Math.PI * 2);
    });

    it('should handle negative angles', () => {
      const degrees = -45;
      const radians = (degrees / 180) * Math.PI;

      expect(radians).toBeCloseTo(-Math.PI / 4);
    });

    it('should handle zero angle', () => {
      const degrees = 0;
      const radians = (degrees / 180) * Math.PI;

      expect(radians).toBe(0);
    });

    it('should match MathUtils.degToRad', () => {
      const testAngles = [0, 30, 45, 60, 90, 120, 180, 270, 360];

      testAngles.forEach((degrees) => {
        const manualRadians = (degrees / 180) * Math.PI;
        const utilRadians = MathUtils.degToRad(degrees);

        expect(manualRadians).toBeCloseTo(utilRadians);
      });
    });
  });

  describe('smooth turn calculation', () => {
    /**
     * Smooth turning applies rotation over time:
     * rotationAmount = turningSpeedRadian * delta
     */

    it('should calculate rotation for smooth turn', () => {
      const turningSpeedDegrees = 180; // degrees per second
      const turningSpeedRadian = (turningSpeedDegrees / 180) * Math.PI;
      const delta = 0.016; // ~60fps

      const rotationAmount = turningSpeedRadian * delta;

      // At 180 deg/s and 60fps, should rotate ~3 degrees per frame
      expect(MathUtils.radToDeg(rotationAmount)).toBeCloseTo(2.88, 1);
    });

    it('should accumulate rotation over time', () => {
      const turningSpeedDegrees = 90;
      const turningSpeedRadian = (turningSpeedDegrees / 180) * Math.PI;
      const delta = 0.1; // 100ms

      // After 1 second (10 frames)
      let totalRotation = 0;
      for (let i = 0; i < 10; i++) {
        totalRotation += turningSpeedRadian * delta;
      }

      expect(MathUtils.radToDeg(totalRotation)).toBeCloseTo(90, 0);
    });
  });

  describe('snap turn calculation', () => {
    /**
     * Snap turning applies fixed rotation instantly:
     * rotationAmount = turningAngleRadian (applied once per input)
     */

    it('should calculate 45 degree snap turn', () => {
      const turningAngle = 45;
      const turningAngleRadian = (turningAngle / 180) * Math.PI;

      expect(turningAngleRadian).toBeCloseTo(Math.PI / 4);
    });

    it('should apply snap turn to quaternion', () => {
      const turningAngle = 90;
      const turningAngleRadian = (turningAngle / 180) * Math.PI;

      const quat = new Quaternion();
      const euler = new Euler(0, turningAngleRadian, 0, 'YXZ');
      quat.setFromEuler(euler);

      // Extract Y rotation back
      const resultEuler = new Euler().setFromQuaternion(quat, 'YXZ');
      expect(MathUtils.radToDeg(resultEuler.y)).toBeCloseTo(90);
    });
  });

  describe('lerp functions', () => {
    /**
     * Lerp is used for smooth visual transitions
     */

    it('should lerp vector towards target', () => {
      const current = new Vector3(0, 0, 0);
      const target = new Vector3(10, 10, 10);
      const alpha = 0.5;

      current.lerp(target, alpha);

      expect(current.x).toBeCloseTo(5);
      expect(current.y).toBeCloseTo(5);
      expect(current.z).toBeCloseTo(5);
    });

    it('should lerp with small alpha for smooth movement', () => {
      const current = new Vector3(0, 0, 0);
      const target = new Vector3(1, 0, 0);
      const delta = 0.016;
      const speed = 5;
      const alpha = delta * speed;

      current.lerp(target, alpha);

      expect(current.x).toBeCloseTo(0.08, 2);
    });

    it('should converge to target with repeated lerp', () => {
      const current = new Vector3(0, 0, 0);
      const target = new Vector3(10, 0, 0);
      const alpha = 0.1;

      for (let i = 0; i < 50; i++) {
        current.lerp(target, alpha);
      }

      expect(current.x).toBeCloseTo(10, 0);
    });

    it('should lerp scale for visual effects', () => {
      const scale = new Vector3(1.5, 1.5, 1.5);
      const unitScale = new Vector3(1, 1, 1);
      const delta = 0.016;

      scale.lerp(unitScale, 5 * delta);

      expect(scale.x).toBeLessThan(1.5);
      expect(scale.x).toBeGreaterThan(1);
    });

    it('should slerp quaternion for rotation', () => {
      const current = new Quaternion();
      const target = new Quaternion().setFromEuler(new Euler(0, Math.PI / 2, 0));
      const alpha = 0.5;

      current.slerp(target, alpha);

      const euler = new Euler().setFromQuaternion(current, 'YXZ');
      expect(MathUtils.radToDeg(euler.y)).toBeCloseTo(45);
    });
  });

  describe('input normalization', () => {
    /**
     * Used in slide system for movement direction
     */

    it('should normalize input vector', () => {
      const input = new Vector3(3, 0, 4);
      input.normalize();

      expect(input.length()).toBeCloseTo(1);
      expect(input.x).toBeCloseTo(0.6);
      expect(input.z).toBeCloseTo(0.8);
    });

    it('should scale normalized input by speed', () => {
      const input = new Vector3(1, 0, 1);
      input.normalize();
      const speed = 2;

      input.multiplyScalar(speed);

      expect(input.length()).toBeCloseTo(2);
    });

    it('should handle zero input gracefully', () => {
      const input = new Vector3(0, 0, 0);

      // Check length before normalizing
      if (input.length() > 0) {
        input.normalize();
      }

      expect(input.length()).toBe(0);
    });
  });

  describe('vignette alpha calculation', () => {
    /**
     * Vignette alpha is lerped based on movement for visual comfort
     */

    it('should lerp alpha towards target', () => {
      let currentAlpha = 0;
      const targetAlpha = 0.5;
      const delta = 0.016;

      // alpha = lerp(current, target, delta * 10)
      currentAlpha = MathUtils.lerp(currentAlpha, targetAlpha, delta * 10);

      expect(currentAlpha).toBeGreaterThan(0);
      expect(currentAlpha).toBeLessThan(targetAlpha);
    });

    it('should map input magnitude to vignette intensity', () => {
      const inputMagnitudes = [0, 0.5, 1.0];
      const maxVignetteAlpha = 0.3;

      inputMagnitudes.forEach((magnitude) => {
        const vignetteTarget = magnitude * maxVignetteAlpha;
        expect(vignetteTarget).toBeLessThanOrEqual(maxVignetteAlpha);
      });
    });
  });

  describe('tolerance calculations', () => {
    /**
     * Used in Follow system to determine when to update position
     */

    it('should calculate distance for tolerance check', () => {
      const current = new Vector3(0, 0, 0);
      const target = new Vector3(0.5, 0, 0);
      const tolerance = 0.4;

      const distance = current.distanceTo(target);

      expect(distance > tolerance).toBe(true);
    });

    it('should calculate angle deviation', () => {
      const forward = new Vector3(0, 0, -1);
      const direction = new Vector3(1, 0, -1).normalize();

      const dotProduct = forward.dot(direction);
      const angle = Math.acos(dotProduct);
      const angleDegrees = MathUtils.radToDeg(angle);

      expect(angleDegrees).toBeCloseTo(45);
    });

    it('should check if within max angle', () => {
      const maxAngle = 30;
      const actualAngle = 25;

      expect(actualAngle <= maxAngle).toBe(true);
    });

    it('should trigger update when beyond tolerance', () => {
      const distance = 0.5;
      const tolerance = 0.4;
      const angle = 35;
      const maxAngle = 30;

      const shouldUpdate = distance > tolerance || angle > maxAngle;

      expect(shouldUpdate).toBe(true);
    });
  });
});
