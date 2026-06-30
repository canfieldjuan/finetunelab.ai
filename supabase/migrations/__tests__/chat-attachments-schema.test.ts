import { execFileSync } from 'child_process';
import { join } from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20260630000000_create_chat_attachments.sql',
);
const postgresImage = 'postgres:16-alpine';

function commandExists(command: string): boolean {
  try {
    execFileSync('which', [command], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function canStartDockerPostgres(): boolean {
  if (!commandExists('docker')) return false;
  try {
    execFileSync('docker', ['info'], { stdio: 'ignore' });
    execFileSync('docker', ['run', '--rm', postgresImage, 'postgres', '--version'], {
      stdio: 'ignore',
      timeout: 60_000,
    });
    return true;
  } catch {
    return false;
  }
}

const canRunSchemaTests =
  commandExists('psql') &&
  (!!process.env.CHAT_ATTACHMENTS_SCHEMA_TEST_DATABASE_URL || canStartDockerPostgres());
const describeSchema = canRunSchemaTests ? describe : describe.skip;

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
      postgresImage,
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

describeSchema('chat_attachments schema migration', () => {
  let databaseUrl = process.env.CHAT_ATTACHMENTS_SCHEMA_TEST_DATABASE_URL || '';
  let containerId: string | null = null;

  beforeAll(() => {
    if (!databaseUrl) {
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
      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS uuid
      LANGUAGE sql
      STABLE
      AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

      CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS public.conversations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS public.messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
        user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
        role text,
        content text,
        metadata jsonb DEFAULT '{}'::jsonb
      );

      CREATE SCHEMA IF NOT EXISTS storage;
      CREATE TABLE IF NOT EXISTS storage.buckets (
        id text PRIMARY KEY,
        name text NOT NULL,
        public boolean NOT NULL DEFAULT false
      );
      CREATE TABLE IF NOT EXISTS storage.objects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        bucket_id text NOT NULL,
        name text NOT NULL
      );
      CREATE OR REPLACE FUNCTION storage.foldername(name text)
      RETURNS text[]
      LANGUAGE sql
      IMMUTABLE
      AS $$ SELECT string_to_array($1, '/') $$;
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

  it('creates nullable message-scoped attachment columns and constraints', () => {
    const columns = queryRows(
      databaseUrl,
      `
      SELECT column_name, is_nullable, COALESCE(column_default, '')
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'chat_attachments'
       ORDER BY column_name;
      `,
    );
    const columnMap = new Map(columns.map(([name, nullable, defaultValue]) => [
      name,
      { nullable, defaultValue },
    ]));

    expect(columnMap.get('user_id')?.nullable).toBe('NO');
    expect(columnMap.get('conversation_id')?.nullable).toBe('NO');
    expect(columnMap.get('message_id')?.nullable).toBe('YES');
    expect(columnMap.get('storage_bucket')?.defaultValue).toContain('chat-attachments');
    expect(columnMap.get('status')?.defaultValue).toContain('uploaded');
    expect(columnMap.get('metadata')?.defaultValue).toContain("'{}'");

    const constraints = queryRows(
      databaseUrl,
      `
      SELECT conname
        FROM pg_constraint
       WHERE conrelid = 'public.chat_attachments'::regclass
       ORDER BY conname;
      `,
    ).map(([name]) => name);

    expect(constraints).toContain('chat_attachments_kind_check');
    expect(constraints).toContain('chat_attachments_status_check');

    const statusConstraint = queryRows(
      databaseUrl,
      `
      SELECT pg_get_constraintdef(oid)
        FROM pg_constraint
       WHERE conrelid = 'public.chat_attachments'::regclass
         AND conname = 'chat_attachments_status_check';
      `,
    );
    expect(statusConstraint[0]?.[0]).toContain("'attaching'");
  });

  it('installs owner indexes, RLS policies, and private storage bucket', () => {
    const indexes = queryRows(
      databaseUrl,
      `
      SELECT indexname
        FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename = 'chat_attachments'
       ORDER BY indexname;
      `,
    ).map(([name]) => name);

    expect(indexes).toEqual(expect.arrayContaining([
      'idx_chat_attachments_user_id',
      'idx_chat_attachments_conversation_id',
      'idx_chat_attachments_message_id',
      'idx_chat_attachments_created_at',
    ]));

    const policies = queryRows(
      databaseUrl,
      `
      SELECT policyname
        FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename = 'chat_attachments'
       ORDER BY policyname;
      `,
    ).map(([name]) => name);

    expect(policies).toEqual(expect.arrayContaining([
      'chat_attachments_select_own',
    ]));
    expect(policies).not.toEqual(expect.arrayContaining([
      'chat_attachments_insert_own',
      'chat_attachments_update_own',
      'chat_attachments_delete_own',
    ]));

    const storageBuckets = queryRows(
      databaseUrl,
      "SELECT id, public::text FROM storage.buckets WHERE id = 'chat-attachments';",
    );
    expect(storageBuckets).toEqual([['chat-attachments', 'false']]);

    const storagePolicies = queryRows(
      databaseUrl,
      `
      SELECT policyname
        FROM pg_policies
       WHERE schemaname = 'storage'
         AND tablename = 'objects'
         AND policyname LIKE 'chat-attachments:%'
       ORDER BY policyname;
      `,
    ).map(([name]) => name);

    expect(storagePolicies).toEqual(expect.arrayContaining([
      'chat-attachments: users read own files',
    ]));
    expect(storagePolicies).not.toEqual(expect.arrayContaining([
      'chat-attachments: users upload to own folder',
      'chat-attachments: users delete own files',
    ]));
  });

  it('installs an atomic capacity-checked attachment insert function', () => {
    const definition = runPsql(
      databaseUrl,
      ['-c', `
      SELECT pg_get_functiondef(
        'public.create_chat_attachment_with_capacity(uuid,uuid,uuid,text,text,integer,text,text,text,text,integer,jsonb,integer)'::regprocedure
      );
      `],
    );

    expect(definition).toContain('pg_advisory_xact_lock');
    expect(definition).toContain("chat_attachments.status = 'uploaded'");
    expect(definition).toContain('p_max_uploaded');

    runPsql(databaseUrl, [
      '-c',
      `
      INSERT INTO auth.users (id)
      VALUES ('11111111-1111-4111-8111-111111111111')
      ON CONFLICT DO NOTHING;

      INSERT INTO public.conversations (id, user_id)
      VALUES ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111')
      ON CONFLICT DO NOTHING;

      SELECT public.create_chat_attachment_with_capacity(
        ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
        n::text || '.txt',
        'text/plain',
        1,
        'chat-attachments',
        n::text || '.txt',
        'text',
        n::text,
        length(n::text),
        '{}'::jsonb,
        5
      )
      FROM generate_series(1, 5) AS seeded(n);
      `,
    ]);

    const count = queryRows(
      databaseUrl,
      `
      SELECT COUNT(*)::text
        FROM public.chat_attachments
       WHERE user_id = '11111111-1111-4111-8111-111111111111'
         AND conversation_id = '22222222-2222-4222-8222-222222222222'
         AND status = 'uploaded';
      `,
    );
    expect(count).toEqual([['5']]);

    runPsql(databaseUrl, [
      '-c',
      `
      DO $$
      DECLARE
        blocked boolean := false;
      BEGIN
        BEGIN
          PERFORM public.create_chat_attachment_with_capacity(
            '00000000-0000-4000-8000-000000000006',
            '11111111-1111-4111-8111-111111111111',
            '22222222-2222-4222-8222-222222222222',
            'six.txt',
            'text/plain',
            1,
            'chat-attachments',
            'six.txt',
            'text',
            'six',
            3,
            '{}'::jsonb,
            5
          );
        EXCEPTION WHEN raise_exception THEN
          IF SQLERRM LIKE 'A chat turn can include at most 5 attachments%' THEN
            blocked := true;
          ELSE
            RAISE;
          END IF;
        END;

        IF NOT blocked THEN
          RAISE EXCEPTION 'capacity function allowed sixth upload';
        END IF;
      END $$;
      `,
    ]);
  });
});
