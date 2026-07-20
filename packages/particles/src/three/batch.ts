/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  CustomBlending,
  DynamicDrawUsage,
  InstancedBufferGeometry,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  Mesh,
  NormalBlending,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
  Texture,
  Vector2,
} from 'three';
import { CompiledEffect } from '../core/engine.js';
import { ParticlePool } from '../core/pool.js';
import { particleFragmentShader, particleVertexShader } from './shaders.js';

/**
 * Instance layouts (floats per instance):
 * - billboard / horizontal / vertical: offset(3) color(4) rotation(1)
 *   size(1) frame(1) = 10
 * - stretched: + velocity(4) = 14
 */
const BASE_STRIDE = 10;
const STRETCHED_STRIDE = 14;

/**
 * One instanced draw call: every effect that shares this batch's material
 * key packs into a single interleaved buffer — one allocation, one update
 * range, one GPU upload per frame (an object-engine baseline uploaded 5–6
 * separate attribute buffers per batch).
 *
 * @category Particles
 */
export class ParticleBatch extends Mesh {
  private interleaved: InstancedInterleavedBuffer;
  private readonly stride: number;
  private readonly members: CompiledEffect[] = [];
  private readonly stretched: boolean;

  constructor(effect: CompiledEffect) {
    const mode = effect.def.mode ?? 'billboard';
    const stretched = mode === 'stretched';
    const stride = stretched ? STRETCHED_STRIDE : BASE_STRIDE;

    let capacity = 0;
    const geometry = new InstancedBufferGeometry();
    const quad = new Float32Array([
      -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
    ]);
    const uv = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
    geometry.setAttribute('position', new BufferAttribute(quad, 3));
    geometry.setAttribute('uv', new BufferAttribute(uv, 2));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);

    const material = ParticleBatch.buildMaterial(effect);

    super(geometry, material);
    this.stride = stride;
    this.stretched = stretched;
    this.frustumCulled = false;
    this.name = `ParticleBatch:${effect.def.name}`;
    // Particle batches are never pointer-interaction targets.
    this.raycast = () => {};

    this.interleaved = new InstancedInterleavedBuffer(
      new Float32Array(0),
      stride,
    );
    this.addMember(effect);
    capacity = this.reservedCapacity();
    this.rebuildBuffer(capacity);
  }

  private static buildMaterial(effect: CompiledEffect): ShaderMaterial {
    const def = effect.def.material ?? {};
    const blending = def.blending ?? 'additive';
    const map = (def.map as Texture | undefined) ?? null;
    const tiles = def.tiles ?? { u: 1, v: 1 };
    const defines: Record<string, string> = {};
    const mode = effect.def.mode ?? 'billboard';
    if (mode === 'stretched') {
      defines.MODE_STRETCHED = '';
    } else if (mode === 'horizontal') {
      defines.MODE_HORIZONTAL = '';
    } else if (mode === 'vertical') {
      defines.MODE_VERTICAL = '';
    }
    if (map) {
      defines.USE_PARTICLE_MAP = '';
    }
    if (blending === 'premultiplied') {
      defines.BLEND_PREMULTIPLIED = '';
    }
    const material = new ShaderMaterial({
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      defines,
      uniforms: {
        uMap: { value: map },
        uUseMap: { value: map ? 1 : 0 },
        uTileCount: { value: new Vector2(tiles.u, tiles.v) },
      },
      transparent: true,
      depthWrite: def.depthWrite ?? false,
      depthTest: true,
    });
    if (blending === 'additive') {
      material.blending = AdditiveBlending;
    } else if (blending === 'normal') {
      material.blending = NormalBlending;
    } else {
      material.blending = CustomBlending;
      material.blendSrc = OneFactor;
      material.blendDst = OneMinusSrcAlphaFactor;
    }
    return material;
  }

  /**
   * Material/mode compatibility key. Effects with equal keys share a batch
   * (and therefore a draw call).
   */
  static keyOf(effect: CompiledEffect): string {
    const def = effect.def.material ?? {};
    const map = def.map as Texture | undefined;
    const tiles = def.tiles ?? { u: 1, v: 1 };
    return [
      effect.def.mode ?? 'billboard',
      def.blending ?? 'additive',
      map ? map.uuid : 'none',
      tiles.u,
      tiles.v,
      def.depthWrite ?? false,
    ].join('|');
  }

  /** Sum of member capacities — the exact buffer size needed. */
  private reservedCapacity(): number {
    let capacity = 0;
    for (const member of this.members) {
      capacity += member.def.capacity;
    }
    return capacity;
  }

  addMember(effect: CompiledEffect): void {
    if (this.members.indexOf(effect) === -1) {
      this.members.push(effect);
      const capacity = this.reservedCapacity();
      if (capacity * this.stride > this.interleaved.array.length) {
        this.rebuildBuffer(capacity);
      }
    }
  }

  private rebuildBuffer(capacity: number): void {
    const geometry = this.geometry as InstancedBufferGeometry;
    this.interleaved = new InstancedInterleavedBuffer(
      new Float32Array(Math.max(1, capacity) * this.stride),
      this.stride,
    );
    this.interleaved.setUsage(DynamicDrawUsage);
    geometry.setAttribute(
      'instanceOffset',
      new InterleavedBufferAttribute(this.interleaved, 3, 0),
    );
    geometry.setAttribute(
      'instanceColor',
      new InterleavedBufferAttribute(this.interleaved, 4, 3),
    );
    geometry.setAttribute(
      'instanceRotation',
      new InterleavedBufferAttribute(this.interleaved, 1, 7),
    );
    geometry.setAttribute(
      'instanceSize',
      new InterleavedBufferAttribute(this.interleaved, 1, 8),
    );
    geometry.setAttribute(
      'instanceFrame',
      new InterleavedBufferAttribute(this.interleaved, 1, 9),
    );
    if (this.stretched) {
      geometry.setAttribute(
        'instanceVelocity',
        new InterleavedBufferAttribute(this.interleaved, 4, 10),
      );
    }
  }

  /**
   * Packs every member pool into the interleaved buffer and issues a single
   * ranged upload. Hides the batch entirely when empty (an instanceCount of
   * zero still costs a draw call).
   */
  pack(): number {
    const array = this.interleaved.array as Float32Array;
    const stride = this.stride;
    let index = 0;
    for (const member of this.members) {
      const pool: ParticlePool = member.pool;
      const count = pool.count;
      const stretch = member.def.stretch ?? {};
      const speedFactor = stretch.speedFactor ?? 0.1;
      const lengthFactor = stretch.lengthFactor ?? 1;
      let base = index * stride;
      for (let i = 0; i < count; i++, index++, base += stride) {
        array[base] = pool.posX[i];
        array[base + 1] = pool.posY[i];
        array[base + 2] = pool.posZ[i];
        array[base + 3] = pool.colR[i];
        array[base + 4] = pool.colG[i];
        array[base + 5] = pool.colB[i];
        array[base + 6] = pool.colA[i];
        array[base + 7] = pool.rotation[i];
        array[base + 8] = pool.size[i];
        array[base + 9] = pool.frame[i];
        if (this.stretched) {
          array[base + 10] = pool.velX[i] * speedFactor;
          array[base + 11] = pool.velY[i] * speedFactor;
          array[base + 12] = pool.velZ[i] * speedFactor;
          array[base + 13] = lengthFactor;
        }
      }
    }
    const geometry = this.geometry as InstancedBufferGeometry;
    geometry.instanceCount = index;
    this.visible = index > 0;
    if (index > 0) {
      this.interleaved.clearUpdateRanges();
      this.interleaved.addUpdateRange(0, index * stride);
      this.interleaved.needsUpdate = true;
    }
    return index;
  }

  dispose(): void {
    this.geometry.dispose();
    (this.material as ShaderMaterial).dispose();
  }
}
