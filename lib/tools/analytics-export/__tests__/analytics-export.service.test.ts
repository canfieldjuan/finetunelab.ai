/**
 * Analytics Export Service - Unit Tests
 * Phase 7: Testing & Validation
 * Date: October 25, 2025
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { analyticsExportService } from '../analytics-export.service';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch as typeof fetch;

describe('AnalyticsExportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createExport', () => {
    it('should create export with valid parameters', async () => {
      const mockResponse = {
        export: {
          id: 'test-123',
          downloadUrl: 'https://example.com/export.csv',
          fileName: 'test.csv',
          fileSize: 1000,
          status: 'completed',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await analyticsExportService.createExport({
        userId: 'user-123',
        format: 'csv',
        exportType: 'overview',
      });

      expect(result.success).toBe(true);
      expect(result.export?.id).toBe('test-123');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/analytics/export',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should reject invalid format', async () => {
      type InvalidFormat = 'csv' | 'json' | 'report';
      const result = await analyticsExportService.createExport({
        userId: 'user-123',
        format: 'invalid' as InvalidFormat,
        exportType: 'overview',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid format');
    });

    it('should reject invalid export type', async () => {
      const result = await analyticsExportService.createExport({
        userId: 'user-123',
        format: 'csv',
        exportType: 'invalid',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid export type');
    });

    it('should reject date range exceeding max days', async () => {
      const startDate = '2024-01-01';
      const endDate = '2025-10-25';

      const result = await analyticsExportService.createExport({
        userId: 'user-123',
        format: 'csv',
        exportType: 'overview',
        startDate,
        endDate,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Date range too large');
    });

    it('should reject start date after end date', async () => {
      const result = await analyticsExportService.createExport({
        userId: 'user-123',
        format: 'csv',
        exportType: 'overview',
        startDate: '2025-10-25',
        endDate: '2025-10-01',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Start date must be before end date');
    });

    it('should use default date range when not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ export: {} }),
      });

      await analyticsExportService.createExport({
        userId: 'user-123',
        format: 'csv',
        exportType: 'overview',
      });

      const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(fetchCall[1].body as string);
      
      expect(body.startDate).toBeDefined();
      expect(body.endDate).toBeDefined();
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      });

      const result = await analyticsExportService.createExport({
        userId: 'user-123',
        format: 'csv',
        exportType: 'overview',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
