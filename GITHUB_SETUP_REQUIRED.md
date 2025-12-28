# GitHub Repository Configuration Required

## CI/CD Status

### ✅ PASSING
- **TypeScript Type-Check**: All type errors fixed!
- **Compilation**: Successfully compiles in 112s

### ❌ FAILING
- **Build (Page Data Collection)**: Missing environment variables from GitHub

## Required GitHub Repository Configuration

The CI/CD workflow needs the following environment variables configured in your GitHub repository settings:

### Repository Variables (Settings → Secrets and variables → Actions → Variables tab)

Add these as **Repository Variables** (not secrets, since they start with `NEXT_PUBLIC_`):

1. **NEXT_PUBLIC_SUPABASE_URL**
   - Your Supabase project URL
   - Example: `https://xxxxx.supabase.co`

2. **NEXT_PUBLIC_SUPABASE_ANON_KEY**
   - Your Supabase anonymous (public) key
   - Example: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### Repository Secrets (Settings → Secrets and variables → Actions → Secrets tab)

Add this as a **Repository Secret**:

3. **SUPABASE_SERVICE_ROLE_KEY**
   - Your Supabase service role (private) key
   - Example: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

## How to Add Variables/Secrets

1. Go to: `https://github.com/canfieldjuan/finetunelab.ai/settings/secrets/actions`
2. Click the **Variables** tab for NEXT_PUBLIC_* values
3. Click **New repository variable**
4. Add name and value
5. Click **Add variable**
6. Repeat for the second NEXT_PUBLIC variable
7. Switch to **Secrets** tab for SUPABASE_SERVICE_ROLE_KEY
8. Click **New repository secret**
9. Add name and value
10. Click **Add secret**

## Current Status in Workflow Logs

The workflow shows these as empty:
```
env:
  NODE_ENV: production
  NEXT_PUBLIC_SUPABASE_URL:           # ❌ EMPTY
  NEXT_PUBLIC_SUPABASE_ANON_KEY:      # ❌ EMPTY
  SUPABASE_SERVICE_ROLE_KEY:          # ❌ EMPTY
```

## Why This Is Needed

The Next.js build process:
1. Compiles TypeScript ✅ (passing)
2. Collects page data by importing API routes
3. API routes import `lib/supabaseClient.ts`
4. That file checks for environment variables at import time
5. Throws error if missing ❌ (current issue)

## Next Steps

1. Add the three environment variables/secrets to GitHub repository settings
2. Re-run the failed workflow or push a new commit
3. The build should succeed with environment variables configured

## Alternative Solution (If Variables Are Already Set)

If you've already added these to GitHub, verify:
- They're in the correct repository: `canfieldjuan/finetunelab.ai`
- The names match exactly (case-sensitive):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- They're set as "Repository" level, not "Environment" level
- For the NEXT_PUBLIC ones: Added as **Variables**, not Secrets
- For the SERVICE_ROLE_KEY: Added as a **Secret**, not Variable
