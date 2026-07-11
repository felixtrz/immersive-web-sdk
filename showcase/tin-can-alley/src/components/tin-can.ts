import { createComponent, Types } from '@iwsdk/core';

/**
 * A knockable tin can. Initial pose is captured at spawn so reset can
 * restack the pyramid exactly (read via getVectorView — elics vector fields
 * must not go through setValue/getValue).
 */
export const Can = createComponent('Can', {
  initialPosition: { type: Types.Vec3, default: [0, 0, 0] },
  initialOrientation: { type: Types.Vec4, default: [0, 0, 0, 1] },
});

/** Tag: this can has been knocked down this round (cleared on reset). */
export const Downed = createComponent(
  'Downed',
  {},
  'can knocked down this round',
);
