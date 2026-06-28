import { execFileSync } from 'child_process';
import { basename, join } from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20251202000000_create_model_serving_tables.sql'
);

const defaultModelSettingsMigrationPath = join(
  process.cwd(),
  'supabase/migrations/20251203_add_default_model_to_user_settings.sql'
);

const requiredLlmModelColumns = [
  'name',
  'provider',
  'base_url',
  'model_id',
  'auth_type',
  'auth_headers',
  'supports_streaming',
  'supports_functions',
  'supports_vision',
  'context_length',
  'max_output_tokens',
  'default_temperature',
  'default_top_p',
  'enabled',
  'is_global',
  'is_default',
  'created_at',
  'updated_at',
];

const requiredServerColumns = [
  'server_type',
  'name',
  'base_url',
  'port',
  'model_path',
  'model_name',
  'status',
  'config_json',
  'started_at',
  'created_at',
  'updated_at',
];

function commandExists(command: string): boolean {
  try {
    execFileSync('which', [command], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function runPsql(databaseUrl: string, sqlArgs: string[]): string {
  return execFileSync(
    'psql',
    [
      databaseUrl,
      '-v',
      'ON_ERROR_STOP=1',
      '-X',
      '-q',
      '-A',
      '-t',
      ...sqlArgs,
    ],
    { encoding: 'utf8' }
  ).trim();
}

function queryRows(databaseUrl: string, query: string): string[][] {
  const output = runPsql(databaseUrl, ['-F', '\t', '-c', query]);
  return output
    ? output.split('\n').map((line) => line.split('\t'))
    : [];
}

function startPostgresContainer(): { containerId: string; databaseUrl: string } {
  const containerId = execFileSync(
    'docker',
    [
      'run',
      '--rm',
      '-d',
      '-e',
      'POSTGRES_PASSWORD=postgres',
      '-e',
      'POSTGRES_DB=postgres',
      '-p',
      '127.0.0.1::5432',
      'postgres:16-alpine',
    ],
    { encoding: 'utf8' }
  ).trim();

  const portOutput = execFileSync('docker', ['port', containerId, '5432/tcp'], {
    encoding: 'utf8',
  }).trim();
  const port = portOutput.split(':').pop();
  if (!port) {
    throw new Error(`Could not determine mapped Postgres port: ${portOutput}`);
  }

  return {
    containerId,
    databaseUrl: `postgres://postgres:postgres@127.0.0.1:${port}/postgres`,
  };
}

function waitForPostgres(databaseUrl: string): void {
  const startedAt = Date.now();
  let lastError = '';

  while (Date.now() - startedAt < 60_000) {
    try {
      runPsql(databaseUrl, ['-c', 'select 1;']);
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    }
  }

  throw new Error(`Postgres did not become ready: ${lastError}`);
}

describe('model serving schema migration', () => {
  let databaseUrl = process.env.MODEL_SCHEMA_TEST_DATABASE_URL || '';
  let containerId: string | null = null;

  beforeAll(() => {
    if (!commandExists('psql')) {
      throw new Error('psql is required for model-serving schema tests');
    }

    if (!databaseUrl) {
      if (!commandExists('docker')) {
        throw new Error(
          'Set MODEL_SCHEMA_TEST_DATABASE_URL or install Docker for model-serving schema tests'
        );
      }

      const container = startPostgresContainer();
      containerId = container.containerId;
      databaseUrl = container.databaseUrl;
    }

    waitForPostgres(databaseUrl);

    runPsql(databaseUrl, [
      '-c',
      `
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS public.user_settings (user_id uuid PRIMARY KEY);
      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS uuid
      LANGUAGE sql
      STABLE
      AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      `,
    ]);

    runPsql(databaseUrl, ['-f', migrationPath]);
    runPsql(databaseUrl, ['-f', migrationPath]);
    runPsql(databaseUrl, ['-f', defaultModelSettingsMigrationPath]);
  }, 120_000);

  afterAll(() => {
    if (containerId) {
      execFileSync('docker', ['stop', containerId], { stdio: 'ignore' });
    }
  });

  it('applies the llm_models schema contract to a real Postgres database', () => {
    const columns = queryRows(
      databaseUrl,
      `
      SELECT column_name, is_nullable, COALESCE(column_default, '')
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'llm_models'
       ORDER BY column_name;
      `
    );
    const columnMap = new Map(columns.map(([name, nullable, defaultValue]) => [
      name,
      { nullable, defaultValue },
    ]));

    expect(columnMap.get('served_model_name')).toBeDefined();
    expect(columnMap.get('training_method')).toBeDefined();
    expect(columnMap.get('metadata')).toBeDefined();

    for (const column of requiredLlmModelColumns) {
      expect(columnMap.get(column)?.nullable).toBe('NO');
    }

    expect(columnMap.get('auth_type')?.defaultValue).toContain("'bearer'");
    expect(columnMap.get('auth_headers')?.defaultValue).toContain("'{}'");
    expect(columnMap.get('enabled')?.defaultValue).toBe('true');
    expect(columnMap.get('is_default')?.defaultValue).toBe('false');

    const constraints = queryRows(
      databaseUrl,
      `
      SELECT conname, contype
        FROM pg_constraint
       WHERE conrelid = 'public.llm_models'::regclass
       ORDER BY conname;
      `
    );
    expect(constraints).toContainEqual(['llm_models_pkey', 'p']);
    expect(constraints).toContainEqual(['llm_models_user_id_name_key', 'u']);

    const indexes = queryRows(
      databaseUrl,
      `
      SELECT indexname, indexdef
        FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename = 'llm_models'
       ORDER BY indexname;
      `
    );
    expect(indexes).toEqual(expect.arrayContaining([
      [
        'idx_llm_models_one_default_per_user',
        expect.stringContaining('CREATE UNIQUE INDEX'),
      ],
      [
        'idx_llm_models_one_global_default',
        expect.stringContaining('CREATE UNIQUE INDEX'),
      ],
    ]));
  });

  it('applies the local_inference_servers schema contract to a real Postgres database', () => {
    const columns = queryRows(
      databaseUrl,
      `
      SELECT column_name, is_nullable, COALESCE(column_default, '')
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'local_inference_servers'
       ORDER BY column_name;
      `
    );
    const columnMap = new Map(columns.map(([name, nullable, defaultValue]) => [
      name,
      { nullable, defaultValue },
    ]));

    expect(columnMap.get('process_id')).toBeDefined();
    expect(columnMap.get('last_health_check')).toBeDefined();
    expect(columnMap.get('error_message')).toBeDefined();

    for (const column of requiredServerColumns) {
      expect(columnMap.get(column)?.nullable).toBe('NO');
    }

    expect(columnMap.get('status')?.defaultValue).toContain("'starting'");
    expect(columnMap.get('config_json')?.defaultValue).toContain("'{}'");
  });

  it('orders the table contract before dependent migrations', () => {
    expect([
      basename(migrationPath),
      basename(defaultModelSettingsMigrationPath),
    ].sort()).toEqual([
      basename(migrationPath),
      basename(defaultModelSettingsMigrationPath),
    ]);

    const defaultModelColumn = queryRows(
      databaseUrl,
      `
      SELECT column_name
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'user_settings'
         AND column_name = 'default_model_id';
      `
    );
    expect(defaultModelColumn).toContainEqual(['default_model_id']);
  });

  it('installs RLS policies without exposing credentialed global rows', () => {
    const policies = queryRows(
      databaseUrl,
      `
      SELECT policyname, cmd, COALESCE(qual, ''), COALESCE(with_check, '')
        FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename = 'llm_models'
       ORDER BY policyname;
      `
    );
    const policyMap = new Map(policies.map(([name, cmd, qual, withCheck]) => [
      name,
      { cmd, qual, withCheck },
    ]));

    const selectPolicy = policyMap.get('llm_models_select_own_or_global');
    expect(selectPolicy?.cmd).toBe('SELECT');
    expect(selectPolicy?.qual).toContain('api_key_encrypted IS NULL');
    expect(selectPolicy?.qual).toContain("auth_headers = '{}'::jsonb");

    const insertPolicy = policyMap.get('llm_models_insert_own');
    expect(insertPolicy?.cmd).toBe('INSERT');
    expect(insertPolicy?.withCheck).toContain('(is_global = false)');

    const updatePolicy = policyMap.get('llm_models_update_own');
    expect(updatePolicy?.cmd).toBe('UPDATE');
    expect(updatePolicy?.withCheck).toContain('(is_global = false)');
  });
});
