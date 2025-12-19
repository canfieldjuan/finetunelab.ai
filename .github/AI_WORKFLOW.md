# AI Multi-Model Development Workflow

**Building with multiple AI models simultaneously - A coordination guide**

---

## 🤖 The Vision

You're not just a solo developer anymore. You're orchestrating a team of AI models:

- **Claude (Terminal)** - Backend, Python, infrastructure, data pipelines
- **Copilot Chat** - Frontend, React, UI/UX, TypeScript
- **Future models** - Testing, documentation, DevOps, etc.

Each model has strengths. Git lets them work in parallel without stepping on each other.

---

## 🎯 Core Principle: Domain Separation

**Assign each model to specific areas of the codebase:**

### Claude (Terminal) - Backend & Infrastructure
```
✅ lib/training/          - Python training scripts
✅ lib/graphrag/          - GraphRAG implementation
✅ app/api/               - API routes (backend logic)
✅ supabase/migrations/   - Database migrations
✅ scripts/               - Build scripts, automation
✅ Deployment configs     - Docker, Render, RunPod
✅ Python packages        - python-package/
```

### Copilot Chat - Frontend & UI
```
✅ app/                   - Next.js pages (UI)
✅ components/            - React components
✅ hooks/                 - Custom React hooks
✅ styles/                - CSS/Tailwind
✅ public/                - Static assets
✅ TypeScript types       - UI-related types
✅ packages/finetune-lab-sdk/  - TypeScript SDK
```

### Shared Territory (Coordinate)
```
⚠️  lib/                 - Shared utilities (both models may touch)
⚠️  types/               - Shared type definitions
⚠️  .env files           - Configuration (coordinate changes)
⚠️  package.json         - Dependencies (coordinate updates)
```

---

## 🌿 Branch Naming Convention

**Prefix branches by model to track who's working on what:**

### Claude (Terminal):
```bash
claude/fix-runpod-alerts
claude/add-graphrag-search
claude/improve-training-metrics
claude/hotfix-payment-crash
```

### Copilot Chat:
```bash
copilot/billing-dashboard
copilot/settings-page
copilot/dark-mode-toggle
copilot/chart-components
```

### Shared/Coordinated Work:
```bash
shared/api-contract-update
shared/type-definitions
team/database-migration
```

**View all branches by model:**
```bash
git branch | grep claude/
git branch | grep copilot/
```

---

## 📅 Daily Multi-Model Workflow

### Morning Sync (Both Models Start Fresh)

```bash
# Pull latest changes
git checkout main
git pull origin main

# Claude starts backend work
git checkout -b claude/training-improvements

# Copilot starts frontend work
git checkout -b copilot/analytics-dashboard
```

**Both models work independently throughout the day.**

---

### During Development (Parallel Work)

**Claude (Terminal):**
```bash
# Working on lib/training/standalone_trainer.py
git add lib/training/
git commit -m "feat: add alert notifications to training"
git push origin claude/training-improvements
```

**Copilot Chat:**
```bash
# Working on components/analytics/Dashboard.tsx
git add components/analytics/
git commit -m "feat: add real-time metrics charts"
git push origin copilot/analytics-dashboard
```

**Zero conflicts** - different files, different domains.

---

### Merge Coordination (You Decide Order)

**Option 1: Sequential Merging (Safest)**

```bash
# End of day: Merge Claude's work first
git checkout main
git merge claude/training-improvements
npm run build  # Test
git push origin main  # Deploy

# Then merge Copilot's work
git merge copilot/analytics-dashboard
npm run build  # Test
git push origin main  # Deploy

# Clean up
git branch -D claude/training-improvements
git branch -D copilot/analytics-dashboard
```

**Option 2: Review Both, Merge Together**

```bash
# Review both branches
git diff main..claude/training-improvements
git diff main..copilot/analytics-dashboard

# Merge both if no conflicts expected
git checkout main
git merge claude/training-improvements
git merge copilot/analytics-dashboard
npm run build  # Test everything together
git push origin main
```

---

## 🔄 Staying Synchronized During Long Work

**Scenario:** Claude ships a fix while Copilot is still working on a feature.

**Claude merges to main:**
```bash
git checkout main
git merge claude/fix-alerts
git push origin main  # Now main has the alert fix
```

**Copilot needs this fix in their branch:**
```bash
# Copilot is on copilot/analytics-dashboard
git checkout main
git pull  # Get Claude's alert fix

git checkout copilot/analytics-dashboard
git merge main  # Bring Claude's fix into Copilot's branch

# Now Copilot has the latest alert code
git commit -m "merge: sync with main (includes alert fix)"
```

---

## ⚔️ Handling Conflicts

### When Conflicts Are Expected

**Scenario:** Both models edit the same file for related features.

**Claude adds training API:**
```typescript
// app/api/training/route.ts
export async function POST(request: NextRequest) {
  // Training logic
}
```

**Copilot adds training UI:**
```typescript
// app/training/page.tsx
export default function TrainingPage() {
  // Calls /api/training
}
```

**No conflict** - Different files.

---

**Scenario:** Both models edit the same navigation component.

**Claude adds:**
```typescript
// components/layout/Sidebar.tsx
<Link href="/training">Training</Link>
```

**Copilot adds:**
```typescript
// components/layout/Sidebar.tsx
<Link href="/analytics">Analytics</Link>
```

**Conflict happens during merge:**
```typescript
<<<<<<< HEAD
<Link href="/training">Training</Link>
=======
<Link href="/analytics">Analytics</Link>
>>>>>>> copilot/analytics-dashboard
```

**Resolution (keep both):**
```typescript
<Link href="/training">Training</Link>
<Link href="/analytics">Analytics</Link>
```

```bash
git add components/layout/Sidebar.tsx
git commit -m "merge: add both training and analytics nav links"
```

---

### Communication Through Commits

**Claude leaves a note for Copilot:**
```bash
git commit -m "feat: add STRIPE_WEBHOOK_URL env var

Copilot: Use this in the billing webhook handler.
Example: process.env.STRIPE_WEBHOOK_URL"
```

**Copilot sees it when merging:**
```bash
git log --oneline
ca3de5d feat: add STRIPE_WEBHOOK_URL env var
```

Now Copilot knows what to use!

---

## 🎨 Model Strengths & Task Assignment

### Assign Tasks Based on Model Strengths

**Claude (Terminal) is best at:**
- Complex backend logic
- Python code (training, GraphRAG)
- Database queries and migrations
- API endpoint implementation
- Performance optimization
- Debugging production issues
- Infrastructure configuration
- Shell scripting

**Copilot Chat is best at:**
- UI component creation
- React/Next.js patterns
- TypeScript interfaces
- CSS/styling
- Form validation
- Client-side state management
- Interactive features
- Accessibility improvements

**Example Task Distribution:**

```
Feature: "Add billing dashboard with usage charts"

Claude (Terminal):
├─ Create /api/billing/usage endpoint
├─ Write SQL query for usage aggregation
├─ Add database indexes for performance
└─ Set up Stripe webhook handler

Copilot Chat:
├─ Create BillingDashboard component
├─ Build UsageChart with recharts
├─ Add loading states and error handling
└─ Style with Tailwind CSS
```

---

## 📋 Pre-Merge Checklist for AI Work

**Before merging any AI branch to main:**

### Technical Checks:
- [ ] `npm run build` passes
- [ ] No TypeScript errors
- [ ] No console.logs left in code
- [ ] No hardcoded values (use env vars)
- [ ] No placeholder/TODO comments without issues

### Code Quality:
- [ ] No duplicate code between branches
- [ ] Follows existing patterns in codebase
- [ ] Error handling is present
- [ ] Edge cases are covered

### Integration:
- [ ] Doesn't break existing features
- [ ] Works with other model's recent changes
- [ ] API contracts match between frontend/backend
- [ ] Types are shared correctly

### Git Hygiene:
- [ ] Branch has descriptive commits
- [ ] No "wip" or "asdf" commits on main
- [ ] Merge conflicts resolved correctly
- [ ] Unnecessary files not committed

---

## 🚨 Emergency: Both Models Broke Production

**Scenario:** Main is broken, need to figure out which model's code caused it.

### Step 1: Identify the Problem
```bash
# Check recent merges
git log --oneline --merges -5

# Outputs:
# abc123 Merge branch 'copilot/billing'
# def456 Merge branch 'claude/training'
```

### Step 2: Revert Suspects One at a Time
```bash
# Revert most recent merge first
git revert -m 1 abc123  # Revert copilot/billing merge
npm run build           # Test

# Still broken? Revert the other one
git revert -m 1 def456  # Revert claude/training merge
npm run build           # Test
```

### Step 3: Fix and Re-apply
```bash
# Found the issue in copilot/billing
git checkout copilot/billing
# Fix the bug
git commit -m "fix: billing calculation error"

git checkout main
git merge copilot/billing  # Re-merge with fix
```

---

## 🎯 Advanced: Feature Flags for AI Work

**Use feature flags to merge incomplete work safely:**

### Claude adds backend (complete):
```typescript
// app/api/billing/route.ts
export async function GET() {
  if (process.env.BILLING_FEATURE === 'true') {
    // New billing logic
  } else {
    // Old logic
  }
}
```

### Copilot adds frontend (incomplete):
```typescript
// app/billing/page.tsx
export default function BillingPage() {
  if (process.env.NEXT_PUBLIC_BILLING_FEATURE !== 'true') {
    return <div>Coming soon...</div>
  }
  // New billing UI
}
```

**Both merge to main with feature flag OFF:**
- Production unaffected
- Both models' code is integrated
- Enable flag when both sides are ready

```bash
# .env.production
BILLING_FEATURE=false
NEXT_PUBLIC_BILLING_FEATURE=false

# When ready:
BILLING_FEATURE=true
NEXT_PUBLIC_BILLING_FEATURE=true
```

---

## 📊 Tracking Multi-Model Contributions

### See What Each Model Built:
```bash
# Claude's contributions
git log --author="Claude" --oneline
git log --grep="claude/" --oneline

# Copilot's contributions
git log --grep="copilot/" --oneline

# Lines of code by model (branches)
git log --shortstat --grep="claude/" | grep "files changed"
git log --shortstat --grep="copilot/" | grep "files changed"
```

### Visualize Parallel Work:
```bash
git log --graph --oneline --all --decorate
```

Output:
```
*   Merge branch 'copilot/billing'
|\
| * feat: add billing charts
| * feat: add usage display
* | Merge branch 'claude/training'
|/
| * fix: restore training alerts
| * feat: add metrics API
```

---

## 🔧 Tools & Setup

### VS Code Extensions (Helpful for Coordination):

**GitLens** - See which model changed each line:
```
Line 45: claude/training (2h ago) - "fix: add alert"
Line 46: copilot/billing (1h ago) - "feat: add chart"
```

**Git Graph** - Visual branch timeline:
- See parallel work
- Identify merge points
- Spot conflicts before merging

### GitHub Settings:

**Branch Protection (Optional):**
- Require pull request reviews (review AI work)
- Require status checks to pass (CI/CD)
- Don't allow force push to main

---

## 🎓 Best Practices

### 1. Start Each Session Fresh
```bash
git checkout main && git pull
```
Both models always start from latest main.

### 2. Commit Often, Push Frequently
```bash
# Every logical checkpoint
git add . && git commit -m "feat: add X"
git push origin claude/feature  # Backup work
```

### 3. Keep Branches Short-Lived
- Merge within 1-2 days
- Long branches = more conflicts
- Small features = easy merges

### 4. Use Descriptive Branch Names
```bash
# ❌ Bad
git checkout -b fix

# ✅ Good
git checkout -b claude/fix-runpod-alert-notifications
```

### 5. Review AI Code Before Merging
```bash
# View all changes
git diff main..claude/feature

# Check for:
# - Hardcoded values
# - Missing error handling
# - Unnecessary complexity
# - Breaking changes
```

### 6. Coordinate on Shared Files
**Before editing shared file:**
```bash
# Check if other model recently touched it
git log -- lib/shared/utils.ts

# If yes, coordinate:
# - Merge their changes first
# - Then make your edits
```

### 7. Document Model Decisions
```bash
# Claude makes a choice
git commit -m "feat: use PostgreSQL for analytics

Decision: PostgreSQL over MongoDB because:
- Better TypeScript support
- Proven for time-series data
- Team familiarity

Copilot: Use pg client in analytics queries"
```

---

## 🚀 Real-World Example: Full Feature

**Feature:** "Add real-time training metrics dashboard"

### Phase 1: Planning (You Coordinate)
```
Claude will handle:
- Backend metrics API
- Database schema
- Websocket server

Copilot will handle:
- Dashboard UI
- Chart components
- Real-time updates
```

### Phase 2: Parallel Development

**Claude (Terminal):**
```bash
git checkout -b claude/metrics-backend

# Day 1
git commit -m "feat: add metrics database table"
git commit -m "feat: add POST /api/metrics endpoint"

# Day 2
git commit -m "feat: add websocket server for real-time updates"
git push origin claude/metrics-backend
```

**Copilot (Chat):**
```bash
git checkout -b copilot/metrics-dashboard

# Day 1
git commit -m "feat: create MetricsDashboard component"
git commit -m "feat: add LineChart component"

# Day 2
git commit -m "feat: add websocket client hook"
git commit -m "feat: connect dashboard to real-time data"
git push origin copilot/metrics-dashboard
```

### Phase 3: Integration

```bash
# Merge backend first
git checkout main
git merge claude/metrics-backend
npm run build && npm test
git push origin main

# Merge frontend second
git merge copilot/metrics-dashboard
npm run build && npm test
git push origin main

# Clean up branches
git branch -D claude/metrics-backend
git branch -D copilot/metrics-dashboard
```

### Phase 4: Verify
```bash
# Check it works together
npm run dev
# Open http://localhost:3000/metrics
# Verify real-time updates work
```

---

## 📝 Quick Command Reference

### Start Multi-Model Work:
```bash
# Claude starts backend work
git checkout -b claude/feature-name

# Copilot starts frontend work
git checkout -b copilot/feature-name
```

### Sync During Work:
```bash
# Get latest main
git checkout main && git pull

# Merge into your branch
git checkout claude/feature-name
git merge main
```

### Merge Coordination:
```bash
# Review both branches
git diff main..claude/feature
git diff main..copilot/feature

# Merge both
git checkout main
git merge claude/feature
git merge copilot/feature
git push origin main
```

### Emergency Revert:
```bash
# Undo last merge
git revert -m 1 HEAD

# Undo specific merge
git revert -m 1 <commit-hash>
```

---

## 🎯 Success Metrics

**You'll know the AI workflow is working when:**

✅ Multiple features ship per day (parallel work)
✅ Merge conflicts are rare (<10% of merges)
✅ Production deployments are stable (AI work is reviewed)
✅ Each model stays in its domain (clear separation)
✅ Git history is readable (descriptive commits)
✅ Features integrate smoothly (good communication)

---

## 🎓 Level Up: 3+ AI Models

**When you add more models:**

```bash
# Claude Terminal - Backend/infra
claude/fix-database-performance

# Copilot Chat - Frontend/UI
copilot/redesign-settings-page

# ChatGPT - Testing/docs
chatgpt/add-e2e-tests

# GitHub Copilot - Code review
copilot-review/suggest-optimizations
```

**Coordination strategy:**
1. Assign clear domains (no overlap)
2. Use descriptive branch prefixes
3. Merge one at a time
4. Review each model's work
5. Keep communication in commits

---

## 📚 Further Reading

- `CONTRIBUTING.md` - General Git workflow
- `.github/workflows/` - CI/CD for automated testing
- `docs/ARCHITECTURE.md` - Codebase structure guide

---

**Remember:** You're the architect. AI models are the builders.

Git is your coordination tool. Use it well, and you'll ship 10x faster than solo dev.

---

**Last Updated:** 2025-12-19

**Questions?** Check examples above or ask any AI model to explain a concept.
