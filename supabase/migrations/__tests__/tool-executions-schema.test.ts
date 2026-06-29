import { execFileSync } from 'child_process';
import { join } from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20260629223000_create_tool_executions.sql',
);

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
    { encoding: 'utf8' },
  ).trim();
}

function queryRows(databaseUrl: string, query: string): string[][] {
  const output = runPsql(databaseUrl, ['-F', '\t', '-c', query]);
  return output ? output.split('\n').map((line) => line.split('\t')) : [];
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
    { encoding: 'utf8' },
  ).trim();

  const portOutput = execFileSync('docker', ['port', containerId, '5432/tcp'], {
    encoding: 'utf8',
  }).trim();
  const port = portOutput.split(':').pop();
  if (!port) throw new Error(`Could not determine mapped Postgres port: ${portOutput}`);

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

describe('tool_executions schema migration', () => {
  let databaseUrl = process.env.TOOL_EXECUTIONS_SCHEMA_TEST_DATABASE_URL || '';
  let containerId: string | null = null;

  beforeAll(() => {
    if (!commandExists('psql')) {
      throw new Error('psql is required for tool_executions schema tests');
    }

    if (!databaseUrl) {
      if (!commandExists('docker')) {
        throw new Error(
          'Set TOOL_EXECUTIONS_SCHEMA_TEST_DATABASE_URL or install Docker for tool_executions schema tests',
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
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY);
      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS uuid
      LANGUAGE sql
      STABLE
      AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

      CREATE TABLE IF NOT EXISTS public.conversations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS public.messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS public.tools (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL
      );
      `,
    ]);

    runPsql(databaseUrl, ['-f', migrationPath]);
    runPsql(databaseUrl, ['-f', migrationPath]);
  }, 120_000);

  afterAll(() => {
    if (containerId) {
      execFileSync('docker', ['stop', containerId], { stdio: 'ignore' });
    }
  });

  it('creates a nullable-tool-id telemetry contract for MCP rows', () => {
    const columns = queryRows(
      databaseUrl,
      `
      SELECT column_name, is_nullable, COALESCE(column_default, '')
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'tool_executions'
       ORDER BY column_name;
      `,
    );
    const columnMap = new Map(columns.map(([name, nullable, defaultValue]) => [
      name,
      { nullable, defaultValue },
    ]));

    expect(columnMap.get('tool_id')?.nullable).toBe('YES');
    expect(columnMap.get('tool_source')?.nullable).toBe('NO');
    expect(columnMap.get('tool_source')?.defaultValue).toContain("'portal'");
    expect(columnMap.get('metadata')?.nullable).toBe('NO');
    expect(columnMap.get('metadata')?.defaultValue).toContain("'{}'");
    expect(columnMap.get('execution_time_ms')?.nullable).toBe('NO');

    runPsql(databaseUrl, [
      '-c',
      `
      INSERT INTO public.tool_executions (
        tool_id,
        tool_name,
        tool_source,
        input_params,
        output_result,
        execution_time_ms,
        metadata
      )
      VALUES (
        NULL,
        'mcp__docs__lookup',
        'mcp',
        '{"query":"deflection"}'::jsonb,
        '{"answer":"ok"}'::jsonb,
        12,
        '{"scoped":true}'::jsonb
      );
      `,
    ]);
  });

  it('installs the source constraint indexes and owner policies', () => {
    const constraints = queryRows(
      databaseUrl,
      `
      SELECT conname
        FROM pg_constraint
       WHERE conrelid = 'public.tool_executions'::regclass
       ORDER BY conname;
      `,
    ).map(([name]) => name);
    expect(constraints).toContain('tool_executions_source_check');

    const indexes = queryRows(
      databaseUrl,
      `
      SELECT indexname
        FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename = 'tool_executions'
       ORDER BY indexname;
      `,
    ).map(([name]) => name);
    expect(indexes).toEqual(expect.arrayContaining([
      'idx_tool_executions_conversation_id',
      'idx_tool_executions_tool_source',
      'idx_tool_executions_created_at',
    ]));

    const policies = queryRows(
      databaseUrl,
      `
      SELECT policyname, cmd
        FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename = 'tool_executions'
       ORDER BY policyname;
      `,
    );
    expect(policies).toContainEqual(['tool_executions_insert_own', 'INSERT']);
    expect(policies).toContainEqual(['tool_executions_select_own', 'SELECT']);
  });

  it('relaxes legacy non-null tool ids on existing telemetry tables', () => {
    runPsql(databaseUrl, [
      '-c',
      `
      DROP TABLE IF EXISTS public.tool_executions CASCADE;
      CREATE TABLE public.tool_executions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
        message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
        tool_id uuid NOT NULL REFERENCES public.tools(id) ON DELETE SET NULL,
        tool_name text NOT NULL,
        input_params jsonb NOT NULL DEFAULT '{}'::jsonb,
        output_result jsonb,
        error_message text,
        execution_time_ms integer NOT NULL DEFAULT 0 CHECK (execution_time_ms >= 0),
        created_at timestamptz NOT NULL DEFAULT now()
      );
      `,
    ]);

    runPsql(databaseUrl, ['-f', migrationPath]);

    const columns = queryRows(
      databaseUrl,
      `
      SELECT column_name, is_nullable
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'tool_executions'
         AND column_name IN ('tool_id', 'tool_source', 'metadata')
       ORDER BY column_name;
      `,
    );
    const columnMap = new Map(columns.map(([name, nullable]) => [name, nullable]));

    expect(columnMap.get('tool_id')).toBe('YES');
    expect(columnMap.get('tool_source')).toBe('NO');
    expect(columnMap.get('metadata')).toBe('NO');

    runPsql(databaseUrl, [
      '-c',
      `
      INSERT INTO public.tool_executions (
        tool_id,
        tool_name,
        tool_source,
        input_params,
        output_result,
        execution_time_ms
      )
      VALUES (
        NULL,
        'mcp__legacy__lookup',
        'mcp',
        '{"query":"legacy"}'::jsonb,
        '{"answer":"ok"}'::jsonb,
        7
      );
      `,
    ]);
  });
});
