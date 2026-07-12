import { createSystem, type World } from '@iwsdk/core';
import {
  BALL_POSITIONS,
  CAN_POSITIONS,
  SPAWN_MAX_DELTA,
  SPAWN_STABLE_FRAMES,
} from '../constants';
import { spawnBall, spawnCan } from '../scene/spawn';

export function spawnGamePieces(world: World): void {
  for (const pos of CAN_POSITIONS) {
    spawnCan(world, pos);
  }
  for (const pos of BALL_POSITIONS) {
    spawnBall(world, pos);
  }
  console.log('[GAME] pieces=spawned');
}

/**
 * Physics steps on the raw frame delta; page load / headless stalls produce
 * multi-second deltas that tunnel freshly-falling bodies through colliders.
 * Hold the dynamic spawns until frames are stable, then spawn once.
 */
export class BootSystem extends createSystem({}) {
  private stableFrames = 0;
  private spawned = false;

  update(delta: number) {
    if (this.spawned) {
      return;
    }
    this.stableFrames = delta < SPAWN_MAX_DELTA ? this.stableFrames + 1 : 0;
    if (this.stableFrames >= SPAWN_STABLE_FRAMES) {
      this.spawned = true;
      spawnGamePieces(this.world);
    }
  }
}
