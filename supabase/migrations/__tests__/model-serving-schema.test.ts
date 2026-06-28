import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20260628000000_create_model_serving_tables.sql'
);

describe('model serving schema migration', () => {
  const migration = readFileSync(migrationPath, 'utf8');

  it('versions the llm_models runtime contract', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.llm_models');
    expect(migration).toContain('served_model_name TEXT');
    expect(migration).toContain('is_default BOOLEAN');
    expect(migration).toContain('training_method TEXT');
    expect(migration).toContain('metadata JSONB');
    expect(migration).toContain('ensure_single_default_llm_model');
  });

  it('versions the local inference server runtime contract', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.local_inference_servers');
    expect(migration).toContain('server_type TEXT');
    expect(migration).toContain('process_id INTEGER');
    expect(migration).toContain('config_json JSONB');
    expect(migration).toContain('last_health_check TIMESTAMPTZ');
  });
});
