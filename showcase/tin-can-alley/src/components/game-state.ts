import type { Entity } from '@iwsdk/core';
import type { Signal } from '@preact/signals-core';

export type RoundState = 'ready' | 'live' | 'cleared' | 'out';

/**
 * Shape of the game's world.globals entries. All cross-system state lives
 * here as signals; systems read with .peek() in update() and subscribe in
 * init() (registered via cleanupFuncs).
 */
export interface GameGlobals {
  score: Signal<number>;
  ballsLeft: Signal<number>;
  roundState: Signal<RoundState>;
  /** Monotonic counter — increment to request a round reset. */
  resetRequested: Signal<number>;
  hitSfx: Entity;
  clearSfx: Entity;
}

/** Single cast site for the untyped world.globals bag. */
export function gameGlobals(globals: Record<string, unknown>): GameGlobals {
  return globals as unknown as GameGlobals;
}
