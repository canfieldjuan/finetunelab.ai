/**
 * Session Tag Generator
 * 
 * Generates unique session tags for conversations linked to tracked models.
 * Format: chat_model_{short_uuid}_{counter}
 * 
 * Features:
 * - Per-user, per-model counter isolation
 * - Automatic model verification against llm_models table
 * - Short UUID format (first 6 chars) for readability
 * - Zero-padded 3-digit counters
 * 
 * Date: 2025-12-19
 */

import { supabase, supabaseAdmin } from '@/lib/supabaseClient';
import crypto from 'crypto';

export interface SessionTag {
  session_id: string;
  experiment_name: string;
  counter: number;
  model_id: string;
  model_name: string;
}

/**
 * Generate a unique session tag for a conversation
 * 
 * @param userId - User ID who owns the conversation
 * @param modelId - Model ID from llm_models table (model_id field, not UUID id)
 * @returns SessionTag object or null if model not tracked
 */
export async function generateSessionTag(
  userId: string,
  modelId: string | null | undefined
): Promise<SessionTag | null> {
  if (!userId || !modelId) {
    return null;
  }

  try {
    // Check if input is UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(modelId);
    const normalizedModelId = modelId.trim();

    // Use service role client if available to bypass RLS, otherwise fall back to anon
    const client = supabaseAdmin || supabase;

    let query = client
      .from('llm_models')
      .select('id, model_id, name');

    if (isUuid) {
      query = query.eq('id', normalizedModelId);
    } else {
      query = query.eq('model_id', normalizedModelId);
    }

    const { data: model, error: modelError } = await query.single();
    if (modelError && modelError.code !== 'PGRST116') {
      console.warn('[Session Tag Generator] Error fetching model metadata:', modelError);
    }
    const fallbackId = crypto.createHash('sha256').update(`${userId}:${normalizedModelId}`).digest('hex');
    const shortUuidSource = model?.id || fallbackId;
    const shortUuid = shortUuidSource.replace(/-/g, '').slice(0, 6) || fallbackId.slice(0, 6);
    const resolvedModelId = model?.model_id || normalizedModelId;
    const resolvedModelName = model?.name || normalizedModelId;
    const modelIdOptions = Array.from(
      new Set(
        [normalizedModelId, model?.id, model?.model_id].filter(Boolean) as string[]
      )
    );

    const { data: conversations, error: counterError } = await client
      .from('conversations')
      .select('session_id')
      .eq('user_id', userId)
      .in('llm_model_id', modelIdOptions)
      .not('session_id', 'is', null)
      .like('session_id', `chat_model_${shortUuid}_%`);

    if (counterError) {
      console.error('[Session Tag Generator] Error fetching counter:', counterError);
      return null;
    }

    let maxCounter = 0;
    if (conversations && conversations.length > 0) {
      conversations.forEach((conv: { session_id: string }) => {
        const match = conv.session_id.match(/_(\d{3})$/);
        if (match) {
          const counter = parseInt(match[1], 10);
          if (counter > maxCounter) {
            maxCounter = counter;
          }
        }
      });
    }

    const nextCounter = maxCounter + 1;
    const paddedCounter = nextCounter.toString().padStart(3, '0');
    const sessionId = `chat_model_${shortUuid}_${paddedCounter}`;

    return {
      session_id: sessionId,
      experiment_name: resolvedModelName,
      counter: nextCounter,
      model_id: resolvedModelId,
      model_name: resolvedModelName
    };
  } catch (error) {
    console.error('[Session Tag Generator] Unexpected error:', error);
    return null;
  }
}
