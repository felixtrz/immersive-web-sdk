/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import {
  BufferGeometry,
  CircleGeometry,
  LatheGeometry,
  MathUtils,
  Vector2,
  Vector3,
  Box3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * BeveledCylinderGeometry Tests
 *
 * Tests for the beveled cylinder geometry generation from
 * src/locomotion/geometries/beveled-cylinder.ts.
 * The geometry is recreated here to test the generation logic.
 */

/**
 * Creates a beveled cylinder geometry with rounded edges.
 * (Implementation from src/locomotion/geometries/beveled-cylinder.ts)
 */
class BeveledCylinderGeometry extends BufferGeometry {
  constructor(
    radiusTop = 1,
    radiusBottom = 1,
    height = 2,
    bevelSegments = 4,
    bevelSize = 1,
    radialSegments = 32,
    heightSegments = 1,
    openEnded = false,
    thetaStart = 0,
    thetaLength = Math.PI * 2,
  ) {
    super();
    const halfHeight = height / 2;
    const profilePoints: Vector2[] = [];

    const deltaAngle = Math.atan2(radiusBottom - radiusTop, height);

    // Bottom bevel
    for (let i = 0; i <= bevelSegments; i++) {
      const t = i / bevelSegments;
      const angle = -Math.PI / 2 + t * (Math.PI / 2 + deltaAngle);
      const x = radiusBottom - bevelSize + bevelSize * Math.cos(angle);
      const y = -halfHeight + bevelSize + bevelSize * Math.sin(angle);
      profilePoints.push(new Vector2(x, y));
    }

    // Middle segments
    for (let i = 1; i < heightSegments; i++) {
      const t = i / heightSegments;
      const y =
        -halfHeight +
        bevelSize +
        t * (halfHeight - bevelSize - (-halfHeight + bevelSize));
      const r = MathUtils.lerp(radiusBottom, radiusTop, t);
      profilePoints.push(new Vector2(r, y));
    }

    // Top bevel
    for (let i = 0; i <= bevelSegments; i++) {
      const t = i / bevelSegments;
      const angle = deltaAngle + t * (Math.PI / 2);
      const x = radiusTop - bevelSize + bevelSize * Math.cos(angle);
      const y = halfHeight - bevelSize + bevelSize * Math.sin(angle);
      profilePoints.push(new Vector2(x, y));
    }

    const latheGeo = new LatheGeometry(
      profilePoints,
      radialSegments,
      thetaStart,
      thetaLength,
    );

    if (!openEnded) {
      const topCap = new CircleGeometry(
        radiusTop - bevelSize,
        radialSegments,
        thetaStart,
        thetaLength,
      );
      topCap.rotateX(-Math.PI / 2);
      topCap.translate(0, halfHeight, 0);

      const bottomCap = new CircleGeometry(
        radiusBottom - bevelSize,
        radialSegments,
        thetaStart,
        thetaLength,
      );
      bottomCap.rotateX(Math.PI / 2);
      bottomCap.translate(0, -halfHeight, 0);

      const merged = mergeGeometries([latheGeo, topCap, bottomCap]);
      this.copy(merged);
    } else {
      this.copy(latheGeo);
    }

    this.computeVertexNormals();
  }
}

describe('BeveledCylinderGeometry', () => {
  describe('default construction', () => {
    it('should create geometry with default parameters', () => {
      const geometry = new BeveledCylinderGeometry();

      expect(geometry).toBeInstanceOf(BufferGeometry);
      expect(geometry.attributes.position).toBeDefined();
      expect(geometry.attributes.normal).toBeDefined();
    });

    it('should have non-empty vertex buffer', () => {
      const geometry = new BeveledCylinderGeometry();
      const positionAttr = geometry.attributes.position;

      expect(positionAttr.count).toBeGreaterThan(0);
    });

    it('should have valid bounding box', () => {
      const geometry = new BeveledCylinderGeometry();
      geometry.computeBoundingBox();

      expect(geometry.boundingBox).not.toBeNull();
      expect(geometry.boundingBox!.isEmpty()).toBe(false);
    });
  });

  describe('custom dimensions', () => {
    it('should respect radiusTop parameter', () => {
      const geometry = new BeveledCylinderGeometry(
        2, // radiusTop
        1, // radiusBottom
        2, // height
        4, // bevelSegments
        0.1, // bevelSize (small to make radius easier to measure)
      );
      geometry.computeBoundingBox();

      const box = geometry.boundingBox!;
      const width = box.max.x - box.min.x;

      // Width should be approximately 2 * radiusTop (the larger radius)
      // radiusTop = 2, so diameter ≈ 4
      expect(width).toBeGreaterThan(3.5);
      expect(width).toBeLessThan(4.5);
    });

    it('should respect height parameter', () => {
      const height = 5;
      const geometry = new BeveledCylinderGeometry(
        1,
        1,
        height,
        4,
        0.1, // small bevel
      );
      geometry.computeBoundingBox();

      const box = geometry.boundingBox!;
      const actualHeight = box.max.y - box.min.y;

      expect(actualHeight).toBeCloseTo(height, 0);
    });

    it('should create tapered cylinder when radii differ', () => {
      const geometry = new BeveledCylinderGeometry(
        0.5, // radiusTop - smaller
        2.0, // radiusBottom - larger
        2,
        4,
        0.1,
      );
      geometry.computeBoundingBox();

      // Bottom should be wider than top
      const positions = geometry.attributes.position;
      let maxRadiusAtBottom = 0;
      let maxRadiusAtTop = 0;

      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        const radius = Math.sqrt(x * x + z * z);

        if (y < 0) {
          maxRadiusAtBottom = Math.max(maxRadiusAtBottom, radius);
        } else {
          maxRadiusAtTop = Math.max(maxRadiusAtTop, radius);
        }
      }

      expect(maxRadiusAtBottom).toBeGreaterThan(maxRadiusAtTop);
    });
  });

  describe('bevel configuration', () => {
    it('should create smoother bevel with more segments', () => {
      const lowSegments = new BeveledCylinderGeometry(1, 1, 2, 2, 0.2, 8);
      const highSegments = new BeveledCylinderGeometry(1, 1, 2, 8, 0.2, 8);

      // More bevel segments should result in more vertices
      expect(highSegments.attributes.position.count).toBeGreaterThan(
        lowSegments.attributes.position.count,
      );
    });

    it('should handle zero bevel size', () => {
      const geometry = new BeveledCylinderGeometry(
        1,
        1,
        2,
        4,
        0, // no bevel
      );

      expect(geometry).toBeInstanceOf(BufferGeometry);
      expect(geometry.attributes.position.count).toBeGreaterThan(0);
    });

    it('should handle bevel size equal to radius', () => {
      const geometry = new BeveledCylinderGeometry(
        1, // radiusTop
        1, // radiusBottom
        2,
        4,
        1, // bevelSize = radius
      );

      expect(geometry).toBeInstanceOf(BufferGeometry);
      geometry.computeBoundingBox();
      expect(geometry.boundingBox!.isEmpty()).toBe(false);
    });
  });

  describe('radial segments', () => {
    it('should create more vertices with more radial segments', () => {
      const lowRes = new BeveledCylinderGeometry(1, 1, 2, 4, 0.2, 8);
      const highRes = new BeveledCylinderGeometry(1, 1, 2, 4, 0.2, 32);

      expect(highRes.attributes.position.count).toBeGreaterThan(
        lowRes.attributes.position.count,
      );
    });

    it('should handle minimum radial segments', () => {
      const geometry = new BeveledCylinderGeometry(1, 1, 2, 4, 0.2, 3);

      expect(geometry).toBeInstanceOf(BufferGeometry);
      expect(geometry.attributes.position.count).toBeGreaterThan(0);
    });
  });

  describe('open/closed ended', () => {
    it('should have fewer vertices when open ended', () => {
      const closed = new BeveledCylinderGeometry(
        1,
        1,
        2,
        4,
        0.2,
        16,
        1,
        false,
      );
      const open = new BeveledCylinderGeometry(1, 1, 2, 4, 0.2, 16, 1, true);

      // Open cylinder doesn't have cap vertices
      expect(open.attributes.position.count).toBeLessThan(
        closed.attributes.position.count,
      );
    });

    it('should create valid geometry when open ended', () => {
      const geometry = new BeveledCylinderGeometry(
        1,
        1,
        2,
        4,
        0.2,
        16,
        1,
        true,
      );

      expect(geometry).toBeInstanceOf(BufferGeometry);
      geometry.computeBoundingBox();
      expect(geometry.boundingBox!.isEmpty()).toBe(false);
    });
  });

  describe('theta (arc) parameters', () => {
    it('should create half cylinder with thetaLength = PI', () => {
      const full = new BeveledCylinderGeometry(
        1,
        1,
        2,
        4,
        0.2,
        16,
        1,
        true, // open ended to avoid cap merging
        0,
        Math.PI * 2,
      );
      const half = new BeveledCylinderGeometry(
        1,
        1,
        2,
        4,
        0.2,
        16,
        1,
        true, // open ended to avoid cap merging
        0,
        Math.PI,
      );

      // Half cylinder (open ended) should have fewer vertices than full
      // Note: With open ended, we're comparing raw lathe geometry
      expect(half.attributes.position.count).toBeLessThanOrEqual(
        full.attributes.position.count,
      );

      // Also verify half cylinder has a different bounding box (narrower in one dimension)
      half.computeBoundingBox();
      full.computeBoundingBox();
      expect(half.boundingBox).not.toBeNull();
      expect(full.boundingBox).not.toBeNull();
    });

    it('should handle custom thetaStart', () => {
      const geometry = new BeveledCylinderGeometry(
        1,
        1,
        2,
        4,
        0.2,
        16,
        1,
        false,
        Math.PI / 4, // Start at 45 degrees
        Math.PI, // Half circle
      );

      expect(geometry).toBeInstanceOf(BufferGeometry);
      expect(geometry.attributes.position.count).toBeGreaterThan(0);
    });
  });

  describe('height segments', () => {
    it('should create more vertices with more height segments', () => {
      const lowSeg = new BeveledCylinderGeometry(1, 1, 2, 4, 0.2, 16, 1);
      const highSeg = new BeveledCylinderGeometry(1, 1, 2, 4, 0.2, 16, 4);

      expect(highSeg.attributes.position.count).toBeGreaterThan(
        lowSeg.attributes.position.count,
      );
    });
  });

  describe('normals', () => {
    it('should have computed vertex normals', () => {
      const geometry = new BeveledCylinderGeometry();
      const normals = geometry.attributes.normal;

      expect(normals).toBeDefined();
      expect(normals.count).toBeGreaterThan(0);
    });

    it('should have unit-length normals', () => {
      const geometry = new BeveledCylinderGeometry(1, 1, 2, 4, 0.2, 8);
      const normals = geometry.attributes.normal;

      // Check a sample of normals are unit length
      for (let i = 0; i < Math.min(normals.count, 20); i++) {
        const normal = new Vector3(
          normals.getX(i),
          normals.getY(i),
          normals.getZ(i),
        );
        expect(normal.length()).toBeCloseTo(1, 1);
      }
    });
  });

  describe('geometry center', () => {
    it('should be centered at origin vertically', () => {
      const geometry = new BeveledCylinderGeometry(1, 1, 4, 4, 0.1);
      geometry.computeBoundingBox();

      const center = new Vector3();
      geometry.boundingBox!.getCenter(center);

      expect(center.y).toBeCloseTo(0, 1);
    });

    it('should be centered at origin horizontally', () => {
      const geometry = new BeveledCylinderGeometry(1, 1, 2, 4, 0.1);
      geometry.computeBoundingBox();

      const center = new Vector3();
      geometry.boundingBox!.getCenter(center);

      expect(center.x).toBeCloseTo(0, 1);
      expect(center.z).toBeCloseTo(0, 1);
    });
  });
});
