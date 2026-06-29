/**
 * Persistence for async image-generation jobs (`image_jobs` table).
 *
 * Uses the service-role `supabaseAdmin` client (bypasses RLS) so the background
 * runner can write job updates after the originating request has closed —
 * exactly how the deep-research storage service works. Reads back by the owner
 * happen through RLS elsewhere (the SSE/status path in slice 3iii).
 */

import { supabaseAdmin } from '@/lib/supabaseClient';
import type { ImageAttribution, ImageGenOptions, ImageJob, ImageSource } from './types';

const TABLE = 'image_jobs';

interface ImageJobRow {
  id: string;
  user_id: string;
  prompt: string;
  status: string;
  options: ImageGenOptions | null;
  result_url: string | null;
  result_path: string | null;
  source: string | null;
  attribution: ImageAttribution | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

class ImageJobStore {
  private getClient() {
    if (!supabaseAdmin) {
      throw new Error('[ImageJob] supabaseAdmin not configured - missing SUPABASE_SERVICE_ROLE_KEY');
    }
    return supabaseAdmin;
  }

  async create(job: ImageJob): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.getClient()
        .from(TABLE)
        .insert({
          id: job.id,
          user_id: job.userId,
          prompt: job.prompt,
          status: job.status,
          options: job.options ?? null,
          created_at: job.createdAt,
          updated_at: job.updatedAt,
        });
      if (error) {
        console.error('[ImageJob] create error:', error);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ImageJob] create exception:', message);
      return { success: false, error: message };
    }
  }

  async update(job: ImageJob): Promise<{ success: boolean; error?: string }> {
    try {
      // Owner-scoped even under the service role (RLS is bypassed here), so the
      // owner check is the default and never depends on the id being unguessable.
      const { error } = await this.getClient()
        .from(TABLE)
        .update({
          status: job.status,
          result_url: job.resultUrl ?? null,
          result_path: job.resultPath ?? null,
          source: job.source ?? null,
          attribution: job.attribution ?? null,
          error: job.error ?? null,
          updated_at: new Date().toISOString(),
          completed_at: job.completedAt ?? null,
        })
        .eq('id', job.id)
        .eq('user_id', job.userId);
      if (error) {
        console.error('[ImageJob] update error:', error);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ImageJob] update exception:', message);
      return { success: false, error: message };
    }
  }

  async get(jobId: string, userId: string): Promise<ImageJob | null> {
    try {
      // Owner-scoped by construction (the service role bypasses RLS), so a
      // client-supplied job id can never read another user's job.
      const { data, error } = await this.getClient()
        .from(TABLE)
        .select('*')
        .eq('id', jobId)
        .eq('user_id', userId)
        .single();
      if (error || !data) {
        if (error?.code !== 'PGRST116') {
          console.error('[ImageJob] get error:', error);
        }
        return null;
      }
      const row = data as ImageJobRow;
      return {
        id: row.id,
        userId: row.user_id,
        prompt: row.prompt,
        status: row.status as ImageJob['status'],
        options: row.options ?? undefined,
        resultUrl: row.result_url ?? undefined,
        resultPath: row.result_path ?? undefined,
        source: (row.source as ImageSource | null) ?? undefined,
        attribution: row.attribution ?? undefined,
        error: row.error ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at ?? undefined,
      };
    } catch (err) {
      console.error('[ImageJob] get exception:', err);
      return null;
    }
  }
}

export const imageJobStore = new ImageJobStore();
