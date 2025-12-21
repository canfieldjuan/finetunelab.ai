# Render Deployment Guide - FinetuneLab

Complete guide for deploying FinetuneLab to Render with automated CI/CD using GitHub Actions.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Initial Render Setup](#initial-render-setup)
4. [GitHub Secrets Configuration](#github-secrets-configuration)
5. [CI/CD Pipeline](#cicd-pipeline)
6. [Deployment Flow](#deployment-flow)
7. [Troubleshooting](#troubleshooting)
8. [Monitoring](#monitoring)

---

## 🎯 Overview

### Architecture

```
┌─────────────┐
│   GitHub    │
│ Repository  │
└──────┬──────┘
       │ Push code
       ▼
┌─────────────────────────────────────┐
│     GitHub Actions CI/CD            │
├─────────────────────────────────────┤
│  1. Lint (ESLint)                   │
│  2. Type Check (TypeScript)         │
│  3. Test (Jest + Vitest)            │
│  4. Security Audit (npm audit)      │
│  5. Build (next build)              │
└──────┬──────────────────────────────┘
       │ All checks pass ✅
       ▼
┌─────────────────────────────────────┐
│    Deploy to Render                 │
├─────────────────────────────────────┤
│  • Staging (develop branch)         │
│  • Production (main branch)         │
└─────────────────────────────────────┘
```

### Key Features

✅ **Automated Testing** - All tests run before deployment
✅ **Type Safety** - TypeScript validation ensures code quality
✅ **Security Checks** - Dependency vulnerability scanning
✅ **Build Verification** - Application builds successfully before deploy
✅ **Environment Separation** - Staging and production environments
✅ **Manual Rollback** - Easy rollback via Render dashboard

---

## ✅ Prerequisites

### 1. Accounts & Services

- ✅ GitHub account with repository access
- ✅ Render account (https://render.com)
- ✅ Supabase project for database (staging and production)

### 2. Local Development Setup

```bash
# Verify Node.js version
node --version  # Should be v20+

# Install dependencies
npm ci

# Verify tests pass locally
npm run lint
npm run type-check
npm test
npm run test:vitest
npm run build
```

---

## 🚀 Initial Render Setup

### Step 1: Create Web Services on Render

#### Production Service

1. Go to https://dashboard.render.com
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. Configure service:
   ```
   Name: finetunelab-production
   Region: Oregon (us-west)
   Branch: main
   Build Command: npm ci && npm run build
   Start Command: npm start
   Plan: Starter (or higher)
   ```

5. Add environment variables:
   ```
   NODE_ENV=production
   NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   OPENAI_API_KEY=your_openai_key
   ANTHROPIC_API_KEY=your_anthropic_key
   NODE_OPTIONS=--max-old-space-size=4096
   ```

6. **Important**: Disable Auto-Deploy
   - In service settings, turn off "Auto-Deploy"
   - We'll deploy via GitHub Actions instead

7. Copy the **Service ID** (format: `srv-xxxxxxxxxxxxx`)

#### Staging Service

1. Repeat steps above with these differences:
   ```
   Name: finetunelab-staging
   Branch: develop
   ```

2. Use staging Supabase credentials

3. Keep Auto-Deploy **enabled** for staging (optional)

4. Copy the **Service ID**

### Step 2: Get Render API Key

1. Go to Render Dashboard → Account Settings
2. Click "API Keys"
3. Create a new API key
4. Copy the key immediately (shown only once)

---

## 🔐 GitHub Secrets Configuration

Add these secrets to your GitHub repository:

**Go to**: GitHub Repository → Settings → Secrets and variables → Actions → New repository secret

### Required Secrets

```bash
# Render API Configuration
RENDER_API_KEY=rnd_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Service IDs (from Render dashboard URL)
RENDER_PRODUCTION_SERVICE_ID=srv-xxxxxxxxxxxxx
RENDER_STAGING_SERVICE_ID=srv-xxxxxxxxxxxxx

# Production Environment
PRODUCTION_SUPABASE_URL=https://your-project.supabase.co
PRODUCTION_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Staging Environment
STAGING_SUPABASE_URL=https://your-staging.supabase.co
STAGING_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Verify Secrets

After adding secrets, verify in GitHub:
1. Go to Settings → Secrets and variables → Actions
2. You should see all 6 secrets listed
3. You cannot view secret values after creation (security feature)

---

## ⚙️ CI/CD Pipeline

### Pipeline Stages

#### 1. Continuous Integration (`.github/workflows/ci.yml`)

Runs on **every push** to:
- `main` branch
- `develop` branch
- `claude/**` branches
- `copilot/**` branches
- Pull requests

**Jobs:**
```yaml
lint → type-check → test → build → security-audit
  ↓        ↓         ↓       ↓            ↓
ESLint  TypeScript  Jest  Next.js    npm audit
                  Vitest   Build
```

**All must pass** before merge is allowed (if branch protection enabled).

#### 2. Deploy to Staging (`.github/workflows/deploy-staging.yml`)

**Triggers:**
- Push to `develop` branch
- Push to `test/**` branches
- Manual trigger (workflow_dispatch)

**Sequence:**
```bash
1. Install dependencies (npm ci)
2. Run linter (npm run lint)
3. Type check (npm run type-check)
4. Run tests (npm test + npm run test:vitest)
5. Build application (npm run build)
6. Deploy to Render staging
7. Notify completion
```

#### 3. Deploy to Production (`.github/workflows/deploy-production.yml`)

**Triggers:**
- Push to `main` branch
- Manual trigger (workflow_dispatch)

**Sequence:**
```bash
1. Install dependencies (npm ci)
2. Run linter (npm run lint)
3. Type check (npm run type-check)
4. Run all tests (npm test + npm run test:vitest)
5. Security audit (npm audit --audit-level=high)
6. Build application (npm run build)
7. Deploy to Render production
8. Run smoke tests
9. Notify success/failure
```

---

## 🔄 Deployment Flow

### Scenario 1: Feature Development

```bash
# 1. Create feature branch
git checkout -b feature/new-analytics-chart
# ... make changes ...
git commit -m "feat: add new analytics chart"
git push origin feature/new-analytics-chart

# ✅ GitHub Actions runs CI workflow (lint, test, build)

# 2. Create pull request to develop
# ✅ CI runs again on PR
# ✅ Merge when CI passes

# 3. Deploy to staging (automatic)
git checkout develop
git merge feature/new-analytics-chart
git push origin develop

# ✅ Triggers deploy-staging workflow
# ✅ Deploys to https://staging.finetunelab.ai
# ✅ Test manually in staging

# 4. Deploy to production
git checkout main
git merge develop
git push origin main

# ✅ Triggers deploy-production workflow
# ✅ Deploys to https://finetunelab.ai
```

### Scenario 2: Hotfix to Production

```bash
# 1. Create hotfix branch from main
git checkout main
git checkout -b hotfix/critical-bug-fix
# ... fix bug ...
git commit -m "fix: resolve critical authentication bug"
git push origin hotfix/critical-bug-fix

# 2. Merge directly to main (skip staging for critical fixes)
git checkout main
git merge hotfix/critical-bug-fix
git push origin main

# ✅ All tests run
# ✅ Deploys to production
# ✅ Backport to develop

git checkout develop
git merge main
git push origin develop
```

### Scenario 3: Manual Deployment

Sometimes you need to redeploy without new code changes:

**Via GitHub UI:**
1. Go to repository → Actions tab
2. Select "Deploy to Production" or "Deploy to Staging"
3. Click "Run workflow"
4. Select branch
5. Click "Run workflow" button

**Via Render Dashboard:**
1. Go to your service
2. Click "Manual Deploy"
3. Select branch
4. Click "Deploy"

---

## 🛠️ Troubleshooting

### Issue 1: Build Fails in CI

**Symptom:** GitHub Actions shows build failed

**Check:**
```bash
# Run locally to reproduce
npm run build

# Check logs in GitHub Actions for specific error
```

**Common Causes:**
- TypeScript errors
- Missing environment variables
- Import errors

### Issue 2: Tests Pass Locally but Fail in CI

**Symptom:** Tests work on your machine but fail in GitHub Actions

**Solutions:**
```bash
# Run tests in CI mode locally
CI=true npm test
CI=true npm run test:vitest

# Check for:
# - Hardcoded file paths (use path.join)
# - Time-dependent tests (use mock timers)
# - Browser-specific code
```

### Issue 3: Deployment Succeeds but Site is Down

**Check:**
1. **Render Dashboard** → Your service → Logs
2. Look for runtime errors

**Common Issues:**
```bash
# Missing environment variables
# Check in Render Dashboard → Environment

# Database connection issues
# Verify SUPABASE_URL is correct

# Memory issues
# Increase NODE_OPTIONS=--max-old-space-size=4096
```

### Issue 4: GitHub Actions Can't Deploy to Render

**Symptom:** "Unauthorized" or "Service not found" error

**Verify:**
1. `RENDER_API_KEY` is correct
2. `RENDER_PRODUCTION_SERVICE_ID` is correct (format: `srv-xxx`)
3. API key has permissions to deploy

**Get correct Service ID:**
```bash
# From Render Dashboard URL:
# https://dashboard.render.com/web/srv-xxxxxxxxxxxxx
#                                     ^^^^^^^^^^^^^^^^^ This is your service ID
```

### Issue 5: Environment Variables Not Working

**Symptom:** App can't connect to Supabase or APIs

**Check:**
1. GitHub Secrets are set correctly
2. Render environment variables are set
3. Variable names match exactly (case-sensitive)

**Debug in Render:**
```bash
# In Render Shell (service → Shell tab):
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NODE_ENV
```

---

## 📊 Monitoring

### GitHub Actions

**View Workflow Status:**
1. Repository → Actions tab
2. See all workflow runs
3. Click any run to see detailed logs

**Status Badges:**
Add to README.md:
```markdown
![CI](https://github.com/canfieldjuan/finetunelab.ai/actions/workflows/ci.yml/badge.svg)
![Deploy](https://github.com/canfieldjuan/finetunelab.ai/actions/workflows/deploy-production.yml/badge.svg)
```

### Render Dashboard

**Monitor Deployments:**
1. Go to https://dashboard.render.com
2. Select your service
3. View:
   - Deployment history
   - Logs (real-time)
   - Metrics (CPU, memory, requests)
   - Events

**Set Up Alerts:**
1. Service → Settings → Notifications
2. Add email or Slack webhook
3. Get notified on:
   - Deploy success/failure
   - Service down
   - High error rate

### Application Logs

**View Real-time Logs:**
```bash
# Via Render Dashboard:
# Service → Logs tab

# Filter by:
# - Time range
# - Log level (info, error, warn)
# - Search terms
```

---

## 🔒 Security Best Practices

### 1. Never Commit Secrets

```bash
# ❌ DON'T DO THIS
SUPABASE_KEY=your_actual_key

# ✅ DO THIS
SUPABASE_KEY=${{ secrets.SUPABASE_KEY }}
```

### 2. Use Environment-Specific Variables

```bash
# Production
NEXT_PUBLIC_SUPABASE_URL=https://prod.supabase.co

# Staging
NEXT_PUBLIC_SUPABASE_URL=https://staging.supabase.co

# Never mix production and staging!
```

### 3. Enable Branch Protection

**GitHub Settings:**
1. Repository → Settings → Branches
2. Add rule for `main` branch:
   - ✅ Require pull request reviews
   - ✅ Require status checks to pass
   - ✅ Require branches to be up to date

### 4. Regular Security Audits

```bash
# Run locally
npm audit

# Fix vulnerabilities
npm audit fix

# Check in CI (already configured)
```

---

## 📈 Performance Optimization

### 1. Enable Caching

Already configured in workflows:
```yaml
- uses: actions/setup-node@v4
  with:
    cache: 'npm'  # ✅ Caches node_modules
```

### 2. Parallel Jobs

CI workflow runs jobs in parallel:
- Lint
- Type check
- Test
- Security audit

All run simultaneously for faster feedback!

### 3. Render Auto-Scaling

Upgrade to Pro or higher plans for:
- Auto-scaling based on traffic
- Zero-downtime deployments
- Health checks and auto-restart

---

## 🎯 Quick Reference

### Deployment Commands

```bash
# Deploy to staging
git checkout develop
git merge feature-branch
git push origin develop

# Deploy to production
git checkout main
git merge develop
git push origin main

# Manual deploy via CLI (using Render CLI)
render deploy --service finetunelab-production
```

### Useful Commands

```bash
# Check build locally
npm run build

# Run all quality checks
npm run lint && npm run type-check && npm test && npm run test:vitest

# Security audit
npm audit

# View Render logs (requires Render CLI)
render logs --tail --service finetunelab-production
```

### Important URLs

- **Render Dashboard**: https://dashboard.render.com
- **GitHub Actions**: https://github.com/canfieldjuan/finetunelab.ai/actions
- **Production App**: https://finetunelab.ai
- **Staging App**: https://staging.finetunelab.ai

---

## 🆘 Getting Help

### Documentation

- [Render Docs](https://render.com/docs)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

### Support Channels

- **Render Support**: support@render.com
- **GitHub Issues**: Create issue in repository
- **Render Community**: https://community.render.com

---

## ✅ Deployment Checklist

Before deploying to production:

- [ ] All tests pass locally
- [ ] TypeScript compiles without errors
- [ ] Linter passes
- [ ] Build succeeds locally
- [ ] Environment variables configured in Render
- [ ] GitHub secrets configured
- [ ] Tested in staging environment
- [ ] Database migrations applied (if any)
- [ ] Reviewed deployment logs
- [ ] Monitoring/alerts configured

---

**Last Updated:** 2025-12-21
**Maintained By:** FinetuneLab Team
