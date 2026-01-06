/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';

// Type definitions
interface DracoParams {
  method: 'edgebreaker' | 'sequential';
  encodeSpeed: number;
  decodeSpeed: number;
  quantizationBits: {
    POSITION: number;
    NORMAL: number;
    TEXCOORD_0: number;
  };
}

interface MeshoptParams {
  level: 'medium' | 'high';
}

interface TextureCompressionParams {
  mode: 'etc1s' | 'uastc';
  quality: number;
  pattern?: string;
}

// Inlined CompressionMapper class for testing
class CompressionMapper {
  static toDracoParams(
    quality: number = 0.75,
    speed: number = 0.5,
    precision: number = 0.8,
  ): DracoParams {
    quality = Math.max(0, Math.min(1, quality));
    speed = Math.max(0, Math.min(1, speed));
    precision = Math.max(0, Math.min(1, precision));

    return {
      method: quality > 0.5 ? 'edgebreaker' : 'sequential',
      encodeSpeed: Math.round(speed * 10),
      decodeSpeed: Math.round(quality * 10),
      quantizationBits: {
        POSITION: 10 + Math.round(precision * 6),
        NORMAL: 8 + Math.round(precision * 2),
        TEXCOORD_0: 10 + Math.round(precision * 2),
      },
    };
  }

  static toMeshoptParams(quality: number = 0.75): MeshoptParams {
    quality = Math.max(0, Math.min(1, quality));
    return {
      level: quality > 0.6 ? 'medium' : 'high',
    };
  }

  static toQuantizationBits(precision: number = 0.8) {
    precision = Math.max(0, Math.min(1, precision));
    return {
      quantizePosition: 10 + Math.round(precision * 6),
      quantizeNormal: 8 + Math.round(precision * 2),
      quantizeTexcoord: 10 + Math.round(precision * 2),
      quantizeColor: 8,
      quantizeWeight: 8,
      quantizeGeneric: 10 + Math.round(precision * 2),
    };
  }

  static toETC1SParams(
    quality: number = 0.75,
    pattern?: string,
  ): TextureCompressionParams {
    quality = Math.max(0, Math.min(1, quality));
    return {
      mode: 'etc1s',
      quality: Math.round(quality * 255),
      pattern,
    };
  }

  static toUASTCParams(
    quality: number = 0.75,
    pattern?: string,
  ): TextureCompressionParams {
    quality = Math.max(0, Math.min(1, quality));
    return {
      mode: 'uastc',
      quality: Math.round((1 - quality) * 4),
      pattern,
    };
  }

  static getAutoTexturePatterns() {
    return {
      uastc: [
        /normalTexture/,
        /metallicRoughnessTexture/,
        /emissiveTexture/,
        /occlusionTexture/,
        /detail|bump|height/i,
        /hero|main|primary/i,
        /normal|detail|specular/i,
      ],
      etc1s: [
        /baseColorTexture/,
        /diffuseTexture/,
        /ui|interface|overlay/i,
        /sky|environment/i,
        /logo|icon|simple/i,
        /background|ambient/i,
      ],
    };
  }

  static detectTextureCompressionMode(textureName: string): 'etc1s' | 'uastc' {
    const patterns = this.getAutoTexturePatterns();

    for (const pattern of patterns.uastc) {
      if (pattern.test(textureName)) {
        return 'uastc';
      }
    }

    for (const pattern of patterns.etc1s) {
      if (pattern.test(textureName)) {
        return 'etc1s';
      }
    }

    return 'etc1s';
  }

  static detectManualTextureCompressionMode(
    textureName: string,
    etc1sPatterns: RegExp[] = [],
    uastcPatterns: RegExp[] = [],
  ): 'etc1s' | 'uastc' {
    for (const pattern of uastcPatterns) {
      if (pattern.test(textureName)) {
        return 'uastc';
      }
    }

    for (const pattern of etc1sPatterns) {
      if (pattern.test(textureName)) {
        return 'etc1s';
      }
    }

    return 'etc1s';
  }
}

describe('CompressionMapper', () => {
  describe('toDracoParams', () => {
    it('should select method based on quality threshold (0.5 boundary)', () => {
      expect(CompressionMapper.toDracoParams(0.51).method).toBe('edgebreaker');
      expect(CompressionMapper.toDracoParams(0.5).method).toBe('sequential');
    });

    it('should map speed and quality to 0-10 range', () => {
      expect(CompressionMapper.toDracoParams(0.75, 0).encodeSpeed).toBe(0);
      expect(CompressionMapper.toDracoParams(0.75, 1).encodeSpeed).toBe(10);
      expect(CompressionMapper.toDracoParams(0).decodeSpeed).toBe(0);
      expect(CompressionMapper.toDracoParams(1).decodeSpeed).toBe(10);
    });

    it('should calculate quantization bits from precision (10-16 for position)', () => {
      expect(
        CompressionMapper.toDracoParams(0.75, 0.5, 0).quantizationBits.POSITION,
      ).toBe(10);
      expect(
        CompressionMapper.toDracoParams(0.75, 0.5, 1).quantizationBits.POSITION,
      ).toBe(16);
    });

    it('should clamp out-of-range values', () => {
      expect(CompressionMapper.toDracoParams(1.5).decodeSpeed).toBe(10);
      expect(CompressionMapper.toDracoParams(-0.5).decodeSpeed).toBe(0);
      expect(CompressionMapper.toDracoParams(0.75, 2).encodeSpeed).toBe(10);
      expect(
        CompressionMapper.toDracoParams(0.75, 0.5, -1).quantizationBits
          .POSITION,
      ).toBe(10);
    });
  });

  describe('toMeshoptParams', () => {
    it('should select level based on quality threshold (0.6 boundary)', () => {
      expect(CompressionMapper.toMeshoptParams(0.61).level).toBe('medium');
      expect(CompressionMapper.toMeshoptParams(0.6).level).toBe('high');
    });

    it('should clamp out-of-range values', () => {
      expect(CompressionMapper.toMeshoptParams(1.5).level).toBe('medium');
      expect(CompressionMapper.toMeshoptParams(-0.5).level).toBe('high');
    });
  });

  describe('toQuantizationBits', () => {
    it('should calculate bits at precision boundaries', () => {
      const low = CompressionMapper.toQuantizationBits(0);
      const high = CompressionMapper.toQuantizationBits(1);

      expect(low.quantizePosition).toBe(10);
      expect(high.quantizePosition).toBe(16);
      expect(low.quantizeNormal).toBe(8);
      expect(high.quantizeNormal).toBe(10);
    });

    it('should keep color and weight fixed at 8 bits', () => {
      const low = CompressionMapper.toQuantizationBits(0);
      const high = CompressionMapper.toQuantizationBits(1);

      expect(low.quantizeColor).toBe(8);
      expect(high.quantizeColor).toBe(8);
      expect(low.quantizeWeight).toBe(8);
      expect(high.quantizeWeight).toBe(8);
    });
  });

  describe('toETC1SParams', () => {
    it('should map quality to 0-255 range', () => {
      expect(CompressionMapper.toETC1SParams(0).quality).toBe(0);
      expect(CompressionMapper.toETC1SParams(1).quality).toBe(255);
    });

    it('should clamp and pass through pattern', () => {
      expect(CompressionMapper.toETC1SParams(-0.5).quality).toBe(0);
      expect(CompressionMapper.toETC1SParams(1.5).quality).toBe(255);
      expect(CompressionMapper.toETC1SParams(0.5, 'test').pattern).toBe('test');
    });
  });

  describe('toUASTCParams', () => {
    it('should invert quality for UASTC (0 = best quality, 4 = most compression)', () => {
      expect(CompressionMapper.toUASTCParams(1).quality).toBe(0);
      expect(CompressionMapper.toUASTCParams(0).quality).toBe(4);
      expect(CompressionMapper.toUASTCParams(0.5).quality).toBe(2);
    });

    it('should clamp out-of-range values', () => {
      expect(CompressionMapper.toUASTCParams(-0.5).quality).toBe(4);
      expect(CompressionMapper.toUASTCParams(1.5).quality).toBe(0);
    });
  });

  describe('detectTextureCompressionMode', () => {
    it('should detect UASTC textures (normal, metallic, emissive)', () => {
      expect(
        CompressionMapper.detectTextureCompressionMode('normalTexture'),
      ).toBe('uastc');
      expect(
        CompressionMapper.detectTextureCompressionMode(
          'metallicRoughnessTexture',
        ),
      ).toBe('uastc');
    });

    it('should detect ETC1S textures (baseColor, UI, sky)', () => {
      expect(
        CompressionMapper.detectTextureCompressionMode('baseColorTexture'),
      ).toBe('etc1s');
      expect(CompressionMapper.detectTextureCompressionMode('ui_button')).toBe(
        'etc1s',
      );
    });

    it('should default to ETC1S for unknown textures', () => {
      expect(
        CompressionMapper.detectTextureCompressionMode('unknown_texture'),
      ).toBe('etc1s');
    });
  });

  describe('detectManualTextureCompressionMode', () => {
    it('should prioritize UASTC patterns over ETC1S', () => {
      const mode = CompressionMapper.detectManualTextureCompressionMode(
        'myTexture',
        [/myTexture/],
        [/myTexture/],
      );
      expect(mode).toBe('uastc');
    });

    it('should fall back to ETC1S when no patterns match', () => {
      const mode = CompressionMapper.detectManualTextureCompressionMode(
        'unknown',
        [/normal/],
        [/specular/],
      );
      expect(mode).toBe('etc1s');
    });

    it('should handle complex regex patterns', () => {
      const mode = CompressionMapper.detectManualTextureCompressionMode(
        'character_arm_normal_01',
        [],
        [/normal_\d+$/],
      );
      expect(mode).toBe('uastc');
    });
  });
});
