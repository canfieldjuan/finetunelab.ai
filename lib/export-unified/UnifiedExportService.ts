/**
 * Unified Export Service
 * Central orchestrator for all export types (conversation, analytics, traces)
 * Phase 1: Foundation
 */

import type {
  ExportRequest,
  ExportResult,
  ExportInfo,
  ExportType,
  ExportFormat,
  DataLoader,
  FormatGenerator,
  StorageProvider,
  ExportData,
  ExportOptions,
  ValidationResult,
} from './interfaces';

interface UnifiedExportServiceConfig {
  maxFileSizeMB: number;
  defaultExpirationHours: number;
  maxExportsPerUser: number;
  asyncProcessingThresholdMB: number;
}

/**
 * Main service class for unified export system
 * Uses plugin architecture for loaders and formatters
 */
export class UnifiedExportService {
  private loaders: Map<ExportType, DataLoader>;
  private formatters: Map<ExportFormat, FormatGenerator>;
  private storage: StorageProvider | null;
  private config: UnifiedExportServiceConfig;

  constructor(config: UnifiedExportServiceConfig) {
    this.loaders = new Map();
    this.formatters = new Map();
    this.storage = null;
    this.config = config;
  }

  // ============================================================================
  // Plugin Registration
  // ============================================================================

  /**
   * Register a data loader for a specific export type
   */
  registerLoader(type: ExportType, loader: DataLoader): void {
    console.log(`[UnifiedExportService] Registering loader for type: ${type}`);
    this.loaders.set(type, loader);
  }

  /**
   * Register a format generator for a specific format
   */
  registerFormatter(format: ExportFormat, formatter: FormatGenerator): void {
    console.log(`[UnifiedExportService] Registering formatter for format: ${format}`);
    this.formatters.set(format, formatter);
  }

  /**
   * Set storage provider
   */
  setStorageProvider(provider: StorageProvider): void {
    console.log(`[UnifiedExportService] Setting storage provider: ${provider.getStorageType()}`);
    this.storage = provider;
  }

  // ============================================================================
  // Validation
  // ============================================================================

  /**
   * Validate export request
   */
  private validateRequest(request: ExportRequest): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if loader exists
    if (!this.loaders.has(request.exportType)) {
      errors.push(`No loader registered for export type: ${request.exportType}`);
    }

    // Check if formatter exists
    if (!this.formatters.has(request.format)) {
      errors.push(`No formatter registered for format: ${request.format}`);
    }

    // Check if storage provider is configured
    if (!this.storage) {
      errors.push('No storage provider configured');
    }

    // Validate userId
    if (!request.userId || request.userId.trim() === '') {
      errors.push('userId is required');
    }

    // Validate data selector using loader
    if (this.loaders.has(request.exportType)) {
      const loader = this.loaders.get(request.exportType)!;
      const selectorValidation = loader.validate(request.dataSelector);

      if (!selectorValidation.valid) {
        errors.push(selectorValidation.error || 'Invalid data selector');
      }

      if (selectorValidation.warnings) {
        warnings.push(...selectorValidation.warnings);
      }
    }

    return {
      valid: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // ============================================================================
  // Export Generation
  // ============================================================================

  /**
   * Generate an export
   * Main orchestration method
   */
  async generateExport(request: ExportRequest): Promise<ExportResult> {
    const startTime = Date.now();
    console.log(`[UnifiedExportService] Starting export generation:`, {
      type: request.exportType,
      format: request.format,
      userId: request.userId,
    });

    try {
      // 1. Validate request
      const validation = this.validateRequest(request);
      if (!validation.valid) {
        throw new Error(`Invalid export request: ${validation.error}`);
      }

      if (validation.warnings && validation.warnings.length > 0) {
        console.warn(`[UnifiedExportService] Warnings:`, validation.warnings);
      }

      // 2. Load data from appropriate source
      const loader = this.loaders.get(request.exportType)!;
      console.log(`[UnifiedExportService] Loading data using ${request.exportType} loader...`);
      const exportData = await loader.load(request.dataSelector, request.userId);

      // 3. Check estimated size
      const estimatedSize = await loader.estimateSize(request.dataSelector);
      const estimatedSizeMB = estimatedSize / (1024 * 1024);

      console.log(`[UnifiedExportService] Estimated size: ${estimatedSizeMB.toFixed(2)} MB`);

      if (estimatedSizeMB > this.config.maxFileSizeMB) {
        throw new Error(
          `Export size (${estimatedSizeMB.toFixed(2)} MB) exceeds maximum (${this.config.maxFileSizeMB} MB)`
        );
      }

      // 4. Format data
      const formatter = this.formatters.get(request.format)!;
      console.log(`[UnifiedExportService] Formatting data as ${request.format}...`);
      const content = await formatter.generate(exportData, request.options);

      // 5. Store export
      const exportId = this.generateExportId();
      console.log(`[UnifiedExportService] Storing export with ID: ${exportId}`);
      const { filePath, fileSize } = await this.storage!.saveExport(
        request.userId,
        exportId,
        content,
        request.format
      );

      // 6. Create export record in database
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.config.defaultExpirationHours);

      const exportInfo = await this.saveExportRecord({
        id: exportId,
        userId: request.userId,
        exportType: request.exportType,
        format: request.format,
        filePath,
        fileSize,
        fileName: this.generateFileName(request.exportType, request.format, exportId),
        storageType: this.storage!.getStorageType(),
        status: 'completed',
        downloadCount: 0,
        createdAt: new Date(),
        expiresAt,
      });

      const duration = Date.now() - startTime;
      console.log(`[UnifiedExportService] Export completed in ${duration}ms`, {
        id: exportId,
        size: fileSize,
        format: request.format,
      });

      // 7. Return result
      return {
        id: exportId,
        downloadUrl: `/api/export/v2/download/${exportId}`,
        expiresAt,
        fileSize,
        format: request.format,
        exportType: request.exportType,
        status: 'completed',
        metadata: exportData.metadata,
      };
    } catch (error) {
      console.error(`[UnifiedExportService] Export generation failed:`, error);

      // Re-throw with context
      throw new Error(
        `Export generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ============================================================================
  // Export Record Management
  // ============================================================================

  /**
   * Save export record to database
   * Uses unified_exports table
   */
  private async saveExportRecord(info: ExportInfo): Promise<ExportInfo> {
    console.log(`[UnifiedExportService] Saving export record to database: ${info.id}`);

    try {
      // Import Supabase client dynamically
      const { supabase } = await import('@/lib/supabaseClient');

      const { data, error } = await supabase
        .from('unified_exports')
        .insert({
          id: info.id,
          user_id: info.userId,
          export_type: info.exportType,
          format: info.format,
          file_path: info.filePath,
          file_size: info.fileSize,
          file_name: info.fileName,
          storage_type: info.storageType,
          status: info.status,
          download_count: info.downloadCount,
          created_at: info.createdAt.toISOString(),
          expires_at: info.expiresAt.toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to save export record: ${error.message}`);
      }

      console.log(`[UnifiedExportService] Export record saved successfully`);
      return info;
    } catch (error) {
      console.error(`[UnifiedExportService] Failed to save export record:`, error);
      throw error;
    }
  }

  /**
   * Get export info from database
   */
  async getExportInfo(exportId: string, userId: string): Promise<ExportInfo | null> {
    console.log(`[UnifiedExportService] Fetching export info: ${exportId}`);

    try {
      const { supabase } = await import('@/lib/supabaseClient');

      const { data, error } = await supabase
        .from('unified_exports')
        .select('*')
        .eq('id', exportId)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return null;
        }
        throw new Error(`Failed to fetch export info: ${error.message}`);
      }

      return {
        id: data.id,
        userId: data.user_id,
        exportType: data.export_type as ExportType,
        format: data.format as ExportFormat,
        filePath: data.file_path,
        fileSize: data.file_size,
        fileName: data.file_name,
        storageType: data.storage_type,
        status: data.status,
        downloadCount: data.download_count,
        createdAt: new Date(data.created_at),
        expiresAt: new Date(data.expires_at),
        lastDownloadedAt: data.last_downloaded_at ? new Date(data.last_downloaded_at) : undefined,
      };
    } catch (error) {
      console.error(`[UnifiedExportService] Failed to get export info:`, error);
      throw error;
    }
  }

  /**
   * Update download count
   */
  async incrementDownloadCount(exportId: string, userId: string): Promise<void> {
    console.log(`[UnifiedExportService] Incrementing download count: ${exportId}`);

    try {
      const { supabase } = await import('@/lib/supabaseClient');

      // Fetch current count
      const { data: currentExport, error: fetchError } = await supabase
        .from('unified_exports')
        .select('download_count')
        .eq('id', exportId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !currentExport) {
        console.warn(`[UnifiedExportService] Failed to fetch current export for count update`);
        return;
      }

      // Increment and update
      const { error: updateError } = await supabase
        .from('unified_exports')
        .update({
          download_count: currentExport.download_count + 1,
          last_downloaded_at: new Date().toISOString(),
        })
        .eq('id', exportId)
        .eq('user_id', userId);

      if (updateError) {
        throw new Error(`Failed to update download count: ${updateError.message}`);
      }

      console.log(`[UnifiedExportService] Download count updated`);
    } catch (error) {
      console.error(`[UnifiedExportService] Failed to increment download count:`, error);
      // Don't throw - this is not critical
    }
  }

  /**
   * List user's exports
   */
  async listExports(
    userId: string,
    options?: {
      limit?: number;
      showExpired?: boolean;
      exportType?: ExportType;
    }
  ): Promise<ExportInfo[]> {
    console.log(`[UnifiedExportService] Listing exports for user: ${userId}`);

    try {
      const { supabase } = await import('@/lib/supabaseClient');

      let query = supabase
        .from('unified_exports')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (!options?.showExpired) {
        const now = new Date().toISOString();
        query = query.gte('expires_at', now);
      }

      if (options?.exportType) {
        query = query.eq('export_type', options.exportType);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to list exports: ${error.message}`);
      }

      return (data || []).map(row => ({
        id: row.id,
        userId: row.user_id,
        exportType: row.export_type as ExportType,
        format: row.format as ExportFormat,
        filePath: row.file_path,
        fileSize: row.file_size,
        fileName: row.file_name,
        storageType: row.storage_type,
        status: row.status,
        downloadCount: row.download_count,
        createdAt: new Date(row.created_at),
        expiresAt: new Date(row.expires_at),
        lastDownloadedAt: row.last_downloaded_at ? new Date(row.last_downloaded_at) : undefined,
      }));
    } catch (error) {
      console.error(`[UnifiedExportService] Failed to list exports:`, error);
      throw error;
    }
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Generate unique export ID
   */
  private generateExportId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `exp_${timestamp}_${random}`;
  }

  /**
   * Generate file name for export
   */
  private generateFileName(type: ExportType, format: ExportFormat, exportId: string): string {
    const timestamp = new Date().toISOString().split('T')[0];
    const formatter = this.formatters.get(format);
    const extension = formatter?.getExtension() || format;

    return `${type}_export_${timestamp}_${exportId}.${extension}`;
  }

  /**
   * Get registered loaders
   */
  getRegisteredLoaders(): ExportType[] {
    return Array.from(this.loaders.keys());
  }

  /**
   * Get registered formatters
   */
  getRegisteredFormatters(): ExportFormat[] {
    return Array.from(this.formatters.keys());
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.loaders.size > 0 && this.formatters.size > 0 && this.storage !== null;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let serviceInstance: UnifiedExportService | null = null;

/**
 * Get or create singleton instance
 */
export function getUnifiedExportService(): UnifiedExportService {
  if (!serviceInstance) {
    serviceInstance = new UnifiedExportService({
      maxFileSizeMB: 100,
      defaultExpirationHours: 168, // 7 days
      maxExportsPerUser: 50,
      asyncProcessingThresholdMB: 10,
    });
  }
  return serviceInstance;
}

/**
 * Reset service instance (for testing)
 */
export function resetUnifiedExportService(): void {
  serviceInstance = null;
}
