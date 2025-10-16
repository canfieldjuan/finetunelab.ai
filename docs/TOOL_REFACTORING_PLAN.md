# ⚠️ DEPRECATED - Tool System Refactoring Plan

> **STATUS:** DEPRECATED - October 13, 2025
>
> **REASON:** This tool system refactoring has been completed and superseded by the completion document.
>
> **SUPERSEDED BY:**
> - `TOOL_REFACTORING_COMPLETE.md` (full implementation summary)
>
> **DO NOT USE THIS PLAN** - Implementation is complete. Tool system is now fully modular with calculator, datetime, and web-search modules.

---

# Tool System Refactoring Plan

**Date:** October 10, 2025
**Objective:** Modular, extensible, configurable tool architecture  

---

## CURRENT STATE ANALYSIS

### Existing Files (Verified)

```
/lib/tools/
  ├── builtinTools.ts (170 lines) - MONOLITHIC, needs breaking up
  ├── toolManager.ts (175 lines) - imports builtinTools
  └── index.ts (30 lines) - exports builtinTools

Dependencies:
  - toolManager.ts imports from builtinTools.ts (line 6)
  - index.ts exports from builtinTools.ts (lines 6, 10)
  - hooks/useTools.ts imports from lib/tools (line 12)
```

### Issues Identified

1. ❌ All tools in one file (builtinTools.ts)
2. ❌ Mock/stub implementations (web_search)
3. ❌ Hardcoded values (timezone defaults, math functions)
4. ❌ Not modular - can't drop in sophisticated calculator
5. ❌ Not configurable - no config file

---

## TARGET ARCHITECTURE

### New Structure

```
/lib/tools/
  ├── types.ts                    # Shared interfaces (NEW)
  ├── registry.ts                 # Tool registry/loader (NEW)
  ├── config.ts                   # Tool configuration (NEW)
  ├── toolManager.ts              # Updated to use registry
  ├── index.ts                    # Updated exports
  │
  ├── calculator/                 # MODULAR TOOL (NEW)
  │   ├── index.ts               # Tool definition + export
  │   ├── calculator.config.ts   # Configuration
  │   └── calculator.service.ts  # Implementation logic
  │
  ├── datetime/                   # MODULAR TOOL (NEW)
  │   ├── index.ts               # Tool definition + export
  │   ├── datetime.config.ts     # Configuration
  │   └── datetime.service.ts    # Implementation logic
  │
  └── web-search/                 # MODULAR TOOL (NEW)
      ├── index.ts               # Tool definition + export
      ├── search.config.ts       # Configuration
      └── search.service.ts      # Implementation logic
```

### Benefits

✅ Each tool is independent module
✅ Easy to replace (drop in your sophisticated calculator)
✅ Configurable via config files
✅ No hardcoded values
✅ No mock/stub code in production
✅ Easy to add new tools

---

## IMPLEMENTATION PHASES

### Phase 1: Create Core Infrastructure (30 min)

**Files to Create:**

- `/lib/tools/types.ts` - Shared interfaces
- `/lib/tools/config.ts` - Global tool config
- `/lib/tools/registry.ts` - Tool loader/registry

**No existing file changes**

### Phase 2: Create Calculator Module (20 min)

**Files to Create:**

- `/lib/tools/calculator/index.ts`
- `/lib/tools/calculator/calculator.config.ts`
- `/lib/tools/calculator/calculator.service.ts`

**Note:** Basic implementation, ready for your sophisticated one

### Phase 3: Create DateTime Module (20 min)

**Files to Create:**

- `/lib/tools/datetime/index.ts`
- `/lib/tools/datetime/datetime.config.ts`
- `/lib/tools/datetime/datetime.service.ts`

### Phase 4: Create Web Search Module (20 min)

**Files to Create:**

- `/lib/tools/web-search/index.ts`
- `/lib/tools/web-search/search.config.ts`
- `/lib/tools/web-search/search.service.ts`

**Note:** Stub only, ready for your robust implementation

### Phase 5: Update Tool Manager (15 min)

**File to Modify:**

- `/lib/tools/toolManager.ts`

**Changes:**

- Line 6: Remove `import { getToolByName } from './builtinTools'`
- Line 6: Add `import { getToolByName } from './registry'`
- Update executeTool function to use registry

### Phase 6: Update Exports (10 min)

**File to Modify:**

- `/lib/tools/index.ts`

**Changes:**

- Remove builtinTools exports
- Add registry exports
- Export types from types.ts

### Phase 7: Delete Old File (5 min)

**File to Delete:**

- `/lib/tools/builtinTools.ts` (no longer needed)

### Phase 8: Verification (10 min)

- Check TypeScript compilation
- Verify imports work
- Test tool execution
- Update documentation

---

## DETAILED FILE SPECIFICATIONS

### Phase 1.1: types.ts (30 lines)

```typescript
// Core interfaces used by all tools
export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  default?: unknown;
}

export interface ToolConfig {
  enabled: boolean;
  [key: string]: unknown;
}

export interface ToolDefinition {
  name: string;
  description: string;
  version: string;
  parameters: {...};
  config: ToolConfig;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}
```

### Phase 1.2: config.ts (30 lines)

```typescript
// Global tool configuration
export const toolConfig = {
  calculator: {
    enabled: true,
    maxExpressionLength: 1000,
    allowedFunctions: ['sqrt', 'pow', 'sin', 'cos', 'tan']
  },
  datetime: {
    enabled: true,
    defaultTimezone: process.env.DEFAULT_TIMEZONE || 'UTC',
    supportedOperations: ['current', 'convert']
  },
  webSearch: {
    enabled: false, // Disabled until configured
    apiKey: process.env.SEARCH_API_KEY,
    provider: process.env.SEARCH_PROVIDER || 'duckduckgo'
  }
};
```

### Phase 1.3: registry.ts (40 lines)

```typescript
// Tool registry - dynamically loads tools
import { ToolDefinition } from './types';

const tools = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition) {
  tools.set(tool.name, tool);
}

export function getToolByName(name: string): ToolDefinition | undefined {
  return tools.get(name);
}

export function getAllTools(): ToolDefinition[] {
  return Array.from(tools.values());
}

// Auto-register tools on import
import calculator from './calculator';
import datetime from './datetime';
import webSearch from './web-search';

registerTool(calculator);
registerTool(datetime);
registerTool(webSearch);
```

### Phase 2: Calculator Module Structure

```
calculator/
  ├── index.ts (exports tool definition)
  ├── calculator.config.ts (configuration)
  └── calculator.service.ts (implementation)
```

**Note for user:** This is a basic implementation. You can replace calculator.service.ts with your sophisticated calculator project.

### Phase 3: DateTime Module Structure

```
datetime/
  ├── index.ts (exports tool definition)
  ├── datetime.config.ts (configuration)
  └── datetime.service.ts (implementation)
```

### Phase 4: Web Search Module Structure

```
web-search/
  ├── index.ts (exports tool definition)
  ├── search.config.ts (configuration)
  └── search.service.ts (STUB - ready for your robust implementation)
```

---

## FILES REQUIRING CHANGES

### Modified Files (2)

1. `/lib/tools/toolManager.ts`
   - Line 6: Update import
   - Lines 80-120: Update executeTool to use registry

2. `/lib/tools/index.ts`
   - Lines 6-10: Remove builtinTools exports
   - Add new registry exports

### Deleted Files (1)

1. `/lib/tools/builtinTools.ts` - replaced by modular structure

### New Files (13)

1. `/lib/tools/types.ts`
2. `/lib/tools/config.ts`
3. `/lib/tools/registry.ts`
4. `/lib/tools/calculator/index.ts`
5. `/lib/tools/calculator/calculator.config.ts`
6. `/lib/tools/calculator/calculator.service.ts`
7. `/lib/tools/datetime/index.ts`
8. `/lib/tools/datetime/datetime.config.ts`
9. `/lib/tools/datetime/datetime.service.ts`
10. `/lib/tools/web-search/index.ts`
11. `/lib/tools/web-search/search.config.ts`
12. `/lib/tools/web-search/search.service.ts`
13. `/docs/TOOL_MODULE_GUIDE.md` (documentation)

---

## VERIFICATION CHECKLIST

After each phase:

- [ ] TypeScript compiles without errors
- [ ] No broken imports
- [ ] Tool registry loads all tools
- [ ] executeTool still works
- [ ] useTools hook still works
- [ ] Chat integration still works

---

## ROLLBACK STRATEGY

If issues occur:

1. Keep builtinTools.ts until Phase 8
2. Git commit after each phase
3. Can revert individual phases
4. Original exports still work until Phase 6

---

## NEXT STEPS

1. User approval of plan
2. Execute Phase 1 (core infrastructure)
3. Execute Phases 2-4 (create modules)
4. Execute Phases 5-6 (update existing files)
5. Execute Phase 7 (cleanup)
6. Execute Phase 8 (verification)
7. Update session log

---

**Estimated Total Time:** 2 hours
**Risk Level:** Low (phased approach with rollback)
**Breaking Changes:** None (until Phase 7)

**Ready to proceed?**
