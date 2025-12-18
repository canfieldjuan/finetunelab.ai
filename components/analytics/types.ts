// Analytics Export Component Types
// Date: October 25, 2025

export type ExportFormat = 'csv' | 'json' | 'report' | 'pdf' | 'html';

export type ExportType =
  | 'overview'
  | 'timeseries'
  | 'complete'
  | 'model_comparison'
  | 'tool_usage'
  | 'quality_trends';

export type AudienceType = 'executive' | 'engineering' | 'onboarding' | 'custom';

export interface ExportRecord {
  id: string;
  user_id: string;
  format: ExportFormat;
  export_type: ExportType;
  file_name: string;
  file_size: number;
  file_path: string;
  start_date: string;
  end_date: string;
  included_metrics: string[];
  created_at: string;
  expires_at: string;
  download_count: number;
  last_downloaded_at: string | null;
}

export interface ExportCreationRequest {
  format: ExportFormat;
  exportType: ExportType;
  startDate: string;
  endDate: string;
  includedMetrics?: string[];
  audience?: AudienceType;
}

export interface ExportCreationResponse {
  success: true;
  exportId: string;
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  expiresAt: string;
}

export interface ExportErrorResponse {
  error: string;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export const EXPORT_TYPE_LABELS: Record<ExportType, string> = {
  overview: 'Overview Summary',
  timeseries: 'Time Series Data',
  complete: 'Complete Dataset',
  model_comparison: 'Model Comparison',
  tool_usage: 'Tool Usage Analytics',
  quality_trends: 'Quality Trends',
};

export const EXPORT_TYPE_DESCRIPTIONS: Record<ExportType, string> = {
  overview: 'High-level metrics and key performance indicators',
  timeseries: 'Time-bucketed data for trend analysis',
  complete: 'All available analytics data in detail',
  model_comparison: 'Side-by-side model performance comparison',
  tool_usage: 'Tool execution statistics and patterns',
  quality_trends: 'Quality ratings and success rates over time',
};

export const FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: 'CSV (Spreadsheet)',
  json: 'JSON (Structured Data)',
  report: 'Report (PDF/HTML)',
  pdf: 'PDF Report',
  html: 'HTML Report',
};

export const FORMAT_DESCRIPTIONS: Record<ExportFormat, string> = {
  csv: 'Best for Excel, Google Sheets, and data analysis tools',
  json: 'Best for programmatic processing and API integration',
  report: 'Best for presentations and executive summaries',
  pdf: 'Printable report with audience-specific templates',
  html: 'Web-viewable report with audience-specific templates',
};

export const AUDIENCE_LABELS: Record<AudienceType, string> = {
  executive: 'Executive Summary',
  engineering: 'Engineering Report',
  onboarding: 'Onboarding Guide',
  custom: 'Custom Report',
};

export const AUDIENCE_DESCRIPTIONS: Record<AudienceType, string> = {
  executive: 'High-level metrics for leadership (1 page)',
  engineering: 'Detailed technical metrics for debugging',
  onboarding: 'System overview for new team members',
  custom: 'Select specific sections to include',
};
