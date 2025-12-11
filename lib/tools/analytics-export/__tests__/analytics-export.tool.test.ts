/**
 * Analytics Export Tool - Integration Tests
 * Phase 7: Testing & Validation
 * Date: October 25, 2025
 */

import { describe, it, expect } from 'vitest';
import { analyticsExportTool } from '../index';

describe('Analytics Export Tool', () => {
  describe('Tool Definition', () => {
    it('should have correct name and version', () => {
      expect(analyticsExportTool.name).toBe('analytics_export');
      expect(analyticsExportTool.version).toBe('1.0.0');
    });

    it('should have proper description', () => {
      expect(analyticsExportTool.description).toContain('analytics export');
      expect(analyticsExportTool.description).toContain('download links');
    });

    it('should define all required parameters', () => {
      const params = analyticsExportTool.parameters;
      expect(params.type).toBe('object');
      expect(params.required).toContain('operation');
      expect(params.properties.operation).toBeDefined();
      expect(params.properties.format).toBeDefined();
      expect(params.properties.exportType).toBeDefined();
    });

    it('should define all operations', () => {
      const operationEnum = analyticsExportTool.parameters.properties.operation.enum;
      expect(operationEnum).toContain('create_export');
      expect(operationEnum).toContain('list_exports');
      expect(operationEnum).toContain('get_download_link');
    });

    it('should be enabled by default', () => {
      expect(analyticsExportTool.config.enabled).toBe(true);
    });
  });

  describe('Tool Execution', () => {
    it('should reject execution without userId', async () => {
      await expect(
        analyticsExportTool.execute({ operation: 'create_export' })
      ).rejects.toThrow('User ID required');
    });

    it('should reject execution without operation', async () => {
      await expect(
        analyticsExportTool.execute({}, undefined, 'user-123')
      ).rejects.toThrow('operation is required');
    });

    it('should reject create_export without format', async () => {
      await expect(
        analyticsExportTool.execute(
          { operation: 'create_export' },
          undefined,
          'user-123'
        )
      ).rejects.toThrow('format is required');
    });

    it('should reject create_export without exportType', async () => {
      await expect(
        analyticsExportTool.execute(
          { operation: 'create_export', format: 'csv' },
          undefined,
          'user-123'
        )
      ).rejects.toThrow('exportType is required');
    });

    it('should reject get_download_link without exportId', async () => {
      await expect(
        analyticsExportTool.execute(
          { operation: 'get_download_link' },
          undefined,
          'user-123'
        )
      ).rejects.toThrow('exportId is required');
    });

    it('should reject unknown operation', async () => {
      await expect(
        analyticsExportTool.execute(
          { operation: 'unknown_operation' },
          undefined,
          'user-123'
        )
      ).rejects.toThrow('Unknown operation');
    });
  });
});
