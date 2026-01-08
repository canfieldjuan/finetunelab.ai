# TypeScript Error Pipeline

AI-powered TypeScript error detection and fixing pipeline using local Ollama models.

## Overview

This pipeline automatically:
1. Scans your codebase for TypeScript errors
2. Categorizes errors by complexity
3. Generates fixes using appropriate AI models
4. Provides interactive review interface
5. Applies approved fixes and commits

## Models Used

- **Tier 1** (Simple): `qwen2.5-coder:32b` - Fast, code-specialized
- **Tier 2** (Medium): `deepseek-r1:32b` - Reasoning for complex fixes
- **Tier 3** (Complex): `deepseek-r1:70b` - Full reasoning power

## Quick Start

```bash
# Full interactive pipeline
npm run ts:pipeline

# Or step-by-step
npm run ts:scan         # Find errors
npm run ts:categorize   # Categorize by complexity
npm run ts:fix          # Generate fixes
npm run ts:review       # Review interactively
npm run ts:apply        # Apply approved fixes

# Automated (skip review - use with caution)
npm run ts:auto
```

## Pipeline Phases

### Phase 1: Scan
- Runs `tsc --noEmit`
- Parses errors with file context
- Outputs: `output/errors.json`

### Phase 2: Categorize
- Uses `qwen2.5-coder:32b` to categorize
- Assigns tier (1-3) and confidence score
- Outputs: `output/fixes/tier{1,2,3}-{auto,review,complex}.json`

### Phase 3: Generate Fixes
- Uses appropriate model per tier
- Generates code changes as JSON
- Outputs: `output/fixes/tier{1,2,3}-generated.json`

### Phase 4: Review
- Interactive CLI to approve/reject fixes
- Shows diff, analysis, confidence
- Outputs: `output/approved/fixes.json`

### Phase 5: Apply
- Applies approved changes to files
- Verifies with `tsc --noEmit`
- Creates git commit

## Configuration

Edit `config.json` to customize:
- Model assignments
- Confidence thresholds
- Batch sizes
- Ollama URL

## Output Directory Structure

```
output/
├── errors.json                    # All detected errors
├── fixes/
│   ├── tier1-auto.json           # Auto-fixable errors
│   ├── tier2-review.json         # Review needed
│   ├── tier3-complex.json        # Complex errors
│   ├── tier1-generated.json      # Generated fixes
│   ├── tier2-generated.json
│   └── tier3-generated.json
└── approved/
    ├── fixes.json                # Approved fixes
    └── review-summary.json       # Review statistics
```

## Tips

1. **First run**: Use interactive mode (`npm run ts:pipeline`)
2. **Trust building**: Review tier 1 fixes first, see quality
3. **Auto mode**: Once confident, use `npm run ts:auto` for tier 1
4. **Complex errors**: Tier 3 often needs manual tweaking
5. **Incremental**: Run after each major change to prevent error buildup

## Troubleshooting

**Models not found:**
```bash
ollama pull qwen2.5-coder:32b
ollama pull deepseek-r1:32b
ollama pull deepseek-r1:70b
```

**Ollama not running:**
```bash
ollama serve
```

**JSON parse errors:**
- Models sometimes output thinking text
- Pipeline tries to clean it up
- Check `output/fixes/*-generated.json` for raw responses

**Line mismatches during apply:**
- File changed since scan
- Re-run full pipeline from scan
