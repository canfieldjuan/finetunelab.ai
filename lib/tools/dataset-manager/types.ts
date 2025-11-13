// Dataset Manager Tool - Type Definitions
// Date: October 13, 2025

export interface DatasetFilter {
  min_rating?: number;
  success_only?: boolean;
  date_from?: string;
  date_to?: string;
  conversation_ids?: string[];
}

export interface DatasetStats {
  total_conversations: number;
  total_messages: number;
  user_messages: number;
  assistant_messages: number;
  evaluated_messages: number;
  avg_rating: number | null;
  successful_interactions: number;
  failed_interactions: number;
  evaluation_coverage: number;
}

export interface DatasetItem {
  id: string;
  title: string;
  created_at: string;
  message_count: number;
  assistant_count: number;
  evaluation_count: number;
  avg_rating: number | null;
}

export interface DatasetExportRecord {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  token_count?: number | null;
  model?: string | null;
  temperature?: number | null;
  rating?: number | null;
  success?: boolean | null;
  failure_tags?: string[] | null;
  notes?: string | null;
}

export interface DatasetExport {
  format: 'jsonl' | 'json' | 'csv';
  total_records: number;
  data: DatasetExportRecord[];
  generated_at: string;
}

/**
 * Dataset export result with download URL
 * Used when export is generated via exportService (jsonl, json formats)
 */
export interface DatasetExportWithDownload {
  format: 'jsonl' | 'json';
  total_records: number;
  downloadUrl: string;
  exportId: string;
  fileSize: number;
  expiresAt?: Date;
  generated_at: string;
}

export interface ValidationResult {
  is_valid: boolean;
  total_messages: number;
  user_assistant_ratio: number;
  evaluation_coverage: number;
  rating_distribution: Record<number, number>;
  issues: string[];
  recommendations: string[];
}
