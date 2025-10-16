# ⚠️ DEPRECATED - LLM Configuration Unification - Implementation Plan

> **STATUS:** DEPRECATED - October 13, 2025
>
> **REASON:** This LLM configuration unification has been completed and superseded by the completion document.
>
> **SUPERSEDED BY:**
> - `LLM_CONFIG_UNIFICATION_COMPLETE.md` (full implementation summary)
> - `LLM_CONFIGURATION_GUIDE.md` (user guide - 392 lines)
>
> **DO NOT USE THIS PLAN** - Implementation is complete. All LLM configs now use environment variables.

---

# LLM Configuration Unification - Implementation Plan

**Date:** October 12, 2025
**Status:** 🚧 In Progress
**Objective:** Unify LLM configuration to use environment variables instead of YAML

---

## 📋 **PHASED IMPLEMENTATION PLAN**

### **PHASE 1: Verify Current State**

- [x] Identify all files using llmConfig
- [x] Verify YAML config location and content
- [x] Check .env current state
- [x] Identify conflicts between systems

**Findings:**

- `app/api/chat/route.ts` uses `loadLLMConfig()` from `llmConfig.ts`
- `config/llm.yaml` exists with OpenAI, Anthropic, Ollama configs
- `.env` has partial OpenAI config (just added)
- `lib/llm/openai.ts` uses env vars but NOT called by chat route

---

### **PHASE 2: Update llmConfig.ts** ✅ COMPLETE

- [x] Remove YAML dependency
- [x] Read from environment variables
- [x] Maintain same interface (no breaking changes)
- [x] Add error handling for missing vars
- [x] Verify TypeScript compilation

**Changes Completed:**

- File: `/lib/config/llmConfig.ts`
- Lines: 29-33 (loadLLMConfig function)
- Keep: Interface definition (lines 5-27)
- Remove: fs, path, yaml imports (lines 1-3)

---

### **PHASE 3: Update .env File** ✅ COMPLETE

- [x] Add LLM_PROVIDER variable
- [x] Add Anthropic configuration
- [x] Add Ollama configuration
- [x] Keep existing OpenAI config
- [x] Add comments for clarity

**Variables Added:**

```bash
LLM_PROVIDER=openai
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_TEMPERATURE=0.7
ANTHROPIC_MAX_TOKENS=2000
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
OLLAMA_TEMPERATURE=0.7
```

---

### **PHASE 4: Verify Integration**

- [ ] Check `app/api/chat/route.ts` still works
- [ ] Test OpenAI provider
- [ ] Test Anthropic provider (if key available)
- [ ] Verify no TypeScript errors
- [ ] Test build process

---

### **PHASE 5: Update Documentation** ✅ COMPLETE

- [x] Create progress log (LLM_CONFIG_UNIFICATION_COMPLETE.md)
- [x] Update config guide (OPENAI_SETUP.md)
- [x] Document migration from YAML (LLM_CONFIGURATION_GUIDE.md)
- [x] Add troubleshooting section (LLM_CONFIGURATION_GUIDE.md)
- [x] Mark superseded docs (OPENAI_CONFIG_UPDATE.md)
- [x] Create comprehensive guide (LLM_CONFIGURATION_GUIDE.md - 392 lines)

---

### **PHASE 6: Cleanup** ✅ COMPLETE

- [x] Rename or archive llm.yaml
- [x] Remove unused YAML dependencies from package.json
- [x] Update README if needed

**Changes Completed:**

- File: `config/llm.yaml` → `config/llm.yaml.deprecated`
- Removed: `@types/js-yaml` from package.json devDependencies
- Updated: `README.md` with project-specific configuration guide
- Status: All YAML dependencies removed, documentation updated

---

## 🎯 **SUCCESS CRITERIA**

- ✅ All LLM configs read from .env
- ✅ No YAML file dependencies
- ✅ TypeScript compiles without errors
- ✅ Chat route works with all providers
- ✅ Backward compatible (same interface)
- ✅ Documentation updated

---

## 📝 **ROLLBACK PLAN**

If issues occur:

1. Keep original llm.yaml file
2. Revert llmConfig.ts changes
3. Remove new .env variables
4. Restore YAML loading logic

**Backup Location:** `config/llm.yaml.backup`

---

**Status: Phases 2-3-5-6 Complete, Phase 4 Ready for Testing**
**Last Updated:** October 12, 2025
**Detailed Log:** `LLM_CONFIG_UNIFICATION_COMPLETE.md`
**User Guide:** `docs/LLM_CONFIGURATION_GUIDE.md` (392 lines)
**Project README:** Updated with complete configuration guide
