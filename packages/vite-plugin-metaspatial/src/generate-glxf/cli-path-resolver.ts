/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as path from 'path';
import fs from 'fs-extra';

/**
 * Get the highest version directory from Meta Spatial Editor installation
 * @param directoryPath - Base directory path
 * @returns The version folder with the highest version number (e.g., 'v20')
 */
export function getHighestVersion(directoryPath: string): string | null {
  try {
    const files = fs.readdirSync(directoryPath);

    // Filter for version directories (e.g., v1, v2, v20)
    const versionDirs = files.filter(file => {
      const fullPath = path.join(directoryPath, file);
      return fs.statSync(fullPath).isDirectory() && /^v\d+$/.test(file);
    });

    if (versionDirs.length === 0) {
      return null;
    }

    // Sort by version number (extract number from 'vN' format)
    versionDirs.sort((a, b) => {
      const numA = parseInt(a.substring(1), 10);
      const numB = parseInt(b.substring(1), 10);
      return numB - numA; // Descending order (highest first)
    });

    return versionDirs[0];
  } catch (error) {
    console.warn(`Warning: Could not read directory ${directoryPath}:`, error);
    return null;
  }
}

/**
 * Resolve the Meta Spatial CLI path based on environment and platform
 * @returns The path to the Meta Spatial CLI executable
 */
export function resolveMetaSpatialCliPath(): string {
  // First, check if META_SPATIAL_EDITOR_CLI_PATH environment variable is set
  if (process.env.META_SPATIAL_EDITOR_CLI_PATH) {
    return process.env.META_SPATIAL_EDITOR_CLI_PATH;
  }

  // Fall back to platform-specific defaults
  const os = process.platform;

  if (os === 'darwin') {
    return '/Applications/Meta Spatial Editor.app/Contents/MacOS/CLI';
  } else if (os === 'win32') {
    const directoryPath = 'C:\\Program Files\\Meta Spatial Editor\\';
    const highestVersion = getHighestVersion(directoryPath);

    if (highestVersion) {
      return path.join(directoryPath, highestVersion, 'Resources', 'CLI.exe');
    } else {
      // Fallback to a default path if no version directories found
      return path.join(directoryPath, 'Resources', 'CLI.exe');
    }
  } else {
    // Linux - assume MetaSpatialEditorCLI is in PATH
    return 'MetaSpatialEditorCLI';
  }
}
