import {
  CylinderGeometry,
  DistanceGrabbable,
  Group,
  Mesh,
  MeshStandardMaterial,
  MovementMode,
  PhysicsBody,
  PhysicsShape,
  PhysicsShapeType,
  PhysicsState,
  SphereGeometry,
  type Entity,
  type World,
} from '@iwsdk/core';
import { Ball } from '../components/softball';
import { Can } from '../components/tin-can';
import {
  BALL_DENSITY,
  BALL_RADIUS,
  CAN_DENSITY,
  CAN_HEIGHT,
  CAN_RADIUS,
  PALETTE,
} from '../constants';

// Shared geometry/materials — allocated once, reused by every spawn and
// respawn (which is why respawned entities use destroy(), never dispose()).
const canGeometry = new CylinderGeometry(
  CAN_RADIUS,
  CAN_RADIUS,
  CAN_HEIGHT,
  20,
);
const canBandGeometry = new CylinderGeometry(
  CAN_RADIUS * 1.004,
  CAN_RADIUS * 1.004,
  CAN_HEIGHT * 0.34,
  20,
);
const canMaterial = new MeshStandardMaterial({
  color: PALETTE.tinSilver,
  metalness: 0.85,
  roughness: 0.35,
});
const canBandMaterial = new MeshStandardMaterial({
  color: PALETTE.carnivalRed,
  metalness: 0.2,
  roughness: 0.55,
});
const ballGeometry = new SphereGeometry(BALL_RADIUS, 24, 16);
const ballMaterial = new MeshStandardMaterial({
  color: PALETTE.canvasCream,
  roughness: 0.75,
  metalness: 0.0,
});

/** Identical configs used at spawn AND at reset re-add (creation-time-only). */
export const CAN_SHAPE = {
  shape: PhysicsShapeType.Cylinder,
  dimensions: [CAN_RADIUS, CAN_HEIGHT, 0] as [number, number, number],
  density: CAN_DENSITY,
  friction: 0.8,
  restitution: 0.05,
};
export const CAN_BODY = {
  state: PhysicsState.Dynamic,
  angularDamping: 0.4,
  linearDamping: 0.1,
};
export const BALL_SHAPE = {
  shape: PhysicsShapeType.Sphere,
  dimensions: [BALL_RADIUS, 0, 0] as [number, number, number],
  density: BALL_DENSITY,
  friction: 0.5,
  restitution: 0.3,
};
export const BALL_BODY = { state: PhysicsState.Dynamic };

export function spawnCan(
  world: World,
  position: readonly [number, number, number],
): Entity {
  const group = new Group();
  const body = new Mesh(canGeometry, canMaterial);
  const band = new Mesh(canBandGeometry, canBandMaterial);
  group.add(body, band);
  group.position.set(position[0], position[1], position[2]);

  // No physics at spawn: body-less cans hold a perfect pyramid regardless
  // of frame-delta spikes (headless stalls). RoundSystem attaches physics
  // via addCanPhysics() when the round goes live.
  const entity = world.createTransformEntity(group).addComponent(Can, {
    initialPosition: [position[0], position[1], position[2]],
    initialOrientation: [0, 0, 0, 1],
  });
  return entity;
}

export function spawnBall(
  world: World,
  position: readonly [number, number, number],
): Entity {
  const mesh = new Mesh(ballGeometry, ballMaterial);
  mesh.position.set(position[0], position[1], position[2]);

  const entity = world
    .createTransformEntity(mesh)
    .addComponent(Ball, {
      initialPosition: [position[0], position[1], position[2]],
    })
    .addComponent(DistanceGrabbable, {
      movementMode: MovementMode.MoveTowardsTarget,
      // Pull lerp alpha = factor * delta * 100 and it is NOT clamped —
      // keep alpha < 1 for frames up to ~300 ms (headless hitches) or the
      // pull overshoots and the ball position explodes exponentially.
      moveSpeedFactor: 0.03,
      translate: true,
      rotate: true,
      scale: false,
      returnToOrigin: false,
    })
    .addComponent(PhysicsShape, BALL_SHAPE)
    .addComponent(PhysicsBody, BALL_BODY);
  return entity;
}

/** Attach (or refresh) can physics — called when a round goes live. */
export function addCanPhysics(entity: Entity): void {
  if (!entity.hasComponent(PhysicsBody)) {
    entity.addComponent(PhysicsShape, CAN_SHAPE);
    entity.addComponent(PhysicsBody, CAN_BODY);
  }
}

/** Strip physics and restore a pose — cans return to this between rounds. */
export function parkAtPose(
  entity: Entity,
  position: ArrayLike<number>,
  quaternion: ArrayLike<number>,
): void {
  if (entity.hasComponent(PhysicsBody)) {
    entity.removeComponent(PhysicsBody);
  }
  if (entity.hasComponent(PhysicsShape)) {
    entity.removeComponent(PhysicsShape);
  }
  const obj = entity.object3D!;
  obj.position.set(position[0], position[1], position[2]);
  obj.quaternion.set(
    quaternion[0],
    quaternion[1],
    quaternion[2],
    quaternion[3],
  );
}

/**
 * The sanctioned "teleport" for a dynamic body (0.4.2): remove BOTH physics
 * components, write the pose directly on the object3D, re-add both. The
 * engine shape+body are recreated at the new pose (zero velocity, awake)
 * over the next ~2 physics frames.
 */
export function resetDynamicPose(
  entity: Entity,
  position: ArrayLike<number>,
  quaternion: ArrayLike<number>,
  shape: typeof CAN_SHAPE | typeof BALL_SHAPE,
  body: typeof CAN_BODY | typeof BALL_BODY,
): void {
  entity.removeComponent(PhysicsBody);
  entity.removeComponent(PhysicsShape);
  const obj = entity.object3D!;
  obj.position.set(position[0], position[1], position[2]);
  obj.quaternion.set(
    quaternion[0],
    quaternion[1],
    quaternion[2],
    quaternion[3],
  );
  entity.addComponent(PhysicsShape, shape);
  entity.addComponent(PhysicsBody, body);
}
