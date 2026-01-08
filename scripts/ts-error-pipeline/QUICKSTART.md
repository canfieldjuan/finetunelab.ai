# TypeScript Error Pipeline - Quick Start

## Prerequisites

Make sure you have these Ollama models pulled:

```bash
ollama pull qwen2.5-coder:32b
ollama pull deepseek-r1:32b
ollama pull deepseek-r1:70b
```

Check they're available:
```bash
ollama list
```

## First Run (Interactive)

```bash
# Run the full pipeline with review
npm run ts:pipeline
```

This will:
1. ✅ Scan for TypeScript errors (~10 seconds)
2. ✅ Categorize with qwen2.5-coder:32b (~2-3 minutes)
3. ✅ Generate fixes with appropriate models (~10-20 minutes)
4. ✅ Open interactive review (you approve/reject each fix)
5. ✅ You then run `npm run ts:apply` to apply approved fixes

## Step-by-Step (Recommended First Time)

```bash
# 1. Scan for errors
npm run ts:scan
# Output: scripts/ts-error-pipeline/output/errors.json

# 2. Categorize by complexity
npm run ts:categorize
# Output: scripts/ts-error-pipeline/output/fixes/tier{1,2,3}-*.json

# 3. Generate fixes
npm run ts:fix
# Output: scripts/ts-error-pipeline/output/fixes/tier*-generated.json

# 4. Review fixes interactively
npm run ts:review
# You'll see each fix with:
#   - Error details
#   - AI analysis
#   - Proposed code changes
#   - Confidence score
# Press: a=accept, r=reject, s=skip, q=quit

# 5. Apply approved fixes
npm run ts:apply
# Applies changes, verifies with tsc, creates git commit
```

## Automated Mode (Use After You Trust It)

```bash
# Scan → Categorize → Fix → Apply (skips review)
npm run ts:auto
```

⚠️ **Warning**: This auto-applies ALL tier 1 fixes without review. Use only after you've verified the quality on your codebase.

## What to Expect on Your Current 45 Errors

Based on typical TypeScript error patterns:

**Scan**: 10 seconds
- Finds your 45 errors
- Extracts code context

**Categorize**: ~2 minutes
- Likely split:
  - Tier 1 (Auto): ~15-20 errors (missing types, simple assertions)
  - Tier 2 (Review): ~20-25 errors (type inference, small refactors)
  - Tier 3 (Complex): ~5-10 errors (architecture issues)

**Generate Fixes**: ~10-15 minutes
- Tier 1 with qwen2.5-coder:32b: ~5 min
- Tier 2 with deepseek-r1:32b: ~8 min
- Tier 3 with deepseek-r1:70b: ~5 min

**Review**: 5-10 minutes (you)
- Read each proposed fix
- Accept good ones, reject uncertain ones
- First time: probably accept 70-80%

**Apply**: 30 seconds
- Modifies files
- Runs tsc to verify
- Creates git commit

**Total time**: ~20-30 minutes (vs 2+ hours manual)

## Reviewing Fixes - What to Look For

### ✅ Good Signs (Accept)
- Fix matches the error message
- Confidence > 85%
- Simple, minimal change
- Makes sense in context

### ⚠️ Uncertain (Maybe Review Manually)
- Confidence 60-85%
- Changes multiple lines
- Affects type inference elsewhere
- You're not 100% sure

### ❌ Bad Signs (Reject)
- Confidence < 60%
- Doesn't make sense
- Changes unrelated code
- Too aggressive refactoring

## Troubleshooting

**"Model not found"**
```bash
ollama pull qwen2.5-coder:32b
# Wait for download, then retry
```

**"Cannot connect to Ollama"**
```bash
# Check if Ollama is running
ollama list

# If not, start it
ollama serve
```

**"JSON parse error in categorize"**
- Model output includes extra text
- Usually retries work
- Or manually edit `output/fixes/*.json` to remove non-JSON text

**"Line mismatch during apply"**
- File changed between scan and apply
- Re-run from scan: `npm run ts:scan`

**"Still have TypeScript errors after apply"**
- Normal! Complex errors need manual fixes
- Run `npm run ts:scan` again to see what's left
- Tackle remaining errors manually or re-run pipeline

## Next Steps After First Run

1. **Review the commit**: `git show` to see what was changed
2. **Run tests**: Make sure nothing broke
3. **Adjust confidence**: Edit `config.json` thresholds if needed
4. **Build trust**: Run a few times to see quality
5. **Automate**: Add to CI/CD or cron job once confident

## Daily Automation (Advanced)

Once you trust the pipeline:

```bash
# Add to crontab
crontab -e

# Run every night at 2 AM
0 2 * * * cd /path/to/web-ui && npm run ts:auto && git push
```

This will automatically fix simple errors overnight!

## Need Help?

Check the full README.md for:
- Configuration options
- Output directory structure
- Advanced usage
- Model customization
