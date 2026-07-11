/**
 * Carnival booth for Tin Can Alley: counter + shelf (static colliders)
 * and visual dressing (side posts, striped awning, back panel — meshes
 * only, no physics).
 *
 * Every mesh gets its own createTransformEntity with no parent (level
 * root at identity) and its world position baked into the mesh — the
 * physics-safe idiom for the two colliders, and consistent everywhere.
 */
import {
  BoxGeometry,
  Mesh,
  MeshStandardMaterial,
  PhysicsBody,
  PhysicsShape,
  PhysicsShapeType,
  PhysicsState,
  World,
} from '@iwsdk/core';
import { COUNTER, PALETTE, SHELF } from '../constants';

// Dressing layout
const POST_SIZE = [0.08, 2.2, 0.08] as const;
const POST_X = 1.0;
const POST_Y = 1.1;
const POST_Z = -2.55;

const AWNING_SLATS = 8;
const AWNING_SLAT_SIZE = [0.25, 0.04, 0.6] as const;
const AWNING_Y = 2.25;
const AWNING_Z = -2.55;
const AWNING_TILT = (15 * Math.PI) / 180; // front edge droops toward player

const BACK_PANEL_SIZE = [2.1, 1.3, 0.04] as const;
const BACK_PANEL_POS = [0, 1.45, -2.98] as const;

export function buildBooth(world: World): void {
  // --- Counter: wood-brown top the balls rest on (static collider) ---
  const counterMesh = new Mesh(
    new BoxGeometry(...COUNTER.size),
    new MeshStandardMaterial({
      color: PALETTE.woodBrown,
      roughness: 0.7,
      metalness: 0.0,
    }),
  );
  counterMesh.position.set(...COUNTER.pos);
  world
    .createTransformEntity(counterMesh)
    .addComponent(PhysicsShape, {
      shape: PhysicsShapeType.Box,
      dimensions: [...COUNTER.size], // FULL extents [2, 0.08, 0.5]
      friction: 0.6,
      restitution: 0.05,
    })
    .addComponent(PhysicsBody, { state: PhysicsState.Static });

  // --- Shelf: indigo ledge the can pyramid stands on (static collider) ---
  const shelfMesh = new Mesh(
    new BoxGeometry(...SHELF.size),
    new MeshStandardMaterial({
      color: PALETTE.boothIndigo,
      roughness: 0.8,
      metalness: 0.0,
    }),
  );
  shelfMesh.position.set(...SHELF.pos);
  world
    .createTransformEntity(shelfMesh)
    .addComponent(PhysicsShape, {
      shape: PhysicsShapeType.Box,
      dimensions: [...SHELF.size], // FULL extents [2, 0.05, 0.35]
      friction: 0.6,
      restitution: 0.05,
    })
    .addComponent(PhysicsBody, { state: PhysicsState.Static });

  // --- Side posts: carnival-red uprights framing the booth (no physics) ---
  const postGeometry = new BoxGeometry(...POST_SIZE);
  const postMaterial = new MeshStandardMaterial({
    color: PALETTE.carnivalRed,
    roughness: 0.6,
    metalness: 0.0,
  });
  for (const x of [-POST_X, POST_X]) {
    const post = new Mesh(postGeometry, postMaterial);
    post.position.set(x, POST_Y, POST_Z);
    world.createTransformEntity(post);
  }

  // --- Striped awning: alternating red/cream slats, tilted forward ---
  const slatGeometry = new BoxGeometry(...AWNING_SLAT_SIZE);
  const redMaterial = new MeshStandardMaterial({
    color: PALETTE.carnivalRed,
    roughness: 0.8,
    metalness: 0.0,
  });
  const creamMaterial = new MeshStandardMaterial({
    color: PALETTE.canvasCream,
    roughness: 0.8,
    metalness: 0.0,
  });
  const slatWidth = AWNING_SLAT_SIZE[0];
  const firstSlatX = -((AWNING_SLATS - 1) / 2) * slatWidth;
  for (let i = 0; i < AWNING_SLATS; i++) {
    const slat = new Mesh(
      slatGeometry,
      i % 2 === 0 ? redMaterial : creamMaterial,
    );
    slat.position.set(firstSlatX + i * slatWidth, AWNING_Y, AWNING_Z);
    slat.rotation.x = AWNING_TILT;
    world.createTransformEntity(slat);
  }

  // --- Back panel: indigo backdrop behind the can shelf (no physics) ---
  const backPanel = new Mesh(
    new BoxGeometry(...BACK_PANEL_SIZE),
    new MeshStandardMaterial({
      color: PALETTE.boothIndigo,
      roughness: 0.9,
      metalness: 0.0,
    }),
  );
  backPanel.position.set(...BACK_PANEL_POS);
  world.createTransformEntity(backPanel);
}
