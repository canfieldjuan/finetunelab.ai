# Minor Issues & Enhancement Tracking

**Purpose:** Track small issues, UX improvements, and enhancement ideas that don't block functionality but could improve the system.

**Status Legend:**
- 🔴 **Open** - Identified, not yet addressed
- 🟡 **Under Review** - Being evaluated or discussed
- 🟢 **Resolved** - Fixed or implemented
- ⚪ **Deferred** - Low priority, address later

---

## Issue #1: Filesystem Tool - LLM Requires Explicit Full Path Prompting

**Status:** 🔴 Open
**Priority:** Low
**Date Identified:** 2025-10-15
**Category:** Tool Usage / UX

### Current Behavior
The LLM does not proactively use the filesystem tool unless explicitly instructed with a full file path. For example:
- ❌ "Read the package.json file" - LLM doesn't use filesystem tool
- ✅ "Use the filesystem tool to read /home/juanc/Desktop/claude_desktop/web-ui/package.json" - Works

### Root Cause Analysis
Possible reasons:
1. **Tool description may not be clear enough** - LLM doesn't understand when to use it
2. **No context awareness** - LLM doesn't know which files exist without being told
3. **Path ambiguity** - LLM may not know the full path structure
4. **Tool selection priority** - Other tools may be preferred over filesystem

### Proposed Solutions

#### Option A: Enhance Tool Description (Easiest)
**Change:** Update `filesystem.tool.ts` description to include examples and use cases.

**Current:**
```typescript
description: 'Read-only filesystem operations with comprehensive security validation. List directories, read files, and get file information safely.'
```

**Proposed:**
```typescript
description: 'Read-only filesystem operations. Use this tool when the user asks to read, check, or list files/directories. Examples: "read package.json", "list files in src/", "check if config.yaml exists". Supports operations: list_directory, read_file, file_info. Allowed paths: [list from config].'
```

#### Option B: Add Context File Awareness (Medium)
Create a context file that lists common project files the LLM can reference:
- `.llmcontext` file listing project structure
- Auto-generated on startup
- LLM can check this before making assumptions

**Example `.llmcontext`:**
```
# Project Structure Context
- package.json
- tsconfig.json
- README.md
- /src
- /lib
- /components
```

#### Option C: Implement File Discovery Tool (Advanced)
Add a lightweight "discover_files" operation that:
- Lists common files in project root
- Returns file tree on demand
- Helps LLM understand what's available

**Implementation:**
```typescript
operation: 'discover_common_files'
// Returns: package.json, tsconfig.json, README.md, etc.
```

#### Option D: System Prompt Enhancement (Quick Fix)
Add to the system prompt:
> "When users ask about files (e.g., 'read package.json', 'check the config'), use the filesystem tool with the project root path: /home/juanc/Desktop/claude_desktop/web-ui/"

### Testing Scenarios
After implementing a solution, test these prompts:
1. "What's in package.json?"
2. "Read the README file"
3. "List files in the components directory"
4. "Check if tools.config.yaml exists"
5. "Show me the tsconfig"

### Decision
**Current Status:** Deferred for discussion
**Reasoning:** Filesystem tool works correctly when used. This is a UX/convenience issue, not a bug.

**Next Steps:**
- [ ] Discuss which solution makes most sense
- [ ] Test Option A (enhance description) first - lowest effort
- [ ] If Option A insufficient, consider Option D (system prompt)
- [ ] Keep Options B & C as future enhancements

---

## Issue #2: [Template for Future Issues]

**Status:** 🔴 Open
**Priority:** [Low/Medium/High]
**Date Identified:** YYYY-MM-DD
**Category:** [Tool Usage / UX / Performance / Security / etc.]

### Current Behavior
[Describe what happens now]

### Root Cause Analysis
[Why does this happen?]

### Proposed Solutions
[List potential fixes with pros/cons]

### Testing Scenarios
[How to verify the fix works]

### Decision
[What was decided and why]

---

**Last Updated:** 2025-10-15
**Total Open Issues:** 1
**Total Resolved Issues:** 0
