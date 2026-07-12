import { createComponent, Types } from '@iwsdk/core';

/**
 * A throwable softball. `thrown` flips true on its first release so
 * re-grabbing a spent ball never double-decrements the budget.
 */
export const Ball = createComponent('Ball', {
  initialPosition: { type: Types.Vec3, default: [0, 0, 0] },
  thrown: { type: Types.Boolean, default: false },
});
