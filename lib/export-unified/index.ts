/**
 * Unified Export System - Main Exports
 * Phase 1: Foundation
 *
 * Central entry point for the unified export system
 */

// Core service
export {
  UnifiedExportService,
  getUnifiedExportService,
  resetUnifiedExportService,
} from './UnifiedExportService';

// Data loaders
export {
  ConversationDataLoader,
  AnalyticsDataLoader,
  TraceDataLoader,
} from './loaders';

// Format generators
export {
  JSONFormatter,
  CSVFormatter,
  JSONLFormatter,
  MarkdownFormatter,
  TXTFormatter,
} from './formatters';

// Storage providers
export { FilesystemStorage } from './storage/FilesystemStorage';
export { SupabaseStorage } from './storage/SupabaseStorage';

// Utilities
export {
  validateDataSelector,
  validateConversationSelector,
  validateAnalyticsSelector,
  validateTraceSelector,
  validateUserId,
  estimateDataSize,
} from './utils/validation';

export {
  escapeCSVValue,
  arrayToCSV,
  addUTF8BOM,
  formatDateForCSV,
  formatJSONForCSV,
  createCSV,
  createMultiSectionCSV,
} from './utils/csv-helpers';

// Configuration
export {
  unifiedExportConfig,
  validateUnifiedExportConfig,
  MIME_TYPES,
  FILE_EXTENSIONS,
  DEFAULT_EXPORT_OPTIONS,
  EXPORT_TYPE_CONFIG,
  ANALYTICS_EXPORT_SUBTYPES,
  TEMPLATE_AUDIENCES,
  EXPORT_STATUS_TRANSITIONS,
  getSupportedFormats,
  isFormatSupported,
  getDefaultFormat,
  requiresTemplate,
} from './config';

// All TypeScript interfaces and types
export type {
  // Export types
  ExportType,
  ExportFormat,
  ExportStatus,
  TemplateAudience,
  StorageType,

  // Core interfaces
  ExportRequest,
  ExportResult,
  ExportInfo,
  ExportMetadata,

  // Data selectors
  DataSelector,
  ConversationDataSelector,
  AnalyticsDataSelector,
  TraceDataSelector,
  CustomDataSelector,

  // Options
  ExportOptions,
  TemplateOptions,

  // Filters
  AnalyticsExportFilters,
  TraceExportFilters,

  // Export data
  ExportData,
  ConversationData,
  MessageData,
  AnalyticsDataset,
  TraceDataset,
  CustomData,

  // Analytics data types
  TokenUsageData,
  QualityMetricsData,
  ToolUsageData,
  ConversationMetricsData,
  ErrorData,
  LatencyData,
  AggregationsData,
  TrendData,

  // Trace data types
  TraceData,
  TraceSummaryData,

  // Plugin interfaces
  DataLoader,
  ValidationResult,
  FormatGenerator,
  ReportTemplate,
  TemplateSection,
  RenderedReport,
  ReportMetadata,
  RenderedSection,
  SectionContent,

  // Template content types
  SummaryContent,
  MetricsContent,
  MetricItem,
  ChartContent,
  ChartDataset,
  TableContent,
  RecommendationsContent,
  RecommendationItem,
  BreakdownContent,
  BreakdownItem,
  AlertContent,

  // Storage
  StorageProvider,

  // Configuration
  UnifiedExportConfig,
} from './interfaces';
