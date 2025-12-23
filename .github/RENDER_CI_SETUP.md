# Render CI/CD Setup Guide

This guide shows how to configure Render to **wait for GitHub CI checks** before deploying.

## Problem

Currently, Render auto-deploys every push to `main` regardless of test results. This means broken code gets deployed.

## Solution

Configure Render to only deploy when GitHub Actions CI passes.

---

## Step 1: Add GitHub Secrets

Your CI workflow needs these secrets to build successfully:

1. Go to **GitHub Repository > Settings > Secrets and variables > Actions**
2. Click **New repository secret**
3. Add these three secrets:

| Secret Name | Value | Where to find it |
|------------|-------|------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard > Project Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon/public key | Supabase Dashboard > Project Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key | Supabase Dashboard > Project Settings > API (⚠️ Keep secret!) |

---

## Step 2: Configure Render to Wait for CI

### Option A: Enable Branch Protection (Recommended)

1. **Go to GitHub Repository > Settings > Branches**
2. Click **Add branch protection rule**
3. Branch name pattern: `main`
4. Enable these settings:
   - ☑️ **Require status checks to pass before merging**
   - ☑️ **Require branches to be up to date before merging**
   - Search for and select: `test-and-build` (from CI workflow)
   - ☑️ **Do not allow bypassing the above settings**
5. Click **Create**

Now you can't push directly to main if CI fails!

### Option B: Configure Render Deploy Hook

1. **Go to Render Dashboard > Your Service > Settings**
2. Scroll to **Deploy**
3. Change **Auto-Deploy** setting:
   - Turn OFF: "Automatically deploy this service when you push to your repository"
4. Scroll to **Build & Deploy > Deploy Hook**
5. Copy the Deploy Hook URL

6. **Go to GitHub Repository > Settings > Webhooks**
7. Click **Add webhook**
8. Paste the Render Deploy Hook URL
9. Content type: `application/json`
10. Which events: **Let me select individual events**
11. Select: ☑️ **Check suites** (triggers when CI completes)
12. Click **Add webhook**

Now Render only deploys when CI passes!

---

## Step 3: Test the Setup

### Test CI Blocking

1. Make a change that breaks TypeScript:
```bash
# Edit any .ts file and add intentional syntax error
echo "const broken = " >> lib/test.ts
git add .
git commit -m "test: intentional CI failure"
git push origin main
```

2. **Go to GitHub > Actions tab**
   - You should see the CI workflow running
   - It should fail due to TypeScript error

3. **Go to Render Dashboard**
   - Deployment should NOT start (if using Option B)
   - Or you should be blocked from pushing (if using Option A)

4. Fix the error:
```bash
git restore lib/test.ts
git commit -m "fix: remove test error"
git push origin main
```

5. CI should pass and Render should deploy ✅

---

## Step 4: Recommended Workflow

Instead of pushing directly to `main`, use this workflow:

1. Create a feature branch:
```bash
git checkout -b feature/my-feature
# Make changes
git add .
git commit -m "feat: add new feature"
git push origin feature/my-feature
```

2. **Create a Pull Request on GitHub**
   - CI will run automatically
   - You'll see if tests pass before merging

3. **Merge the PR**
   - Only merge if CI is green ✅
   - Render will deploy the merged code

This prevents broken code from ever reaching production!

---

## Workflow Features

The `ci.yml` workflow:

✅ **Runs on every push to main**
✅ **Runs on every pull request**
✅ **TypeScript type checking**
✅ **Next.js build validation**
✅ **Test execution (if you add tests)**
✅ **Blocks deployment if build fails**

---

## Troubleshooting

### CI fails with "Missing environment variable"

**Problem**: Build needs Supabase secrets to run

**Fix**: Add the secrets in Step 1 above

### CI passes but Render still auto-deploys failing code

**Problem**: Render isn't waiting for CI status

**Fix**: Use Option A (branch protection) or Option B (deploy hooks) from Step 2

### I can't push to main anymore

**Good!** That means branch protection is working.

**Solution**: Always create PRs and merge after CI passes:
```bash
git checkout -b fix/something
# Make changes
git push origin fix/something
# Create PR on GitHub, wait for CI, then merge
```

---

## Next Steps

1. ✅ Commit the workflow files
2. ✅ Add GitHub secrets
3. ✅ Configure Render (Option A or B)
4. ✅ Test with an intentional failure
5. ✅ Switch to PR-based workflow

Questions? Check the CI logs at: **GitHub > Actions tab**
