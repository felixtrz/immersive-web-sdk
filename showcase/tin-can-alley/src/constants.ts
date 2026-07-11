/**
 * Shared layout + palette constants for Tin Can Alley.
 * Positions come from design/concept/layout.svg (meters, world space).
 * Physics entities must be scene-root-parented at identity — these are
 * world positions baked in at spawn time.
 */

// Palette (design deck: "neon carnival night")
export const PALETTE = {
  midnightIndigo: 0x120c2e,
  boothIndigo: 0x241b54,
  stringAmber: 0xffb347,
  carnivalRed: 0xe23b3b,
  canvasCream: 0xf6eedc,
  tinSilver: 0xc7cdd4,
  floorAsphalt: 0x232228,
  woodBrown: 0x6b4a2f,
} as const;

// Booth geometry (top surfaces: floor 0, counter 0.9, shelf 1.1).
// Solid blocks — thin plates tunnel under headless delta spikes (variable
// timestep physics): every static is chunky and the floor extends under
// the booth as a catch surface.
export const FLOOR = {
  size: [4, 0.1, 6] as const,
  pos: [0, -0.05, -1] as const,
};
export const COUNTER = {
  size: [2, 0.9, 0.5] as const,
  pos: [0, 0.45, -2.2] as const,
};
export const SHELF = {
  size: [2, 0.3, 0.35] as const,
  pos: [0, 0.95, -2.8] as const,
};

// Spawn gate: hold dynamic spawns until the frame delta is stable so the
// first physics steps can't tunnel the freshly-dropped bodies.
export const SPAWN_STABLE_FRAMES = 5;
export const SPAWN_MAX_DELTA = 0.05;

// Cans (cylinders)
export const CAN_RADIUS = 0.035;
export const CAN_HEIGHT = 0.12;
export const CAN_DENSITY = 150;
/**
 * 3-2-1 pyramid; base row 5 mm above the shelf top so contacts settle in.
 * Horizontal spacing must be ~2*CAN_RADIUS so upper rows rest on the rims
 * of the two cans below — wider spacing leaves upper cans unsupported and
 * the pyramid collapses at spawn.
 */
export const CAN_POSITIONS: ReadonlyArray<readonly [number, number, number]> = [
  [-0.075, 1.161, -2.8],
  [0, 1.161, -2.8],
  [0.075, 1.161, -2.8],
  [-0.0375, 1.282, -2.8],
  [0.0375, 1.282, -2.8],
  [0, 1.403, -2.8],
];

/** Invisible containment walls so rolling cans/balls never leave the world. */
export const WALLS: ReadonlyArray<{
  size: readonly [number, number, number];
  pos: readonly [number, number, number];
}> = [
  { size: [0.2, 4, 6], pos: [-2.1, 1.5, -1] }, // left
  { size: [0.2, 4, 6], pos: [2.1, 1.5, -1] }, // right
  { size: [4.4, 4, 0.2], pos: [0, 1.5, -4.1] }, // back
  { size: [4.4, 4, 0.2], pos: [0, 1.5, 2.1] }, // front (behind player)
];

// Balls (spheres) on the counter (top 0.9 + r)
export const BALL_RADIUS = 0.05;
export const BALL_DENSITY = 700;
export const BALL_POSITIONS: ReadonlyArray<readonly [number, number, number]> =
  [
    [-0.3, 0.955, -2.2],
    [0, 0.955, -2.2],
    [0.3, 0.955, -2.2],
  ];

// Scoring zone (shelf AABB + tip threshold) — ScoringSystem config defaults
export const SHELF_TOP_Y = 1.1;
export const SHELF_HALF_WIDTH = 1.0;
export const SHELF_Z = -2.8;
export const SHELF_DEPTH_TOL = 0.35;
export const TIP_DEGREES = 45;

// Round rules
export const BALLS_PER_ROUND = 3;
export const CAN_COUNT = 6;
export const SETTLE_SECONDS = 3;

// UI
export const PANEL_POS = [0, 1.9, -2.9] as const;
export const PANEL_CONFIG = './ui/scoreboard.json';

// Audio
export const HIT_SFX_POS = [0, 1.1, -2.8] as const;
export const CLEAR_SFX_POS = [0, 1.6, -2.5] as const;
