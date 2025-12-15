/**
 * Analytics Report Template Types
 * Defines structures for audience-specific report templates
 * Phase 2: Audience Templates
 * Date: December 15, 2025
 */

import type { AnalyticsDataset } from '../../types';

/**
 * Target audience for the report
 */
export type AudienceType = 'executive' | 'engineering' | 'onboarding' | 'custom';

/**
 * Section types available in reports
 */
export type SectionType =
  | 'summary'           // High-level overview
  | 'metrics'           // Key metrics display
  | 'chart'             // Visualization
  | 'table'             // Tabular data
  | 'recommendations'   // Action items
  | 'breakdown'         // Detailed breakdown
  | 'comparison'        // Before/after or model comparison
  | 'alert';            // Warnings/concerns

/**
 * Data sources that sections can pull from
 */
export type DataSource =
  | 'tokenUsage'
  | 'quality'
  | 'tools'
  | 'conversations'
  | 'errors'
  | 'latency'
  | 'aggregations'
  | 'trends';

/**
 * Formatting options for report sections
 */
export interface SectionFormatting {
  /** Show trend indicators (arrows, percentages) */
  showTrends: boolean;
  /** Show comparisons to previous period */
  showComparisons: boolean;
  /** Level of detail to include */
  detailLevel: 'high' | 'medium' | 'low';
  /** How to present the data */
  visualStyle: 'numbers' | 'charts' | 'both' | 'text';
  /** Maximum items to show in lists/tables */
  maxItems?: number;
  /** Whether to use technical terminology */
  technicalLanguage: boolean;
}

/**
 * Individual section definition
 */
export interface ReportSection {
  /** Unique section identifier */
  id: string;
  /** Section title displayed in report */
  title: string;
  /** Type of section */
  type: SectionType;
  /** Priority for ordering (lower = higher priority) */
  priority: number;
  /** Where to pull data from */
  dataSource: DataSource;
  /** Formatting options */
  formatting: SectionFormatting;
  /** Optional description/subtitle */
  description?: string;
  /** Whether this section is required or optional */
  required: boolean;
}

/**
 * Complete report template definition
 */
export interface ReportTemplate {
  /** Template identifier */
  id: AudienceType;
  /** Human-readable template name */
  name: string;
  /** Description of the template's purpose */
  description: string;
  /** Target audience description */
  targetAudience: string;
  /** Sections to include in the report */
  sections: ReportSection[];
  /** Maximum pages (for PDF generation) */
  maxPages?: number;
  /** Whether to include raw data tables */
  includeRawData: boolean;
  /** Whether to include chart visualizations */
  includeCharts: boolean;
  /** Whether to include AI-generated recommendations */
  includeRecommendations: boolean;
  /** Header text for the report */
  headerText?: string;
  /** Footer text for the report */
  footerText?: string;
}

/**
 * Rendered section content
 */
export interface RenderedSection {
  id: string;
  title: string;
  type: SectionType;
  content: SectionContent;
}

/**
 * Content types for rendered sections
 */
export type SectionContent =
  | SummaryContent
  | MetricsContent
  | ChartContent
  | TableContent
  | RecommendationsContent
  | BreakdownContent
  | AlertContent;

export interface SummaryContent {
  type: 'summary';
  headline: string;
  highlights: string[];
  concerns: string[];
}

export interface MetricsContent {
  type: 'metrics';
  metrics: {
    label: string;
    value: string | number;
    trend?: 'up' | 'down' | 'stable';
    changePercent?: number;
    status?: 'good' | 'warning' | 'critical';
  }[];
}

export interface ChartContent {
  type: 'chart';
  chartType: 'line' | 'bar' | 'pie' | 'donut';
  title: string;
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color?: string;
  }[];
}

export interface TableContent {
  type: 'table';
  headers: string[];
  rows: (string | number)[][];
  footer?: string;
}

export interface RecommendationsContent {
  type: 'recommendations';
  items: {
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    impact: string;
    actions?: string[];
  }[];
}

export interface BreakdownContent {
  type: 'breakdown';
  title: string;
  items: {
    label: string;
    value: number;
    percentage: number;
    subItems?: { label: string; value: number }[];
  }[];
}

export interface AlertContent {
  type: 'alert';
  level: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  timestamp?: string;
}

/**
 * Fully rendered report ready for output
 */
export interface RenderedReport {
  metadata: {
    templateId: AudienceType;
    templateName: string;
    generatedAt: string;
    userId: string;
    dateRange: {
      start: string;
      end: string;
    };
    filtersApplied?: Record<string, unknown>;
  };
  header?: string;
  sections: RenderedSection[];
  footer?: string;
}

/**
 * Template renderer function signature
 */
export type TemplateRenderer = (
  template: ReportTemplate,
  data: AnalyticsDataset
) => RenderedReport;
