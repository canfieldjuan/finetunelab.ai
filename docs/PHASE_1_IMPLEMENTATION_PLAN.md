# Phase 1: Model Import + Serving - Implementation Plan

**Goal:** Enable importing trained Tiny Tool Use models from HuggingFace and using them in chat

**Estimated Time:** 2-3 hours
**Risk Level:** Low (all additive changes, backward compatible)

---

## What We're Building

Allow users to:
1. Import HuggingFace models via simple form
2. Serve models via HuggingFace Inference API
3. Use imported models in chat immediately
4. Track model usage in analytics

---

## Implementation Steps

### Step 1: Database Schema Enhancement (Optional - 15 min)
**File:** `docs/schema_updates/13_training_metadata.sql`

Add optional training metadata columns to `llm_models` table:
- `training_method` TEXT (e.g., "sft", "dpo")
- `base_model` TEXT (e.g., "Qwen/Qwen3-0.6B")
- `training_dataset` TEXT
- `training_date` TIMESTAMPTZ
- `lora_config` JSONB
- `evaluation_metrics` JSONB

**Why:** Track model provenance for trained models

**Validation:**
- All columns nullable (backward compatible)
- Run verification query
- Check existing models unaffected

---

### Step 2: Add HuggingFace Template (20 min)
**File:** `lib/models/model-templates.ts`

Add template:
```typescript
{
  id: 'huggingface-inference',
  name: 'HuggingFace Inference API',
  provider: 'huggingface',
  description: 'Import models from HuggingFace Hub',
  base_url: 'https://api-inference.huggingface.co/models',
  model_id: '', // User enters: username/model-name
  auth_type: 'bearer',
  context_length: 2048,
  max_output_tokens: 1024,
  supports_streaming: false, // HF Inference API limitation
  supports_functions: true,
  placeholder_api_key: 'Get from https://huggingface.co/settings/tokens'
}
```

**Validation:**
- Template appears in AddModelDialog
- Fields pre-populate correctly

---

### Step 3: Update TypeScript Types (10 min)
**File:** `lib/models/llm-model.types.ts`

Add optional fields to `LLMModel` interface:
```typescript
export interface LLMModel {
  // ... existing fields ...

  // Training metadata (optional)
  training_method?: string | null;
  base_model?: string | null;
  training_dataset?: string | null;
  training_date?: string | null;
  lora_config?: Record<string, any> | null;
  evaluation_metrics?: Record<string, any> | null;
}
```

Update DTOs accordingly.

**Validation:**
- TypeScript compiles without errors
- Existing code unaffected

---

### Step 4: Enhance AddModelDialog (30 min)
**File:** `components/models/AddModelDialog.tsx`

Add helper text for HuggingFace provider:
- Show model ID format example: `username/model-name`
- Link to HuggingFace tokens page
- Add optional training metadata fields (collapsible section)

**Validation:**
- Helper text shows when HuggingFace selected
- Form validation works
- Can submit with minimal fields

---

### Step 5: Test Import Workflow (30 min)

**Test Case 1: Import Public Model**
- Model: `gpt2` (no API key needed)
- Steps:
  1. Navigate to /models
  2. Click "Add Model"
  3. Select "HuggingFace Inference API"
  4. Enter model_id: `gpt2`
  5. Test connection (should pass)
  6. Save
- Expected: Model appears in list

**Test Case 2: Import Private/Trained Model**
- Model: Your trained model (e.g., `username/qwen3-tool-use-v1`)
- Steps:
  1. Get HuggingFace API token
  2. Add model with token
  3. Test connection
  4. Save
- Expected: Model saved with encrypted token

**Test Case 3: Use in Chat**
- Steps:
  1. Navigate to /chat
  2. Select imported model
  3. Send message: "What is 2+2?"
  4. Wait for response
- Expected: Response from HuggingFace API

**Test Case 4: Verify Analytics**
- Check message in database has `llm_model_id`
- Verify token counts (estimated if not provided)
- Check session tagging works

---

### Step 6: Documentation (20 min)

**Create:** `docs/TRAINING_GUIDE.md`
```markdown
# Training Guide: Tiny Tool Use Integration

## Prerequisites
- GPU with 8GB VRAM (RTX 4060 Ti or better)
- Python 3.10+
- HuggingFace account and API token

## Step 1: Train Model with Tiny Tool Use
1. Navigate to training repo
2. Edit config file
3. Run training: `python train.py --config configs/my_config.json`
4. Wait 2-4 hours

## Step 2: Merge and Save Model
```bash
python save_merge_model.py \
  --base_model Qwen/Qwen3-0.6B \
  --adapter_path outputs/checkpoint-final \
  --output_dir outputs/merged_model
```

## Step 3: Push to HuggingFace
```bash
huggingface-cli login
huggingface-cli upload username/model-name outputs/merged_model
```

## Step 4: Import into Web-UI
1. Navigate to /models page
2. Click "Add Model"
3. Select "HuggingFace Inference API"
4. Enter model ID: `username/model-name`
5. Enter HuggingFace API token
6. Test connection
7. Save

## Step 5: Use in Chat
1. Navigate to /chat
2. Select your model from dropdown
3. Start chatting!

## Troubleshooting
- **Cold start delay:** First request may take 10-30 seconds
- **Rate limits:** Free tier has limits, consider paid tier
- **Connection fails:** Check model is public or token is valid
```

**Update:** `docs/USER_GUIDE.md`
- Add "Importing Custom Models" section
- Reference TRAINING_GUIDE.md

---

## Files Changed Summary

### New Files (2)
1. `docs/schema_updates/13_training_metadata.sql` - Database migration
2. `docs/TRAINING_GUIDE.md` - Training workflow guide

### Modified Files (4)
1. `lib/models/model-templates.ts` - Add HuggingFace template
2. `lib/models/llm-model.types.ts` - Add training metadata fields
3. `components/models/AddModelDialog.tsx` - Add helper text
4. `docs/USER_GUIDE.md` - Add import section

### Files to Read (4 - for validation)
1. `lib/llm/adapters/huggingface-adapter.ts` - Verify adapter works
2. `app/api/models/route.ts` - Verify create endpoint
3. `app/api/models/test-connection/route.ts` - Verify test works
4. `app/api/chat/route.ts` - Verify model selection

---

## Validation Checklist

### Before Implementation
- [x] Read existing HuggingFace adapter code
- [x] Verify llm_models table schema
- [x] Verify models page exists
- [x] Check AddModelDialog implementation
- [x] Review model templates structure

### During Implementation
- [ ] Test TypeScript compilation after each file change
- [ ] Verify no breaking changes to existing code
- [ ] Check database migration is backward compatible
- [ ] Validate all new fields are nullable

### After Implementation
- [ ] Import public model (gpt2) successfully
- [ ] Import private model with API key
- [ ] Use imported model in chat
- [ ] Verify analytics tracking works
- [ ] Test session tagging with custom model
- [ ] Check model appears in analytics comparisons

---

## Risk Mitigation

**Risk:** HuggingFace API rate limits
**Mitigation:** Document limits, suggest paid tier for production

**Risk:** Cold start delays on free tier
**Mitigation:** Warn users, suggest keeping models active

**Risk:** No token counts from HF API
**Mitigation:** Implement estimation, document limitation

**Risk:** No streaming support
**Mitigation:** Set `supports_streaming: false`, UI shows non-streaming mode

---

## Success Criteria

1. ✅ User can import HuggingFace model in < 2 minutes
2. ✅ Connection test completes successfully
3. ✅ Chat works with imported model
4. ✅ Zero breaking changes to existing features
5. ✅ Documentation complete and tested

---

## Next Actions After Completion

1. Get user feedback on workflow
2. Test with 2-3 trained models
3. Evaluate Phase 2 (Config Builder) necessity
4. Consider alternative serving options (vLLM, Ollama)

---

**Status:** Awaiting approval
**Created:** 2025-10-15
**Estimated Completion:** 2-3 hours after approval
