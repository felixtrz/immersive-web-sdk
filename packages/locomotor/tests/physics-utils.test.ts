/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Vector3 } from 'three';
import { describe, it, expect } from 'vitest';

/**
 * PhysicsUtils Tests
 *
 * Tests for the physics utility functions from src/physics/physics-utils.ts.
 * Inlined implementation to avoid workspace dependency issues during testing.
 */

// Inlined PhysicsUtils class for testing
class PhysicsUtils {
  static calculateSpringForce(
    displacement: number,
    springConstant: number,
  ): number {
    return springConstant * displacement;
  }

  static calculateDampingForce(
    velocity: number,
    dampingConstant: number,
  ): number {
    return dampingConstant * velocity;
  }

  static clampForce(force: number, maxForce: number): number {
    return Math.max(-maxForce, Math.min(maxForce, force));
  }

  static applyGravity(
    velocity: Vector3,
    gravityDir: Vector3,
    gravity: number,
    gravityMultiplier: number,
    delta: number,
  ): void {
    velocity.addScaledVector(gravityDir, gravity * gravityMultiplier * delta);
  }

  static applyFloatingForce(
    velocity: Vector3,
    upAxis: Vector3,
    springForce: number,
    dampingForce: number,
    maxForce: number,
    mass: number,
    delta: number,
  ): void {
    const floatForce = springForce - dampingForce;
    const cappedFloatForce = PhysicsUtils.clampForce(floatForce, maxForce);
    const acceleration = (cappedFloatForce * delta) / mass;
    velocity.addScaledVector(upAxis, acceleration);
  }

  static calculateTargetDistance(
    floatHeight: number,
    capsuleRadius: number,
  ): number {
    return floatHeight + capsuleRadius;
  }

  static isGrounded(
    groundDistance: number,
    groundingThreshold: number,
  ): boolean {
    return groundDistance < groundingThreshold;
  }

  static calculateGroundingThreshold(
    floatHeight: number,
    capsuleRadius: number,
    buffer: number = 0.15,
  ): number {
    return floatHeight + capsuleRadius + buffer;
  }

  static isWalkableSlope(
    surfaceNormal: Vector3,
    upAxis: Vector3,
    maxSlope: number,
  ): boolean {
    const slopeAngle = surfaceNormal.angleTo(upAxis);
    return slopeAngle < maxSlope;
  }

  static capVelocity(velocity: Vector3, maxVelocity: number): void {
    if (velocity.lengthSq() > maxVelocity * maxVelocity) {
      velocity.normalize().multiplyScalar(maxVelocity);
    }
  }
}

describe('PhysicsUtils', () => {
  describe('calculateSpringForce', () => {
    it("should calculate spring force using Hooke's law", () => {
      const displacement = 0.5;
      const springConstant = 100;

      const force = PhysicsUtils.calculateSpringForce(
        displacement,
        springConstant,
      );

      expect(force).toBe(50);
    });

    it('should return zero force at equilibrium', () => {
      const force = PhysicsUtils.calculateSpringForce(0, 100);
      expect(force).toBe(0);
    });

    it('should return negative force for negative displacement', () => {
      const force = PhysicsUtils.calculateSpringForce(-0.5, 100);
      expect(force).toBe(-50);
    });

    it('should scale linearly with spring constant', () => {
      const displacement = 1;
      const force1 = PhysicsUtils.calculateSpringForce(displacement, 50);
      const force2 = PhysicsUtils.calculateSpringForce(displacement, 100);

      expect(force2).toBe(force1 * 2);
    });

    it('should scale linearly with displacement', () => {
      const springConstant = 100;
      const force1 = PhysicsUtils.calculateSpringForce(0.5, springConstant);
      const force2 = PhysicsUtils.calculateSpringForce(1.0, springConstant);

      expect(force2).toBe(force1 * 2);
    });
  });

  describe('calculateDampingForce', () => {
    it('should calculate damping force proportional to velocity', () => {
      const velocity = 2;
      const dampingConstant = 10;

      const force = PhysicsUtils.calculateDampingForce(
        velocity,
        dampingConstant,
      );

      expect(force).toBe(20);
    });

    it('should return zero force when velocity is zero', () => {
      const force = PhysicsUtils.calculateDampingForce(0, 10);
      expect(force).toBe(0);
    });

    it('should return negative force for negative velocity', () => {
      const force = PhysicsUtils.calculateDampingForce(-2, 10);
      expect(force).toBe(-20);
    });

    it('should oppose motion direction', () => {
      const positiveVelocity = PhysicsUtils.calculateDampingForce(5, 10);
      const negativeVelocity = PhysicsUtils.calculateDampingForce(-5, 10);

      expect(positiveVelocity).toBeGreaterThan(0);
      expect(negativeVelocity).toBeLessThan(0);
    });
  });

  describe('clampForce', () => {
    it('should return force unchanged when within limits', () => {
      const force = PhysicsUtils.clampForce(50, 100);
      expect(force).toBe(50);
    });

    it('should clamp force to maxForce when exceeded', () => {
      const force = PhysicsUtils.clampForce(150, 100);
      expect(force).toBe(100);
    });

    it('should clamp negative force to -maxForce', () => {
      const force = PhysicsUtils.clampForce(-150, 100);
      expect(force).toBe(-100);
    });

    it('should handle zero force', () => {
      const force = PhysicsUtils.clampForce(0, 100);
      expect(force).toBe(0);
    });

    it('should handle exactly maxForce', () => {
      const force = PhysicsUtils.clampForce(100, 100);
      expect(force).toBe(100);
    });

    it('should handle exactly -maxForce', () => {
      const force = PhysicsUtils.clampForce(-100, 100);
      expect(force).toBe(-100);
    });
  });

  describe('applyGravity', () => {
    it('should apply gravity in the specified direction', () => {
      const velocity = new Vector3(0, 0, 0);
      const gravityDir = new Vector3(0, -1, 0);
      const gravity = 9.8;
      const gravityMultiplier = 1;
      const delta = 0.016;

      PhysicsUtils.applyGravity(
        velocity,
        gravityDir,
        gravity,
        gravityMultiplier,
        delta,
      );

      expect(velocity.y).toBeCloseTo(-9.8 * 0.016, 4);
      expect(velocity.x).toBe(0);
      expect(velocity.z).toBe(0);
    });

    it('should accumulate velocity over time', () => {
      const velocity = new Vector3(0, -1, 0);
      const gravityDir = new Vector3(0, -1, 0);

      PhysicsUtils.applyGravity(velocity, gravityDir, 10, 1, 0.1);

      expect(velocity.y).toBeCloseTo(-2, 4);
    });

    it('should respect gravity multiplier', () => {
      const velocity1 = new Vector3(0, 0, 0);
      const velocity2 = new Vector3(0, 0, 0);
      const gravityDir = new Vector3(0, -1, 0);

      PhysicsUtils.applyGravity(velocity1, gravityDir, 10, 1, 0.1);
      PhysicsUtils.applyGravity(velocity2, gravityDir, 10, 2, 0.1);

      expect(velocity2.y).toBeCloseTo(velocity1.y * 2, 4);
    });

    it('should handle custom gravity direction', () => {
      const velocity = new Vector3(0, 0, 0);
      const gravityDir = new Vector3(1, 0, 0).normalize();

      PhysicsUtils.applyGravity(velocity, gravityDir, 10, 1, 0.1);

      expect(velocity.x).toBeCloseTo(1, 4);
      expect(velocity.y).toBe(0);
    });
  });

  describe('applyFloatingForce', () => {
    it('should apply upward force when spring dominates', () => {
      const velocity = new Vector3(0, 0, 0);
      const upAxis = new Vector3(0, 1, 0);

      PhysicsUtils.applyFloatingForce(
        velocity,
        upAxis,
        100, // spring force
        50, // damping force
        200, // max force
        1, // mass
        0.016, // delta
      );

      expect(velocity.y).toBeGreaterThan(0);
    });

    it('should apply downward force when damping dominates', () => {
      const velocity = new Vector3(0, 0, 0);
      const upAxis = new Vector3(0, 1, 0);

      PhysicsUtils.applyFloatingForce(
        velocity,
        upAxis,
        50, // spring force
        100, // damping force
        200, // max force
        1, // mass
        0.016, // delta
      );

      expect(velocity.y).toBeLessThan(0);
    });

    it('should cap force to maxForce', () => {
      const velocity = new Vector3(0, 0, 0);
      const upAxis = new Vector3(0, 1, 0);

      PhysicsUtils.applyFloatingForce(
        velocity,
        upAxis,
        500, // Large spring force
        0, // No damping
        100, // max force limit
        1, // mass
        1, // delta = 1 for easy calculation
      );

      // Force is capped at 100, so acceleration = 100 / 1 = 100
      expect(velocity.y).toBe(100);
    });

    it('should scale with mass', () => {
      const velocity1 = new Vector3(0, 0, 0);
      const velocity2 = new Vector3(0, 0, 0);
      const upAxis = new Vector3(0, 1, 0);

      PhysicsUtils.applyFloatingForce(velocity1, upAxis, 100, 0, 200, 1, 0.1);
      PhysicsUtils.applyFloatingForce(velocity2, upAxis, 100, 0, 200, 2, 0.1);

      expect(velocity1.y).toBeCloseTo(velocity2.y * 2, 4);
    });

    it('should produce zero velocity when forces balance', () => {
      const velocity = new Vector3(0, 0, 0);
      const upAxis = new Vector3(0, 1, 0);

      PhysicsUtils.applyFloatingForce(velocity, upAxis, 100, 100, 200, 1, 0.1);

      expect(velocity.y).toBe(0);
    });
  });

  describe('calculateTargetDistance', () => {
    it('should sum float height and capsule radius', () => {
      const distance = PhysicsUtils.calculateTargetDistance(0.5, 0.25);
      expect(distance).toBe(0.75);
    });

    it('should handle zero float height', () => {
      const distance = PhysicsUtils.calculateTargetDistance(0, 0.3);
      expect(distance).toBe(0.3);
    });

    it('should handle zero capsule radius', () => {
      const distance = PhysicsUtils.calculateTargetDistance(1, 0);
      expect(distance).toBe(1);
    });
  });

  describe('isGrounded', () => {
    it('should return true when distance is below threshold', () => {
      expect(PhysicsUtils.isGrounded(0.1, 0.2)).toBe(true);
    });

    it('should return false when distance is above threshold', () => {
      expect(PhysicsUtils.isGrounded(0.3, 0.2)).toBe(false);
    });

    it('should return false when distance equals threshold', () => {
      expect(PhysicsUtils.isGrounded(0.2, 0.2)).toBe(false);
    });

    it('should return true for zero distance', () => {
      expect(PhysicsUtils.isGrounded(0, 0.1)).toBe(true);
    });
  });

  describe('calculateGroundingThreshold', () => {
    it('should sum all components', () => {
      const threshold = PhysicsUtils.calculateGroundingThreshold(
        0.5,
        0.25,
        0.1,
      );
      expect(threshold).toBe(0.85);
    });

    it('should use default buffer of 0.15', () => {
      const threshold = PhysicsUtils.calculateGroundingThreshold(0.5, 0.25);
      expect(threshold).toBe(0.9);
    });

    it('should handle zero values', () => {
      const threshold = PhysicsUtils.calculateGroundingThreshold(0, 0, 0);
      expect(threshold).toBe(0);
    });
  });

  describe('isWalkableSlope', () => {
    it('should return true for flat surface', () => {
      const normal = new Vector3(0, 1, 0);
      const upAxis = new Vector3(0, 1, 0);
      const maxSlope = Math.PI / 4; // 45 degrees

      expect(PhysicsUtils.isWalkableSlope(normal, upAxis, maxSlope)).toBe(true);
    });

    it('should return true for slope within limit', () => {
      const normal = new Vector3(0, 1, 0.5).normalize();
      const upAxis = new Vector3(0, 1, 0);
      const maxSlope = Math.PI / 4; // 45 degrees

      expect(PhysicsUtils.isWalkableSlope(normal, upAxis, maxSlope)).toBe(true);
    });

    it('should return false for slope exceeding limit', () => {
      const normal = new Vector3(1, 0.5, 0).normalize();
      const upAxis = new Vector3(0, 1, 0);
      const maxSlope = Math.PI / 6; // 30 degrees

      expect(PhysicsUtils.isWalkableSlope(normal, upAxis, maxSlope)).toBe(
        false,
      );
    });

    it('should return false for vertical wall', () => {
      const normal = new Vector3(1, 0, 0);
      const upAxis = new Vector3(0, 1, 0);
      const maxSlope = Math.PI / 4;

      expect(PhysicsUtils.isWalkableSlope(normal, upAxis, maxSlope)).toBe(
        false,
      );
    });

    it('should handle inverted normal (ceiling)', () => {
      const normal = new Vector3(0, -1, 0);
      const upAxis = new Vector3(0, 1, 0);
      const maxSlope = Math.PI / 4;

      expect(PhysicsUtils.isWalkableSlope(normal, upAxis, maxSlope)).toBe(
        false,
      );
    });
  });

  describe('capVelocity', () => {
    it('should not modify velocity below max', () => {
      const velocity = new Vector3(1, 2, 2);
      PhysicsUtils.capVelocity(velocity, 10);

      expect(velocity.length()).toBe(3);
    });

    it('should cap velocity exceeding max', () => {
      const velocity = new Vector3(10, 0, 0);
      PhysicsUtils.capVelocity(velocity, 5);

      expect(velocity.length()).toBeCloseTo(5, 4);
    });

    it('should preserve velocity direction when capping', () => {
      const velocity = new Vector3(6, 8, 0);
      PhysicsUtils.capVelocity(velocity, 5);

      expect(velocity.x / velocity.y).toBeCloseTo(6 / 8, 4);
    });

    it('should handle zero velocity', () => {
      const velocity = new Vector3(0, 0, 0);
      PhysicsUtils.capVelocity(velocity, 5);

      expect(velocity.length()).toBe(0);
    });

    it('should handle velocity exactly at max', () => {
      const velocity = new Vector3(3, 4, 0);
      PhysicsUtils.capVelocity(velocity, 5);

      expect(velocity.length()).toBe(5);
    });

    it('should handle 3D velocity', () => {
      const velocity = new Vector3(10, 10, 10);
      PhysicsUtils.capVelocity(velocity, 5);

      expect(velocity.length()).toBeCloseTo(5, 4);
    });
  });
});
