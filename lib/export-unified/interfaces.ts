/**
 * Unified Export System - Core Interfaces
 * Defines all types and interfaces for the unified export architecture
 */

import type { JsonValue } from '../types';

// ============================================================================
// Export Types
// ============================================================================

export type ExportType = 'conversation' | 'analytics' | 'trace' | 'custom';

export type ExportFormat =
  | 'csv'
  | 'json'
  | 'jsonl'
  | 'markdown'
  | 'txt'
  | 'html'
  | 'pdf';

export type ExportStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'expired';

export type TemplateAudience =
  | 'executive'
  | 'engineering'
  | 'onboarding'
  | 'custom';

export type StorageType = 'filesystem' | 'supabase_storage' | 's3';

// ============================================================================
// Core Export Request/Response
// ============================================================================

export interface ExportRequest {
  userId: string;
  exportType: ExportType;
  format: ExportFormat;
  dataSelector: DataSelector;
  options?: ExportOptions;
  template?: TemplateOptions;
}

export interface ExportResult {
  id: string;
  downloadUrl: string;
  expiresAt: Date;
  fileSize: number;
  format: ExportFormat;
  exportType: ExportType;
  status: ExportStatus;
  metadata?: ExportMetadata;
}

export interface ExportInfo {
  id: string;
  userId: string;
  exportType: ExportType;
  format: ExportFormat;
  filePath: string;
  fileSize: number;
  fileName: string;
  storageType: StorageType;
  status: ExportStatus;
  downloadCount: number;
  createdAt: Date;
  expiresAt: Date;
  lastDownloadedAt?: Date;
}

export interface ExportMetadata {
  conversationCount?: number;
  messageCount?: number;
  traceCount?: number;
  dateRange?: { start: Date; end: Date };
  [key: string]: unknown;
}

// ============================================================================
// Data Selectors (Polymorphic based on exportType)
// ============================================================================

export type DataSelector =
  | ConversationDataSelector
  | AnalyticsDataSelector
  | TraceDataSelector
  | CustomDataSelector;

export interface ConversationDataSelector {
  type: 'conversation';
  conversationIds: string[];
  dateRange?: { start: Date; end: Date };
  widgetSessionFilter?: 'all' | 'widget' | 'normal';
  includeSystemMessages?: boolean;
  messageLimit?: number;
}

export interface AnalyticsDataSelector {
  type: 'analytics';
  timeRange: { start: Date; end: Date };
  metrics: string[];
  exportSubType?: 'overview' | 'timeseries' | 'complete' | 'model_comparison' | 'tool_usage' | 'quality_trends';
  filters?: AnalyticsExportFilters;
}

export interface TraceDataSelector {
  type: 'trace';
  timeRange: { start: Date; end: Date };
  traceIds?: string[];
  filters?: TraceExportFilters;
  includeMetrics?: boolean;
}

export interface CustomDataSelector {
  type: 'custom';
  query: Record<string, unknown>;
}

// ============================================================================
// Export Options
// ============================================================================

export interface ExportOptions {
  includeMetadata?: boolean;
  includeSystemMessages?: boolean;
  compressionFormat?: 'zip' | 'gzip' | 'none';
  theme?: 'light' | 'dark';
  title?: string;
  description?: string;
  customOptions?: Record<string, unknown>;
}

export interface TemplateOptions {
  audience: TemplateAudience;
  includeRecommendations?: boolean;
  includeCharts?: boolean;
  customSections?: string[];
  maxPages?: number;
}

// ============================================================================
// Filters
// ============================================================================

export interface AnalyticsExportFilters {
  models?: string[];
  status?: 'all' | 'success' | 'failure';
  trainingJobId?: string;
  conversationIds?: string[];
  operationTypes?: string[];
  minRating?: number;
  toolNames?: string[];
  tags?: string[];
}

export interface TraceExportFilters {
  models?: string[];
  operations?: string[];
  status?: 'all' | 'success' | 'failure';
  minDuration?: number;
  maxDuration?: number;
  tags?: string[];
}

// ============================================================================
// Export Data (returned by data loaders)
// ============================================================================

export interface ExportData {
  type: ExportType;
  userId: string;
  data: ConversationData[] | AnalyticsDataset | TraceDataset | CustomData;
  metadata: ExportMetadata;
}

export interface ConversationData {
  id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
  messages: MessageData[];
}

export interface MessageData {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: Date;
  metadata?: Record<string, unknown>;
}

export interface AnalyticsDataset {
  tokenUsage?: TokenUsageData[];
  quality?: QualityMetricsData[];
  tools?: ToolUsageData[];
  conversations?: ConversationMetricsData[];
  errors?: ErrorData[];
  latency?: LatencyData[];
  aggregations?: AggregationsData;
}

export interface TraceDataset {
  traces: TraceData[];
  summary?: TraceSummaryData;
}

export interface CustomData {
  [key: string]: unknown;
}

// ============================================================================
// Analytics Data Types
// ============================================================================

export interface TokenUsageData {
  date: Date;
  model?: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost?: number;
}

export interface QualityMetricsData {
  date: Date;
  model?: string;
  rating?: number;
  success_rate: number;
  failure_rate: number;
  error_rate: number;
}

export interface ToolUsageData {
  tool_name: string;
  execution_count: number;
  success_count: number;
  failure_count: number;
  avg_duration_ms: number;
}

export interface ConversationMetricsData {
  conversation_id: string;
  message_count: number;
  total_tokens: number;
  avg_rating?: number;
  created_at: Date;
}

export interface ErrorData {
  timestamp: Date;
  error_type: string;
  error_message: string;
  model?: string;
  conversation_id?: string;
}

export interface LatencyData {
  timestamp: Date;
  operation: string;
  latency_ms: number;
  model?: string;
}

export interface AggregationsData {
  totalMessages?: number;
  totalConversations?: number;
  totalTokens?: number;
  totalCost?: number;
  avgRating?: number;
  avgLatency?: number;
  successRate?: number;
  trends?: TrendData;
}

export interface TrendData {
  direction: 'up' | 'down' | 'stable';
  changePercent: number;
  confidence: 'high' | 'medium' | 'low';
}

// ============================================================================
// Trace Data Types
// ============================================================================

export interface TraceData {
  trace_id: string;
  operation: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  latency_ms: number;
  cost?: number;
  status: 'success' | 'failure';
  error_type?: string;
  retry_count?: number;
  retry_reason?: string;
  created_at: Date;
  metadata?: JsonValue;
}

export interface TraceSummaryData {
  totalTraces: number;
  successCount: number;
  failureCount: number;
  avgLatency: number;
  totalTokens: number;
  totalCost: number;
}

// ============================================================================
// Data Loader Interface
// ============================================================================

export interface DataLoader {
  /**
   * Load data based on selector
   */
  load(selector: DataSelector, userId: string): Promise<ExportData>;

  /**
   * Validate selector before loading
   */
  validate(selector: DataSelector): ValidationResult;

  /**
   * Estimate size of export (in bytes)
   */
  estimateSize(selector: DataSelector): Promise<number>;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

// ============================================================================
// Format Generator Interface
// ============================================================================

export interface FormatGenerator {
  /**
   * Generate export content in specified format
   */
  generate(data: ExportData, options?: ExportOptions): Promise<string | Buffer>;

  /**
   * Get file extension for this format
   */
  getExtension(): string;

  /**
   * Get MIME type for this format
   */
  getMimeType(): string;

  /**
   * Whether this formatter supports streaming
   */
  supportsStreaming(): boolean;
}

// ============================================================================
// Template System
// ============================================================================

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  audience: TemplateAudience;

  /**
   * Render the template with data
   */
  render(data: ExportData, options?: TemplateOptions): RenderedReport;

  /**
   * Get template sections
   */
  getSections(): TemplateSection[];
}

export interface TemplateSection {
  id: string;
  type: 'summary' | 'metrics' | 'chart' | 'table' | 'recommendations' | 'breakdown' | 'alert';
  title: string;
  dataSource: string;
  priority: number;
  format?: Record<string, unknown>;
}

export interface RenderedReport {
  metadata: ReportMetadata;
  summary: SummaryContent;
  sections: RenderedSection[];
  visualizations?: ChartContent[];
  recommendations?: RecommendationsContent;
}

export interface ReportMetadata {
  title: string;
  generatedAt: Date;
  dateRange?: { start: Date; end: Date };
  audience: TemplateAudience;
  version: string;
}

export interface RenderedSection {
  id: string;
  type: string;
  title: string;
  content: SectionContent;
}

export type SectionContent =
  | SummaryContent
  | MetricsContent
  | ChartContent
  | TableContent
  | RecommendationsContent
  | BreakdownContent
  | AlertContent;

export interface SummaryContent {
  headline: string;
  highlights: string[];
  concerns?: string[];
}

export interface MetricsContent {
  metrics: MetricItem[];
}

export interface MetricItem {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: number;
  status?: 'good' | 'warning' | 'critical';
}

export interface ChartContent {
  type: 'line' | 'bar' | 'pie' | 'area';
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  color?: string;
}

export interface TableContent {
  headers: string[];
  rows: (string | number)[][];
  footer?: (string | number)[];
}

export interface RecommendationsContent {
  recommendations: RecommendationItem[];
}

export interface RecommendationItem {
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  actions: string[];
}

export interface BreakdownContent {
  items: BreakdownItem[];
}

export interface BreakdownItem {
  label: string;
  value: number;
  percentage: number;
}

export interface AlertContent {
  level: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
}

// ============================================================================
// Storage Provider Interface
// ============================================================================

export interface StorageProvider {
  /**
   * Save export file
   */
  saveExport(
    userId: string,
    exportId: string,
    content: string | Buffer,
    format: ExportFormat
  ): Promise<{ filePath: string; fileSize: number }>;

  /**
   * Get export file
   */
  getExport(filePath: string): Promise<Buffer>;

  /**
   * Delete export file
   */
  deleteExport(filePath: string): Promise<void>;

  /**
   * Check if export exists
   */
  exportExists(filePath: string): Promise<boolean>;

  /**
   * Get storage type identifier
   */
  getStorageType(): StorageType;
}

// ============================================================================
// Configuration
// ============================================================================

export interface UnifiedExportConfig {
  // General
  enabled: boolean;
  defaultFormat: ExportFormat;
  defaultExpirationHours: number;

  // Limits
  maxConversationsPerExport: number;
  maxMessagesPerConversation: number;
  maxAnalyticsDataPoints: number;
  maxTracesPerExport: number;
  maxFileSizeMB: number;
  maxExportsPerUser: number;

  // Storage
  storagePath: string;
  storageType: StorageType;
  useSupabaseStorage: boolean;
  cleanupEnabled: boolean;

  // Features
  enableAsyncProcessing: boolean;
  asyncProcessingThresholdMB: number;
  enableCaching: boolean;
  cacheTTLMinutes: number;
}
