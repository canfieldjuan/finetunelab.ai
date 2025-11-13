# Fix Ollama Port Constraint Issue

## Problem
Ollama deployment is failing with error:
```
new row for relation "local_inference_servers" violates check constraint "local_inference_servers_port_check"
```

## Root Cause
- Database constraint only allows ports 8002-8020
- Ollama uses port 11434 (its standard default)
- Port 11434 is outside the allowed range

## Solution
Apply migration `20251104000001_fix_inference_servers_port_constraint.sql` which expands the port constraint to allow:
- vLLM ports: 8002-8020
- Ollama port: 11434

## How to Apply

### Option 1: Using Supabase CLI (Recommended)
```bash
npx supabase db push
```

### Option 2: Using Supabase Studio
1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to SQL Editor
4. Copy contents of `supabase/migrations/20251104000001_fix_inference_servers_port_constraint.sql`
5. Execute the SQL

### Option 3: Direct SQL Execution
Run this SQL in your database:

```sql
BEGIN;

ALTER TABLE local_inference_servers
  DROP CONSTRAINT IF EXISTS local_inference_servers_port_check;

ALTER TABLE local_inference_servers
  ADD CONSTRAINT local_inference_servers_port_check
  CHECK (
    (port >= 8002 AND port <= 8020) OR
    (port = 11434)
  );

COMMIT;
```

## Verification
After applying, test Ollama deployment:
1. Try deploying an Ollama model from the UI
2. Should no longer get port constraint error
3. Verify database record created with port 11434

## File Locations
- Migration: `supabase/migrations/20251104000001_fix_inference_servers_port_constraint.sql`
- Code using port 11434: `lib/services/inference-server-manager.ts:380`
