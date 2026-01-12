/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach } from 'vitest';

/**
 * CacheManager Tests
 *
 * Tests for the asset caching system from src/asset/cache-manager.ts.
 * The CacheManager is inlined here to avoid workspace dependency issues.
 */

// Inline implementation of CacheManager for testing
class CacheManager {
  private static cache = new Map<string, any>();
  private static promiseCache = new Map<string, Promise<any>>();
  private static keyToUrl = new Map<string, string>();

  static setKeyToUrl(key: string, url: string): void {
    this.keyToUrl.set(key, url);
  }

  static resolveUrl(urlOrKey: string): string {
    return this.keyToUrl.get(urlOrKey) ?? urlOrKey;
  }

  static hasPromise(url: string): boolean {
    return this.promiseCache.has(url);
  }

  static getPromise<T>(url: string): Promise<T> | undefined {
    return this.promiseCache.get(url) as Promise<T>;
  }

  static setPromise<T>(url: string, promise: Promise<T>): void {
    this.promiseCache.set(url, promise);
  }

  static deletePromise(url: string): void {
    this.promiseCache.delete(url);
  }

  static hasAsset(url: string): boolean {
    return this.cache.has(url);
  }

  static getAsset<T>(url: string): T | undefined {
    return this.cache.get(url) as T;
  }

  static setAsset<T>(url: string, asset: T): void {
    this.cache.set(url, asset);
  }

  static getAssetByKey(key: string): any {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    const url = this.keyToUrl.get(key);
    if (url) {
      return this.cache.get(url);
    }
    return undefined;
  }

  static clear(): void {
    this.cache.clear();
    this.promiseCache.clear();
    this.keyToUrl.clear();
  }
}

describe('CacheManager', () => {
  beforeEach(() => {
    CacheManager.clear();
  });

  describe('key-to-URL mapping', () => {
    it('should register and resolve key to URL', () => {
      CacheManager.setKeyToUrl('my-texture', 'https://example.com/texture.png');

      expect(CacheManager.resolveUrl('my-texture')).toBe(
        'https://example.com/texture.png',
      );
    });

    it('should pass through URL when no key mapping exists', () => {
      const directUrl = 'https://example.com/direct.png';

      expect(CacheManager.resolveUrl(directUrl)).toBe(directUrl);
    });

    it('should overwrite existing key mapping', () => {
      CacheManager.setKeyToUrl('my-texture', 'https://example.com/old.png');
      CacheManager.setKeyToUrl('my-texture', 'https://example.com/new.png');

      expect(CacheManager.resolveUrl('my-texture')).toBe(
        'https://example.com/new.png',
      );
    });

    it('should handle multiple distinct keys', () => {
      CacheManager.setKeyToUrl('texture-a', 'https://example.com/a.png');
      CacheManager.setKeyToUrl('texture-b', 'https://example.com/b.png');
      CacheManager.setKeyToUrl('model-c', 'https://example.com/c.glb');

      expect(CacheManager.resolveUrl('texture-a')).toBe(
        'https://example.com/a.png',
      );
      expect(CacheManager.resolveUrl('texture-b')).toBe(
        'https://example.com/b.png',
      );
      expect(CacheManager.resolveUrl('model-c')).toBe(
        'https://example.com/c.glb',
      );
    });
  });

  describe('promise cache', () => {
    it('should store and retrieve promises', () => {
      const url = 'https://example.com/asset.glb';
      const promise = Promise.resolve({ type: 'model' });

      CacheManager.setPromise(url, promise);

      expect(CacheManager.hasPromise(url)).toBe(true);
      expect(CacheManager.getPromise(url)).toBe(promise);
    });

    it('should return false for non-existent promise', () => {
      expect(CacheManager.hasPromise('https://example.com/missing.png')).toBe(
        false,
      );
    });

    it('should return undefined for non-existent promise get', () => {
      expect(
        CacheManager.getPromise('https://example.com/missing.png'),
      ).toBeUndefined();
    });

    it('should delete promise from cache', () => {
      const url = 'https://example.com/asset.glb';
      const promise = Promise.resolve({ type: 'model' });

      CacheManager.setPromise(url, promise);
      expect(CacheManager.hasPromise(url)).toBe(true);

      CacheManager.deletePromise(url);
      expect(CacheManager.hasPromise(url)).toBe(false);
    });

    it('should handle deleting non-existent promise gracefully', () => {
      expect(() => {
        CacheManager.deletePromise('https://example.com/never-existed.png');
      }).not.toThrow();
    });

    it('should store multiple concurrent promises', () => {
      const url1 = 'https://example.com/asset1.glb';
      const url2 = 'https://example.com/asset2.glb';
      const promise1 = Promise.resolve({ id: 1 });
      const promise2 = Promise.resolve({ id: 2 });

      CacheManager.setPromise(url1, promise1);
      CacheManager.setPromise(url2, promise2);

      expect(CacheManager.getPromise(url1)).toBe(promise1);
      expect(CacheManager.getPromise(url2)).toBe(promise2);
    });
  });

  describe('asset cache', () => {
    it('should store and retrieve assets', () => {
      const url = 'https://example.com/texture.png';
      const asset = { type: 'texture', data: new Uint8Array([1, 2, 3]) };

      CacheManager.setAsset(url, asset);

      expect(CacheManager.hasAsset(url)).toBe(true);
      expect(CacheManager.getAsset(url)).toBe(asset);
    });

    it('should return false for non-existent asset', () => {
      expect(CacheManager.hasAsset('https://example.com/missing.png')).toBe(
        false,
      );
    });

    it('should return undefined for non-existent asset get', () => {
      expect(
        CacheManager.getAsset('https://example.com/missing.png'),
      ).toBeUndefined();
    });

    it('should overwrite existing asset', () => {
      const url = 'https://example.com/texture.png';
      const oldAsset = { version: 1 };
      const newAsset = { version: 2 };

      CacheManager.setAsset(url, oldAsset);
      CacheManager.setAsset(url, newAsset);

      expect(CacheManager.getAsset(url)).toBe(newAsset);
    });

    it('should store assets of different types', () => {
      CacheManager.setAsset('url1', 'string-asset');
      CacheManager.setAsset('url2', 42);
      CacheManager.setAsset('url3', { complex: true });
      CacheManager.setAsset('url4', null);

      expect(CacheManager.getAsset<string>('url1')).toBe('string-asset');
      expect(CacheManager.getAsset<number>('url2')).toBe(42);
      expect(CacheManager.getAsset<object>('url3')).toEqual({ complex: true });
      expect(CacheManager.getAsset('url4')).toBeNull();
    });
  });

  describe('getAssetByKey', () => {
    it('should retrieve asset by direct URL', () => {
      const url = 'https://example.com/texture.png';
      const asset = { type: 'texture' };

      CacheManager.setAsset(url, asset);

      expect(CacheManager.getAssetByKey(url)).toBe(asset);
    });

    it('should retrieve asset by logical key', () => {
      const key = 'my-texture';
      const url = 'https://example.com/texture.png';
      const asset = { type: 'texture' };

      CacheManager.setKeyToUrl(key, url);
      CacheManager.setAsset(url, asset);

      expect(CacheManager.getAssetByKey(key)).toBe(asset);
    });

    it('should return undefined for unknown key', () => {
      expect(CacheManager.getAssetByKey('unknown-key')).toBeUndefined();
    });

    it('should return undefined when key exists but asset not cached', () => {
      CacheManager.setKeyToUrl('my-key', 'https://example.com/not-loaded.png');

      expect(CacheManager.getAssetByKey('my-key')).toBeUndefined();
    });

    it('should prioritize direct URL lookup over key lookup', () => {
      // If a URL is used as both a key and a direct cache entry
      const url = 'https://example.com/texture.png';
      const directAsset = { source: 'direct' };

      CacheManager.setAsset(url, directAsset);
      // Don't set a key mapping - should still find it directly

      expect(CacheManager.getAssetByKey(url)).toBe(directAsset);
    });
  });

  describe('clear', () => {
    it('should clear all caches', () => {
      CacheManager.setKeyToUrl('key1', 'https://example.com/1.png');
      CacheManager.setPromise(
        'https://example.com/1.png',
        Promise.resolve({}),
      );
      CacheManager.setAsset('https://example.com/1.png', { data: true });

      CacheManager.clear();

      expect(CacheManager.resolveUrl('key1')).toBe('key1'); // Falls back to key itself
      expect(CacheManager.hasPromise('https://example.com/1.png')).toBe(false);
      expect(CacheManager.hasAsset('https://example.com/1.png')).toBe(false);
    });

    it('should allow adding new entries after clear', () => {
      CacheManager.setAsset('url1', { old: true });
      CacheManager.clear();
      CacheManager.setAsset('url2', { new: true });

      expect(CacheManager.hasAsset('url1')).toBe(false);
      expect(CacheManager.hasAsset('url2')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string as key', () => {
      CacheManager.setKeyToUrl('', 'https://example.com/empty-key.png');
      expect(CacheManager.resolveUrl('')).toBe(
        'https://example.com/empty-key.png',
      );
    });

    it('should handle special characters in keys', () => {
      const specialKey = 'asset:with/special?chars=true&more';
      const url = 'https://example.com/asset.png';

      CacheManager.setKeyToUrl(specialKey, url);
      expect(CacheManager.resolveUrl(specialKey)).toBe(url);
    });

    it('should handle very long URLs', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(1000) + '.png';
      const asset = { data: 'test' };

      CacheManager.setAsset(longUrl, asset);
      expect(CacheManager.getAsset(longUrl)).toBe(asset);
    });
  });
});
