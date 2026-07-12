import {
  AudioUtils,
  createSystem,
  PhysicsBody,
  Quaternion,
  Transform,
  Types,
  Vector3,
  type Entity,
} from '@iwsdk/core';
import { gameGlobals } from '../components/game-state';
import { Can, Downed } from '../components/tin-can';
import {
  CAN_COUNT,
  SHELF_DEPTH_TOL,
  SHELF_HALF_WIDTH,
  SHELF_TOP_Y,
  SHELF_Z,
  TIP_DEGREES,
} from '../constants';

/**
 * Detects knocked-down cans (no collision events exist in IWSDK — detection
 * is Transform-based) and owns the score. A can is "down" when its up axis
 * tips past the threshold OR it leaves the shelf zone. Runs in the sim band
 * (after PhysicsSystem at -2) so it reads post-step poses.
 */
export class ScoringSystem extends createSystem(
  {
    standing: {
      required: [Can, Transform, PhysicsBody],
      excluded: [Downed],
    },
    downed: { required: [Can, Downed] },
  },
  {
    shelfY: { type: Types.Float32, default: SHELF_TOP_Y },
    shelfHalfWidth: { type: Types.Float32, default: SHELF_HALF_WIDTH },
    shelfZ: { type: Types.Float32, default: SHELF_Z },
    shelfDepthTol: { type: Types.Float32, default: SHELF_DEPTH_TOL },
    tipDegrees: { type: Types.Float32, default: TIP_DEGREES },
  },
) {
  private up!: Vector3;
  private q!: Quaternion;
  private pos!: Vector3;
  private toDown!: Entity[];

  init() {
    this.up = new Vector3();
    this.q = new Quaternion();
    this.pos = new Vector3();
    this.toDown = [];

    this.queries.downed.subscribe('qualify', () => {
      const g = gameGlobals(this.globals);
      g.score.value = g.score.peek() + 1;
      console.log(`[GAME] score=${g.score.peek()}`);
      AudioUtils.play(g.hitSfx);
      console.log('[GAME] sfx=hit');
      if (this.queries.downed.entities.size >= CAN_COUNT) {
        g.roundState.value = 'cleared';
        console.log('[GAME] round=cleared');
      }
    });
  }

  update() {
    const cosTip = Math.cos((this.config.tipDegrees.peek() * Math.PI) / 180);
    const shelfY = this.config.shelfY.peek();
    const halfW = this.config.shelfHalfWidth.peek();
    const shelfZ = this.config.shelfZ.peek();
    const depthTol = this.config.shelfDepthTol.peek();

    this.toDown.length = 0;
    for (const entity of this.queries.standing.entities) {
      const obj = entity.object3D!;
      obj.getWorldQuaternion(this.q);
      this.up.set(0, 1, 0).applyQuaternion(this.q);
      obj.getWorldPosition(this.pos);

      const tipped = this.up.y < cosTip;
      const offShelf =
        this.pos.y < shelfY - 0.15 ||
        Math.abs(this.pos.x) > halfW + 0.1 ||
        Math.abs(this.pos.z - shelfZ) > depthTol;

      if (tipped || offShelf) {
        this.toDown.push(entity);
      }
    }
    for (const entity of this.toDown) {
      entity.addComponent(Downed);
    }
  }
}
