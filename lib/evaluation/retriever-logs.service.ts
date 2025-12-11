// Retriever Logs Service
// Date: October 14, 2025
// Purpose: Log retrieval operations for audit trail and analysis
//
// This service handles:
// - Logging all GraphRAG retrieval operations
// - Tracking latency, topk, scores
// - Linking to citations
// - Analyzing retrieval quality over time

import { supabase } from '@/lib/supabaseClient';

/**
 * Retriever Log Insert Record
 * Used for database insertion
 */
export interface RetrieverLogInsert {
  conversation_id: string;
  user_id: string;
  query: string;
  topk: number;
  retrieved_doc_ids: string[];
  scores?: number[];
  latency_ms: number;
}

/**
 * Retriever Logs Service Class
 * Handles all retriever log operations
 */
export class RetrieverLogsService {
  /**
   * Save retriever log to database
   *
   * @param log - Retriever log data
   * @returns Retriever log ID (for linking to citations)
   */
  async saveRetrieverLog(log: RetrieverLogInsert): Promise<string | null> {
    const { data, error } = await supabase
      .from('retriever_logs')
      .insert(log)
      .select('id')
      .single();

    if (error) {
      console.error('[RetrieverLogs] Error saving log:', error);
      return null;
    }

    console.log(`[RetrieverLogs] Saved log ${data.id} for query: ${log.query.slice(0, 50)}...`);
    return data.id;
  }

  /**
   * Get retriever logs for a conversation
   *
   * @param conversationId - Conversation ID
   * @returns Array of retriever logs
   */
  async getLogsForConversation(conversationId: string): Promise<RetrieverLogInsert[]> {
    const { data, error } = await supabase
      .from('retriever_logs')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[RetrieverLogs] Error fetching logs:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get retriever logs for a user
   *
   * @param userId - User ID
   * @param limit - Max number of logs to return (default: 100)
   * @returns Array of retriever logs
   */
  async getLogsForUser(userId: string, limit: number = 100): Promise<RetrieverLogInsert[]> {
    const { data, error } = await supabase
      .from('retriever_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[RetrieverLogs] Error fetching logs:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Calculate retrieval quality metrics for a user
   *
   * @param userId - User ID
   * @param days - Number of days to analyze (default: 7)
   * @returns Metrics object with avg latency, avg topk, total queries
   */
  async getRetrievalMetrics(userId: string, days: number = 7): Promise<{
    totalQueries: number;
    avgLatency: number;
    avgTopK: number;
    avgScore: number;
    uniqueDocuments: number;
  }> {
    // Get logs from last N days
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('retriever_logs')
      .select('latency_ms, topk, scores, retrieved_doc_ids')
      .eq('user_id', userId)
      .gte('created_at', since.toISOString());

    if (error) {
      console.error('[RetrieverLogs] Error fetching metrics:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return {
        totalQueries: 0,
        avgLatency: 0,
        avgTopK: 0,
        avgScore: 0,
        uniqueDocuments: 0
      };
    }

    // Calculate metrics
    const totalQueries = data.length;
    const avgLatency = data.reduce((sum, log) => sum + (log.latency_ms || 0), 0) / totalQueries;
    const avgTopK = data.reduce((sum, log) => sum + (log.topk || 0), 0) / totalQueries;

    // Calculate average score
    let totalScores = 0;
    let scoreCount = 0;
    data.forEach(log => {
      if (log.scores && Array.isArray(log.scores)) {
        totalScores += log.scores.reduce((sum: number, score: number) => sum + score, 0);
        scoreCount += log.scores.length;
      }
    });
    const avgScore = scoreCount > 0 ? totalScores / scoreCount : 0;

    // Count unique documents
    const allDocIds = new Set<string>();
    data.forEach(log => {
      if (log.retrieved_doc_ids && Array.isArray(log.retrieved_doc_ids)) {
        log.retrieved_doc_ids.forEach((id: string) => allDocIds.add(id));
      }
    });
    const uniqueDocuments = allDocIds.size;

    return {
      totalQueries,
      avgLatency,
      avgTopK,
      avgScore,
      uniqueDocuments
    };
  }

  /**
   * Get most frequently retrieved documents
   *
   * @param userId - User ID
   * @param days - Number of days to analyze (default: 30)
   * @param limit - Max number of documents to return (default: 10)
   * @returns Array of { documentId, count } objects
   */
  async getMostRetrievedDocuments(
    userId: string,
    days: number = 30,
    limit: number = 10
  ): Promise<Array<{ documentId: string; count: number }>> {
    // Get logs from last N days
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('retriever_logs')
      .select('retrieved_doc_ids')
      .eq('user_id', userId)
      .gte('created_at', since.toISOString());

    if (error) {
      console.error('[RetrieverLogs] Error fetching document frequency:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Count document occurrences
    const docCounts = new Map<string, number>();
    data.forEach(log => {
      if (log.retrieved_doc_ids && Array.isArray(log.retrieved_doc_ids)) {
        log.retrieved_doc_ids.forEach((id: string) => {
          docCounts.set(id, (docCounts.get(id) || 0) + 1);
        });
      }
    });

    // Sort by count and return top N
    return Array.from(docCounts.entries())
      .map(([documentId, count]) => ({ documentId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get retrieval latency percentiles
   *
   * @param userId - User ID
   * @param days - Number of days to analyze (default: 7)
   * @returns Object with p50, p95, p99 latency values
   */
  async getLatencyPercentiles(userId: string, days: number = 7): Promise<{
    p50: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('retriever_logs')
      .select('latency_ms')
      .eq('user_id', userId)
      .gte('created_at', since.toISOString())
      .order('latency_ms', { ascending: true });

    if (error) {
      console.error('[RetrieverLogs] Error fetching latency:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return { p50: 0, p95: 0, p99: 0, min: 0, max: 0 };
    }

    const latencies = data.map(log => log.latency_ms || 0);
    const p50Index = Math.floor(latencies.length * 0.5);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p99Index = Math.floor(latencies.length * 0.99);

    return {
      p50: latencies[p50Index] || 0,
      p95: latencies[p95Index] || 0,
      p99: latencies[p99Index] || 0,
      min: latencies[0] || 0,
      max: latencies[latencies.length - 1] || 0
    };
  }
}

/**
 * Singleton instance for convenience
 */
export const retrieverLogsService = new RetrieverLogsService();

/**
 * Example usage:
 *
 * // 1. Log a retrieval operation
 * const logId = await retrieverLogsService.saveRetrieverLog({
 *   conversation_id: 'conv-id-123',
 *   user_id: 'user-id-123',
 *   query: 'What is the PTO policy?',
 *   topk: 5,
 *   retrieved_doc_ids: ['doc-id-1', 'doc-id-2', 'doc-id-3'],
 *   scores: [0.95, 0.87, 0.76],
 *   latency_ms: 245
 * });
 *
 * // 2. Get retrieval metrics
 * const metrics = await retrieverLogsService.getRetrievalMetrics('user-id-123', 7);
 * console.log(`Avg latency: ${metrics.avgLatency.toFixed(0)}ms`);
 * console.log(`Avg topK: ${metrics.avgTopK.toFixed(1)}`);
 * console.log(`Avg score: ${metrics.avgScore.toFixed(3)}`);
 *
 * // 3. Get most retrieved documents
 * const topDocs = await retrieverLogsService.getMostRetrievedDocuments('user-id-123', 30, 10);
 * console.log('Most retrieved documents:');
 * topDocs.forEach(({ documentId, count }) => {
 *   console.log(`  ${documentId}: ${count} times`);
 * });
 *
 * // 4. Get latency percentiles
 * const latency = await retrieverLogsService.getLatencyPercentiles('user-id-123', 7);
 * console.log(`Latency - p50: ${latency.p50}ms, p95: ${latency.p95}ms, p99: ${latency.p99}ms`);
 */
