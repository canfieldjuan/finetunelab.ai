# CI/CD Setup Checklist - FinetuneLab

Quick checklist to configure CI/CD for Render deployment.

---

## ✅ Prerequisites

- [ ] GitHub repository connected
- [ ] Render account created
- [ ] Supabase projects created (staging & production)

---

## 📝 Step 1: Render Service Setup

### Create Production Service

1. Go to https://dashboard.render.com
2. Click **New +** → **Web Service**
3. Connect your GitHub repository: `canfieldjuan/finetunelab.ai`
4. Configure:
   ```
   Name: finetunelab-production
   Region: Oregon
   Branch: main
   Build Command: npm ci && npm run build
   Start Command: npm start
   ```

5. **Disable Auto-Deploy** (we'll use GitHub Actions)

6. Add environment variables in Render:
   ```
   NODE_ENV=production
   NEXT_PUBLIC_SUPABASE_URL=<your_production_supabase_url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_production_anon_key>
   SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
   OPENAI_API_KEY=<your_openai_key>
   ANTHROPIC_API_KEY=<your_anthropic_key>
   NODE_OPTIONS=--max-old-space-size=4096
   ```

7. **Copy Service ID** from URL: `srv-xxxxxxxxxxxxx`

### Create Staging Service

1. Repeat above steps with:
   ```
   Name: finetunelab-staging
   Branch: develop
   ```

2. Use **staging** Supabase credentials

3. **Copy Service ID**

---

## 🔐 Step 2: GitHub Secrets

Go to: **GitHub Repository** → **Settings** → **Secrets and variables** → **Actions**

Add these secrets:

```bash
# Click "New repository secret" for each:

RENDER_API_KEY
Value: Get from Render Dashboard → Account Settings → API Keys

RENDER_PRODUCTION_SERVICE_ID
Value: srv-xxxxxxxxxxxxx (from production service URL)

RENDER_STAGING_SERVICE_ID
Value: srv-xxxxxxxxxxxxx (from staging service URL)

PRODUCTION_SUPABASE_URL
Value: https://your-project.supabase.co

PRODUCTION_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

STAGING_SUPABASE_URL
Value: https://your-staging.supabase.co

STAGING_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🔐 Step 3: GitLab CI/CD Variables (If Using GitLab)

Go to: **GitLab Repository** → **Settings** → **CI/CD** → **Variables**

Add these variables:

```bash
RENDER_API_KEY
Type: Masked
Value: <from Render dashboard>

RENDER_PRODUCTION_SERVICE_ID
Type: Masked
Value: srv-xxxxxxxxxxxxx

RENDER_STAGING_SERVICE_ID
Type: Masked
Value: srv-xxxxxxxxxxxxx
```

---

## 🛡️ Step 4: Branch Protection (Recommended)

### GitHub

1. Go to **Settings** → **Branches** → **Add rule**
2. Branch name pattern: `main`
3. Enable:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
     - Select: `lint`, `type-check`, `test`, `build`
   - ✅ Require branches to be up to date before merging
   - ✅ Include administrators

4. Repeat for `develop` branch (less strict)

---

## 🧪 Step 5: Test the Pipeline

### Test CI Workflow

```bash
# 1. Create a test branch
git checkout -b test/ci-pipeline
echo "# CI Test" >> TEST_CI.md
git add TEST_CI.md
git commit -m "test: verify CI pipeline"
git push origin test/ci-pipeline

# 2. Go to GitHub → Actions tab
# ✅ Verify CI workflow runs
# ✅ Check all jobs pass (lint, type-check, test, build)
```

### Test Staging Deployment

```bash
# 1. Merge to develop
git checkout develop
git merge test/ci-pipeline
git push origin develop

# 2. Go to GitHub → Actions tab
# ✅ Verify "Deploy to Staging" workflow runs
# ✅ Check all steps complete
# ✅ Verify deployment on Render dashboard

# 3. Test staging site
open https://staging.finetunelab.ai  # or your staging URL
```

### Test Production Deployment

```bash
# 1. Merge to main (after testing in staging)
git checkout main
git merge develop
git push origin main

# 2. Go to GitHub → Actions tab
# ✅ Verify "Deploy to Production" workflow runs
# ✅ Check all quality gates pass
# ✅ Verify deployment on Render dashboard

# 3. Test production site
open https://finetunelab.ai  # or your production URL
```

---

## 📊 Step 6: Verify Everything Works

### GitHub Actions

- [ ] CI workflow runs on every push
- [ ] All jobs complete successfully
- [ ] Build artifacts are created
- [ ] Type checking passes
- [ ] Tests pass
- [ ] Linting passes

### Render Deployments

- [ ] Staging deploys on push to `develop`
- [ ] Production deploys on push to `main`
- [ ] Services start successfully
- [ ] Health checks pass
- [ ] Environment variables are set
- [ ] Application loads in browser

### Monitoring

- [ ] Check GitHub Actions tab regularly
- [ ] Monitor Render dashboard logs
- [ ] Set up Render notifications (optional)

---

## 🔧 Troubleshooting

### If CI Fails

```bash
# Run locally to reproduce
npm run lint
npm run type-check
npm test
npm run test:vitest
npm run build
```

### If Deployment Fails

1. **Check Render Logs**
   - Render Dashboard → Service → Logs

2. **Verify GitHub Secrets**
   - Settings → Secrets → Ensure all secrets are set

3. **Check Service IDs**
   - Verify format is `srv-xxxxxxxxxxxxx`

4. **Verify API Key**
   - Render Dashboard → Account Settings → API Keys
   - Create new key if needed

### If Application Doesn't Load

1. **Check Environment Variables**
   - Render Dashboard → Service → Environment
   - Verify all variables are set correctly

2. **Check Build Logs**
   - Look for build errors in Render logs

3. **Check Runtime Logs**
   - Look for startup errors

---

## 🎯 Next Steps After Setup

1. **Add Status Badges** to README.md:
   ```markdown
   ![CI](https://github.com/canfieldjuan/finetunelab.ai/actions/workflows/ci.yml/badge.svg)
   ![Deploy](https://github.com/canfieldjuan/finetunelab.ai/actions/workflows/deploy-production.yml/badge.svg)
   ```

2. **Set Up Notifications**:
   - GitHub: Settings → Notifications → Enable Actions
   - Render: Service → Settings → Notifications

3. **Configure Monitoring**:
   - Set up error tracking (Sentry, LogRocket)
   - Configure uptime monitoring
   - Set up performance monitoring

4. **Document Your Workflow**:
   - Update team docs with deployment process
   - Create runbooks for common issues

---

## 📚 Resources

- [RENDER_DEPLOYMENT_GUIDE.md](./RENDER_DEPLOYMENT_GUIDE.md) - Comprehensive deployment guide
- [CICD_GUIDE.md](./.github/CICD_GUIDE.md) - General CI/CD documentation
- [Render Docs](https://render.com/docs)
- [GitHub Actions Docs](https://docs.github.com/en/actions)

---

## ✅ Final Checklist

Before considering setup complete:

- [ ] GitHub secrets configured (6 secrets)
- [ ] GitLab variables configured (if using GitLab)
- [ ] Render production service created
- [ ] Render staging service created
- [ ] Render API key obtained
- [ ] Service IDs copied
- [ ] Branch protection rules enabled
- [ ] Test deployment to staging successful
- [ ] Test deployment to production successful
- [ ] Application loads correctly in both environments
- [ ] Monitoring and alerts configured
- [ ] Team members have access to Render dashboard
- [ ] Documentation updated

---

**Setup Time Estimate:** 30-45 minutes

**Last Updated:** 2025-12-21
