/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';

// Type definitions
type GeometryCompression = 'quantize' | 'meshopt' | 'draco' | 'both' | false;
type TextureCompressionMode = 'auto' | 'etc1s' | 'uastc' | 'mixed' | 'manual';
type OptimizationLevel = 'light' | 'medium' | 'aggressive';

interface GeometryOptions {
  compress?: GeometryCompression;
  quality?: number;
  speed?: number;
  precision?: number;
}

interface TextureOptions {
  mode?: TextureCompressionMode;
  quality?: number;
  maxSize?: number;
  etc1sPatterns?: RegExp[];
  uastcPatterns?: RegExp[];
}

interface GLTFOptimizerOptions {
  level?: OptimizationLevel;
  include?: RegExp;
  exclude?: RegExp;
  verbose?: boolean;
  geometry?: GeometryOptions;
  textures?: TextureOptions;
}

interface ProcessedOptions {
  level: OptimizationLevel;
  include: RegExp;
  exclude: RegExp | undefined;
  verbose: boolean;
  geometry: Required<GeometryOptions>;
  textures: Required<TextureOptions>;
}

// Inlined PresetManager class for testing
class PresetManager {
  static getPreset(level: OptimizationLevel): GLTFOptimizerOptions {
    switch (level) {
      case 'light':
        return {
          geometry: {
            compress: 'quantize',
            quality: 0.9,
            precision: 0.95,
            speed: 0.8,
          },
          textures: { mode: 'auto', quality: 0.85, maxSize: 2048 },
        };
      case 'medium':
        return {
          geometry: {
            compress: 'meshopt',
            quality: 0.75,
            precision: 0.8,
            speed: 0.5,
          },
          textures: { mode: 'auto', quality: 0.75, maxSize: 1024 },
        };
      case 'aggressive':
        return {
          geometry: {
            compress: 'draco',
            quality: 0.5,
            precision: 0.6,
            speed: 0.3,
          },
          textures: { mode: 'auto', quality: 0.55, maxSize: 512 },
        };
      default:
        return this.getPreset('medium');
    }
  }

  static processOptions(options: GLTFOptimizerOptions = {}): ProcessedOptions {
    const baseDefaults: ProcessedOptions = {
      level: 'medium',
      include: /\.(gltf|glb)$/i,
      exclude: undefined as any,
      verbose: false,
      geometry: {
        compress: 'meshopt',
        quality: 0.75,
        speed: 0.5,
        precision: 0.8,
      },
      textures: {
        mode: 'auto',
        quality: 0.75,
        maxSize: 1024,
        etc1sPatterns: [],
        uastcPatterns: [],
      },
    };

    let presetConfig: Partial<GLTFOptimizerOptions> = {};
    if (options.level) {
      presetConfig = this.getPreset(options.level);
    }

    const merged = this.deepMerge(baseDefaults, presetConfig, options);

    if (options.exclude === undefined && presetConfig.exclude === undefined) {
      (merged as any).exclude = undefined;
    }

    return merged as ProcessedOptions;
  }

  private static deepMerge(...objects: any[]): any {
    const result: any = {};

    for (const obj of objects) {
      if (!obj) {
        continue;
      }

      for (const [key, value] of Object.entries(obj)) {
        if (value === undefined) {
          continue;
        }

        if (
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value) &&
          !(value instanceof RegExp)
        ) {
          result[key] = this.deepMerge(result[key] || {}, value);
        } else {
          result[key] = value;
        }
      }
    }

    return result;
  }

  static validateOptions(
    options: ProcessedOptions,
    _verbose: boolean = false,
  ): ProcessedOptions {
    if (
      options.geometry.quality < 0 ||
      options.geometry.quality > 1 ||
      isNaN(options.geometry.quality)
    ) {
      options.geometry.quality = 0.75;
    }

    if (
      options.geometry.speed < 0 ||
      options.geometry.speed > 1 ||
      isNaN(options.geometry.speed)
    ) {
      options.geometry.speed = 0.5;
    }

    if (
      options.geometry.precision < 0 ||
      options.geometry.precision > 1 ||
      isNaN(options.geometry.precision)
    ) {
      options.geometry.precision = 0.8;
    }

    if (
      options.textures.quality < 0 ||
      options.textures.quality > 1 ||
      isNaN(options.textures.quality)
    ) {
      options.textures.quality = 0.75;
    }

    if (
      options.textures.maxSize <= 0 ||
      !Number.isInteger(options.textures.maxSize)
    ) {
      options.textures.maxSize = 1024;
    }

    return options;
  }

  static getConfigSummary(options: ProcessedOptions): string {
    const geometryCompression = options.geometry.compress || 'none';
    const textureMode = options.textures.mode;

    return [
      `🔧 GLTF Optimizer Configuration:`,
      `   Level: ${options.level}`,
      `   Geometry: ${geometryCompression} (quality: ${(options.geometry.quality * 100).toFixed(0)}%, precision: ${(options.geometry.precision * 100).toFixed(0)}%)`,
      `   Textures: ${textureMode} mode (quality: ${(options.textures.quality * 100).toFixed(0)}%, max size: ${options.textures.maxSize}px)`,
    ].join('\n');
  }
}

describe('PresetManager', () => {
  describe('getPreset', () => {
    it('should return different compression methods per level', () => {
      expect(PresetManager.getPreset('light').geometry?.compress).toBe(
        'quantize',
      );
      expect(PresetManager.getPreset('medium').geometry?.compress).toBe(
        'meshopt',
      );
      expect(PresetManager.getPreset('aggressive').geometry?.compress).toBe(
        'draco',
      );
    });

    it('should fall back to medium for unknown level', () => {
      const preset = PresetManager.getPreset('unknown' as OptimizationLevel);
      expect(preset.geometry?.compress).toBe('meshopt');
    });
  });

  describe('processOptions', () => {
    it('should apply defaults when no options provided', () => {
      const processed = PresetManager.processOptions();

      expect(processed.level).toBe('medium');
      expect(processed.geometry.compress).toBe('meshopt');
      expect(processed.exclude).toBeUndefined();
    });

    it('should apply preset values when level specified', () => {
      const processed = PresetManager.processOptions({ level: 'aggressive' });

      expect(processed.geometry.compress).toBe('draco');
      expect(processed.textures.maxSize).toBe(512);
    });

    it('should allow user options to override preset values', () => {
      const processed = PresetManager.processOptions({
        level: 'light',
        geometry: { quality: 0.5 },
      });

      expect(processed.geometry.compress).toBe('quantize'); // From preset
      expect(processed.geometry.quality).toBe(0.5); // User override
    });

    it('should merge nested options without losing defaults', () => {
      const processed = PresetManager.processOptions({
        textures: { maxSize: 512 },
      });

      expect(processed.textures.maxSize).toBe(512);
      expect(processed.textures.mode).toBe('auto'); // Default preserved
    });
  });

  describe('deepMerge edge cases', () => {
    it('should not merge arrays (replace instead)', () => {
      const processed = PresetManager.processOptions({
        textures: { etc1sPatterns: [/test/] },
      });

      expect(processed.textures.etc1sPatterns).toHaveLength(1);
    });

    it('should not merge RegExp objects (replace instead)', () => {
      const customInclude = /custom/;
      const processed = PresetManager.processOptions({
        include: customInclude,
      });

      expect(processed.include).toBe(customInclude);
    });

    it('should skip undefined values during merge', () => {
      const processed = PresetManager.processOptions({
        geometry: { quality: undefined },
      });

      expect(processed.geometry.quality).toBe(0.75); // Default preserved
    });
  });

  describe('validateOptions', () => {
    it('should reset out-of-range quality values to default', () => {
      const options = PresetManager.processOptions();
      options.geometry.quality = 1.5;

      const validated = PresetManager.validateOptions(options);
      expect(validated.geometry.quality).toBe(0.75);
    });

    it('should reset NaN values to default', () => {
      const options = PresetManager.processOptions();
      options.geometry.quality = NaN;

      const validated = PresetManager.validateOptions(options);
      expect(validated.geometry.quality).toBe(0.75);
    });

    it('should reset invalid maxSize (non-positive, non-integer) to default', () => {
      const options = PresetManager.processOptions();

      options.textures.maxSize = -1;
      expect(PresetManager.validateOptions(options).textures.maxSize).toBe(
        1024,
      );

      options.textures.maxSize = 1024.5;
      expect(PresetManager.validateOptions(options).textures.maxSize).toBe(
        1024,
      );
    });

    it('should accept valid boundary values (0 and 1)', () => {
      const options = PresetManager.processOptions();
      options.geometry.quality = 0;
      options.geometry.speed = 1;

      const validated = PresetManager.validateOptions(options);
      expect(validated.geometry.quality).toBe(0);
      expect(validated.geometry.speed).toBe(1);
    });
  });

  describe('getConfigSummary', () => {
    it('should include level, compression type, and sizes', () => {
      const options = PresetManager.processOptions({ level: 'aggressive' });
      const summary = PresetManager.getConfigSummary(options);

      expect(summary).toContain('Level: aggressive');
      expect(summary).toContain('draco');
      expect(summary).toContain('512px');
    });

    it('should show "none" when compression is disabled', () => {
      const options = PresetManager.processOptions();
      options.geometry.compress = false;
      const summary = PresetManager.getConfigSummary(options);

      expect(summary).toContain('none');
    });
  });
});
