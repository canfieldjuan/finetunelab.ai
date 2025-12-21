# CI/CD Guide for FinetuneLab

## Overview

This project uses GitHub Actions for continuous integration and deployment. The workflows automatically test, build, and deploy code when AI models (Claude, Copilot, etc.) push branches.

---

## 🔄 Workflows

### 1. CI - Continuous Integration (`ci.yml`)

**Triggers:** All pushes and PRs to main, develop, and AI branches
**Purpose:** Validate code quality before merging

**Steps:**
- Lint code (ESLint)
- Type check (TypeScript)
- Run unit tests (Jest + Vitest)
- Build application
- Security audit

**When it runs:**
```bash
git push origin claude/new-feature  # ✅ CI runs automatically
git push origin copilot/ui-update   # ✅ CI runs automatically
```

### 2. AI Branch Quality Check (`ai-branch-check.yml`)

**Triggers:** Pushes to `claude/**`, `copilot/**`, `chatgpt/**` branches
**Purpose:** Extra quality checks for AI-generated code

**Checks:**
- ❌ Fails if console.log found
- ❌ Fails if hardcoded secrets detected
- ⚠️  Warns about TODO comments
- ✅ Runs linter and tests

**Example:**
```bash
# Claude pushes code
git push origin claude/backend-api

# GitHub Actions checks:
# - No console.logs
# - No hardcoded API keys
# - Tests pass
# - Types are correct
```

### 3. Integration Tests (`integration-test.yml`)

**Triggers:** Pushes to `test/**` branches
**Purpose:** Test combined work from multiple AI models

**When to use:**
```bash
# After both models finish their branches
git checkout -b test/feature-integration
git merge claude/backend-api
git merge copilot/frontend-ui
git push origin test/feature-integration

# GitHub Actions will:
# - Run full test suite
# - Build application
# - Start server
# - Run smoke tests
# - Comment on PR if tests pass
```

### 4. Deploy to Staging (`deploy-staging.yml`)

**Triggers:** Pushes to `develop` or `test/**` branches
**Purpose:** Deploy to staging environment for testing

**Steps:**
- Run tests
- Build with staging environment variables
- Deploy to Render (staging)
- Notify deployment URL

**Example:**
```bash
git checkout develop
git merge test/feature-integration
git push origin develop

# Deploys to: https://staging.finetunelab.ai
```

### 5. Deploy to Production (`deploy-production.yml`)

**Triggers:** Pushes to `main` branch
**Purpose:** Deploy to production

**Steps:**
- Run all tests
- Build with production environment variables
- Deploy to Render (production)
- Run smoke tests
- Notify success/failure

**Example:**
```bash
git checkout main
git merge develop
git push origin main

# Deploys to: https://finetunelab.ai
```

### 6. Dependency Updates (`dependency-update.yml`)

**Triggers:** Every Monday at 9 AM UTC + manual
**Purpose:** Check for outdated packages and security issues

**Actions:**
- Check outdated packages
- Run security audit
- Create GitHub issue with update recommendations

---

## 🛠️ Setup Instructions

### 1. GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

**Render Deployment:**
```
RENDER_API_KEY=your_render_api_key
RENDER_STAGING_SERVICE_ID=your_staging_service_id
RENDER_PRODUCTION_SERVICE_ID=your_production_service_id
```

To get these values:
1. Go to Render Dashboard → Account Settings → API Keys
2. Create a new API key and copy it
3. For service IDs, go to each service and copy the ID from the URL (e.g., `srv-xxxxxxxxxxxxx`)

**Staging Environment:**
```
STAGING_SUPABASE_URL=https://your-staging.supabase.co
STAGING_SUPABASE_ANON_KEY=your_staging_anon_key
```

**Production Environment:**
```
PRODUCTION_SUPABASE_URL=https://your-prod.supabase.co
PRODUCTION_SUPABASE_ANON_KEY=your_prod_anon_key
```

**Testing:**
```
TEST_SUPABASE_URL=https://your-test.supabase.co
TEST_SUPABASE_ANON_KEY=your_test_anon_key
```

### 2. Branch Protection Rules

Configure in GitHub: Settings → Branches → Add rule

**For `main` branch:**
- ✅ Require pull request reviews before merging
- ✅ Require status checks to pass before merging
  - CI / Lint Code
  - CI / TypeScript Type Check
  - CI / Run Tests
  - CI / Build Application
- ✅ Require branches to be up to date before merging
- ✅ Include administrators

**For `develop` branch:**
- ✅ Require status checks to pass before merging
- ✅ Require branches to be up to date before merging

### 3. GitHub Environments

Create environments (Settings → Environments):

**Staging:**
- Name: `staging`
- Deployment branch: `develop`, `test/**`
- URL: https://staging.finetunelab.ai

**Production:**
- Name: `production`
- Deployment branch: `main` only
- URL: https://finetunelab.ai
- ✅ Required reviewers: Add yourself
- ✅ Wait timer: 5 minutes (safety buffer)

---

## 🚀 Workflow for AI Multi-Model Development

### Scenario: Claude builds backend, Copilot builds frontend

**Day 1: Both models start work**

```bash
# Claude starts
git checkout -b claude/metrics-api
# ... makes changes to lib/api/metrics.ts
git push origin claude/metrics-api
# ✅ CI runs automatically (lint, test, build)

# Copilot starts
git checkout -b copilot/metrics-dashboard
# ... makes changes to components/MetricsDashboard.tsx
git push origin copilot/metrics-dashboard
# ✅ CI runs automatically (lint, test, build)
```

**Day 2: Integration testing**

```bash
# Create integration branch
git checkout -b test/metrics-feature
git merge claude/metrics-api
git merge copilot/metrics-dashboard
git push origin test/metrics-feature

# ✅ Integration Tests workflow runs
# ✅ Builds and tests combined code
# ✅ Comments on PR if tests pass
```

**Day 3: Deploy to staging**

```bash
# Merge to develop
git checkout develop
git merge test/metrics-feature
git push origin develop

# ✅ Deploy to Staging workflow runs
# ✅ Deploys to https://staging.finetunelab.ai
# ✅ Test manually in staging environment
```

**Day 4: Deploy to production**

```bash
# Merge to main
git checkout main
git merge develop
git push origin main

# ✅ Deploy to Production workflow runs
# ✅ All tests run again
# ✅ Deploys to https://finetunelab.ai
# ✅ Smoke tests verify deployment
```

---

## 📊 Monitoring CI/CD

### View Workflow Runs

**GitHub UI:**
1. Go to repository → Actions tab
2. See all workflow runs
3. Click any run to see details
4. View logs for each step

**Useful filters:**
- Filter by workflow name
- Filter by branch (e.g., `claude/*`)
- Filter by status (success, failure)

### Check Status Badges

Add to README.md:

```markdown
![CI Status](https://github.com/canfieldjuan/finetunelab.ai/actions/workflows/ci.yml/badge.svg)
![Deployment](https://github.com/canfieldjuan/finetunelab.ai/actions/workflows/deploy-production.yml/badge.svg)
```

### Notifications

**Get notified when workflows fail:**
1. GitHub → Settings → Notifications
2. Enable "Actions" notifications
3. Choose email or GitHub notifications

---

## 🔧 Customizing Workflows

### Add More Checks

Edit `.github/workflows/ci.yml`:

```yaml
# Add code coverage check
- name: Check code coverage
  run: npm run test:vitest:coverage -- --coverage.threshold.lines=80

# Add E2E tests
- name: Run E2E tests
  run: npm run test:e2e
```

### Add Slack Notifications

Add to any workflow:

```yaml
- name: Notify Slack
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: 'Build failed on ${{ github.ref_name }}'
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### Add Performance Testing

Create `.github/workflows/performance.yml`:

```yaml
name: Performance Tests

on:
  push:
    branches: [main, develop]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: treosh/lighthouse-ci-action@v10
        with:
          urls: |
            https://staging.finetunelab.ai
          uploadArtifacts: true
```

---

## ⚠️ Troubleshooting

### Workflow fails on "npm ci"

**Problem:** Package-lock.json is out of sync

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
git add package-lock.json
git commit -m "fix: update package-lock.json"
```

### Workflow fails on "npm test"

**Problem:** Tests fail in CI but pass locally

**Solution:**
- Check environment variables are set in GitHub Secrets
- Ensure tests don't depend on local state
- Run tests in CI mode locally: `CI=true npm test`

### Deployment fails

**Problem:** Missing environment variables

**Solution:**
1. Check GitHub Secrets are set correctly
2. Verify Vercel token is valid
3. Check environment names match (staging vs production)

### CI is too slow

**Problem:** Workflows take >10 minutes

**Solution:**
- Cache dependencies: Already done with `cache: 'npm'`
- Parallelize jobs: Already done (lint, test, type-check run in parallel)
- Skip jobs on docs changes:
  ```yaml
  on:
    push:
      paths-ignore:
        - '**.md'
        - 'docs/**'
  ```

---

## 📈 Best Practices

### 1. Fast Feedback

**Goal:** Get CI results in <5 minutes

- ✅ Parallelize independent jobs
- ✅ Cache dependencies
- ✅ Run unit tests before slow E2E tests
- ✅ Skip unnecessary steps for doc changes

### 2. Clear Failure Messages

**Make failures obvious:**
```yaml
- name: Run tests
  run: npm test
  continue-on-error: false  # Fail immediately

- name: Show failure info
  if: failure()
  run: |
    echo "❌ Tests failed!"
    echo "View logs above for details"
```

### 3. Safe Deployments

**Prevent bad deploys:**
- ✅ Require all checks to pass before merging
- ✅ Deploy to staging first
- ✅ Manual approval for production
- ✅ Smoke tests after deployment
- ✅ Rollback plan (revert commit)

### 4. AI Code Quality

**Enforce standards for AI-generated code:**
- ✅ No console.logs
- ✅ No hardcoded secrets
- ✅ No placeholder comments
- ✅ Tests pass
- ✅ Types are correct

### 5. Regular Maintenance

**Keep workflows healthy:**
- ✅ Update actions to latest versions monthly
- ✅ Review dependency updates weekly
- ✅ Monitor workflow run times
- ✅ Remove unused workflows

---

## 🎯 Next Steps

1. **Set up GitHub Secrets** (required for deployment)
2. **Configure branch protection** (prevent direct pushes to main)
3. **Test workflows** (push a test branch)
4. **Monitor first deployment** (watch Actions tab)
5. **Customize for your needs** (add team-specific checks)

---

## 📚 Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Render Deployment with GitHub Actions](https://render.com/docs/deploy-hooks)
- [Next.js CI/CD Best Practices](https://nextjs.org/docs/deployment)
- [AI_WORKFLOW.md](./AI_WORKFLOW.md) - Multi-model development guide

---

**Questions?** Check workflow logs in Actions tab or review examples above.

**Last Updated:** 2025-12-20
