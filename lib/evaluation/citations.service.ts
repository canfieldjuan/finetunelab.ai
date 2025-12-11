// Citations Service
// Date: October 14, 2025
// Purpose: Extract citations from structured output and save to database
//
// This service handles:
// - Extracting citations from content_json
// - Saving citations to database
// - Linking citations to retriever logs
// - Managing citation correctness validation

import { supabase } from '@/lib/supabaseClient';

/**
 * Citation Insert Record
 * Used for database insertion
 */
export interface CitationInsert {
  message_id: string;
  document_id: string;
  span_start?: number;
  span_end?: number;
  quote?: string;
  correctness?: boolean;
  retriever_log_id?: string;
}

interface ContentJson {
  citations?: {
    doc_id: string;
    span_start?: number;
    span_end?: number;
    quote?: string;
  }[];
}

export interface CitationWithDocument extends CitationInsert {
  document: {
    id: string;
    filename: string;
    title: string;
    uri: string;
    created_at: string;
  };
}

/**
 * Citations Service Class
 * Handles all citation-related operations
 */
export class CitationsService {
  /**
   * Extract citations from structured output and save to database
   *
   * @param messageId - Message ID to link citations to
   * @param contentJson - Parsed structured output with citations array
   * @returns Number of citations saved
   */
  async saveCitations(
    messageId: string,
    contentJson: ContentJson
  ): Promise<number> {
    const citations = contentJson?.citations || [];

    if (citations.length === 0) {
      console.log('[Citations] No citations to save');
      return 0;
    }

    // Map to database records
    const citationRecords: CitationInsert[] = citations.map((c) => ({
      message_id: messageId,
      document_id: c.doc_id,
      span_start: c.span_start,
      span_end: c.span_end,
      quote: c.quote,
      correctness: undefined, // Will be validated by human or LLM judge
    }));

    // Insert into database
    const { error } = await supabase
      .from('citations')
      .insert(citationRecords)
      .select('id');

    if (error) {
      console.error('[Citations] Error saving citations:', error);
      throw error;
    }

    console.log(`[Citations] Saved ${citationRecords.length} citations for message ${messageId}`);
    return citationRecords.length;
  }

  /**
   * Link retriever log to all citations for a message
   *
   * @param messageId - Message ID
   * @param retrieverLogId - Retriever log ID to link
   */
  async linkRetrieverLog(
    messageId: string,
    retrieverLogId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('citations')
      .update({ retriever_log_id: retrieverLogId })
      .eq('message_id', messageId);

    if (error) {
      console.error('[Citations] Error linking retriever log:', error);
      throw error;
    }

    console.log(`[Citations] Linked retriever log ${retrieverLogId} to citations for message ${messageId}`);
  }

  /**
   * Update citation correctness
   * Called after human or LLM validation
   *
   * @param citationId - Citation ID
   * @param correctness - True if citation is correct, false otherwise
   */
  async updateCorrectness(
    citationId: string,
    correctness: boolean
  ): Promise<void> {
    const { error } = await supabase
      .from('citations')
      .update({ correctness })
      .eq('id', citationId);

    if (error) {
      console.error('[Citations] Error updating correctness:', error);
      throw error;
    }

    console.log(`[Citations] Updated correctness for citation ${citationId}: ${correctness}`);
  }

  /**
   * Batch update citation correctness
   * Useful for bulk validation from UI
   *
   * @param updates - Array of { citationId, correctness } objects
   */
  async batchUpdateCorrectness(
    updates: Array<{ citationId: string; correctness: boolean }>
  ): Promise<void> {
    const promises = updates.map(update =>
      this.updateCorrectness(update.citationId, update.correctness)
    );

    await Promise.all(promises);
    console.log(`[Citations] Batch updated ${updates.length} citation correctness values`);
  }

  /**
   * Get citations for a message
   *
   * @param messageId - Message ID
   * @returns Array of citations
   */
  async getCitations(messageId: string): Promise<CitationInsert[]> {
    const { data, error } = await supabase
      .from('citations')
      .select('*')
      .eq('message_id', messageId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Citations] Error fetching citations:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get citations with document details
   *
   * @param messageId - Message ID
   * @returns Array of citations with document data
   */
  async getCitationsWithDocuments(messageId: string): Promise<CitationWithDocument[]> {
    const { data, error } = await supabase
      .from('citations')
      .select(`
        *,
        document:documents (
          id,
          filename,
          title,
          uri,
          created_at
        )
      `)
      .eq('message_id', messageId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Citations] Error fetching citations with documents:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Calculate citation validity rate for a message
   *
   * @param messageId - Message ID
   * @returns Object with total, validated, correct, incorrect counts and validity rate
   */
  async getCitationStats(messageId: string): Promise<{
    total: number;
    validated: number;
    correct: number;
    incorrect: number;
    validityRate: number;
  }> {
    const citations = await this.getCitations(messageId);

    const total = citations.length;
    const validated = citations.filter(c => c.correctness !== null).length;
    const correct = citations.filter(c => c.correctness === true).length;
    const incorrect = citations.filter(c => c.correctness === false).length;
    const validityRate = validated > 0 ? correct / validated : 0;

    return {
      total,
      validated,
      correct,
      incorrect,
      validityRate
    };
  }
}

/**
 * Singleton instance for convenience
 */
export const citationsService = new CitationsService();

/**
 * Example usage:
 *
 * // 1. Save citations from structured output
 * const contentJson = {
 *   answer: 'According to company policy...',
 *   citations: [
 *     { doc_id: '123e4567-...', quote: 'Employees must...' },
 *     { doc_id: '987fcdeb-...', quote: 'PTO policy states...' }
 *   ]
 * };
 *
 * const count = await citationsService.saveCitations('msg-id-123', contentJson);
 * console.log(`Saved ${count} citations`);
 *
 * // 2. Link retriever log
 * await citationsService.linkRetrieverLog('msg-id-123', 'log-id-456');
 *
 * // 3. Update citation correctness (from human validation)
 * await citationsService.updateCorrectness('citation-id-789', true);
 *
 * // 4. Get citations with document details
 * const citations = await citationsService.getCitationsWithDocuments('msg-id-123');
 * citations.forEach(c => {
 *   console.log(`Citation: ${c.quote}`);
 *   console.log(`Document: ${c.document.filename}`);
 *   console.log(`Correct: ${c.correctness}`);
 * });
 *
 * // 5. Get citation statistics
 * const stats = await citationsService.getCitationStats('msg-id-123');
 * console.log(`Citation validity: ${(stats.validityRate * 100).toFixed(1)}%`);
 * console.log(`${stats.correct}/${stats.validated} citations correct`);
 */
