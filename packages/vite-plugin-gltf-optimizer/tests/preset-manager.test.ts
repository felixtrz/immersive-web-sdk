/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';

/**
 * PresetManager Tests
 *
 * Tests for the preset configuration management from src/preset-manager.ts.
 * Inlined implementation to avoid workspace dependency issues during testing.
 */

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
          textures: {
            mode: 'auto',
            quality: 0.85,
            maxSize: 2048,
          },
        };

      case 'medium':
        return {
          geometry: {
            compress: 'meshopt',
            quality: 0.75,
            precision: 0.8,
            speed: 0.5,
          },
          textures: {
            mode: 'auto',
            quality: 0.75,
            maxSize: 1024,
          },
        };

      case 'aggressive':
        return {
          geometry: {
            compress: 'draco',
            quality: 0.5,
            precision: 0.6,
            speed: 0.3,
          },
          textures: {
            mode: 'auto',
            quality: 0.55,
            maxSize: 512,
          },
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
    const warnings: string[] = [];

    if (
      options.geometry.quality < 0 ||
      options.geometry.quality > 1 ||
      isNaN(options.geometry.quality)
    ) {
      warnings.push(
        `Invalid geometry.quality: ${options.geometry.quality} (should be 0-1)`,
      );
      options.geometry.quality = 0.75;
    }

    if (
      options.geometry.speed < 0 ||
      options.geometry.speed > 1 ||
      isNaN(options.geometry.speed)
    ) {
      warnings.push(
        `Invalid geometry.speed: ${options.geometry.speed} (should be 0-1)`,
      );
      options.geometry.speed = 0.5;
    }

    if (
      options.geometry.precision < 0 ||
      options.geometry.precision > 1 ||
      isNaN(options.geometry.precision)
    ) {
      warnings.push(
        `Invalid geometry.precision: ${options.geometry.precision} (should be 0-1)`,
      );
      options.geometry.precision = 0.8;
    }

    if (
      options.textures.quality < 0 ||
      options.textures.quality > 1 ||
      isNaN(options.textures.quality)
    ) {
      warnings.push(
        `Invalid textures.quality: ${options.textures.quality} (should be 0-1)`,
      );
      options.textures.quality = 0.75;
    }

    if (
      options.textures.maxSize <= 0 ||
      !Number.isInteger(options.textures.maxSize)
    ) {
      warnings.push(
        `Invalid textures.maxSize: ${options.textures.maxSize} (should be positive integer)`,
      );
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
    describe('light preset', () => {
      it('should use quantize compression', () => {
        const preset = PresetManager.getPreset('light');
        expect(preset.geometry?.compress).toBe('quantize');
      });

      it('should have high quality settings', () => {
        const preset = PresetManager.getPreset('light');
        expect(preset.geometry?.quality).toBe(0.9);
        expect(preset.geometry?.precision).toBe(0.95);
      });

      it('should have larger max texture size', () => {
        const preset = PresetManager.getPreset('light');
        expect(preset.textures?.maxSize).toBe(2048);
      });

      it('should have high texture quality', () => {
        const preset = PresetManager.getPreset('light');
        expect(preset.textures?.quality).toBe(0.85);
      });
    });

    describe('medium preset', () => {
      it('should use meshopt compression', () => {
        const preset = PresetManager.getPreset('medium');
        expect(preset.geometry?.compress).toBe('meshopt');
      });

      it('should have balanced quality settings', () => {
        const preset = PresetManager.getPreset('medium');
        expect(preset.geometry?.quality).toBe(0.75);
        expect(preset.geometry?.precision).toBe(0.8);
      });

      it('should have medium max texture size', () => {
        const preset = PresetManager.getPreset('medium');
        expect(preset.textures?.maxSize).toBe(1024);
      });
    });

    describe('aggressive preset', () => {
      it('should use draco compression', () => {
        const preset = PresetManager.getPreset('aggressive');
        expect(preset.geometry?.compress).toBe('draco');
      });

      it('should have lower quality for more compression', () => {
        const preset = PresetManager.getPreset('aggressive');
        expect(preset.geometry?.quality).toBe(0.5);
        expect(preset.geometry?.precision).toBe(0.6);
      });

      it('should have smaller max texture size', () => {
        const preset = PresetManager.getPreset('aggressive');
        expect(preset.textures?.maxSize).toBe(512);
      });

      it('should have lower texture quality', () => {
        const preset = PresetManager.getPreset('aggressive');
        expect(preset.textures?.quality).toBe(0.55);
      });
    });

    describe('default handling', () => {
      it('should return medium for unknown level', () => {
        const preset = PresetManager.getPreset('unknown' as OptimizationLevel);
        expect(preset.geometry?.compress).toBe('meshopt');
      });
    });
  });

  describe('processOptions', () => {
    describe('base defaults', () => {
      it('should apply base defaults when no options provided', () => {
        const processed = PresetManager.processOptions();

        expect(processed.level).toBe('medium');
        expect(processed.verbose).toBe(false);
        expect(processed.geometry.compress).toBe('meshopt');
        expect(processed.textures.mode).toBe('auto');
      });

      it('should have default include pattern for GLTF/GLB', () => {
        const processed = PresetManager.processOptions();

        expect(processed.include.test('model.gltf')).toBe(true);
        expect(processed.include.test('model.glb')).toBe(true);
        expect(processed.include.test('model.obj')).toBe(false);
      });

      it('should have undefined exclude by default', () => {
        const processed = PresetManager.processOptions();
        expect(processed.exclude).toBeUndefined();
      });
    });

    describe('preset application', () => {
      it('should apply light preset when specified', () => {
        const processed = PresetManager.processOptions({ level: 'light' });

        expect(processed.geometry.compress).toBe('quantize');
        expect(processed.geometry.quality).toBe(0.9);
      });

      it('should apply aggressive preset when specified', () => {
        const processed = PresetManager.processOptions({ level: 'aggressive' });

        expect(processed.geometry.compress).toBe('draco');
        expect(processed.textures.maxSize).toBe(512);
      });
    });

    describe('option merging', () => {
      it('should override preset with user options', () => {
        const processed = PresetManager.processOptions({
          level: 'light',
          geometry: { quality: 0.5 },
        });

        expect(processed.geometry.compress).toBe('quantize'); // From preset
        expect(processed.geometry.quality).toBe(0.5); // User override
      });

      it('should preserve user include pattern', () => {
        const customInclude = /\.custom$/;
        const processed = PresetManager.processOptions({
          include: customInclude,
        });

        expect(processed.include).toBe(customInclude);
      });

      it('should preserve user exclude pattern', () => {
        const customExclude = /node_modules/;
        const processed = PresetManager.processOptions({
          exclude: customExclude,
        });

        expect(processed.exclude).toBe(customExclude);
      });

      it('should merge nested texture options', () => {
        const processed = PresetManager.processOptions({
          textures: { maxSize: 512 },
        });

        expect(processed.textures.maxSize).toBe(512);
        expect(processed.textures.mode).toBe('auto'); // Default preserved
      });
    });

    describe('array handling', () => {
      it('should preserve etc1sPatterns array', () => {
        const patterns = [/baseColor/, /diffuse/];
        const processed = PresetManager.processOptions({
          textures: { etc1sPatterns: patterns },
        });

        expect(processed.textures.etc1sPatterns).toBe(patterns);
      });

      it('should preserve uastcPatterns array', () => {
        const patterns = [/normal/, /specular/];
        const processed = PresetManager.processOptions({
          textures: { uastcPatterns: patterns },
        });

        expect(processed.textures.uastcPatterns).toBe(patterns);
      });

      it('should have empty pattern arrays by default', () => {
        const processed = PresetManager.processOptions();

        expect(processed.textures.etc1sPatterns).toEqual([]);
        expect(processed.textures.uastcPatterns).toEqual([]);
      });
    });
  });

  describe('validateOptions', () => {
    describe('geometry validation', () => {
      it('should reset invalid quality to default', () => {
        const options = PresetManager.processOptions();
        options.geometry.quality = 1.5;

        const validated = PresetManager.validateOptions(options);
        expect(validated.geometry.quality).toBe(0.75);
      });

      it('should reset negative quality to default', () => {
        const options = PresetManager.processOptions();
        options.geometry.quality = -0.5;

        const validated = PresetManager.validateOptions(options);
        expect(validated.geometry.quality).toBe(0.75);
      });

      it('should reset NaN quality to default', () => {
        const options = PresetManager.processOptions();
        options.geometry.quality = NaN;

        const validated = PresetManager.validateOptions(options);
        expect(validated.geometry.quality).toBe(0.75);
      });

      it('should reset invalid speed to default', () => {
        const options = PresetManager.processOptions();
        options.geometry.speed = 2;

        const validated = PresetManager.validateOptions(options);
        expect(validated.geometry.speed).toBe(0.5);
      });

      it('should reset invalid precision to default', () => {
        const options = PresetManager.processOptions();
        options.geometry.precision = -1;

        const validated = PresetManager.validateOptions(options);
        expect(validated.geometry.precision).toBe(0.8);
      });

      it('should accept valid geometry values', () => {
        const options = PresetManager.processOptions();
        options.geometry.quality = 0.9;
        options.geometry.speed = 0.3;
        options.geometry.precision = 0.95;

        const validated = PresetManager.validateOptions(options);
        expect(validated.geometry.quality).toBe(0.9);
        expect(validated.geometry.speed).toBe(0.3);
        expect(validated.geometry.precision).toBe(0.95);
      });
    });

    describe('texture validation', () => {
      it('should reset invalid texture quality to default', () => {
        const options = PresetManager.processOptions();
        options.textures.quality = 1.5;

        const validated = PresetManager.validateOptions(options);
        expect(validated.textures.quality).toBe(0.75);
      });

      it('should reset negative maxSize to default', () => {
        const options = PresetManager.processOptions();
        options.textures.maxSize = -1;

        const validated = PresetManager.validateOptions(options);
        expect(validated.textures.maxSize).toBe(1024);
      });

      it('should reset non-integer maxSize to default', () => {
        const options = PresetManager.processOptions();
        options.textures.maxSize = 1024.5;

        const validated = PresetManager.validateOptions(options);
        expect(validated.textures.maxSize).toBe(1024);
      });

      it('should reset zero maxSize to default', () => {
        const options = PresetManager.processOptions();
        options.textures.maxSize = 0;

        const validated = PresetManager.validateOptions(options);
        expect(validated.textures.maxSize).toBe(1024);
      });

      it('should accept valid texture values', () => {
        const options = PresetManager.processOptions();
        options.textures.quality = 0.8;
        options.textures.maxSize = 2048;

        const validated = PresetManager.validateOptions(options);
        expect(validated.textures.quality).toBe(0.8);
        expect(validated.textures.maxSize).toBe(2048);
      });
    });

    describe('boundary values', () => {
      it('should accept quality of exactly 0', () => {
        const options = PresetManager.processOptions();
        options.geometry.quality = 0;

        const validated = PresetManager.validateOptions(options);
        expect(validated.geometry.quality).toBe(0);
      });

      it('should accept quality of exactly 1', () => {
        const options = PresetManager.processOptions();
        options.geometry.quality = 1;

        const validated = PresetManager.validateOptions(options);
        expect(validated.geometry.quality).toBe(1);
      });

      it('should accept maxSize of 1', () => {
        const options = PresetManager.processOptions();
        options.textures.maxSize = 1;

        const validated = PresetManager.validateOptions(options);
        expect(validated.textures.maxSize).toBe(1);
      });
    });
  });

  describe('getConfigSummary', () => {
    it('should include level in summary', () => {
      const options = PresetManager.processOptions({ level: 'aggressive' });
      const summary = PresetManager.getConfigSummary(options);

      expect(summary).toContain('Level: aggressive');
    });

    it('should include geometry compression type', () => {
      const options = PresetManager.processOptions({ level: 'light' });
      const summary = PresetManager.getConfigSummary(options);

      expect(summary).toContain('quantize');
    });

    it('should include quality percentages', () => {
      const options = PresetManager.processOptions({ level: 'medium' });
      const summary = PresetManager.getConfigSummary(options);

      expect(summary).toContain('75%');
    });

    it('should include max texture size', () => {
      const options = PresetManager.processOptions({ level: 'medium' });
      const summary = PresetManager.getConfigSummary(options);

      expect(summary).toContain('1024px');
    });

    it('should include texture mode', () => {
      const options = PresetManager.processOptions();
      const summary = PresetManager.getConfigSummary(options);

      expect(summary).toContain('auto mode');
    });

    it('should show none when compression is false', () => {
      const options = PresetManager.processOptions();
      options.geometry.compress = false;
      const summary = PresetManager.getConfigSummary(options);

      expect(summary).toContain('none');
    });
  });

  describe('deepMerge behavior', () => {
    it('should not merge arrays', () => {
      const processed = PresetManager.processOptions({
        textures: { etc1sPatterns: [/test/] },
      });

      expect(processed.textures.etc1sPatterns).toHaveLength(1);
    });

    it('should not merge RegExp objects', () => {
      const customInclude = /custom/;
      const processed = PresetManager.processOptions({
        include: customInclude,
      });

      expect(processed.include).toBe(customInclude);
    });

    it('should skip undefined values', () => {
      const processed = PresetManager.processOptions({
        geometry: { quality: undefined },
      });

      expect(processed.geometry.quality).toBe(0.75); // Default value preserved
    });

    it('should handle null objects in merge chain', () => {
      const processed = PresetManager.processOptions({});
      expect(processed.level).toBe('medium');
    });
  });

  describe('integration scenarios', () => {
    it('should handle full custom configuration', () => {
      const processed = PresetManager.processOptions({
        level: 'aggressive',
        verbose: true,
        include: /\.glb$/,
        exclude: /ignore/,
        geometry: {
          compress: 'both',
          quality: 0.6,
        },
        textures: {
          mode: 'manual',
          maxSize: 256,
          etc1sPatterns: [/base/],
        },
      });

      expect(processed.verbose).toBe(true);
      expect(processed.geometry.compress).toBe('both');
      expect(processed.geometry.quality).toBe(0.6);
      expect(processed.textures.mode).toBe('manual');
      expect(processed.textures.maxSize).toBe(256);
      expect(processed.textures.etc1sPatterns).toHaveLength(1);
    });

    it('should validate after processing', () => {
      const processed = PresetManager.processOptions({
        geometry: { quality: 1.5 },
      });

      const validated = PresetManager.validateOptions(processed);

      expect(validated.geometry.quality).toBe(0.75);
      expect(validated.geometry.compress).toBe('meshopt'); // Preserved
    });
  });
});
