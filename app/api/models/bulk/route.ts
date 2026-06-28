// Bulk import discovered LLM models.
// POST /api/models/bulk - Create many discovered model rows using provider secrets.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { modelManager } from '@/lib/models/model-manager.service';
import type { AuthType, CreateModelDTO, LLMModel, ModelProvider } from '@/lib/models/llm-model.types';
import { cacheDeletePattern, generateCacheKey } from '@/lib/cache/redis-cache';

export const runtime = 'nodejs';

const CACHE_PREFIX = 'api:models';
const MAX_BULK_IMPORT_MODELS = 100;
const CREATE_CONCURRENCY = 10;

const DISCOVERY_SUPPORTED = new Set<ModelProvider>([
  'openai',
  'vllm',
  'ollama',
  'together',
  'groq',
  'openrouter',
  'fireworks',
  'runpod',
  'custom',
]);

const SERVED_MODEL_NAME_PROVIDERS = new Set<ModelProvider>(['vllm', 'ollama']);
const AUTH_TYPES = new Set<AuthType>(['bearer', 'api_key', 'custom_header', 'none']);

type BulkModelInput = {
  model_id?: unknown;
  name?: unknown;
  served_model_name?: unknown;
  context_length?: unknown;
  max_model_len?: unknown;
};

type BulkModelSummary = {
  id: string;
  name: string;
  model_id: string;
  provider: ModelProvider;
  served_model_name: string | null;
};

function asTrimmedString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asPositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : undefined;
}

function toCreatedSummary(model: LLMModel): BulkModelSummary {
  return {
    id: model.id,
    name: model.name,
    model_id: model.model_id,
    provider: model.provider,
    served_model_name: model.served_model_name,
  };
}

function buildBulkDto({
  body,
  model,
  provider,
  baseUrl,
  authType,
}: {
  body: Record<string, unknown>;
  model: BulkModelInput;
  provider: ModelProvider;
  baseUrl: string;
  authType: AuthType;
}): CreateModelDTO | null {
  const modelId = asTrimmedString(model.model_id);
  if (!modelId) return null;

  const explicitServedName = asTrimmedString(model.served_model_name);
  const servedModelName = explicitServedName ?? (SERVED_MODEL_NAME_PROVIDERS.has(provider) ? modelId : undefined);

  return {
    name: asTrimmedString(model.name) ?? modelId,
    description: asTrimmedString(body.description),
    provider,
    base_url: baseUrl,
    model_id: modelId,
    served_model_name: servedModelName,
    auth_type: authType,
    auth_headers: {},
    supports_streaming: typeof body.supports_streaming === 'boolean' ? body.supports_streaming : true,
    supports_functions: typeof body.supports_functions === 'boolean' ? body.supports_functions : false,
    supports_vision: typeof body.supports_vision === 'boolean' ? body.supports_vision : false,
    context_length:
      asPositiveInteger(model.context_length) ??
      asPositiveInteger(model.max_model_len) ??
      asPositiveInteger(body.context_length) ??
      4096,
    max_output_tokens:
      asPositiveInteger(body.max_output_tokens) ??
      parseInt(process.env.MODELS_DEFAULT_MAX_OUTPUT_TOKENS || '2000', 10),
    default_temperature:
      typeof body.default_temperature === 'number'
        ? body.default_temperature
        : parseFloat(process.env.MODELS_DEFAULT_TEMPERATURE || '0.7'),
    default_top_p:
      typeof body.default_top_p === 'number'
        ? body.default_top_p
        : parseFloat(process.env.MODELS_DEFAULT_TOP_P || '1.0'),
    enabled: true,
    is_default: false,
  };
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as Record<string, unknown>;
    const provider = asTrimmedString(body.provider) as ModelProvider | undefined;
    const baseUrl = asTrimmedString(body.base_url);
    const authType = asTrimmedString(body.auth_type) as AuthType | undefined;
    const models = Array.isArray(body.models) ? body.models as BulkModelInput[] : [];

    if (!provider || !baseUrl || !authType || models.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          required: ['provider', 'base_url', 'auth_type', 'models'],
        },
        { status: 400 }
      );
    }

    if (!DISCOVERY_SUPPORTED.has(provider)) {
      return NextResponse.json(
        {
          success: false,
          unsupported: true,
          error: 'unsupported_provider',
          message: `Bulk discovery import isn't available for "${provider}".`,
        },
        { status: 400 }
      );
    }

    if (!AUTH_TYPES.has(authType)) {
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_auth_type',
          message: `Unsupported auth_type "${authType}".`,
        },
        { status: 400 }
      );
    }

    if (models.length > MAX_BULK_IMPORT_MODELS) {
      return NextResponse.json(
        {
          success: false,
          error: 'too_many_models',
          message: `Import at most ${MAX_BULK_IMPORT_MODELS} models per request.`,
          max_models: MAX_BULK_IMPORT_MODELS,
        },
        { status: 400 }
      );
    }

    const created: BulkModelSummary[] = [];
    const skipped: Array<{ model_id: string; reason: string }> = [];
    const failed: Array<{ model_id: string; error: string }> = [];
    const seenModelIds = new Set<string>();
    const seenNames = new Set<string>();
    const createCandidates: CreateModelDTO[] = [];

    for (const model of models) {
      const dto = buildBulkDto({ body, model, provider, baseUrl, authType });
      if (!dto) {
        failed.push({ model_id: '<missing>', error: 'Model ID is required.' });
        continue;
      }

      if (seenModelIds.has(dto.model_id) || seenNames.has(dto.name)) {
        skipped.push({ model_id: dto.model_id, reason: 'duplicate_in_request' });
        continue;
      }
      seenModelIds.add(dto.model_id);
      seenNames.add(dto.name);
      createCandidates.push(dto);
    }

    for (let i = 0; i < createCandidates.length; i += CREATE_CONCURRENCY) {
      const batch = createCandidates.slice(i, i + CREATE_CONCURRENCY);
      const results = await Promise.all(batch.map(async (dto) => {
        try {
          const createdModel = await modelManager.createModel(dto, user.id, supabase);
          return { type: 'created' as const, model: createdModel };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { type: 'error' as const, dto, message };
        }
      }));

      for (const result of results) {
        if (result.type === 'created') {
          created.push(toCreatedSummary(result.model));
        } else if (result.message === 'DUPLICATE_MODEL_NAME') {
          skipped.push({ model_id: result.dto.model_id, reason: 'already_exists' });
        } else {
          failed.push({ model_id: result.dto.model_id, error: result.message });
        }
      }
    }

    if (created.length > 0) {
      await cacheDeletePattern(generateCacheKey(CACHE_PREFIX, user.id));
    }

    return NextResponse.json(
      {
        success: failed.length === 0,
        created,
        skipped,
        failed,
        counts: {
          created: created.length,
          skipped: skipped.length,
          failed: failed.length,
        },
      },
      { status: failed.length > 0 ? 207 : 200 }
    );
  } catch (error) {
    console.error('[ModelsBulkAPI] POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to bulk import models',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
