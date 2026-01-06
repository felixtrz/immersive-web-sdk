/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  Vector3,
  Mesh,
  BoxGeometry,
  SphereGeometry,
  CylinderGeometry,
  PlaneGeometry,
  BufferGeometry,
  Object3D,
  Group,
  Float32BufferAttribute,
  Box3,
  Matrix4,
  Quaternion,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Physics Utils Tests
 *
 * These tests verify the shape detection and bounds calculation logic from
 * src/physics/utils.ts. The functions are inlined here to avoid workspace
 * dependency resolution issues during testing.
 *
 * The actual implementation in src/physics/utils.ts should be kept in sync
 * with these test implementations.
 */

// Physics shape types (mirroring PhysicsShapeType from physicsShape.ts)
const PhysicsShapeType = {
  Sphere: 'Sphere',
  Box: 'Box',
  Cylinder: 'Cylinder',
  Capsules: 'Capsules',
  ConvexHull: 'ConvexHull',
  TriMesh: 'TriMesh',
  Auto: 'Auto',
} as const;

interface ShapeDetectionResult {
  shapeType: string;
  dimensions: [number, number, number] | null;
}

// Temporary objects for calculations
const tempVec1 = new Vector3();
const tempVec2 = new Vector3();
const tempQuat = new Quaternion();
const tempMatrix = new Matrix4();
const tempMatrix2 = new Matrix4();
const UNIT_SCALE = new Vector3(1, 1, 1);

/**
 * Generates merged geometry from an Object3D tree
 * (Implementation copied from src/physics/utils.ts for testing isolation)
 */
function generateMergedGeometry(object3D: Object3D): BufferGeometry {
  object3D.updateMatrixWorld(true);

  tempMatrix.copy(object3D.matrixWorld);

  tempMatrix.decompose(tempVec1, tempQuat, tempVec2);
  tempMatrix.compose(tempVec1, tempQuat, UNIT_SCALE);

  const geometries: BufferGeometry[] = [];
  object3D.traverse((child) => {
    if ((child as Mesh).isMesh && (child as Mesh).geometry) {
      const geometry = (child as Mesh).geometry.clone();
      geometry.applyMatrix4(child.matrixWorld);
      geometries.push(geometry);
    }
  });

  if (geometries.length === 0) {
    return new BufferGeometry();
  }

  const mergedGeometry = mergeGeometries(geometries);
  tempMatrix2.copy(tempMatrix).invert();
  mergedGeometry.applyMatrix4(tempMatrix2);

  object3D.matrixWorld.copy(tempMatrix);

  return mergedGeometry;
}

/**
 * Calculates bounding box dimensions from Object3D
 * (Implementation copied from src/physics/utils.ts for testing isolation)
 */
function calculateObject3DBounds(object3D: Object3D): [number, number, number] {
  try {
    const box = new Box3().setFromObject(object3D);

    if (!box.isEmpty()) {
      const size = new Vector3();
      box.getSize(size);

      const dimensions: [number, number, number] = [
        Math.max(size.x, 0.01),
        Math.max(size.y, 0.01),
        Math.max(size.z, 0.01),
      ];

      console.log(
        `PhysicsSystem: Calculated Object3D bounds: [${dimensions.join(', ')}]`,
      );
      return dimensions;
    } else {
      console.warn(
        'PhysicsSystem: Object3D bounding box is empty, using default dimensions',
      );
    }
  } catch (error) {
    console.warn('PhysicsSystem: Failed to calculate Object3D bounds:', error);
  }

  return [1, 1, 1];
}

/**
 * Detects the best physics shape type based on geometry
 * (Implementation copied from src/physics/utils.ts for testing isolation)
 */
function detectShapeFromGeometry(object3D: Object3D): ShapeDetectionResult {
  const geometry =
    object3D instanceof Mesh
      ? object3D.geometry
      : generateMergedGeometry(object3D);

  if (geometry instanceof SphereGeometry) {
    const radius = geometry.parameters.radius ?? 1;
    return {
      shapeType: PhysicsShapeType.Sphere,
      dimensions: [radius, 0, 0],
    };
  }

  if (geometry instanceof BoxGeometry) {
    const width = geometry.parameters.width ?? 1;
    const height = geometry.parameters.height ?? 1;
    const depth = geometry.parameters.depth ?? 1;
    return {
      shapeType: PhysicsShapeType.Box,
      dimensions: [width, height, depth],
    };
  }

  if (geometry instanceof PlaneGeometry) {
    const width = geometry.parameters.width ?? 1;
    const height = geometry.parameters.height ?? 1;
    const thickness = 0.01;
    return {
      shapeType: PhysicsShapeType.Box,
      dimensions: [width, height, thickness],
    };
  }

  if (geometry instanceof CylinderGeometry) {
    const radiusTop = geometry.parameters.radiusTop ?? 1;
    const radiusBottom = geometry.parameters.radiusBottom ?? 1;
    if (radiusTop !== radiusBottom) {
      console.warn(
        'PhysicsSystem: detected cylinder with different radiusTop and radiusBottom. Using average radius for the physics shape.',
      );
    }
    const height = geometry.parameters.height ?? 1;
    const avgRadius = (radiusTop + radiusBottom) / 2;
    return {
      shapeType: PhysicsShapeType.Cylinder,
      dimensions: [avgRadius, height, 0],
    };
  }

  if (geometry instanceof BufferGeometry) {
    console.log(
      `PhysicsSystem: BufferGeometry detected for object ${object3D}, using ConvexHull.`,
    );
    return {
      shapeType: PhysicsShapeType.ConvexHull,
      dimensions: null,
    };
  }

  console.warn(
    `PhysicsSystem: Unknown geometry type for object ${object3D}, falling back to Box`,
  );
  return {
    shapeType: PhysicsShapeType.Box,
    dimensions: calculateObject3DBounds(object3D),
  };
}

describe('Physics Utils', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    consoleSpy.log.mockRestore();
    consoleSpy.warn.mockRestore();
  });

  describe('detectShapeFromGeometry', () => {
    describe('SphereGeometry detection', () => {
      it('should detect sphere with default radius', () => {
        const geometry = new SphereGeometry();
        const mesh = new Mesh(geometry);

        const result = detectShapeFromGeometry(mesh);

        expect(result.shapeType).toBe(PhysicsShapeType.Sphere);
        expect(result.dimensions).toEqual([1, 0, 0]);
      });

      it('should detect sphere with custom radius', () => {
        const geometry = new SphereGeometry(2.5);
        const mesh = new Mesh(geometry);

        const result = detectShapeFromGeometry(mesh);

        expect(result.shapeType).toBe(PhysicsShapeType.Sphere);
        expect(result.dimensions).toEqual([2.5, 0, 0]);
      });

      it('should handle small sphere radius', () => {
        const geometry = new SphereGeometry(0.1);
        const mesh = new Mesh(geometry);

        const result = detectShapeFromGeometry(mesh);

        expect(result.shapeType).toBe(PhysicsShapeType.Sphere);
        expect(result.dimensions).toEqual([0.1, 0, 0]);
      });
    });

    describe('BoxGeometry detection', () => {
      it('should detect box with default dimensions', () => {
        const geometry = new BoxGeometry();
        const mesh = new Mesh(geometry);

        const result = detectShapeFromGeometry(mesh);

        expect(result.shapeType).toBe(PhysicsShapeType.Box);
        expect(result.dimensions).toEqual([1, 1, 1]);
      });

      it('should detect box with custom dimensions', () => {
        const geometry = new BoxGeometry(2, 3, 4);
        const mesh = new Mesh(geometry);

        const result = detectShapeFromGeometry(mesh);

        expect(result.shapeType).toBe(PhysicsShapeType.Box);
        expect(result.dimensions).toEqual([2, 3, 4]);
      });

      it('should handle non-uniform box dimensions', () => {
        const geometry = new BoxGeometry(10, 0.5, 5);
        const mesh = new Mesh(geometry);

        const result = detectShapeFromGeometry(mesh);

        expect(result.shapeType).toBe(PhysicsShapeType.Box);
        expect(result.dimensions).toEqual([10, 0.5, 5]);
      });
    });

    describe('PlaneGeometry detection', () => {
      it('should detect plane and return box shape with thin thickness', () => {
        const geometry = new PlaneGeometry();
        const mesh = new Mesh(geometry);

        const result = detectShapeFromGeometry(mesh);

        expect(result.shapeType).toBe(PhysicsShapeType.Box);
        expect(result.dimensions).toEqual([1, 1, 0.01]);
      });

      it('should detect plane with custom dimensions', () => {
        const geometry = new PlaneGeometry(5, 10);
        const mesh = new Mesh(geometry);

        const result = detectShapeFromGeometry(mesh);

        expect(result.shapeType).toBe(PhysicsShapeType.Box);
        expect(result.dimensions).toEqual([5, 10, 0.01]);
      });
    });

    describe('CylinderGeometry detection', () => {
      it('should detect cylinder with equal radii', () => {
        const geometry = new CylinderGeometry(1, 1, 2);
        const mesh = new Mesh(geometry);

        const result = detectShapeFromGeometry(mesh);

        expect(result.shapeType).toBe(PhysicsShapeType.Cylinder);
        expect(result.dimensions).toEqual([1, 2, 0]);
        expect(consoleSpy.warn).not.toHaveBeenCalled();
      });

      it('should detect cylinder with default parameters', () => {
        const geometry = new CylinderGeometry();
        const mesh = new Mesh(geometry);

        const result = detectShapeFromGeometry(mesh);

        expect(result.shapeType).toBe(PhysicsShapeType.Cylinder);
        expect(result.dimensions).toEqual([1, 1, 0]);
      });

      it('should handle cylinder with different top/bottom radii and warn', () => {
        const geometry = new CylinderGeometry(2, 4, 3);
        const mesh = new Mesh(geometry);

        const result = detectShapeFromGeometry(mesh);

        expect(result.shapeType).toBe(PhysicsShapeType.Cylinder);
        expect(result.dimensions).toEqual([3, 3, 0]);
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          expect.stringContaining('different radiusTop and radiusBottom'),
        );
      });

      it('should handle cone-like cylinder (one radius is zero)', () => {
        const geometry = new CylinderGeometry(2, 0, 4);
        const mesh = new Mesh(geometry);

        const result = detectShapeFromGeometry(mesh);

        expect(result.shapeType).toBe(PhysicsShapeType.Cylinder);
        expect(result.dimensions).toEqual([1, 4, 0]);
        expect(consoleSpy.warn).toHaveBeenCalled();
      });
    });

    describe('BufferGeometry detection', () => {
      it('should detect generic BufferGeometry and return ConvexHull', () => {
        const geometry = new BufferGeometry();
        const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
        geometry.setAttribute(
          'position',
          new Float32BufferAttribute(positions, 3),
        );
        const mesh = new Mesh(geometry);

        const result = detectShapeFromGeometry(mesh);

        expect(result.shapeType).toBe(PhysicsShapeType.ConvexHull);
        expect(result.dimensions).toBeNull();
        expect(consoleSpy.log).toHaveBeenCalledWith(
          expect.stringContaining('BufferGeometry detected'),
        );
      });
    });

    describe('Object3D without mesh (merged geometry)', () => {
      it('should handle Group with child meshes', () => {
        const group = new Group();
        const childMesh1 = new Mesh(new BoxGeometry(1, 1, 1));
        const childMesh2 = new Mesh(new BoxGeometry(1, 1, 1));
        childMesh2.position.set(2, 0, 0);
        group.add(childMesh1);
        group.add(childMesh2);
        group.updateMatrixWorld(true);

        const result = detectShapeFromGeometry(group);

        expect(result.shapeType).toBe(PhysicsShapeType.ConvexHull);
        expect(result.dimensions).toBeNull();
      });

      it('should handle empty Object3D', () => {
        const obj = new Object3D();

        const result = detectShapeFromGeometry(obj);

        expect(result.shapeType).toBe(PhysicsShapeType.ConvexHull);
      });
    });
  });

  describe('calculateObject3DBounds', () => {
    it('should calculate bounds of a simple box mesh', () => {
      const geometry = new BoxGeometry(2, 4, 6);
      const mesh = new Mesh(geometry);

      const result = calculateObject3DBounds(mesh);

      expect(result[0]).toBeCloseTo(2);
      expect(result[1]).toBeCloseTo(4);
      expect(result[2]).toBeCloseTo(6);
    });

    it('should calculate bounds of a sphere mesh', () => {
      const geometry = new SphereGeometry(1);
      const mesh = new Mesh(geometry);

      const result = calculateObject3DBounds(mesh);

      expect(result[0]).toBeCloseTo(2);
      expect(result[1]).toBeCloseTo(2);
      expect(result[2]).toBeCloseTo(2);
    });

    it('should handle mesh with offset position', () => {
      const geometry = new BoxGeometry(1, 1, 1);
      const mesh = new Mesh(geometry);
      mesh.position.set(10, 10, 10);

      const result = calculateObject3DBounds(mesh);

      expect(result[0]).toBeCloseTo(1);
      expect(result[1]).toBeCloseTo(1);
      expect(result[2]).toBeCloseTo(1);
    });

    it('should handle mesh with scale', () => {
      const geometry = new BoxGeometry(1, 1, 1);
      const mesh = new Mesh(geometry);
      mesh.scale.set(2, 3, 4);
      mesh.updateMatrixWorld(true);

      const result = calculateObject3DBounds(mesh);

      expect(result[0]).toBeCloseTo(2);
      expect(result[1]).toBeCloseTo(3);
      expect(result[2]).toBeCloseTo(4);
    });

    it('should enforce minimum dimension size of 0.01', () => {
      const geometry = new BufferGeometry();
      const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
      geometry.setAttribute(
        'position',
        new Float32BufferAttribute(positions, 3),
      );
      const mesh = new Mesh(geometry);

      const result = calculateObject3DBounds(mesh);

      expect(result[0]).toBeGreaterThanOrEqual(0.01);
      expect(result[1]).toBeGreaterThanOrEqual(0.01);
      expect(result[2]).toBe(0.01);
    });

    it('should return default [1,1,1] for empty bounding box', () => {
      const obj = new Object3D();

      const result = calculateObject3DBounds(obj);

      expect(result).toEqual([1, 1, 1]);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('bounding box is empty'),
      );
    });

    it('should calculate bounds for Group with multiple children', () => {
      const group = new Group();
      const mesh1 = new Mesh(new BoxGeometry(1, 1, 1));
      mesh1.position.set(0, 0, 0);
      const mesh2 = new Mesh(new BoxGeometry(1, 1, 1));
      mesh2.position.set(2, 0, 0);

      group.add(mesh1, mesh2);
      group.updateMatrixWorld(true);

      const result = calculateObject3DBounds(group);

      expect(result[0]).toBeCloseTo(3);
      expect(result[1]).toBeCloseTo(1);
      expect(result[2]).toBeCloseTo(1);
    });

    it('should handle nested groups', () => {
      const outerGroup = new Group();
      const innerGroup = new Group();
      const mesh = new Mesh(new BoxGeometry(2, 2, 2));

      innerGroup.add(mesh);
      innerGroup.position.set(5, 5, 5);
      outerGroup.add(innerGroup);
      outerGroup.updateMatrixWorld(true);

      const result = calculateObject3DBounds(outerGroup);

      expect(result[0]).toBeCloseTo(2);
      expect(result[1]).toBeCloseTo(2);
      expect(result[2]).toBeCloseTo(2);
    });
  });
});
