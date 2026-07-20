/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from 'vitest';
import {
  bakeCurve,
  bakeGradient,
  bezier,
  curve,
  evalCurveExact,
  getCurveDiagnostics,
  gradient,
  sampleCurve,
} from '../src/index.js';

describe('curves', () => {
  it('bakes bezier curves within one 8-bit quantum of the closed form', () => {
    const def = bezier(0.2, 1.4, -0.1, 0.9);
    const lut = bakeCurve(def);
    let maxError = 0;
    for (let i = 0; i <= 1000; i++) {
      const t = i / 1000;
      maxError = Math.max(
        maxError,
        Math.abs(
          sampleCurve(lut, Math.min(t, 0.999999)) - evalCurveExact(def, t),
        ),
      );
    }
    expect(maxError).toBeLessThan(1 / 255);
  });

  it('reproduces linear key curves exactly at the keys', () => {
    const def = curve([
      [0, 0.5],
      [0.25, 1],
      [1, 0],
    ]);
    const lut = bakeCurve(def);
    expect(lut[0]).toBeCloseTo(0.5, 6);
    expect(sampleCurve(lut, 0.25)).toBeCloseTo(1, 5);
  });

  it('bakes gradients with alpha channels', () => {
    const lut = bakeGradient(
      gradient(
        [
          [0, 0xff0000],
          [1, 0x0000ff],
        ],
        [
          [0, 1],
          [1, 0],
        ],
      ),
    );
    expect(lut[0]).toBeCloseTo(1, 5); // r at t=0
    expect(lut[3]).toBeCloseTo(1, 5); // a at t=0
    const last = (lut.length / 4 - 1) * 4;
    expect(lut[last + 2]).toBeCloseTo(1, 5); // b at t=1
    expect(lut[last + 3]).toBeCloseTo(0, 5); // a at t=1
  });

  it('tracks bake diagnostics', () => {
    const before = getCurveDiagnostics().curves;
    bakeCurve(
      curve([
        [0, 0],
        [1, 1],
      ]),
    );
    const after = getCurveDiagnostics();
    expect(after.curves).toBe(before + 1);
    expect(after.maxError).toBeLessThan(1 / 255);
  });
});
