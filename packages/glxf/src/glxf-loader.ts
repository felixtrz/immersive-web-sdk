/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  FileLoader,
  Group,
  Loader,
  LoaderUtils,
  LoadingManager,
  Object3D,
} from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Interface for any loader with loadAsync method. */
interface GLTFLoaderLike {
  loadAsync(url: string): Promise<GLTF>;
}

/**
 * Reference to a GLTF asset within a GLXF file.
 * @category Scene
 */
export interface GLXFAsset {
  /** URI path to the GLTF asset. */
  uri: string;
  /** Optional display name for the asset. */
  name?: string;
}

/**
 * Node definition within a GLXF scene graph.
 * @category Scene
 */
export interface GLXFNode {
  /** Optional node name. */
  name?: string;
  /** Index into the assets array for the GLTF to instantiate. */
  asset?: number;
  /** Local position [x, y, z]. */
  translation?: [number, number, number];
  /** Local rotation quaternion [x, y, z, w]. */
  rotation?: [number, number, number, number];
  /** Local scale [x, y, z]. */
  scale?: [number, number, number];
  /** Indices of child nodes. */
  children?: number[];
  /** Extended metadata including Meta Spatial Editor data. */
  extras?: {
    meta_spatial?: {
      entity_id?: string;
      components?: Record<string, any>;
      version?: number;
    };
  };
}

/**
 * Scene definition containing root node indices.
 * @category Scene
 */
export interface GLXFScene {
  /** Indices of root nodes in this scene. */
  nodes: number[];
}

/**
 * Raw GLXF file data structure.
 * @category Scene
 */
export interface GLXFData {
  /** Array of GLTF asset references. */
  assets: GLXFAsset[];
  /** Array of node definitions. */
  nodes: GLXFNode[];
  /** Array of scene definitions. */
  scenes: GLXFScene[];
  /** Index of the default scene. */
  scene?: number;
  /** GLXF format version info. */
  asset: {
    minVersion: string;
    version: string;
  };
}

/**
 * Loaded and parsed GLXF result.
 * @category Scene
 */
export interface GLXF {
  /** Loaded GLTF assets. */
  assets: GLTF[];
  /** Instantiated Object3D nodes. */
  nodes: Object3D[];
  /** Scene groups containing root nodes. */
  scenes: Group[];
  /** The active/default scene. */
  scene: Group;
}

/**
 * Loader for GLXF (GL Transmission Format Extended) scene composition files.
 *
 * GLXF is a Meta-developed format that extends GLTF by supporting:
 * - Multiple GLTF asset references in a single composition
 * - Scene hierarchy with transforms
 * - Meta Spatial Editor component metadata
 *
 * @remarks
 * - Follows Three.js Loader conventions (load, loadAsync, parse).
 * - Automatically resolves and loads referenced GLTF assets.
 * - Preserves Meta Spatial Editor metadata in `userData.meta_spatial`.
 *
 * @example
 * ```ts
 * const loader = new GLXFLoader();
 * const glxf = await loader.loadAsync('/scenes/level.glxf');
 * scene.add(glxf.scene);
 * ```
 *
 * @category Scene
 */
export class GLXFLoader extends Loader<GLXF> {
  private gltfLoader: GLTFLoaderLike;

  constructor(manager?: LoadingManager) {
    super(manager);
    this.gltfLoader = new GLTFLoader(manager);
  }

  /**
   * Loads a GLXF file and all referenced GLTF assets.
   *
   * @param url URL to the GLXF file.
   * @param onLoad Callback with loaded GLXF result.
   * @param onProgress Optional progress callback.
   * @param onError Optional error callback.
   */
  load(
    url: string,
    onLoad: (glxf: GLXF) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void,
  ): void {
    const scope = this;

    this.manager.itemStart(url);

    const loader = new FileLoader(this.manager);
    loader.setPath(this.path);
    loader.setResponseType('text');
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);

    loader.load(
      url,
      function (text) {
        try {
          scope.parse(
            text as string,
            LoaderUtils.extractUrlBase(url),
            onLoad,
            onError,
          );
        } catch (e) {
          if (onError) {
            onError(new ErrorEvent('error', { error: e }));
          } else {
            console.error(e);
          }
          scope.manager.itemError(url);
        }
      },
      onProgress,
      onError
        ? (err) => onError(new ErrorEvent('error', { error: err }))
        : undefined,
    );
  }

  /**
   * Loads a GLXF file asynchronously.
   *
   * @param url URL to the GLXF file.
   * @param onProgress Optional progress callback.
   * @returns Promise resolving to the loaded GLXF.
   */
  loadAsync(
    url: string,
    onProgress?: (event: ProgressEvent) => void,
  ): Promise<GLXF> {
    return new Promise((resolve, reject) => {
      this.load(url, resolve, onProgress, (error) => reject(error));
    });
  }

  /**
   * Parses GLXF JSON text and loads referenced GLTF assets.
   *
   * @param text GLXF JSON string.
   * @param path Base path for resolving asset URIs.
   * @param onLoad Callback with parsed GLXF result.
   * @param onError Optional error callback.
   */
  parse(
    text: string,
    path: string,
    onLoad: (glxf: GLXF) => void,
    onError?: (event: ErrorEvent) => void,
  ): void {
    const scope = this;

    try {
      const glxfData: GLXFData = JSON.parse(text);

      // Validate GLXF format
      if (!glxfData.assets || !glxfData.nodes) {
        throw new Error('Invalid GLXF format: missing assets or nodes');
      }

      // Load all referenced GLTF assets
      const assetPromises = glxfData.assets.map((asset) => {
        const assetUrl = LoaderUtils.resolveURL(asset.uri, path);
        return this.gltfLoader.loadAsync(assetUrl).catch((error) => {
          console.error(`Failed to load GLXF asset ${asset.uri}:`, error);
          // Return empty GLTF as placeholder to maintain array indices
          return { scene: new Group() } as GLTF;
        });
      });

      Promise.all(assetPromises)
        .then((loadedAssets) => {
          // Create nodes and scenes from GLXF composition data
          const { nodes, scenes } = scope.createNodesAndScenesFromGLXF(
            glxfData,
            loadedAssets,
          );

          // Get the active scene (default to first scene if not specified)
          const activeSceneIndex = glxfData.scene ?? 0;
          const activeScene = scenes[activeSceneIndex] || scenes[0];

          const result: GLXF = {
            assets: loadedAssets,
            nodes: nodes,
            scenes: scenes,
            scene: activeScene,
          };

          onLoad(result);
          scope.manager.itemEnd(path);
        })
        .catch((error) => {
          if (onError) {
            onError(error);
          } else {
            console.error('Error loading GLXF assets:', error);
          }
          scope.manager.itemError(path);
        });
    } catch (error) {
      if (onError) {
        onError(error as ErrorEvent);
      } else {
        console.error('Error parsing GLXF:', error);
      }
      this.manager.itemError(path);
    }
  }

  /**
   * Parses GLXF JSON text asynchronously.
   *
   * @param text GLXF JSON string.
   * @param path Base path for resolving asset URIs.
   * @returns Promise resolving to the parsed GLXF.
   */
  parseAsync(text: string, path: string): Promise<GLXF> {
    return new Promise((resolve, reject) => {
      this.parse(text, path, resolve, reject);
    });
  }

  /**
   * Sets a custom GLTF loader for loading referenced assets.
   *
   * @param gltfLoader Custom loader implementing loadAsync.
   * @returns This loader for chaining.
   */
  setGLTFLoader(gltfLoader: GLTFLoaderLike): this {
    this.gltfLoader = gltfLoader;
    return this;
  }

  private createNodesAndScenesFromGLXF(
    glxfData: GLXFData,
    loadedAssets: GLTF[],
  ): { nodes: Object3D[]; scenes: Group[] } {
    const scenes: Group[] = [];
    const nodes: Object3D[] = [];
    const nodeCache = new Map<number, Object3D>();

    // First pass: create all nodes
    glxfData.nodes.forEach((node, index) => {
      let nodeObject: Object3D;

      // If node has an asset, clone it as the base object
      if (node.asset !== undefined && loadedAssets[node.asset]) {
        nodeObject = loadedAssets[node.asset].scene.clone();
      } else {
        nodeObject = new Group();
      }

      nodeObject.name = node.name || `node_${index}`;

      // Apply transforms
      if (node.translation) {
        nodeObject.position.fromArray(node.translation);
      }
      if (node.rotation) {
        nodeObject.quaternion.fromArray(node.rotation);
      }
      if (node.scale) {
        nodeObject.scale.fromArray(node.scale);
      }

      // Store metadata
      if (node.extras?.meta_spatial) {
        nodeObject.userData.meta_spatial = node.extras.meta_spatial;
      }

      nodes.push(nodeObject);
      nodeCache.set(index, nodeObject);
    });

    // Second pass: establish parent-child relationships
    glxfData.nodes.forEach((node, index) => {
      if (node.children) {
        const parent = nodeCache.get(index);
        if (parent) {
          node.children.forEach((childIndex) => {
            const child = nodeCache.get(childIndex);
            if (child) {
              parent.add(child);
            }
          });
        }
      }
    });

    // Create scene groups
    glxfData.scenes.forEach((sceneData, index) => {
      const sceneGroup = new Group();
      sceneGroup.name = `scene_${index}`;

      sceneData.nodes.forEach((nodeIndex) => {
        const node = nodeCache.get(nodeIndex);
        if (node) {
          sceneGroup.add(node);
        }
      });

      scenes.push(sceneGroup);
    });

    return { nodes, scenes };
  }
}
