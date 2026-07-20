/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Instanced sprite shaders. One vertex shader covers every render mode via
 * defines; attributes come from a single interleaved instance buffer.
 *
 * Modes:
 * - billboard: camera-facing quad, rotated by the particle angle.
 * - stretched: elongated along the particle's view-space velocity.
 * - horizontal: fixed in the world XZ plane.
 * - vertical: Y-up quad facing the camera horizontally.
 *
 * @category Particles
 */
export const particleVertexShader = /* glsl */ `
attribute vec3 instanceOffset;
attribute vec4 instanceColor;
attribute float instanceRotation;
attribute float instanceSize;
attribute float instanceFrame;
#ifdef MODE_STRETCHED
attribute vec4 instanceVelocity;
#endif

uniform vec2 uTileCount;

varying vec2 vUv;
varying vec4 vColor;

void main() {
  vColor = instanceColor;

  float frame = floor(instanceFrame + 0.001);
  float column = mod(frame, uTileCount.x);
  float row = floor(frame / uTileCount.x);
  vec2 tileScale = 1.0 / uTileCount;
  vUv = (uv + vec2(column, uTileCount.y - 1.0 - row)) * tileScale;

  vec2 corner = position.xy * instanceSize;

#ifdef MODE_HORIZONTAL
  float c = cos(instanceRotation);
  float s = sin(instanceRotation);
  vec3 local = vec3(
    corner.x * c - corner.y * s,
    0.0,
    corner.x * s + corner.y * c
  );
  vec4 worldPosition = modelMatrix * vec4(instanceOffset + local, 1.0);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
#elif defined(MODE_VERTICAL)
  vec4 center = modelMatrix * vec4(instanceOffset, 1.0);
  vec3 toCamera = cameraPosition - center.xyz;
  toCamera.y = 0.0;
  vec3 forward = normalize(
    dot(toCamera, toCamera) > 1e-8 ? toCamera : vec3(0.0, 0.0, 1.0)
  );
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
  float c = cos(instanceRotation);
  float s = sin(instanceRotation);
  vec2 rotated = vec2(corner.x * c - corner.y * s, corner.x * s + corner.y * c);
  vec3 world = center.xyz + right * rotated.x + vec3(0.0, 1.0, 0.0) * rotated.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
#elif defined(MODE_STRETCHED)
  vec4 viewCenter = viewMatrix * modelMatrix * vec4(instanceOffset, 1.0);
  vec3 viewVelocity =
    mat3(viewMatrix) * mat3(modelMatrix) * instanceVelocity.xyz;
  float speed = length(viewVelocity.xy);
  vec2 dir = speed > 1e-6 ? viewVelocity.xy / speed : vec2(1.0, 0.0);
  vec2 side = vec2(-dir.y, dir.x);
  float lengthFactor = instanceVelocity.w;
  vec2 stretched =
    dir * corner.x * (instanceSize * lengthFactor + speed) +
    side * corner.y * instanceSize;
  viewCenter.xy += stretched;
  gl_Position = projectionMatrix * viewCenter;
#else
  vec4 viewCenter = viewMatrix * modelMatrix * vec4(instanceOffset, 1.0);
  float c = cos(instanceRotation);
  float s = sin(instanceRotation);
  viewCenter.xy += vec2(corner.x * c - corner.y * s, corner.x * s + corner.y * c);
  gl_Position = projectionMatrix * viewCenter;
#endif
}
`;

export const particleFragmentShader = /* glsl */ `
uniform float uUseMap;
#ifdef USE_PARTICLE_MAP
uniform sampler2D uMap;
#endif

varying vec2 vUv;
varying vec4 vColor;

void main() {
  vec4 texel = vec4(1.0);
#ifdef USE_PARTICLE_MAP
  texel = texture2D(uMap, vUv);
#endif
#ifdef BLEND_PREMULTIPLIED
  // Premultiplied output: alpha slides between additive (0) and normal (1)
  // compositing per particle, in one pipeline.
  vec3 rgb = vColor.rgb * texel.rgb * texel.a;
  gl_FragColor = vec4(rgb, vColor.a * texel.a);
#else
  gl_FragColor = vColor * texel;
#endif
}
`;
