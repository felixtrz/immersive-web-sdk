/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export {
  CURVE_LUT_SIZE,
  bakeCurve,
  bakeGradient,
  bezier,
  curve,
  evalCurveExact,
  getCurveDiagnostics,
  gradient,
  range,
  sampleCurve,
  value,
  type AnyCurve,
  type BezierDef,
  type CurveDef,
  type GradientDef,
  type ScalarInit,
} from './core/curves.js';
export {
  defineEffect,
  type BurstDef,
  type BurstParams,
  type ChildEffectDef,
  type EffectDef,
  type EffectInitDef,
  type EffectOverLifeDef,
  type ParticleBlending,
  type ParticleMaterialDef,
  type ParticleRenderMode,
} from './core/effect.js';
export {
  ParticleEmitterHandle,
  ParticleEngine,
  type CompiledEffect,
  type ParticleEngineStats,
  type SpawnFrame,
} from './core/engine.js';
export { compilePasses, type ParticlePass } from './core/passes.js';
export { ParticlePool } from './core/pool.js';
export { ParticleRng, deriveSeed } from './core/rng.js';
export {
  circle,
  cone,
  hemisphere,
  point,
  sampleShape,
  sphere,
  type ShapeDef,
  type ShapeSample,
} from './core/shapes.js';
export { ParticleBatch } from './three/batch.js';
export { ParticleBatchSet } from './three/batch-set.js';
export {
  particleFragmentShader,
  particleVertexShader,
} from './three/shaders.js';
