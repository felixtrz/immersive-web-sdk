/**
 * Night environment for Tin Can Alley: dome/IBL gradients on the level
 * root, asphalt floor (static collider), and two strings of amber
 * carnival lights.
 *
 * Physics entities are scene-root parented at identity (no parent passed
 * to createTransformEntity) with world positions baked into the mesh.
 */
import {
  BoxGeometry,
  CylinderGeometry,
  DomeGradient,
  Group,
  IBLGradient,
  Mesh,
  MeshStandardMaterial,
  PhysicsBody,
  PhysicsShape,
  PhysicsShapeType,
  PhysicsState,
  SphereGeometry,
  World,
} from '@iwsdk/core';
import { FLOOR, PALETTE, WALLS } from '../constants';

// String-light layout: two rows of bulbs spanning the alley width.
const BULBS_PER_ROW = 7;
const BULB_SPAN_HALF = 1.5;
const LIGHT_ROWS: ReadonlyArray<{ y: number; z: number }> = [
  { y: 2.4, z: -1.6 },
  { y: 2.2, z: -2.0 },
];

export function setupEnvironment(world: World): void {
  // --- Night sky + warm carnival lighting (level root only) ---
  // App is created with render.defaultLighting:false, so nothing is
  // pre-attached. _needsUpdate defaults to true on addComponent.
  const root = world.activeLevel.value;
  root
    .addComponent(DomeGradient, {
      sky: [0.07, 0.047, 0.18, 1.0], // midnight indigo #120C2E
      equator: [0.141, 0.106, 0.329, 1.0], // booth indigo #241B54
      ground: [0.22, 0.13, 0.055, 1.0], // dark warm ground glow
      intensity: 1.0,
    })
    .addComponent(IBLGradient, {
      // Warmer amber-tinted lighting; IBL intensity applies ~squared,
      // so tune colors and keep intensity at 1.0.
      sky: [0.35, 0.3, 0.55, 1.0],
      equator: [0.55, 0.42, 0.3, 1.0],
      ground: [0.65, 0.45, 0.22, 1.0],
      intensity: 1.0,
    });

  // --- Floor: dark asphalt slab, static collider (top at y=0) ---
  const floorMesh = new Mesh(
    new BoxGeometry(...FLOOR.size),
    new MeshStandardMaterial({
      color: PALETTE.floorAsphalt,
      roughness: 0.95,
      metalness: 0.0,
    }),
  );
  floorMesh.position.set(...FLOOR.pos);
  world
    .createTransformEntity(floorMesh)
    .addComponent(PhysicsShape, {
      shape: PhysicsShapeType.Box,
      dimensions: [...FLOOR.size], // FULL extents
      friction: 0.8,
      restitution: 0.05,
    })
    .addComponent(PhysicsBody, { state: PhysicsState.Static });

  // --- String lights: emissive bulbs + thin wires, one group, no physics ---
  const lights = new Group();

  const bulbGeometry = new SphereGeometry(0.02, 12, 8);
  const bulbMaterial = new MeshStandardMaterial({
    color: 0x000000,
    emissive: PALETTE.stringAmber,
    emissiveIntensity: 2,
  });
  const wireGeometry = new CylinderGeometry(
    0.004,
    0.004,
    BULB_SPAN_HALF * 2,
    6,
  );
  const wireMaterial = new MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.9,
    metalness: 0.0,
  });

  const bulbStep = (BULB_SPAN_HALF * 2) / (BULBS_PER_ROW - 1);
  for (const row of LIGHT_ROWS) {
    // Wire strung just above the bulbs, lying along X.
    const wire = new Mesh(wireGeometry, wireMaterial);
    wire.rotation.z = Math.PI / 2;
    wire.position.set(0, row.y + 0.03, row.z);
    lights.add(wire);

    for (let i = 0; i < BULBS_PER_ROW; i++) {
      const bulb = new Mesh(bulbGeometry, bulbMaterial);
      bulb.position.set(-BULB_SPAN_HALF + i * bulbStep, row.y, row.z);
      lights.add(bulb);
    }
  }

  world.createTransformEntity(lights);

  // Invisible containment walls — rolling cans/balls stay in the world.
  for (const wall of WALLS) {
    const collider = world.createTransformEntity();
    collider.object3D!.position.set(...wall.pos);
    collider
      .addComponent(PhysicsShape, {
        shape: PhysicsShapeType.Box,
        dimensions: [...wall.size],
        friction: 0.4,
        restitution: 0.1,
      })
      .addComponent(PhysicsBody, { state: PhysicsState.Static });
  }
}
