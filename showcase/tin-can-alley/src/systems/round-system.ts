import {
  AudioUtils,
  createSystem,
  Grabbed,
  PhysicsBody,
  Transform,
  type Entity,
} from '@iwsdk/core';
import { gameGlobals } from '../components/game-state';
import { Ball } from '../components/softball';
import { Can, Downed } from '../components/tin-can';
import { BALLS_PER_ROUND, SETTLE_SECONDS } from '../constants';
import {
  addCanPhysics,
  BALL_BODY,
  BALL_SHAPE,
  parkAtPose,
  resetDynamicPose,
  spawnBall,
} from '../scene/spawn';

const IDENTITY_QUAT = [0, 0, 0, 1] as const;

/**
 * Owns the round lifecycle: ball budget, round-state transitions, the
 * settle window after the last throw, the clear sting, and reset.
 * Throw detection = Grabbed-tag disqualify on a Ball (release ends a grab).
 */
export class RoundSystem extends createSystem({
  balls: { required: [Ball, Transform, PhysicsBody] },
  heldBalls: { required: [Ball, Grabbed] },
  cans: { required: [Can, Transform] },
}) {
  private resetting = false;
  private resetPending = false;
  private outOfBounds: Entity[] = [];
  private settleTimer = -1;
  private clearPlaysLeft = 0;
  private clearTimer = 0;
  private lastResetHandled = 0;

  init() {
    const g = gameGlobals(this.globals);

    this.queries.heldBalls.subscribe('qualify', () => {
      if (g.roundState.peek() === 'ready') {
        // Cans are body-less while waiting (delta-spike-proof pyramid);
        // the round going live is the moment they become knockable.
        for (const can of this.queries.cans.entities) {
          addCanPhysics(can);
        }
        g.roundState.value = 'live';
        console.log('[GAME] round=live');
      }
    });

    this.queries.heldBalls.subscribe('disqualify', (entity) => {
      if (this.resetting) {
        return;
      }
      // destroy() also fires disqualify after components are gone
      if (!entity.hasComponent(Ball)) {
        return;
      }
      if (entity.getValue(Ball, 'thrown')) {
        return;
      }
      entity.setValue(Ball, 'thrown', true);
      g.ballsLeft.value = g.ballsLeft.peek() - 1;
      console.log(`[GAME] balls=${g.ballsLeft.peek()}`);
      if (g.ballsLeft.peek() <= 0) {
        this.settleTimer = SETTLE_SECONDS;
      }
    });

    // Monotonic counter; subscribe fires immediately with the current value,
    // so only react to increases past what we've already handled. The reset
    // itself is DEFERRED to the next update tick: the request arrives from
    // a UIKit pointer-event handler, and tearing down physics bodies inside
    // that dispatch wedges the runtime.
    this.cleanupFuncs.push(
      g.resetRequested.subscribe((count) => {
        if (count > this.lastResetHandled) {
          this.lastResetHandled = count;
          this.resetPending = true;
        }
      }),
    );

    this.cleanupFuncs.push(
      g.roundState.subscribe((state) => {
        if (state === 'cleared') {
          this.settleTimer = -1;
          // Carnival sting: 3 staggered chime plays (no pitch API exists).
          AudioUtils.play(g.clearSfx);
          console.log('[GAME] sfx=clear');
          this.clearPlaysLeft = 2;
          this.clearTimer = 0.12;
        }
      }),
    );
  }

  update(delta: number) {
    const g = gameGlobals(this.globals);

    if (this.resetPending) {
      this.resetPending = false;
      this.doReset();
    }

    // Self-healing: any ball that escapes the arena (physics hitch, wild
    // throw) comes back to its counter slot. Detect on the live Set with a
    // reused scratch array (zero steady-state allocations); mutate only
    // outside the Set iteration (re-adds mid-iteration would be revisited).
    this.outOfBounds.length = 0;
    for (const ball of this.queries.balls.entities) {
      const pos = ball.object3D!.position;
      if (
        pos.y < -1 ||
        pos.y > 6 ||
        Math.abs(pos.x) > 3 ||
        pos.z > 3 ||
        pos.z < -5
      ) {
        this.outOfBounds.push(ball);
      }
    }
    for (const ball of this.outOfBounds) {
      const wasThrown = ball.getValue(Ball, 'thrown');
      if (ball.hasComponent(Grabbed)) {
        const ip = ball.getVectorView(Ball, 'initialPosition');
        const slot: [number, number, number] = [ip[0], ip[1], ip[2]];
        this.resetting = true; // suppress the throw-decrement on destroy
        ball.destroy();
        this.resetting = false;
        const fresh = spawnBall(this.world, slot);
        fresh.setValue(Ball, 'thrown', wasThrown === true);
      } else {
        resetDynamicPose(
          ball,
          ball.getVectorView(Ball, 'initialPosition'),
          IDENTITY_QUAT,
          BALL_SHAPE,
          BALL_BODY,
        );
      }
      console.log('[GAME] ball=recovered');
    }

    if (this.settleTimer > 0) {
      this.settleTimer -= delta;
      if (this.settleTimer <= 0 && g.roundState.peek() === 'live') {
        g.roundState.value = 'out';
        console.log('[GAME] round=out');
      }
    }

    if (this.clearPlaysLeft > 0) {
      this.clearTimer -= delta;
      if (this.clearTimer <= 0) {
        AudioUtils.play(g.clearSfx);
        this.clearPlaysLeft -= 1;
        this.clearTimer = 0.12;
      }
    }
  }

  private doReset() {
    const g = gameGlobals(this.globals);
    this.resetting = true;
    this.settleTimer = -1;
    this.clearPlaysLeft = 0;

    // NOTE: iterate over COPIES — resetDynamicPose removes and re-adds
    // components, and entities re-qualifying mid-iteration would be visited
    // again by the live query Set (infinite loop).
    const cans = Array.from(this.queries.cans.entities);
    const balls = Array.from(this.queries.balls.entities);

    // Cans: back to the captured pyramid pose, body-less until next round.
    for (const can of cans) {
      if (can.hasComponent(Downed)) {
        can.removeComponent(Downed);
      }
      parkAtPose(
        can,
        can.getVectorView(Can, 'initialPosition'),
        can.getVectorView(Can, 'initialOrientation'),
      );
    }

    // Balls: held ones cannot be force-released in 0.4.2 — destroy and
    // respawn at their own counter slot; free ones teleport back.
    const toRespawn: Array<[number, number, number]> = [];
    for (const ball of balls) {
      if (ball.hasComponent(Grabbed)) {
        const ip = ball.getVectorView(Ball, 'initialPosition');
        toRespawn.push([ip[0], ip[1], ip[2]]);
        ball.destroy();
      } else {
        resetDynamicPose(
          ball,
          ball.getVectorView(Ball, 'initialPosition'),
          IDENTITY_QUAT,
          BALL_SHAPE,
          BALL_BODY,
        );
        ball.setValue(Ball, 'thrown', false);
      }
    }
    for (const pos of toRespawn) {
      spawnBall(this.world, pos);
    }

    g.score.value = 0;
    g.ballsLeft.value = BALLS_PER_ROUND;
    g.roundState.value = 'ready';
    console.log('[GAME] round=reset');
    this.resetting = false;
  }
}
