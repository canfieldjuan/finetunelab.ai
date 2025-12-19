# AI Model Coordination Files

**Purpose:** These files are shared context for multiple AI models working on the same codebase.

---

## 📚 How to Use These Files

### For AI Models:

**Before starting work:**
1. Read the relevant coordination file for your domain
2. Check what other models are working on
3. Note any contracts, patterns, or decisions you need to follow

**While working:**
1. Update the coordination file with your changes
2. Leave notes for other models about decisions made
3. Document any new patterns or contracts

**After completing work:**
1. Update status from "In Progress" to "Complete"
2. Document what you built and where
3. Note any follow-up work needed

### For Developers (You):

Use these files to:
- See what each AI model is working on
- Understand decisions made during development
- Track integration points between models
- Plan future work distribution

---

## 📁 Coordination Files

### Core Coordination

**API_COORDINATION.md**
- API endpoint contracts (paths, methods, request/response formats)
- Authentication requirements
- Error response patterns
- Used by: Claude (backend), Copilot (frontend)

**TYPES_COORDINATION.md**
- Shared TypeScript types
- Database schema types
- API response types
- Used by: Both models

**PATTERNS_COORDINATION.md**
- Code patterns to follow
- Naming conventions
- File structure patterns
- Used by: Both models

### Domain-Specific Coordination

**TRAINING_COORDINATION.md**
- Training system work
- RunPod deployment patterns
- Training API contracts
- Used by: Claude (Python/backend)

**UI_COORDINATION.md**
- React component patterns
- Styling guidelines
- Component composition patterns
- Used by: Copilot (frontend)

**DATABASE_COORDINATION.md**
- Database schema changes
- Migration tracking
- RLS policies
- Used by: Claude (backend)

---

## 🔄 Workflow with Coordination Files

```
1. Read coordination file
   └─ Understand current state, patterns, contracts

2. Create branch for your work
   └─ git checkout -b claude/feature

3. Update coordination file
   └─ Mark what you're working on as "In Progress"
   └─ Document decisions as you make them

4. Commit coordination file WITH your code
   └─ git add .github/ai-coordination/API_COORDINATION.md
   └─ git commit -m "feat: add training stats API + update coordination"

5. Other models see your updates
   └─ They read coordination file before starting related work
   └─ They follow contracts you documented
```

---

## 📝 Template Format

Each coordination file follows this structure:

```markdown
# [Domain] Coordination

## Current Work

### In Progress
- **Model:** Claude
- **Branch:** claude/feature-name
- **Work:** Description of what's being built
- **Started:** 2025-12-19

### Recently Completed
- **Feature:** Training stats API
- **Completed:** 2025-12-19
- **Files:** app/api/training/stats/route.ts

## Contracts

### API Endpoints
[Document endpoint contracts here]

### Types
[Document shared types here]

### Patterns
[Document patterns to follow here]

## Decisions Log
[Record important decisions here]

## TODOs
- [ ] Thing that needs to be done
```

---

## 🚨 Important Rules

1. **Always update coordination files in the same commit as your code**
   - Keeps coordination in sync with actual code changes

2. **Never delete information - mark as complete**
   - Coordination files are a history log
   - Move completed items to "Recently Completed" section

3. **Be specific and clear**
   - Other models need to understand without asking questions
   - Include file paths, type names, exact patterns

4. **Update when decisions change**
   - If you change a contract, update the coordination file
   - Note WHY the change was made

5. **Read before writing**
   - Always check coordination files before starting work
   - Prevents conflicting implementations

---

## 📍 When to Create New Coordination Files

Create a new coordination file when:
- A new major system is being developed
- Multiple models will work on related features
- Complex integration is required
- Contracts need to be documented

Examples:
- `PAYMENTS_COORDINATION.md` - When building payment system
- `ANALYTICS_COORDINATION.md` - When building analytics features
- `AUTH_COORDINATION.md` - When working on authentication

---

**Last Updated:** 2025-12-19
