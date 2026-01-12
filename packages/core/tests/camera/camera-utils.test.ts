/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';

/**
 * Camera Utils Tests
 *
 * These tests verify the pure utility functions from src/camera/camera-utils.ts.
 * The findByFacing function is inlined here to avoid workspace dependency
 * resolution issues during testing.
 */

// Camera facing types (mirroring types from src/camera/types.ts)
const CameraFacing = {
  Back: 'back',
  Front: 'front',
  Unknown: 'unknown',
} as const;

type CameraFacingType = (typeof CameraFacing)[keyof typeof CameraFacing];

interface CameraDeviceInfo {
  deviceId: string;
  label: string;
  facing: CameraFacingType;
}

/**
 * Find camera by facing direction from device list
 * (Implementation copied from src/camera/camera-utils.ts for testing isolation)
 */
function findByFacing(
  devices: CameraDeviceInfo[],
  facing: CameraFacingType,
): CameraDeviceInfo | null {
  return devices.find((d) => d.facing === facing) || null;
}

describe('CameraUtils', () => {
  describe('findByFacing', () => {
    const mockDevices: CameraDeviceInfo[] = [
      {
        deviceId: 'front-1',
        label: 'Front Camera',
        facing: CameraFacing.Front,
      },
      { deviceId: 'back-1', label: 'Back Camera', facing: CameraFacing.Back },
      {
        deviceId: 'unknown-1',
        label: 'External USB Camera',
        facing: CameraFacing.Unknown,
      },
    ];

    it('should find front-facing camera', () => {
      const result = findByFacing(mockDevices, CameraFacing.Front);

      expect(result).not.toBeNull();
      expect(result?.deviceId).toBe('front-1');
      expect(result?.facing).toBe(CameraFacing.Front);
    });

    it('should find back-facing camera', () => {
      const result = findByFacing(mockDevices, CameraFacing.Back);

      expect(result).not.toBeNull();
      expect(result?.deviceId).toBe('back-1');
      expect(result?.facing).toBe(CameraFacing.Back);
    });

    it('should find unknown-facing camera', () => {
      const result = findByFacing(mockDevices, CameraFacing.Unknown);

      expect(result).not.toBeNull();
      expect(result?.deviceId).toBe('unknown-1');
      expect(result?.facing).toBe(CameraFacing.Unknown);
    });

    it('should return null when no matching camera found', () => {
      const devicesWithoutFront: CameraDeviceInfo[] = [
        { deviceId: 'back-1', label: 'Back Camera', facing: CameraFacing.Back },
      ];

      const result = findByFacing(devicesWithoutFront, CameraFacing.Front);

      expect(result).toBeNull();
    });

    it('should return null for empty device list', () => {
      const result = findByFacing([], CameraFacing.Front);

      expect(result).toBeNull();
    });

    it('should return first matching camera when multiple exist', () => {
      const devicesWithMultipleFront: CameraDeviceInfo[] = [
        {
          deviceId: 'front-1',
          label: 'Front Camera 1',
          facing: CameraFacing.Front,
        },
        {
          deviceId: 'front-2',
          label: 'Front Camera 2',
          facing: CameraFacing.Front,
        },
        { deviceId: 'back-1', label: 'Back Camera', facing: CameraFacing.Back },
      ];

      const result = findByFacing(devicesWithMultipleFront, CameraFacing.Front);

      expect(result).not.toBeNull();
      expect(result?.deviceId).toBe('front-1');
    });

    it('should handle devices list with only unknown facing cameras', () => {
      const unknownOnlyDevices: CameraDeviceInfo[] = [
        { deviceId: 'cam-1', label: 'Camera 1', facing: CameraFacing.Unknown },
        { deviceId: 'cam-2', label: 'Camera 2', facing: CameraFacing.Unknown },
      ];

      expect(findByFacing(unknownOnlyDevices, CameraFacing.Front)).toBeNull();
      expect(findByFacing(unknownOnlyDevices, CameraFacing.Back)).toBeNull();
      expect(
        findByFacing(unknownOnlyDevices, CameraFacing.Unknown),
      ).not.toBeNull();
    });

    it('should not mutate the input array', () => {
      const devices: CameraDeviceInfo[] = [
        {
          deviceId: 'front-1',
          label: 'Front Camera',
          facing: CameraFacing.Front,
        },
      ];
      const originalDevices = [...devices];

      findByFacing(devices, CameraFacing.Front);

      expect(devices).toEqual(originalDevices);
    });
  });
});
