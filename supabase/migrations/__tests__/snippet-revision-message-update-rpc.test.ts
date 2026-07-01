import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20260701040500_create_snippet_revision_message_update_rpc.sql',
);

describe('snippet revision message update RPC migration', () => {
  it('enforces message content size inside the SECURITY DEFINER function', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('length(p_expected_content) > 200000');
    expect(sql).toContain('length(p_updated_content) > 200000');
    expect(sql).toContain('USING ERRCODE = \'22001\'');
  });
});
