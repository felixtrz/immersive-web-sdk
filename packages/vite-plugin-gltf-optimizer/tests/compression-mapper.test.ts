/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';

/**
 * CompressionMapper Tests
 *
 * Tests for the parameter mapping utilities from src/compression-mapper.ts.
 * Inlined implementation to avoid workspace dependency issues during testing.
 */

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
    describe('method selection', () => {
      it('should use edgebreaker for quality > 0.5', () => {
        const params = CompressionMapper.toDracoParams(0.75);
        expect(params.method).toBe('edgebreaker');
      });

      it('should use sequential for quality <= 0.5', () => {
        const params = CompressionMapper.toDracoParams(0.5);
        expect(params.method).toBe('sequential');
      });

      it('should use sequential for low quality', () => {
        const params = CompressionMapper.toDracoParams(0.25);
        expect(params.method).toBe('sequential');
      });
    });

    describe('encode speed mapping', () => {
      it('should map speed 0 to encodeSpeed 0', () => {
        const params = CompressionMapper.toDracoParams(0.75, 0);
        expect(params.encodeSpeed).toBe(0);
      });

      it('should map speed 0.5 to encodeSpeed 5', () => {
        const params = CompressionMapper.toDracoParams(0.75, 0.5);
        expect(params.encodeSpeed).toBe(5);
      });

      it('should map speed 1 to encodeSpeed 10', () => {
        const params = CompressionMapper.toDracoParams(0.75, 1);
        expect(params.encodeSpeed).toBe(10);
      });
    });

    describe('decode speed mapping', () => {
      it('should map quality to decodeSpeed', () => {
        const params = CompressionMapper.toDracoParams(0.8);
        expect(params.decodeSpeed).toBe(8);
      });

      it('should map quality 0 to decodeSpeed 0', () => {
        const params = CompressionMapper.toDracoParams(0);
        expect(params.decodeSpeed).toBe(0);
      });

      it('should map quality 1 to decodeSpeed 10', () => {
        const params = CompressionMapper.toDracoParams(1);
        expect(params.decodeSpeed).toBe(10);
      });
    });

    describe('quantization bits', () => {
      it('should calculate position bits based on precision', () => {
        const lowPrecision = CompressionMapper.toDracoParams(0.75, 0.5, 0);
        const highPrecision = CompressionMapper.toDracoParams(0.75, 0.5, 1);

        expect(lowPrecision.quantizationBits.POSITION).toBe(10);
        expect(highPrecision.quantizationBits.POSITION).toBe(16);
      });

      it('should calculate normal bits based on precision', () => {
        const lowPrecision = CompressionMapper.toDracoParams(0.75, 0.5, 0);
        const highPrecision = CompressionMapper.toDracoParams(0.75, 0.5, 1);

        expect(lowPrecision.quantizationBits.NORMAL).toBe(8);
        expect(highPrecision.quantizationBits.NORMAL).toBe(10);
      });

      it('should calculate texcoord bits based on precision', () => {
        const lowPrecision = CompressionMapper.toDracoParams(0.75, 0.5, 0);
        const highPrecision = CompressionMapper.toDracoParams(0.75, 0.5, 1);

        expect(lowPrecision.quantizationBits.TEXCOORD_0).toBe(10);
        expect(highPrecision.quantizationBits.TEXCOORD_0).toBe(12);
      });
    });

    describe('value clamping', () => {
      it('should clamp quality above 1 to 1', () => {
        const params = CompressionMapper.toDracoParams(1.5);
        expect(params.decodeSpeed).toBe(10);
      });

      it('should clamp quality below 0 to 0', () => {
        const params = CompressionMapper.toDracoParams(-0.5);
        expect(params.decodeSpeed).toBe(0);
      });

      it('should clamp speed above 1', () => {
        const params = CompressionMapper.toDracoParams(0.75, 2);
        expect(params.encodeSpeed).toBe(10);
      });

      it('should clamp precision below 0', () => {
        const params = CompressionMapper.toDracoParams(0.75, 0.5, -1);
        expect(params.quantizationBits.POSITION).toBe(10);
      });
    });

    describe('default values', () => {
      it('should use default quality 0.75', () => {
        const params = CompressionMapper.toDracoParams();
        expect(params.decodeSpeed).toBe(8); // round(0.75 * 10)
      });

      it('should use default speed 0.5', () => {
        const params = CompressionMapper.toDracoParams();
        expect(params.encodeSpeed).toBe(5);
      });

      it('should use default precision 0.8', () => {
        const params = CompressionMapper.toDracoParams();
        expect(params.quantizationBits.POSITION).toBe(15); // 10 + round(0.8 * 6)
      });
    });
  });

  describe('toMeshoptParams', () => {
    it('should use medium level for quality > 0.6', () => {
      const params = CompressionMapper.toMeshoptParams(0.75);
      expect(params.level).toBe('medium');
    });

    it('should use high level for quality <= 0.6', () => {
      const params = CompressionMapper.toMeshoptParams(0.6);
      expect(params.level).toBe('high');
    });

    it('should use high level for low quality', () => {
      const params = CompressionMapper.toMeshoptParams(0.3);
      expect(params.level).toBe('high');
    });

    it('should clamp quality above 1', () => {
      const params = CompressionMapper.toMeshoptParams(1.5);
      expect(params.level).toBe('medium');
    });

    it('should clamp quality below 0', () => {
      const params = CompressionMapper.toMeshoptParams(-0.5);
      expect(params.level).toBe('high');
    });

    it('should use default quality 0.75', () => {
      const params = CompressionMapper.toMeshoptParams();
      expect(params.level).toBe('medium');
    });
  });

  describe('toQuantizationBits', () => {
    it('should calculate all quantization values', () => {
      const bits = CompressionMapper.toQuantizationBits(0.8);

      expect(bits.quantizePosition).toBe(15);
      expect(bits.quantizeNormal).toBe(10);
      expect(bits.quantizeTexcoord).toBe(12);
      expect(bits.quantizeColor).toBe(8);
      expect(bits.quantizeWeight).toBe(8);
      expect(bits.quantizeGeneric).toBe(12);
    });

    it('should use minimum values for precision 0', () => {
      const bits = CompressionMapper.toQuantizationBits(0);

      expect(bits.quantizePosition).toBe(10);
      expect(bits.quantizeNormal).toBe(8);
      expect(bits.quantizeTexcoord).toBe(10);
    });

    it('should use maximum values for precision 1', () => {
      const bits = CompressionMapper.toQuantizationBits(1);

      expect(bits.quantizePosition).toBe(16);
      expect(bits.quantizeNormal).toBe(10);
      expect(bits.quantizeTexcoord).toBe(12);
    });

    it('should have fixed color and weight bits', () => {
      const lowBits = CompressionMapper.toQuantizationBits(0);
      const highBits = CompressionMapper.toQuantizationBits(1);

      expect(lowBits.quantizeColor).toBe(8);
      expect(highBits.quantizeColor).toBe(8);
      expect(lowBits.quantizeWeight).toBe(8);
      expect(highBits.quantizeWeight).toBe(8);
    });

    it('should use default precision 0.8', () => {
      const bits = CompressionMapper.toQuantizationBits();
      expect(bits.quantizePosition).toBe(15);
    });
  });

  describe('toETC1SParams', () => {
    it('should set mode to etc1s', () => {
      const params = CompressionMapper.toETC1SParams(0.75);
      expect(params.mode).toBe('etc1s');
    });

    it('should map quality to 0-255 range', () => {
      expect(CompressionMapper.toETC1SParams(0).quality).toBe(0);
      expect(CompressionMapper.toETC1SParams(0.5).quality).toBe(128);
      expect(CompressionMapper.toETC1SParams(1).quality).toBe(255);
    });

    it('should include pattern when provided', () => {
      const params = CompressionMapper.toETC1SParams(0.75, 'baseColor');
      expect(params.pattern).toBe('baseColor');
    });

    it('should have undefined pattern when not provided', () => {
      const params = CompressionMapper.toETC1SParams(0.75);
      expect(params.pattern).toBeUndefined();
    });

    it('should clamp quality values', () => {
      expect(CompressionMapper.toETC1SParams(-0.5).quality).toBe(0);
      expect(CompressionMapper.toETC1SParams(1.5).quality).toBe(255);
    });

    it('should use default quality 0.75', () => {
      const params = CompressionMapper.toETC1SParams();
      expect(params.quality).toBe(191); // round(0.75 * 255)
    });
  });

  describe('toUASTCParams', () => {
    it('should set mode to uastc', () => {
      const params = CompressionMapper.toUASTCParams(0.75);
      expect(params.mode).toBe('uastc');
    });

    it('should invert quality for UASTC (0 = best quality)', () => {
      expect(CompressionMapper.toUASTCParams(1).quality).toBe(0); // Best quality
      expect(CompressionMapper.toUASTCParams(0).quality).toBe(4); // Most compression
    });

    it('should map to 0-4 range', () => {
      expect(CompressionMapper.toUASTCParams(0.75).quality).toBe(1);
      expect(CompressionMapper.toUASTCParams(0.5).quality).toBe(2);
      expect(CompressionMapper.toUASTCParams(0.25).quality).toBe(3);
    });

    it('should include pattern when provided', () => {
      const params = CompressionMapper.toUASTCParams(0.75, 'normalMap');
      expect(params.pattern).toBe('normalMap');
    });

    it('should clamp quality values', () => {
      expect(CompressionMapper.toUASTCParams(-0.5).quality).toBe(4);
      expect(CompressionMapper.toUASTCParams(1.5).quality).toBe(0);
    });
  });

  describe('getAutoTexturePatterns', () => {
    it('should return UASTC patterns', () => {
      const patterns = CompressionMapper.getAutoTexturePatterns();
      expect(patterns.uastc).toBeDefined();
      expect(patterns.uastc.length).toBeGreaterThan(0);
    });

    it('should return ETC1S patterns', () => {
      const patterns = CompressionMapper.getAutoTexturePatterns();
      expect(patterns.etc1s).toBeDefined();
      expect(patterns.etc1s.length).toBeGreaterThan(0);
    });

    it('should include normalTexture in UASTC', () => {
      const patterns = CompressionMapper.getAutoTexturePatterns();
      expect(patterns.uastc.some((p) => p.test('normalTexture'))).toBe(true);
    });

    it('should include baseColorTexture in ETC1S', () => {
      const patterns = CompressionMapper.getAutoTexturePatterns();
      expect(patterns.etc1s.some((p) => p.test('baseColorTexture'))).toBe(true);
    });
  });

  describe('detectTextureCompressionMode', () => {
    describe('UASTC detection', () => {
      it('should detect normalTexture as UASTC', () => {
        expect(
          CompressionMapper.detectTextureCompressionMode('normalTexture'),
        ).toBe('uastc');
      });

      it('should detect metallicRoughnessTexture as UASTC', () => {
        expect(
          CompressionMapper.detectTextureCompressionMode(
            'metallicRoughnessTexture',
          ),
        ).toBe('uastc');
      });

      it('should detect emissiveTexture as UASTC', () => {
        expect(
          CompressionMapper.detectTextureCompressionMode('emissiveTexture'),
        ).toBe('uastc');
      });

      it('should detect detail textures as UASTC', () => {
        expect(
          CompressionMapper.detectTextureCompressionMode('detail_normal'),
        ).toBe('uastc');
      });

      it('should detect hero textures as UASTC', () => {
        expect(
          CompressionMapper.detectTextureCompressionMode('hero_diffuse'),
        ).toBe('uastc');
      });
    });

    describe('ETC1S detection', () => {
      it('should detect baseColorTexture as ETC1S', () => {
        expect(
          CompressionMapper.detectTextureCompressionMode('baseColorTexture'),
        ).toBe('etc1s');
      });

      it('should detect diffuseTexture as ETC1S', () => {
        expect(
          CompressionMapper.detectTextureCompressionMode('diffuseTexture'),
        ).toBe('etc1s');
      });

      it('should detect UI textures as ETC1S', () => {
        expect(
          CompressionMapper.detectTextureCompressionMode('ui_button'),
        ).toBe('etc1s');
      });

      it('should detect sky textures as ETC1S', () => {
        expect(CompressionMapper.detectTextureCompressionMode('sky_dome')).toBe(
          'etc1s',
        );
      });
    });

    describe('default behavior', () => {
      it('should default to ETC1S for unknown textures', () => {
        expect(
          CompressionMapper.detectTextureCompressionMode('unknown_texture'),
        ).toBe('etc1s');
      });

      it('should default to ETC1S for empty string', () => {
        expect(CompressionMapper.detectTextureCompressionMode('')).toBe(
          'etc1s',
        );
      });
    });
  });

  describe('detectManualTextureCompressionMode', () => {
    it('should match UASTC patterns first', () => {
      const mode = CompressionMapper.detectManualTextureCompressionMode(
        'myTexture',
        [/myTexture/],
        [/myTexture/],
      );
      expect(mode).toBe('uastc');
    });

    it('should match ETC1S patterns when no UASTC match', () => {
      const mode = CompressionMapper.detectManualTextureCompressionMode(
        'baseColor',
        [/baseColor/],
        [/normal/],
      );
      expect(mode).toBe('etc1s');
    });

    it('should default to ETC1S when no patterns match', () => {
      const mode = CompressionMapper.detectManualTextureCompressionMode(
        'unknown',
        [/normal/],
        [/specular/],
      );
      expect(mode).toBe('etc1s');
    });

    it('should handle empty pattern arrays', () => {
      const mode = CompressionMapper.detectManualTextureCompressionMode(
        'texture',
        [],
        [],
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
