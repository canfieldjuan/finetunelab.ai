# Provider Secrets Vault - Implementation Plan

**Date:** 2025-10-16
**Feature:** Centralized provider-level API key management
**Objective:** Allow users to enter one API key per provider (OpenAI, Anthropic, HuggingFace, etc.) that persists and can be reused across multiple models

---

## Problem Statement

**Current Issue:**
- Each model stores its own encrypted API key in `llm_models.api_key_encrypted`
- User must copy/paste same HuggingFace token 5 times to create 5 HuggingFace models
- No centralized key management
- Key rotation requires updating N model records

**Desired Behavior:**
- User enters OpenAI key once → all OpenAI models use it
- User enters HuggingFace key once → all HF models use it
- Keys persist across sessions
- Easy key rotation (update once, affects all models using that provider)

---

## Solution Architecture

### Design Decision: Hybrid Approach

**Support BOTH per-model keys AND provider-level secrets:**

1. **If model has `api_key_encrypted`:** Use model's own key (backwards compatible)
2. **If model has NULL `api_key_encrypted`:** Look up provider secret from `provider_secrets` table
3. **Fallback:** If neither exists, return undefined (connection will fail)

**Benefits:**
- ✅ Backwards compatible (existing models continue working)
- ✅ Flexible (users can override provider key for specific models)
- ✅ Gradual migration (no breaking changes)

---

## Implementation Phases

### Phase 1: Database Schema
**File:** `docs/schema_updates/15_provider_secrets.sql`

Create `provider_secrets` table with:
- User-scoped provider secrets
- Encrypted API keys using existing encryption
- RLS policies matching `llm_models` pattern
- Unique constraint: one secret per user per provider

**Verification:**
- Check existing RLS policies in `10_llm_models_registry.sql` (lines 87-126)
- Match policy structure and naming conventions
- Use same trigger pattern for `updated_at`

---

### Phase 2: Type Definitions
**File:** `lib/secrets/secrets.types.ts` (NEW)

TypeScript interfaces for:
- `ProviderSecret` - Database record
- `ProviderSecretDisplay` - UI display (with preview, no actual key)
- `CreateSecretDTO` - Create payload
- `UpdateSecretDTO` - Update payload

**Verification:**
- Match naming conventions from `lib/models/llm-model.types.ts`
- Use same pattern: Record type vs Display type

---

### Phase 3: Secrets Manager Service
**File:** `lib/secrets/secrets-manager.service.ts` (NEW)

Service layer with methods:
- `listSecrets(userId)` - List user's provider secrets
- `getSecret(userId, provider)` - Get specific provider secret
- `createSecret(dto, userId)` - Create new provider secret
- `updateSecret(provider, dto, userId)` - Update existing secret
- `deleteSecret(provider, userId)` - Delete provider secret

**Verification:**
- Follow pattern from `lib/models/model-manager.service.ts`
- Use same error handling and logging patterns
- Reuse `encrypt()` and `decrypt()` from `lib/models/encryption.ts`

---

### Phase 4: API Routes
**Files:**
- `app/api/secrets/route.ts` (NEW) - List/Create
- `app/api/secrets/[provider]/route.ts` (NEW) - Get/Update/Delete

**Verification:**
- Match structure of `app/api/models/route.ts`
- Use same authentication pattern (createClient with auth header)
- Same error response format

---

### Phase 5: UI Management Page
**File:** `app/secrets/page.tsx` (NEW)

Provider secrets management interface:
- List all configured provider secrets (with key preview)
- Add new provider secret
- Update existing provider secret
- Delete provider secret
- Visual indicators for which providers have keys configured

**Verification:**
- Follow pattern from `app/models/page.tsx`
- Match styling and component structure
- Use same authentication flow

---

### Phase 6: Model Manager Integration
**File:** `lib/models/model-manager.service.ts` (MODIFY)

Update `getModelConfig()` method:

**Current code (line 267-310):**
```typescript
async getModelConfig(modelId: string): Promise<ModelConfig> {
  const { data, error } = await defaultSupabase
    .from('llm_models')
    .select('*')
    .eq('id', modelId)
    .single();

  // ... existing code ...

  const config: ModelConfig = {
    // ... other fields ...
    api_key: data.api_key_encrypted ? decrypt(data.api_key_encrypted) : undefined,
  };

  return config;
}
```

**New code:**
```typescript
async getModelConfig(modelId: string, userId?: string): Promise<ModelConfig> {
  const { data, error } = await defaultSupabase
    .from('llm_models')
    .select('*')
    .eq('id', modelId)
    .single();

  // ... existing error handling ...

  let apiKey: string | undefined;

  // Priority 1: Use model's own API key if present
  if (data.api_key_encrypted) {
    apiKey = decrypt(data.api_key_encrypted);
  }
  // Priority 2: Look up provider secret
  else if (userId) {
    try {
      const providerSecret = await secretsManager.getSecret(userId, data.provider);
      if (providerSecret?.api_key_encrypted) {
        apiKey = decrypt(providerSecret.api_key_encrypted);
      }
    } catch (error) {
      console.log('[ModelManager] No provider secret found for', data.provider);
    }
  }

  const config: ModelConfig = {
    // ... other fields ...
    api_key: apiKey,
  };

  return config;
}
```

**Verification:**
- ✅ Backwards compatible (existing behavior preserved)
- ✅ Gradual fallback (model key → provider secret → undefined)
- ✅ Non-breaking (userId parameter optional)

**Impact Analysis:**
- `lib/llm/unified-client.ts` line 67 & 309: Calls `getModelConfig(modelId)` → Will continue working (userId optional)
- Need to update callers to pass userId for provider secret support

---

### Phase 7: Update Unified Client
**File:** `lib/llm/unified-client.ts` (MODIFY)

Update calls to `getModelConfig()` to pass userId:

**Current code (line 54-67):**
```typescript
async chat(
  modelId: string,
  messages: ChatMessage[],
  options?: { /* ... */ }
): Promise<LLMResponse> {
  // Load model configuration from database
  const config = await modelManager.getModelConfig(modelId);
  // ...
}
```

**New code:**
```typescript
async chat(
  modelId: string,
  messages: ChatMessage[],
  options?: {
    tools?: ToolDefinition[];
    temperature?: number;
    maxTokens?: number;
    userId?: string;  // NEW: Add userId to options
    toolCallHandler?: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
  }
): Promise<LLMResponse> {
  // Load model configuration from database (with userId for provider secret lookup)
  const config = await modelManager.getModelConfig(modelId, options?.userId);
  // ...
}
```

**Impact:** Need to verify where `unifiedLLMClient.chat()` is called and ensure userId is passed

---

### Phase 8: Update Chat API
**File:** `app/api/chat/route.ts` (MODIFY)

Pass userId to unified client:

**Verified insertion points:**
- **Line 29-35:** userId extracted from memory `userId = memory?.userId || null`
- **Line 220-228:** Non-streaming path with tools - unifiedLLMClient.chat() called
- **Line 349-356:** Streaming path - unifiedLLMClient.stream() called

**Change required:**
```typescript
// NON-STREAMING PATH (line 220-228)
llmResponse = await unifiedLLMClient.chat(
  selectedModelId,
  enhancedMessages,
  {
    tools,
    temperature,
    maxTokens,
    toolCallHandler,
    userId,  // ADD THIS LINE
  }
);

// STREAMING PATH (line 349-356)
for await (const chunk of unifiedLLMClient.stream(
  selectedModelId,
  enhancedMessages,
  {
    temperature,
    maxTokens,
    userId,  // ADD THIS LINE
  }
)) {
  // ...
}
```

---

### Phase 9: Update Model Creation UI
**File:** `components/models/AddModelDialog.tsx` (MODIFY)

Make API key field optional with helpful messaging:

**Verified insertion points:**
- **Line 108-110:** Validation logic that requires API key for non-'none' auth types
- **Line 519-527:** Template form API key input (currently required `*`)
- **Line 707-714:** Manual form API key input (currently required `*` for non-'none')

**Changes required:**

1. **Remove validation requirement (line 108-110):**
```typescript
// REMOVE THIS:
if (formData.auth_type !== 'none' && !formData.api_key?.trim()) {
  return 'API key is required for this auth type';
}
```

2. **Update Template form label (line 519):**
```typescript
// CHANGE FROM:
API Key <span className="text-destructive">*</span>

// CHANGE TO:
API Key <span className="text-muted-foreground text-xs">(Optional - uses provider secret if empty)</span>
```

3. **Update Manual form label (line 707):**
```typescript
// CHANGE FROM:
API Key {formData.auth_type !== 'none' && <span className="text-destructive">*</span>}

// CHANGE TO:
API Key <span className="text-muted-foreground text-xs">(Optional - uses provider secret if empty)</span>
```

4. **Update Test button disabled logic (line 576 & 824):**
```typescript
// REMOVE api_key requirement from disabled condition
// Test connection will use api_key from form if provided, or fail gracefully
disabled={testing || submitting}  // Remove: || !formData.api_key
```

**Note:** Test connection can still fail if no API key AND no provider secret exists, which will inform the user to configure one.

---

## Impact Analysis

### Files to CREATE (8 files):
1. ✅ `docs/schema_updates/15_provider_secrets.sql`
2. ✅ `lib/secrets/secrets.types.ts`
3. ✅ `lib/secrets/secrets-manager.service.ts`
4. ✅ `app/api/secrets/route.ts`
5. ✅ `app/api/secrets/[provider]/route.ts`
6. ✅ `app/secrets/page.tsx`
7. ✅ `docs/progress_logs/PROVIDER_SECRETS_IMPLEMENTATION_PLAN.md` (this file)
8. ✅ Update `docs/progress_logs/API_KEY_ENCRYPTION_INVESTIGATION.md` with solution

### Files to MODIFY (4 files):
1. ⚠️ `lib/models/model-manager.service.ts` - Add provider secret fallback to `getModelConfig()`
2. ⚠️ `lib/llm/unified-client.ts` - Pass userId to `getModelConfig()`
3. ⚠️ `app/api/chat/route.ts` - Extract userId and pass to unified client
4. ⚠️ `components/models/AddModelDialog.tsx` - Make API key optional, add UI hints

### Features UNAFFECTED:
- ✅ Model listing (no changes needed)
- ✅ Model creation with explicit API key (backwards compatible)
- ✅ Test connection (uses API key from request body, not database)
- ✅ Existing models with encrypted keys (priority 1 in fallback logic)
- ✅ Training configs (unrelated feature)

### Features ENHANCED:
- ✅ Model creation (can omit API key if provider secret exists)
- ✅ Chat API (will use provider secrets automatically)
- ✅ Key rotation (update provider secret once, affects all models)

---

## Verification Checklist

### Before Implementation:
- [ ] Read `lib/models/model-manager.service.ts` to find exact insertion point for provider secret fallback
- [ ] Read `app/api/chat/route.ts` to find where unifiedLLMClient is called
- [ ] Read `components/models/AddModelDialog.tsx` to find API key input field code
- [ ] Verify navigation/layout structure for adding /secrets link

### During Implementation:
- [ ] Follow exact RLS policy pattern from `10_llm_models_registry.sql`
- [ ] Match naming conventions from existing types
- [ ] Use same error handling patterns
- [ ] Add robust logging to all service methods
- [ ] Test each phase independently before moving to next

### After Implementation:
- [ ] Run database migration in Supabase
- [ ] Test creating provider secret via API
- [ ] Test creating model without API key (should use provider secret)
- [ ] Test creating model with API key (should use model key, not provider secret)
- [ ] Test chat with model using provider secret
- [ ] Test updating provider secret affects all models
- [ ] Test backwards compatibility (existing models still work)

---

## Risk Assessment

### Low Risk:
- Database schema (new table, no modifications to existing)
- New service layer (isolated, no dependencies)
- New API routes (isolated endpoints)
- New UI page (isolated route)

### Medium Risk:
- `getModelConfig()` modification (core function, but backwards compatible)
- Unified client modification (widely used, but optional parameter)

### Mitigation:
- Make all modifications backwards compatible
- Use optional parameters
- Preserve existing behavior as default
- Add extensive logging
- Test thoroughly before committing

---

## Next Steps

1. Complete verification checklist (read all files to modify)
2. Implement Phase 1 (database schema)
3. Implement Phase 2-4 (types, service, API)
4. Test API endpoints independently
5. Implement Phase 5 (UI)
6. Test UI independently
7. Implement Phase 6-8 (integration)
8. Test complete end-to-end workflow
9. Update progress log with findings

---

**Status:** Plan created, ready for verification phase
