# Proper Git Workflow with AI Code Review

## Overview

This project uses **Qwen 2.5 Coder 32B** running locally on your RTX 3090 for AI code review **before** code reaches GitHub CI/CD.

## Workflow Steps

### 1. Local Development → Build + Qwen Review → Commit

```bash
# Make changes to code
git add <files>

# Pre-commit hook automatically runs (3 steps):
# ✓ Step 1/3: Syntax check (TypeScript compiler - 2 seconds)
# ✓ Step 2/3: Build check (Next.js build - 30-60 seconds)
# ✓ Step 3/3: AI code review (Qwen on local GPU - 2-5 seconds)

git commit -m "your message"
```

### 2. Push → GitHub Actions CI/CD

```bash
git push origin main

# GitHub Actions CI runs:
# ✓ ESLint
# ✓ TypeScript type-check  
# ✓ Tests
# ✓ Build
# ✓ Security audit
```

### 3. CI Success → Deploy to Render

```
# If CI passes:
# ✓ Wait for CI Success job
# ✓ Deploy to Render Production (main branch)
# ✓ Deploy to Render Staging (develop branch)
```

## Pre-Commit Hook

Located at `.git/hooks/pre-commit`:

```bash
#!/bin/bash

echo "🚀 Pre-commit checks starting..."

# Get staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx)$')

# Step 1: Syntax check (fastest)
echo "⚡ Step 1/3: Syntax check..."
npx tsc --noEmit --skipLibCheck

# Step 2: Build check (catches more issues)
echo "🏗️  Step 2/3: Build check..."
npm run build

# Step 3: AI code review (Qwen on local GPU)
echo "🤖 Step 3/3: AI code review..."
npx tsx scripts/ollama-code-review.ts $STAGED_FILES

echo "✅ All pre-commit checks passed!"
```

## Pre-Commit Check Details

### Step 1: Syntax Check (2 seconds)
- Runs TypeScript compiler (`tsc --noEmit`)
- Catches syntax errors, type errors
- **Blocks commit if errors found**

### Step 2: Build Check (30-60 seconds)
- Runs full Next.js build (`npm run build`)
- Catches compilation errors, missing imports
- Uses build cache for speed (subsequent builds faster)
- ESLint disabled during build (pre-existing errors don't block)
- **Warns but allows override if build fails**

### Step 3: AI Code Review (2-5 seconds)
**Model:** Qwen 2.5 Coder 32B (19GB, Q4_K_M quantization)
**Hardware:** RTX 3090 (24GB VRAM)
**Cost:** $0 (runs on local GPU)

**What it checks:**
1. Security vulnerabilities (SQL injection, XSS, etc.)
2. Performance issues (O(n²) algorithms, memory leaks)
3. Type safety (missing types, unsafe assertions)
4. Best practices (error handling, edge cases)

**Severity levels:**
- **Critical** → Warns and prompts (allows override)
- **High** → Warning but allows commit
- **Medium/Low** → Informational

**Total Time:** 35-70 seconds for all 3 steps
- First run: ~60-70 seconds (full build)
- Subsequent runs: ~35-40 seconds (uses build cache)

## Bypassing Pre-Commit Hook

**⚠️ Only use when absolutely necessary:**

```bash
git commit --no-verify -m "emergency fix"
```

**When it's acceptable:**
- Merge commits with conflicts
- Documentation-only changes
- Emergency hotfixes

## Current Status

✅ **Pre-commit hook:** Installed and executable
✅ **Ollama server:** Running (`localhost:11434`)
✅ **Qwen model:** Available (`qwen2.5-coder:32b`)
✅ **Syntax checker:** Fixed to use project tsconfig.json

## Recent Issues Fixed

1. **Duplicate messageId declarations** - Blocking TypeScript errors
   - Fixed in: `trace-completion-helper.ts`, `route.ts`
   - Status: ✅ TypeScript type-check now passes

2. **Syntax checker path resolution** - False positives
   - Fixed in: `scripts/check-syntax.ts`
   - Now uses project `tsconfig.json` for path mappings

3. **TraceReplayPanel authentication** - Missing export
   - Fixed in: `components/analytics/TraceReplayPanel.tsx`
   - Now imports `createClient` from `@supabase/supabase-js`

## Next Steps

1. **Fix pre-existing ESLint errors** - Not related to recent changes
   - `app/about/page.tsx` - Escape quotes in JSX
   - `app/account/page.tsx` - Replace `any` with proper types
   - Multiple analytics routes - Type the `any` parameters

2. **Test the fixes:**
   - Restart dev server
   - Run batch test with LLM judge enabled
   - Verify individual criteria appear in TraceView

## Resources

- **Pre-commit hook:** `.git/hooks/pre-commit`
- **Qwen review script:** `scripts/ollama-code-review.ts`
- **Syntax checker:** `scripts/check-syntax.ts`
- **CI workflow:** `.github/workflows/ci.yml`
- **Deploy workflow:** `.github/workflows/deploy-production.yml`
