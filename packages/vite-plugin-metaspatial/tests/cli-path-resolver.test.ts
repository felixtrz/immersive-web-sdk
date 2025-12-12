/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getHighestVersion, resolveMetaSpatialCliPath } from '../src/generate-glxf/cli-path-resolver.js';
import fs from 'fs-extra';
import * as path from 'path';

// Mock fs module
vi.mock('fs-extra');

describe('CLI Path Resolver', () => {
  let originalPlatform: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original values
    originalPlatform = process.platform;
    originalEnv = { ...process.env };

    // Clear mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original values
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
    });
    process.env = originalEnv;
  });

  describe('getHighestVersion', () => {
    it('should return the highest version number', () => {
      const mockFiles = ['v1', 'v2', 'v9', 'v11', 'v12', 'v20', 'other-file.txt'];

      vi.mocked(fs.readdirSync).mockReturnValue(mockFiles as any);
      vi.mocked(fs.statSync).mockImplementation((filePath: any) => {
        const fileName = path.basename(filePath.toString());
        return {
          isDirectory: () => /^v\d+$/.test(fileName),
        } as any;
      });

      const result = getHighestVersion('C:\\Program Files\\Meta Spatial Editor\\');

      expect(result).toBe('v20');
    });

    it('should handle single version directory', () => {
      const mockFiles = ['v5'];

      vi.mocked(fs.readdirSync).mockReturnValue(mockFiles as any);
      vi.mocked(fs.statSync).mockImplementation((filePath: any) => {
        const fileName = path.basename(filePath.toString());
        return {
          isDirectory: () => /^v\d+$/.test(fileName),
        } as any;
      });

      const result = getHighestVersion('C:\\Program Files\\Meta Spatial Editor\\');

      expect(result).toBe('v5');
    });

    it('should return null when no version directories exist', () => {
      const mockFiles = ['other-file.txt', 'config.json'];

      vi.mocked(fs.readdirSync).mockReturnValue(mockFiles as any);
      vi.mocked(fs.statSync).mockImplementation(() => {
        return {
          isDirectory: () => false,
        } as any;
      });

      const result = getHighestVersion('C:\\Program Files\\Meta Spatial Editor\\');

      expect(result).toBeNull();
    });

    it('should correctly sort multi-digit version numbers', () => {
      const mockFiles = ['v2', 'v100', 'v20', 'v3'];

      vi.mocked(fs.readdirSync).mockReturnValue(mockFiles as any);
      vi.mocked(fs.statSync).mockImplementation((filePath: any) => {
        const fileName = path.basename(filePath.toString());
        return {
          isDirectory: () => /^v\d+$/.test(fileName),
        } as any;
      });

      const result = getHighestVersion('C:\\Program Files\\Meta Spatial Editor\\');

      expect(result).toBe('v100');
    });

    it('should handle directory read errors gracefully', () => {
      vi.mocked(fs.readdirSync).mockImplementation(() => {
        throw new Error('Directory not found');
      });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = getHighestVersion('C:\\Program Files\\Meta Spatial Editor\\');

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('resolveMetaSpatialCliPath', () => {
    it('should use META_SPATIAL_EDITOR_CLI_PATH environment variable if set', () => {
      process.env.META_SPATIAL_EDITOR_CLI_PATH = '/custom/path/to/CLI';

      const result = resolveMetaSpatialCliPath();

      expect(result).toBe('/custom/path/to/CLI');
    });

    it('should return macOS path when platform is darwin and no env var is set', () => {
      delete process.env.META_SPATIAL_EDITOR_CLI_PATH;
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
      });

      const result = resolveMetaSpatialCliPath();

      expect(result).toBe('/Applications/Meta Spatial Editor.app/Contents/MacOS/CLI');
    });

    it('should return Windows path with highest version when platform is win32', () => {
      delete process.env.META_SPATIAL_EDITOR_CLI_PATH;
      Object.defineProperty(process, 'platform', {
        value: 'win32',
      });

      const mockFiles = ['v1', 'v2', 'v20'];
      vi.mocked(fs.readdirSync).mockReturnValue(mockFiles as any);
      vi.mocked(fs.statSync).mockImplementation((filePath: any) => {
        const fileName = path.basename(filePath.toString());
        return {
          isDirectory: () => /^v\d+$/.test(fileName),
        } as any;
      });

      const result = resolveMetaSpatialCliPath();

      expect(result).toContain('v20');
      expect(result).toContain('Resources');
      expect(result).toContain('CLI.exe');
    });

    it('should return Windows fallback path when no version directories found', () => {
      delete process.env.META_SPATIAL_EDITOR_CLI_PATH;
      Object.defineProperty(process, 'platform', {
        value: 'win32',
      });

      const mockFiles = ['other-file.txt'];
      vi.mocked(fs.readdirSync).mockReturnValue(mockFiles as any);
      vi.mocked(fs.statSync).mockImplementation(() => {
        return {
          isDirectory: () => false,
        } as any;
      });

      const result = resolveMetaSpatialCliPath();

      expect(result).toContain('Resources');
      expect(result).toContain('CLI.exe');
      expect(result).not.toContain('v');
    });

    it('should return MetaSpatialEditorCLI for Linux platform', () => {
      delete process.env.META_SPATIAL_EDITOR_CLI_PATH;
      Object.defineProperty(process, 'platform', {
        value: 'linux',
      });

      const result = resolveMetaSpatialCliPath();

      expect(result).toBe('MetaSpatialEditorCLI');
    });

    it('should prioritize environment variable over platform detection', () => {
      process.env.META_SPATIAL_EDITOR_CLI_PATH = '/override/path';
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
      });

      const result = resolveMetaSpatialCliPath();

      expect(result).toBe('/override/path');
      expect(result).not.toBe('/Applications/Meta Spatial Editor.app/Contents/MacOS/CLI');
    });
  });
});
