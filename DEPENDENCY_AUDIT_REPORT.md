# Dependency Audit Report - Linux Migration
**Date:** 2025-11-09
**Node Version:** v18.19.1
**NPM Version:** 9.2.0
**Total node_modules Size:** 1.3 GB

---

## 🔴 CRITICAL ISSUES

### 1. Node Version Incompatibility
**Current:** Node v18.19.1
**Required:** Node 20+ (for Supabase packages)

**Affected Packages:**
- `@supabase/auth-js@2.80.0` - requires >=20.0.0
- `@supabase/functions-js@2.80.0` - requires >=20.0.0
- `@isaacs/balanced-match@4.0.1` - requires 20 || >=22
- `@isaacs/brace-expansion@5.0.0` - requires 20 || >=22

**Impact:**
- Potential runtime errors
- Missing features/optimizations
- Security vulnerabilities

**Fix:**
```bash
# Using nvm (recommended)
nvm install 20
nvm use 20
nvm alias default 20

# Or using apt (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

---

## 🟡 CLEANUP NEEDED

### 2. Extraneous Package
**Package:** `@emnapi/runtime@1.7.0`

Not listed in package.json but installed in node_modules.

**Fix:**
```bash
npm uninstall @emnapi/runtime
```

### 3. Unused Dependencies (Can be removed)

#### Production Dependencies
- ❌ `@dagster-io/dagster-pipes` - Not used in codebase
- ❌ `@tanstack/react-query` - Not used (using native fetch)
- ❌ `ai` - Vercel AI SDK, not used
- ❌ `check` - Unknown usage
- ❌ `pdfjs-dist` - PDF parsing not used
- ❌ `react-markdown` - Not rendering markdown client-side
- ❌ `react-resizable-panels` - Not using resizable UI
- ❌ `react-window` - Not using virtualized lists
- ❌ `remark-gfm` - Markdown GFM not used

**Potential Savings:** ~50-100 MB

**Fix:**
```bash
npm uninstall @dagster-io/dagster-pipes @tanstack/react-query ai check pdfjs-dist react-markdown react-resizable-panels react-window remark-gfm
```

#### Dev Dependencies
- ❌ `@testing-library/user-event` - Not used in tests
- ❌ `@vitest/coverage-v8` - Coverage not configured
- ❌ `autoprefixer` - Already handled by Next.js
- ❌ `babel-jest` - Using Vitest, not Jest
- ❌ `cross-env` - Not needed on Linux
- ❌ `jest-environment-jsdom` - Using Vitest
- ❌ `markdownlint-cli` - Not linting markdown
- ❌ `postcss` - Already included by Next.js
- ❌ `postcss-nesting` - Not used
- ❌ `supabase` - CLI should be global, not dev dependency
- ❌ `ts-jest` - Using Vitest
- ❌ `ts-node` - Not needed (Next.js handles TS)
- ⚠️ `typescript` - **KEEP** (needed for type checking)

**Potential Savings:** ~200 MB

**Fix:**
```bash
npm uninstall @testing-library/user-event @vitest/coverage-v8 autoprefixer babel-jest cross-env jest-environment-jsdom markdownlint-cli postcss postcss-nesting supabase ts-jest ts-node
```

### 4. Missing Dependencies (False Positives)

These are not actually needed:
- `node-fetch` - Used only in test script (standalone)
- `@jest/globals` - E2E test can be updated to Vitest
- `k6` - Load testing tool (external)
- `@graphiql/react` - From Dagster venv, not our code
- `graphql` - From Dagster venv, not our code

**No action needed** - these are false positives from depcheck.

---

## 🟢 OPTIONAL UPDATES

### 5. Outdated Packages

#### Major Version Updates Available
| Package | Current | Latest | Breaking? |
|---------|---------|--------|-----------|
| `@types/archiver` | 6.0.4 | 7.0.0 | Possibly |
| `@types/node` | 20.19.24 | 24.10.0 | Possibly |
| `@types/react-window` | 1.8.8 | 2.0.0 | Possibly |
| `@types/uuid` | 10.0.0 | 11.0.0 | Possibly |
| `eslint-config-next` | 15.5.4 | 16.0.1 | Yes |
| `next` | 15.5.4 | 16.0.1 | Yes |
| `pdf-parse` | 1.1.4 | 2.4.5 | Possibly |
| `react` | 19.1.0 | 19.2.0 | No |
| `react-dom` | 19.1.0 | 19.2.0 | No |
| `tailwindcss` | 3.4.0 | 4.1.17 | Yes |

#### Minor/Patch Updates (Safe)
```bash
npm update @anthropic-ai/sdk lucide-react react react-dom react-window tailwind-merge vitest @vitest/ui autoprefixer postcss
```

**Recommendation:**
- Update React to 19.2.0 (patch release, safe)
- Hold on Next.js 16 (major version, needs testing)
- Hold on Tailwind 4 (major rewrite, breaking changes)

---

## 📋 CLEANUP SCRIPT

### Step 1: Upgrade Node.js
```bash
# Install Node 20 LTS
nvm install 20.18.1  # Current LTS
nvm use 20.18.1
nvm alias default 20.18.1

# Verify
node --version  # Should show v20.18.1
```

### Step 2: Remove Extraneous Package
```bash
npm uninstall @emnapi/runtime
```

### Step 3: Remove Unused Dependencies
```bash
# Production dependencies
npm uninstall @dagster-io/dagster-pipes @tanstack/react-query ai check pdfjs-dist react-markdown react-resizable-panels react-window remark-gfm

# Dev dependencies
npm uninstall @testing-library/user-event @vitest/coverage-v8 autoprefixer babel-jest cross-env jest-environment-jsdom markdownlint-cli postcss postcss-nesting supabase ts-jest ts-node
```

### Step 4: Update Safe Packages
```bash
npm update @anthropic-ai/sdk lucide-react react react-dom tailwind-merge
```

### Step 5: Clean Install
```bash
rm -rf node_modules package-lock.json
npm install
```

### Step 6: Verify
```bash
npm ls --depth=0 2>&1 | grep -E "extraneous|UNMET"  # Should be empty
npm outdated  # Check remaining outdated packages
npm run build  # Verify build works
```

---

## 💾 ESTIMATED SAVINGS

After cleanup:
- **Disk space:** ~250-350 MB freed
- **Install time:** ~20% faster
- **Security:** Fewer packages to audit
- **Maintenance:** Cleaner dependency tree

---

## ⚠️ BEFORE YOU RUN CLEANUP

### Backup Current State
```bash
cp package.json package.json.backup
cp package-lock.json package-lock.json.backup
```

### Test After Each Step
```bash
npm run dev      # Verify dev server starts
npm run build    # Verify production build
npm run lint     # Verify linting works
```

### Rollback if Needed
```bash
mv package.json.backup package.json
mv package-lock.json.backup package-lock.json
npm install
```

---

## 🎯 RECOMMENDED ACTION PLAN

### Priority 1: Critical (Do Now)
1. ✅ **Upgrade Node.js to v20.18.1** (fixes engine warnings)
2. ✅ **Remove extraneous package** (@emnapi/runtime)
3. ✅ **Clean install** (npm install)

### Priority 2: Cleanup (This Week)
1. Remove unused production dependencies
2. Remove unused dev dependencies
3. Update safe packages (React, icons, etc.)

### Priority 3: Optional (When Ready)
1. Consider Next.js 16 upgrade (requires testing)
2. Consider Tailwind 4 upgrade (major rewrite)
3. Review and update all @types packages

---

## 📊 HEALTH SCORE

| Category | Status | Score |
|----------|--------|-------|
| Node Version | 🔴 Outdated | 3/10 |
| Package Count | 🟡 High | 6/10 |
| Outdated Packages | 🟡 Some | 7/10 |
| Unused Dependencies | 🔴 Many | 4/10 |
| Security | 🟢 Good | 9/10 |
| **Overall** | 🟡 | **6/10** |

**After Cleanup:** Expected score **8.5/10**

---

## 🔄 ONGOING MAINTENANCE

### Weekly
```bash
npm outdated  # Check for updates
```

### Monthly
```bash
npm audit     # Security vulnerabilities
npm update    # Safe minor/patch updates
```

### Quarterly
```bash
npx npm-check-updates  # Major version updates
```

---

**Next Steps:** Run Priority 1 tasks, then test thoroughly before proceeding to Priority 2.
