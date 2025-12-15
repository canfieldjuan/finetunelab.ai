/**
 * Analytics Export Service
 * Phase 6: LLM Integration
 * Date: October 25, 2025
 */

import { analyticsExportConfig } from './config';
import type { SupabaseClient } from '@supabase/supabase-js';

interface ExportCreationParams {
  userId: string;
  format: 'csv' | 'json' | 'report';
  exportType: string;
  startDate?: string;
  endDate?: string;
}

interface ExportRecord {
  id: string;
  userId: string;
  exportType: string;
  format: string;
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  status: string;
  createdAt: string;
  expiresAt: string;
}

interface ExportListParams {
  userId: string;
  limit?: number;
  showExpired?: boolean;
}

class AnalyticsExportService {
  /**
   * Create a new analytics export
   * Calls the /api/analytics/export endpoint
   */
  async createExport(params: ExportCreationParams): Promise<{
    success: boolean;
    export?: ExportRecord;
    error?: string;
  }> {
    const { userId, format, exportType, startDate, endDate } = params;

    console.log('[AnalyticsExportService] Creating export:', {
      userId,
      format,
      exportType,
      dateRange: startDate && endDate ? `${startDate} to ${endDate}` : 'default',
    });

    try {
      // Validate format
      const validFormats = analyticsExportConfig.availableFormats as readonly string[];
      if (!validFormats.includes(format)) {
        return {
          success: false,
          error: `Invalid format: ${format}. Must be one of: ${analyticsExportConfig.availableFormats.join(', ')}`,
        };
      }

      // Validate export type
      const validTypes = analyticsExportConfig.availableTypes as readonly string[];
      if (!validTypes.includes(exportType)) {
        return {
          success: false,
          error: `Invalid export type: ${exportType}. Must be one of: ${analyticsExportConfig.availableTypes.join(', ')}`,
        };
      }

      // Calculate date range
      const now = new Date();
      const defaultStart = new Date(now);
      defaultStart.setDate(now.getDate() - analyticsExportConfig.defaultDateRangeDays);

      const finalStartDate = startDate || defaultStart.toISOString().split('T')[0];
      const finalEndDate = endDate || now.toISOString().split('T')[0];

      // Validate date range
      const start = new Date(finalStartDate);
      const end = new Date(finalEndDate);
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff > analyticsExportConfig.maxDateRangeDays) {
        return {
          success: false,
          error: `Date range too large: ${daysDiff} days. Maximum: ${analyticsExportConfig.maxDateRangeDays} days`,
        };
      }

      if (daysDiff < 0) {
        return {
          success: false,
          error: 'Start date must be before end date',
        };
      }

      // Call the API endpoint (use full URL for server-side execution)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
        || 'http://localhost:3000';

      const response = await fetch(`${baseUrl}/api/analytics/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: finalStartDate,
          endDate: finalEndDate,
          format,
          exportType,
          userId, // Include userId for server-side auth
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || `API error: ${response.status}`,
        };
      }

      const data = await response.json();

      console.log('[AnalyticsExportService] Export created successfully:', data.export.id);

      return {
        success: true,
        export: data.export,
      };
    } catch (error) {
      console.error('[AnalyticsExportService] Error creating export:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get list of user's exports
   * Queries analytics_exports table via Supabase
   */
  async listExports(params: ExportListParams, passedClient?: unknown): Promise<{
    success: boolean;
    exports?: ExportRecord[];
    error?: string;
  }> {
    const { userId, limit = 20, showExpired = false } = params;

    console.log('[AnalyticsExportService] Listing exports for user:', userId);

    try {
      // Import Supabase client dynamically (server-side only)
      if (typeof window !== 'undefined') {
        // Client-side: use fetch to call an API endpoint
        const response = await fetch(
          `/api/analytics/exports?limit=${limit}&showExpired=${showExpired}`
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          return {
            success: false,
            error: errorData.error || `API error: ${response.status}`,
          };
        }

        const data = await response.json();
        return {
          success: true,
          exports: data.exports,
        };
      } else {
        // Server-side: use passed client (authenticated) or fallback to default
        const { supabase } = await import('@/lib/supabaseClient');
        const dbClient = (passedClient && typeof passedClient === 'object' && 'from' in passedClient)
          ? passedClient as SupabaseClient
          : supabase;

        const query = dbClient
          .from('analytics_exports')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (!showExpired) {
          const now = new Date().toISOString();
          query.gte('expires_at', now);
        }

        const { data, error } = await query;

        if (error) {
          console.error('[AnalyticsExportService] Supabase error:', error);
          return {
            success: false,
            error: error.message,
          };
        }

        return {
          success: true,
          exports: data as ExportRecord[],
        };
      }
    } catch (error) {
      console.error('[AnalyticsExportService] Error listing exports:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get download link for an export
   */
  async getDownloadLink(exportId: string, userId: string, passedClient?: unknown): Promise<{
    success: boolean;
    downloadUrl?: string;
    error?: string;
  }> {
    console.log('[AnalyticsExportService] Getting download link:', exportId);

    try {
      // Use passed client (authenticated) or fallback to default
      const { supabase } = await import('@/lib/supabaseClient');
      const dbClient = (passedClient && typeof passedClient === 'object' && 'from' in passedClient)
        ? passedClient as SupabaseClient
        : supabase;

      const { data, error } = await dbClient
        .from('analytics_exports')
        .select('download_url, expires_at, status')
        .eq('id', exportId)
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('[AnalyticsExportService] Supabase error:', error);
        return {
          success: false,
          error: error.message,
        };
      }

      if (!data) {
        return {
          success: false,
          error: 'Export not found',
        };
      }

      // Check if expired
      const now = new Date();
      const expiresAt = new Date(data.expires_at);
      if (now > expiresAt) {
        return {
          success: false,
          error: 'Export has expired',
        };
      }

      // Check status
      if (data.status !== 'completed') {
        return {
          success: false,
          error: `Export is ${data.status}`,
        };
      }

      return {
        success: true,
        downloadUrl: data.download_url,
      };
    } catch (error) {
      console.error('[AnalyticsExportService] Error getting download link:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export const analyticsExportService = new AnalyticsExportService();
