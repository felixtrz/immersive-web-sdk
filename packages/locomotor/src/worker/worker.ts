/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Matrix4, Vector3 } from 'three';
import { LocomotionEngine } from '../core/engine.js';
import { MessageType } from '../types/message-types.js';

console.log('[Locomotor Worker] Worker script loaded and executing');

let engine: LocomotionEngine;

let updateFrequency = 60;
const tempVec1 = new Vector3();
const tempVec2 = new Vector3();
const tempMatrix = new Matrix4();

const environments = new Set<number>();

onmessage = function (e) {
  console.log('[Locomotor Worker] Received message:', e.data);
  if (!(e.data instanceof Array)) {
    const { type, payload } = e.data;
    switch (type) {
      case MessageType.Init: {
        console.log(
          '[Locomotor Worker] Initializing engine with position:',
          payload.initialPlayerPosition,
        );
        engine = new LocomotionEngine(
          tempVec1.fromArray(payload.initialPlayerPosition),
        );
        console.log('[Locomotor Worker] Engine initialized successfully');
        break;
      }
      case MessageType.AddEnvironment: {
        if (engine && payload.handle && payload.positions && payload.indices) {
          environments.add(payload.handle);

          const worldMatrix = payload.worldMatrix
            ? tempMatrix.fromArray(payload.worldMatrix)
            : new Matrix4();

          engine.addEnvironment(
            payload.handle,
            payload.positions,
            payload.indices,
            payload.type || 'STATIC',
            worldMatrix,
          );
        }
        break;
      }
      case MessageType.RemoveEnvironment: {
        if (engine && payload.handle) {
          environments.delete(payload.handle);
          engine.removeEnvironment(payload.handle);
        }
        break;
      }
      case MessageType.Config: {
        if (payload.rayGravity !== undefined) {
          engine.rayGravity = payload.rayGravity;
        }
        if (payload.maxDropDistance !== undefined) {
          engine.setMaxDropDistance(payload.maxDropDistance);
        }
        if (payload.jumpHeight !== undefined) {
          engine.jumpHeight = payload.jumpHeight;
        }
        if (payload.jumpCooldown !== undefined) {
          engine.jumpCooldown = payload.jumpCooldown;
        }
        if (payload.updateFrequency !== undefined) {
          updateFrequency = payload.updateFrequency;
        }
        break;
      }
    }
  } else {
    const type = e.data[0];
    switch (type) {
      case MessageType.Slide: {
        engine?.slide(tempVec1.fromArray(e.data, 1));
        break;
      }

      case MessageType.Teleport: {
        engine?.teleport(tempVec1.fromArray(e.data, 1));
        break;
      }

      case MessageType.ParabolicRaycast: {
        const intersect = engine?.parabolicRaycast(
          tempVec1.fromArray(e.data, 1),
          tempVec2.fromArray(e.data, 4),
        );
        const response = new Array(7).fill(NaN);
        response[0] = MessageType.RaycastUpdate;
        if (intersect) {
          intersect.point.toArray(response, 1);
          if (intersect.face) {
            intersect.face.normal.toArray(response, 4);
          }
        }
        self.postMessage(response);
        break;
      }

      case MessageType.UpdateKinematicEnvironment: {
        const envId = e.data[1];

        if (engine && environments.has(envId)) {
          const matrixElements = e.data.slice(2, 18);
          const worldMatrix = tempMatrix.fromArray(matrixElements);
          engine.updateKinematicPlatform(envId, worldMatrix);
        }
        break;
      }

      case MessageType.Jump: {
        engine?.jump();
        break;
      }
    }
  }
};

let updateCount = 0;
function update() {
  engine?.update(1 / updateFrequency);
  if (engine?.updating) {
    const response = new Array(7).fill(NaN);
    response[0] = MessageType.PositionUpdate;
    engine.playerPosition.toArray(response, 1);
    response[5] = engine.isGrounded ? 1 : 0;
    self.postMessage(response);
    updateCount++;
    if (updateCount <= 3 || updateCount % 100 === 0) {
      console.log(
        '[Locomotor Worker] Sent position update #' + updateCount + ':',
        response.slice(1, 4),
      );
    }
  }
  setTimeout(update, 1000 / updateFrequency);
}

console.log('[Locomotor Worker] Starting update loop');
update();
