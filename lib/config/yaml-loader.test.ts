/**
 * Tests for YAML Configuration Loader
 *
 * @module lib/config/yaml-loader.test
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { z } from 'zod';
import {
  loadYamlConfig,
  clearConfigCache,
  clearConfigCacheKey,
  getConfigCacheSize,
} from './yaml-loader';

describe('yaml-loader', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearConfigCache();
  });

  describe('loadYamlConfig', () => {
    it('should load a valid YAML file', () => {
      // tools.config.yaml exists in project root
      const config = loadYamlConfig('tools.config.yaml');
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });

    it('should cache loaded configurations', () => {
      expect(getConfigCacheSize()).toBe(0);

      loadYamlConfig('tools.config.yaml');
      expect(getConfigCacheSize()).toBe(1);

      // Load again - should use cache
      loadYamlConfig('tools.config.yaml');
      expect(getConfigCacheSize()).toBe(1);
    });

    it('should validate with Zod schema', () => {
      const schema = z.object({
        filesystem: z.object({
          enabled: z.boolean(),
        }),
      });

      const config = loadYamlConfig('tools.config.yaml', schema);
      expect(config.filesystem.enabled).toBeDefined();
    });

    it('should throw on missing file by default', () => {
      expect(() => {
        loadYamlConfig('nonexistent.yaml');
      }).toThrow();
    });

    it('should not throw with throwOnError: false', () => {
      const config = loadYamlConfig('nonexistent.yaml', undefined, {
        throwOnError: false,
      });

      expect(config).toEqual({});
    });
  });

  describe('cache management', () => {
    it('should clear all cache', () => {
      loadYamlConfig('tools.config.yaml');
      expect(getConfigCacheSize()).toBe(1);

      clearConfigCache();
      expect(getConfigCacheSize()).toBe(0);
    });

    it('should clear specific cache key', () => {
      loadYamlConfig('tools.config.yaml');
      expect(getConfigCacheSize()).toBe(1);

      clearConfigCacheKey('tools.config.yaml');
      expect(getConfigCacheSize()).toBe(0);
    });
  });
});
