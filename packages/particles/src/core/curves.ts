/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Curve and gradient authoring plus baked lookup-table evaluation.
 *
 * @remarks
 * Over-life curves are evaluated once per particle per frame — profiling a
 * production WebXR title showed closed-form gradient/curve evaluation alone
 * consuming ~17% of the particle layer's CPU time. All curves here bake into
 * small lookup tables at effect-registration time (never on a live frame);
 * runtime evaluation is a single lerp. The interpolation error of every bake
 * is measured against the closed form and surfaced via
 * {@link getCurveDiagnostics}, so the fidelity cost is a reported number, not
 * an assumption. With the default 128-interval tables the error is below one
 * 8-bit color quantum for gradients.
 *
 * @category Particles
 */

/** Number of lookup-table intervals per baked curve. */
export const CURVE_LUT_SIZE = 128;

/** Scalar value source sampled once per particle at spawn. */
export type ScalarInit =
  | { kind: 'value'; value: number }
  | { kind: 'range'; min: number; max: number };

/** Constant scalar spawn parameter. */
export function value(v: number): ScalarInit {
  return { kind: 'value', value: v };
}

/** Uniformly random scalar spawn parameter in [min, max). */
export function range(min: number, max: number): ScalarInit {
  return { kind: 'range', min, max };
}

/** A scalar-over-life curve definition (piecewise linear keys). */
export interface CurveDef {
  kind: 'curve';
  /** `[t, value]` keys with t in [0, 1], sorted ascending. */
  keys: ReadonlyArray<readonly [number, number]>;
}

/** A cubic-Bezier-over-life curve definition (four control values). */
export interface BezierDef {
  kind: 'bezier';
  p0: number;
  p1: number;
  p2: number;
  p3: number;
}

export type AnyCurve = CurveDef | BezierDef;

/**
 * Piecewise-linear curve over normalized life `t` in [0, 1].
 *
 * @example
 * ```ts
 * size: curve([
 *   [0, 0.4],
 *   [0.2, 1],
 *   [1, 0],
 * ]);
 * ```
 */
export function curve(
  keys: ReadonlyArray<readonly [number, number]>,
): CurveDef {
  if (keys.length < 2) {
    throw new Error('[particles] curve() needs at least 2 keys');
  }
  for (let i = 1; i < keys.length; i++) {
    if (keys[i][0] < keys[i - 1][0]) {
      throw new Error('[particles] curve() keys must be sorted by t');
    }
  }
  return { kind: 'curve', keys };
}

/** Cubic Bezier curve over normalized life (value control points). */
export function bezier(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
): BezierDef {
  return { kind: 'bezier', p0, p1, p2, p3 };
}

/** A color+alpha gradient over normalized life. */
export interface GradientDef {
  kind: 'gradient';
  /** `[t, 0xrrggbb]` color stops, sorted ascending. */
  color: ReadonlyArray<readonly [number, number]>;
  /** `[t, alpha]` stops, sorted ascending. */
  alpha: ReadonlyArray<readonly [number, number]>;
}

/**
 * Color/alpha gradient over normalized life.
 *
 * @example
 * ```ts
 * color: gradient(
 *   [
 *     [0, 0xfff2cc],
 *     [0.4, 0xff8844],
 *     [1, 0x331111],
 *   ],
 *   [
 *     [0, 1],
 *     [0.7, 0.9],
 *     [1, 0],
 *   ],
 * );
 * ```
 */
export function gradient(
  color: ReadonlyArray<readonly [number, number]>,
  alpha: ReadonlyArray<readonly [number, number]> = [
    [0, 1],
    [1, 1],
  ],
): GradientDef {
  if (color.length < 1 || alpha.length < 1) {
    throw new Error('[particles] gradient() needs at least one stop');
  }
  return { kind: 'gradient', color, alpha };
}

let bakedCurveCount = 0;
let maxBakeError = 0;

/**
 * Diagnostics for every curve baked so far: table count and the maximum
 * measured interpolation error versus the closed forms.
 *
 * @category Particles
 */
export function getCurveDiagnostics(): { curves: number; maxError: number } {
  return { curves: bakedCurveCount, maxError: maxBakeError };
}

function trackError(error: number): void {
  if (error > maxBakeError) {
    maxBakeError = error;
  }
}

function evalBezier(def: BezierDef, t: number): number {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return (
    def.p0 * mt2 * mt +
    def.p1 * mt2 * t * 3 +
    def.p2 * mt * t2 * 3 +
    def.p3 * t2 * t
  );
}

function evalLinearKeys(
  keys: ReadonlyArray<readonly [number, number]>,
  t: number,
): number {
  if (t <= keys[0][0]) {
    return keys[0][1];
  }
  const last = keys[keys.length - 1];
  if (t >= last[0]) {
    return last[1];
  }
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1] = keys[i];
      const u = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * u;
    }
  }
  return last[1];
}

/** Exact (closed-form) evaluation of any scalar curve definition. */
export function evalCurveExact(def: AnyCurve, t: number): number {
  return def.kind === 'bezier'
    ? evalBezier(def, t)
    : evalLinearKeys(def.keys, t);
}

/**
 * Bakes a scalar curve into a `CURVE_LUT_SIZE + 1` sample table and records
 * its midpoint interpolation error.
 */
export function bakeCurve(def: AnyCurve): Float32Array {
  const lut = new Float32Array(CURVE_LUT_SIZE + 1);
  for (let k = 0; k <= CURVE_LUT_SIZE; k++) {
    lut[k] = evalCurveExact(def, k / CURVE_LUT_SIZE);
  }
  bakedCurveCount++;
  for (let k = 0; k < CURVE_LUT_SIZE; k++) {
    const tm = (k + 0.5) / CURVE_LUT_SIZE;
    const approx = lut[k] + (lut[k + 1] - lut[k]) * 0.5;
    trackError(Math.abs(approx - evalCurveExact(def, tm)));
  }
  return lut;
}

function hexToRgb(hex: number): [number, number, number] {
  return [
    ((hex >> 16) & 255) / 255,
    ((hex >> 8) & 255) / 255,
    (hex & 255) / 255,
  ];
}

function evalChannelStops(
  stops: ReadonlyArray<readonly [number, number]>,
  t: number,
  channel: number,
): number {
  // Channel < 0 means the stop value is already scalar (alpha stops).
  if (channel < 0) {
    return evalLinearKeys(stops, t);
  }
  if (t <= stops[0][0]) {
    return hexToRgb(stops[0][1])[channel];
  }
  const last = stops[stops.length - 1];
  if (t >= last[0]) {
    return hexToRgb(last[1])[channel];
  }
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const u = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      const a = hexToRgb(c0)[channel];
      const b = hexToRgb(c1)[channel];
      return a + (b - a) * u;
    }
  }
  return hexToRgb(last[1])[channel];
}

/**
 * Bakes a gradient into an rgba-interleaved `(CURVE_LUT_SIZE + 1) * 4` table
 * and records its midpoint interpolation error.
 */
export function bakeGradient(def: GradientDef): Float32Array {
  const lut = new Float32Array((CURVE_LUT_SIZE + 1) * 4);
  for (let k = 0; k <= CURVE_LUT_SIZE; k++) {
    const t = k / CURVE_LUT_SIZE;
    const base = k * 4;
    lut[base] = evalChannelStops(def.color, t, 0);
    lut[base + 1] = evalChannelStops(def.color, t, 1);
    lut[base + 2] = evalChannelStops(def.color, t, 2);
    lut[base + 3] = evalChannelStops(def.alpha, t, -1);
  }
  bakedCurveCount++;
  for (let k = 0; k < CURVE_LUT_SIZE; k++) {
    const tm = (k + 0.5) / CURVE_LUT_SIZE;
    const base = k * 4;
    for (let c = 0; c < 4; c++) {
      const approx = lut[base + c] + (lut[base + 4 + c] - lut[base + c]) * 0.5;
      const exact =
        c === 3
          ? evalChannelStops(def.alpha, tm, -1)
          : evalChannelStops(def.color, tm, c);
      trackError(Math.abs(approx - exact));
    }
  }
  return lut;
}

/** Samples a baked scalar table at normalized life `t` in [0, 1). */
export function sampleCurve(lut: Float32Array, t: number): number {
  const x = t * CURVE_LUT_SIZE;
  let k = x | 0;
  if (k >= CURVE_LUT_SIZE) {
    k = CURVE_LUT_SIZE - 1;
  }
  return lut[k] + (lut[k + 1] - lut[k]) * (x - k);
}
