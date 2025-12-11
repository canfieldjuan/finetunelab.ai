// Storage service for persistent search summaries
// Handles CRUD operations for search_summaries table in Supabase

import { supabase } from '@/lib/supabaseClient';
import type { SearchResultSummary, SavedSearchResult, ResearchJob } from './types';

export class SearchStorageService {
  /**
   * Save a summary for later use
   * Creates a new record in search_summaries table
   */
  async saveSummary(
    summary: SearchResultSummary,
    userId: string,
    conversationId?: string
  ): Promise<{ success: boolean; error?: string; id?: string }> {
    try {
      console.log('[SearchStorage] Saving summary:', {
        userId,
        conversationId,
        resultUrl: summary.resultUrl,
      });

      const { data, error } = await supabase
        .from('search_summaries')
        .insert({
          user_id: userId,
          conversation_id: conversationId || null,
          query: summary.query,
          result_url: summary.resultUrl,
          result_title: summary.resultTitle,
          original_snippet: summary.originalSnippet,
          summary: summary.summary,
          source: summary.source || null,
          published_at: summary.publishedAt || null,
          is_ingested: summary.isIngested,
          is_saved: true, // Always true when saving
        })
        .select('id')
        .single();

      if (error) {
        console.error('[SearchStorage] Save error:', error);
        return { success: false, error: error.message };
      }

      console.log('[SearchStorage] Saved successfully:', data.id);
      return { success: true, id: data.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SearchStorage] Save exception:', message);
      return { success: false, error: message };
    }
  }

  /**
   * Save multiple summaries in batch
   * More efficient than saving one at a time
   */
  async saveBatch(
    summaries: SearchResultSummary[],
    userId: string,
    conversationId?: string
  ): Promise<{ success: boolean; saved: number; failed: number; errors?: string[] }> {
    console.log('[SearchStorage] Batch saving:', {
      count: summaries.length,
      userId,
      conversationId,
    });

    const results = await Promise.all(
      summaries.map(summary => this.saveSummary(summary, userId, conversationId))
    );

    const succeeded = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log('[SearchStorage] Batch save complete:', {
      saved: succeeded.length,
      failed: failed.length,
    });

    return {
      success: failed.length === 0,
      saved: succeeded.length,
      failed: failed.length,
      errors: failed.map(f => f.error).filter(Boolean) as string[],
    };
  }

  /**
   * Mark summaries as ingested into LLM context
   * Updates the is_ingested flag for tracking
   */
  async markAsIngested(
    summaryIds: string[],
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[SearchStorage] Marking as ingested:', {
        count: summaryIds.length,
        userId,
      });

      const { error } = await supabase
        .from('search_summaries')
        .update({
          is_ingested: true,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .in('id', summaryIds);

      if (error) {
        console.error('[SearchStorage] Mark ingested error:', error);
        return { success: false, error: error.message };
      }

      console.log('[SearchStorage] Marked as ingested successfully');
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SearchStorage] Mark ingested exception:', message);
      return { success: false, error: message };
    }
  }

  /**
   * Retrieve saved summaries for a user
   * Optionally filter by conversation
   */
  async getSavedSummaries(
    userId: string,
    options?: {
      conversationId?: string;
      limit?: number;
      onlySaved?: boolean;
    }
  ): Promise<SavedSearchResult[]> {
    try {
      console.log('[SearchStorage] Retrieving summaries:', {
        userId,
        ...options,
      });

      let query = supabase
        .from('search_summaries')
        .select('*')
        .eq('user_id', userId);

      // Filter by conversation if specified
      if (options?.conversationId) {
        query = query.eq('conversation_id', options.conversationId);
      }

      // Filter by saved status if specified
      if (options?.onlySaved) {
        query = query.eq('is_saved', true);
      }

      // Apply limit
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      // Order by most recent first
      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('[SearchStorage] Retrieve error:', error);
        return [];
      }

      console.log('[SearchStorage] Retrieved summaries:', data?.length || 0);

      return (data || []).map(row => ({
        id: row.id,
        userId: row.user_id,
        conversationId: row.conversation_id,
        query: row.query,
        resultUrl: row.result_url,
        resultTitle: row.result_title,
        originalSnippet: row.original_snippet,
        summary: row.summary,
        source: row.source,
        publishedAt: row.published_at,
        isIngested: row.is_ingested,
        isSaved: row.is_saved,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      console.error('[SearchStorage] Retrieve exception:', error);
      return [];
    }
  }

  /**
   * Get recent summaries across all conversations
   * Useful for showing user's search history
   */
  async getRecentSummaries(
    userId: string,
    limit: number = 10
  ): Promise<SavedSearchResult[]> {
    return this.getSavedSummaries(userId, { limit, onlySaved: true });
  }

  /**
   * Delete saved summaries
   * Hard delete from database
   */
  async deleteSummaries(
    summaryIds: string[],
    userId: string
  ): Promise<{ success: boolean; deleted: number; error?: string }> {
    try {
      console.log('[SearchStorage] Deleting summaries:', {
        count: summaryIds.length,
        userId,
      });

      const { error, count } = await supabase
        .from('search_summaries')
        .delete()
        .eq('user_id', userId)
        .in('id', summaryIds);

      if (error) {
        console.error('[SearchStorage] Delete error:', error);
        return { success: false, deleted: 0, error: error.message };
      }

      console.log('[SearchStorage] Deleted successfully:', count);
      return { success: true, deleted: count || 0 };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SearchStorage] Delete exception:', message);
      return { success: false, deleted: 0, error: message };
    }
  }

  /**
   * Search saved summaries by query text
   * Case-insensitive search in query, title, and summary fields
   */
  async searchSummaries(
    userId: string,
    searchText: string,
    limit: number = 20
  ): Promise<SavedSearchResult[]> {
    try {
      console.log('[SearchStorage] Searching summaries:', {
        userId,
        searchText,
        limit,
      });

      // Use Postgres full-text search or ILIKE for simple text matching
      const { data, error } = await supabase
        .from('search_summaries')
        .select('*')
        .eq('user_id', userId)
        .or(
          `query.ilike.%${searchText}%,result_title.ilike.%${searchText}%,summary.ilike.%${searchText}%`
        )
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[SearchStorage] Search error:', error);
        return [];
      }

      console.log('[SearchStorage] Search results:', data?.length || 0);

      return (data || []).map(row => ({
        id: row.id,
        userId: row.user_id,
        conversationId: row.conversation_id,
        query: row.query,
        resultUrl: row.result_url,
        resultTitle: row.result_title,
        originalSnippet: row.original_snippet,
        summary: row.summary,
        source: row.source,
        publishedAt: row.published_at,
        isIngested: row.is_ingested,
        isSaved: row.is_saved,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      console.error('[SearchStorage] Search exception:', error);
      return [];
    }
  }

  /**
   * Get statistics for user's saved summaries
   * Returns count by ingested status
   */
  async getStats(
    userId: string
  ): Promise<{ total: number; ingested: number; saved: number }> {
    try {
      const { data, error } = await supabase
        .from('search_summaries')
        .select('is_ingested, is_saved')
        .eq('user_id', userId);

      if (error || !data) {
        console.error('[SearchStorage] Stats error:', error);
        return { total: 0, ingested: 0, saved: 0 };
      }

      const total = data.length;
      const ingested = data.filter(row => row.is_ingested).length;
      const saved = data.filter(row => row.is_saved).length;

      console.log('[SearchStorage] Stats:', { total, ingested, saved });

      return { total, ingested, saved };
    } catch (error) {
      console.error('[SearchStorage] Stats exception:', error);
      return { total: 0, ingested: 0, saved: 0 };
    }
  }

  /**
   * Create a new research job
   */
  async createResearchJob(job: ResearchJob): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[SearchStorage] Creating research job:', job.id);
      const { error } = await supabase
        .from('research_jobs')
        .insert({
          id: job.id,
          user_id: job.userId || null,
          query: job.query,
          status: job.status,
          steps: job.steps,
          collected_content: job.collectedContent,
          created_at: job.createdAt,
          updated_at: job.updatedAt,
        });

      if (error) {
        console.error('[SearchStorage] Create job error:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SearchStorage] Create job exception:', message);
      return { success: false, error: message };
    }
  }

  /**
   * Update an existing research job
   */
  async updateResearchJob(job: ResearchJob): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('research_jobs')
        .update({
          status: job.status,
          steps: job.steps,
          collected_content: job.collectedContent,
          report: job.report,
          error: job.error,
          updated_at: new Date().toISOString(),
          completed_at: job.completedAt,
        })
        .eq('id', job.id);

      if (error) {
        console.error('[SearchStorage] Update job error:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SearchStorage] Update job exception:', message);
      return { success: false, error: message };
    }
  }

  /**
   * Get a research job by ID
   */
  async getResearchJob(jobId: string): Promise<ResearchJob | null> {
    try {
      const { data, error } = await supabase
        .from('research_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error || !data) {
        if (error?.code !== 'PGRST116') { // Not found code
             console.error('[SearchStorage] Get job error:', error);
        }
        return null;
      }

      return {
        id: data.id,
        query: data.query,
        userId: data.user_id,
        status: data.status,
        steps: data.steps,
        collectedContent: data.collected_content,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        completedAt: data.completed_at,
        error: data.error,
        report: data.report,
      } as ResearchJob;
    } catch (error) {
      console.error('[SearchStorage] Get job exception:', error);
      return null;
    }
  }
}

// Export singleton instance
export const searchStorageService = new SearchStorageService();
