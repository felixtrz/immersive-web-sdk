/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PointerEvent, PointerEventsMap } from '@pmndrs/pointer-events';
import { createSystem, Entity, VisibilityState } from '../ecs/index.js';
import { Mesh, Object3D, Object3DEventMap } from '../runtime/index.js';
import { Transform } from '../transform/index.js';
import { Hovered, Interactable, Pressed } from './state-tags.js';

/**
 * Samples XR poses (hands/controllers/head) and gamepads, curates the set of
 * interactables for pointer raycasting, and attaches minimal event listeners.
 *
 * @remarks
 * - Scheduled after player movement so pointers reflect updated transforms.
 * - Rebuilds the interactable list every frame when in XR mode.
 * - Adds transient `Hovered` / `Pressed` tags so other systems can react declaratively.
 *
 * @category Input
 * @example React to Hovered / Pressed
 * ```ts
 * export class HighlightSystem extends createSystem({
 *   items: { required: [Interactable] }
 * }) {
 *   update() {
 *     this.queries.items.entities.forEach(e => {
 *       e.object3D.visible = !e.hasComponent(Pressed);
 *     })
 *   }
 * }
 * ```
 */
export class InputSystem extends createSystem(
  {
    interactable: { required: [Interactable, Transform] },
  },
  {},
) {
  private intersectables: Object3D[] = [];
  private shouldSetIntersectables = false;
  private listeners = new WeakMap<
    Object3D,
    {
      enter: (e: any) => void;
      leave: (e: any) => void;
      down: (e: any) => void;
      up: (e: any) => void;
    }
  >();
  private lastBVHUpdate = new WeakMap<Object3D, number>();

  init(): void {
    // Track XR visibility for scoped intersections (XR mode only)
    this.cleanupFuncs.push(
      this.visibilityState.subscribe((value) => {
        this.shouldSetIntersectables = value === VisibilityState.Visible;
      }),
    );

    // Setup/cleanup event listeners when entities qualify/disqualify
    this.queries.interactable.subscribe('qualify', (entity) => {
      this.setupEventListeners(entity);
    });
    this.queries.interactable.subscribe('disqualify', (entity) => {
      this.cleanupEventListeners(entity);
    });
  }

  update(delta: number, time: number): void {
    // Update input sampling first
    this.input.update(this.xrManager, delta, time);

    // Rebuild interactables list every frame in XR mode
    if (this.shouldSetIntersectables) {
      this.intersectables.length = 0;
      for (const entity of this.queries.interactable.entities) {
        if (entity.object3D) {
          this.intersectables.push(entity.object3D);
        }
      }
      this.scene.interactableDescendants = this.intersectables;
    } else {
      // In 2D mode, clear the reference so pointer-events uses default behavior
      this.scene.interactableDescendants = undefined;
    }
  }

  private setupEventListeners(entity: Entity): void {
    const object3D = entity.object3D as Object3D<
      Object3DEventMap & PointerEventsMap
    >;
    if (!object3D) {
      return;
    }

    // Compute BVH for all meshes in the entity hierarchy for fast raycasting
    this.computeBoundsTreeForEntity(object3D);

    // Enable pointer events for raycasting
    (object3D as any).pointerEvents = 'auto';

    // Throttled subtree BVH refresh helper
    const maybeRefreshBVH = () => {
      const now =
        typeof performance !== 'undefined' && performance.now
          ? performance.now()
          : Date.now();
      const last = this.lastBVHUpdate.get(object3D) ?? 0;
      if (now - last > 250) {
        this.computeBoundsTreeForEntity(object3D);
        this.lastBVHUpdate.set(object3D, now);
      }
    };

    const enter = (event: PointerEvent) => {
      maybeRefreshBVH();
      event.stopPropagation();
      if (!entity.hasComponent(Hovered)) {
        entity.addComponent(Hovered);
      }
    };
    const leave = (event: PointerEvent) => {
      event.stopPropagation();
      entity.removeComponent(Hovered);
    };
    const down = (event: PointerEvent) => {
      maybeRefreshBVH();
      event.stopPropagation();
      if (!entity.hasComponent(Pressed)) {
        entity.addComponent(Pressed);
      }
    };
    const up = (event: PointerEvent) => {
      event.stopPropagation();
      entity.removeComponent(Pressed);
    };

    this.listeners.set(object3D, { enter, leave, down, up });
    (object3D as any).addEventListener('pointerenter', enter);
    (object3D as any).addEventListener('pointerleave', leave);
    (object3D as any).addEventListener('pointerdown', down);
    (object3D as any).addEventListener('pointerup', up);
  }

  private computeBoundsTreeForEntity(object3D: Object3D): void {
    object3D.traverse((child) => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh;
        if ((mesh as any).geometry && !(mesh as any).geometry.boundsTree) {
          try {
            (mesh as any).geometry.computeBoundsTree();
          } catch (error) {
            console.warn(
              `[InputSystem] Failed to compute BVH for ${mesh.name || 'unnamed'}:`,
              error,
            );
          }
        }
      }
    });
  }

  private cleanupEventListeners(entity: Entity): void {
    const object3D = entity.object3D as any;
    if (!object3D) {
      return;
    }
    const fns = this.listeners.get(object3D);
    if (fns) {
      object3D.removeEventListener('pointerenter', fns.enter);
      object3D.removeEventListener('pointerleave', fns.leave);
      object3D.removeEventListener('pointerdown', fns.down);
      object3D.removeEventListener('pointerup', fns.up);
      this.listeners.delete(object3D);
    }
    // Remove hover/press state components if they exist
    // Check hasComponent first to avoid warnings when entity is being destroyed
    // (entity destruction removes all components, so trying to remove them again causes warnings)
    if (entity.hasComponent(Hovered)) {
      entity.removeComponent(Hovered);
    }
    if (entity.hasComponent(Pressed)) {
      entity.removeComponent(Pressed);
    }
  }
}
