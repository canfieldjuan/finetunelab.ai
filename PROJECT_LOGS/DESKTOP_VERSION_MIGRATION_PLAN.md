# FineTune Lab Desktop - Migration Implementation Plan

**Date Created**: December 13, 2025  
**Objective**: Create a local-only desktop version of FineTune Lab without cloud dependencies  
**Target Repo**: `finetunelab-desktop` (new repository)  
**Source Repo**: `finetunelab.ai` (current web-ui)

---

## Executive Summary

This plan outlines a **phased approach** to extract local training functionality from the current web application and create a standalone desktop application. The desktop version will:

- ✅ **Support local GPU training** (NVIDIA GPUs with CUDA)
- ✅ **Use local SQLite database** instead of Supabase
- ✅ **No cloud API dependencies** (no Supabase, no cloud deployment features)
- ✅ **Standalone executable** via Tauri (lightweight, ~20MB)
- ✅ **Local model inference** for testing trained models
- ❌ **NO cloud training** (RunPod/Lambda Labs removed)
- ❌ **NO authentication** (single-user local app)
- ❌ **NO payments/subscriptions** (Stripe removed)

---

## Phase 1: Analysis & Verification ✅ COMPLETE

### 1.1 Core Training Files Identified

**Essential Files to Keep:**

#### Python Training Core
```
lib/training/standalone_trainer.py         # Main training engine (3494 lines)
lib/training/dataset-url-service.ts        # Dataset handling
lib/training/training-config.types.ts      # Type definitions
lib/training/dataset.types.ts              # Dataset types
```

#### Frontend Training UI
```
app/training/page.tsx                      # Main training page
app/datasets/page.tsx                      # Dataset management
components/training/TrainingWorkflow.tsx   # Training wizard
components/training/DatasetManager.tsx     # Dataset upload/management
components/training/ConfigEditor.tsx       # Config editor
components/training/TrainingDashboard.tsx  # Monitor training jobs
components/training/ModelSelector.tsx      # Model selection
components/training/LoRAConfig.tsx         # LoRA configuration
components/training/MetricsOverviewCard.tsx # Training metrics
components/training/LossChart.tsx          # Loss visualization
components/training/GPUMemoryChart.tsx     # GPU monitoring
```

#### UI Components (Keep)
```
components/ui/*                            # Shadcn/ui components
components/layout/PageWrapper.tsx          # Layout wrapper (simplify)
components/branding/*                      # Logo/branding
```

#### API Routes (Local Only)
```
app/api/training/route.ts                  # Training config CRUD
app/api/training/local/route.ts            # Local training start
app/api/training/local/metrics/route.ts    # Metrics ingestion
app/api/datasets/route.ts                  # Dataset management
```

### 1.2 Files to REMOVE

**Cloud Dependencies (DELETE):**
```
lib/supabase/*                             # All Supabase clients
lib/supabaseAdmin.ts
lib/supabaseClient.ts
lib/auth.ts                                # Supabase auth
contexts/AuthContext.tsx                   # Authentication context
lib/stripe/*                               # Payment processing
lib/subscriptions/*                        # Subscription management
```

**Cloud Training Features (DELETE):**
```
app/api/training/deploy/*                  # Cloud deployment APIs
app/api/training/cloud-check/*             # Cloud job checking
lib/training/runpod-service.ts             # RunPod integration
lib/training/deployment.types.ts           # Cloud deployment types
lib/training/distributed-orchestrator.ts   # Distributed training
lib/training/job-handlers.ts               # Cloud job handlers (parts)
components/training/CloudDeploymentWizard.tsx
components/training/CloudDeploymentConfirmationDialog.tsx
components/training/DeploymentTargetSelector.tsx
```

**Content Pages (DELETE - not relevant to training):**
```
app/lab-academy/*                          # Academy content
app/lab-notes/*                            # Lab notes blog
app/case-studies/*                         # Case studies
app/chat/*                                 # Chat interface
app/graphrag-demo/*                        # GraphRAG demo
app/inference/*                            # Cloud inference
```

**Admin/Analytics (DELETE):**
```
app/analytics/*                            # Usage analytics
app/admin/*                                # Admin panel
lib/analytics/*                            # Analytics tracking
```

### 1.3 Database Migration Strategy

**FROM: Supabase PostgreSQL**
```sql
-- Current tables used by training:
local_training_jobs
training_configs
training_datasets
training_metrics
training_checkpoints
```

**TO: SQLite Local Database**
```sql
-- New schema (simplified):
CREATE TABLE training_jobs (...)
CREATE TABLE training_configs (...)
CREATE TABLE training_datasets (...)
CREATE TABLE training_metrics (...)
CREATE TABLE training_checkpoints (...)
```

---

## Phase 2: Repository Setup

### 2.1 Commit Current Project to GitHub (FIRST!)
**Status**: ⏸️ AWAITING APPROVAL

**CRITICAL**: This is the active `finetunelab.ai` web project - do NOT delete files here!

```bash
# In current directory: /home/juan-canfield/Desktop/web-ui
cd /home/juan-canfield/Desktop/web-ui

# Make sure everything is committed
git add .
git commit -m "Checkpoint: Full web-ui before desktop extraction"
git push origin main

# Verify push succeeded
git status
```

### 2.2 Create New GitHub Repository
**Status**: ⏸️ AWAITING APPROVAL

**On GitHub.com:**
1. Go to https://github.com/canfieldjuan
2. Click "New Repository"
3. Name: `finetunelab-desktop`
4. Description: "Free desktop app for local LLM fine-tuning"
5. **Public** repository (for free distribution)
6. **DO NOT** initialize with README (we'll push existing code)
7. Click "Create Repository"

### 2.3 Clone to New Location for Desktop Version
**Status**: ⏸️ AWAITING APPROVAL

```bash
# Clone the FULL web-ui project to a NEW directory
cd ~/Desktop
git clone https://github.com/canfieldjuan/finetunelab.ai finetunelab-desktop
cd finetunelab-desktop

# Verify we're in the new copy
pwd  # Should show: /home/juan-canfield/Desktop/finetunelab-desktop

# Point to NEW desktop repository
git remote set-url origin https://github.com/canfieldjuan/finetunelab-desktop.git

# Verify remote changed
git remote -v  # Should show finetunelab-desktop
```

### 2.4 Remove Cloud Files (ONLY in the new clone!)
**Status**: ⏸️ AWAITING APPROVAL

**Now we can safely delete files in `/finetunelab-desktop/` without affecting the original web-ui**

```bash
# Make sure we're in the NEW desktop directory
cd ~/Desktop/finetunelab-desktop
pwd  # Verify: /home/juan-canfield/Desktop/finetunelab-desktop

# Remove Supabase dependencies
rm -rf lib/supabase/
rm -f lib/supabaseAdmin.ts lib/supabaseClient.ts lib/auth.ts

# Remove authentication
rm -rf contexts/AuthContext.tsx
rm -rf app/api/auth/
rm -rf app/login/
rm -rf app/signup/
rm -rf app/account/

# Remove cloud training features
rm -rf app/api/training/deploy/
rm -rf app/api/training/cloud-check/
rm -f lib/training/runpod-service.ts
rm -f lib/training/distributed-orchestrator.ts
rm -f lib/training/deployment.types.ts
rm -f components/training/CloudDeploymentWizard.tsx
rm -f components/training/CloudDeploymentConfirmationDialog.tsx
rm -f components/training/DeploymentTargetSelector.tsx
rm -f components/training/UnifiedPackageGenerator.tsx
rm -f components/training/PackageGenerator.tsx
rm -f components/training/GeneratedPackageDisplay.tsx

# Remove content pages (not needed for training app)
rm -rf app/lab-academy/
rm -rf app/lab-notes/
rm -rf app/case-studies/
rm -rf app/chat/
rm -rf app/graphrag-demo/
rm -rf app/inference/
rm -rf app/docs/

# Remove payment/subscription
rm -rf lib/stripe/
rm -rf lib/subscriptions/
rm -rf lib/pricing/
rm -rf app/upgrade/
rm -rf components/subscription/
rm -rf components/pricing/

# Remove analytics
rm -rf lib/analytics/
rm -rf app/analytics/
rm -rf components/analytics/

# Remove development/test files (optional - keeps repo cleaner)
rm -rf __tests__/
rm -rf test-*.js test-*.ts test-*.mjs test-*.py
rm -rf check_*.js check_*.py check_*.mjs
rm -rf verify_*.js verify_*.sh
rm -rf debug_*.js debug_*.py
rm -rf analyze_*.py analyze_*.js
rm -rf fix_*.py fix_*.js fix_*.sh
rm -rf apply_*.js apply_*.sh

# Remove documentation (keep only relevant)
rm -rf PROJECT_LOGS/
rm -rf docs/
rm -f *.md  # Remove all markdown files
# We'll create a new README.md for desktop version

# Remove SQL migrations (using SQLite now)
rm -rf migrations/
rm -rf supabase/
rm -f *.sql

# Commit the deletions
git add -A
git commit -m "Remove cloud features for desktop-only version"

# Push to new desktop repo
git push -u origin main
```

---

## Phase 3: Local Database Implementation

### 3.1 Install SQLite Dependencies
```bash
npm install better-sqlite3 @types/better-sqlite3
npm install drizzle-orm drizzle-kit  # Optional: Type-safe ORM
```

### 3.2 Create Local Database Service
**File**: `lib/database/local-db.ts`

```typescript
import Database from 'better-sqlite3';
import path from 'path';
import { app } from '@electron/remote'; // If using Electron

export class LocalDatabase {
  private db: Database.Database;
  
  constructor() {
    // Store DB in user's app data directory
    const dbPath = path.join(
      app.getPath('userData'),
      'finetunelab.db'
    );
    
    this.db = new Database(dbPath);
    this.initializeTables();
  }
  
  private initializeTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS training_jobs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        model_name TEXT NOT NULL,
        dataset_path TEXT NOT NULL,
        status TEXT NOT NULL,
        config TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS training_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        config TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS training_datasets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        size INTEGER NOT NULL,
        rows INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS training_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT NOT NULL,
        step INTEGER NOT NULL,
        loss REAL,
        learning_rate REAL,
        gpu_memory REAL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (job_id) REFERENCES training_jobs(id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_metrics_job_id ON training_metrics(job_id);
      CREATE INDEX IF NOT EXISTS idx_metrics_step ON training_metrics(step);
    `);
  }
  
  // CRUD methods for training jobs
  createJob(job: any) {
    const stmt = this.db.prepare(`
      INSERT INTO training_jobs (id, name, model_name, dataset_path, status, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    return stmt.run(
      job.id,
      job.name,
      job.model_name,
      job.dataset_path,
      job.status,
      JSON.stringify(job.config),
      Date.now(),
      Date.now()
    );
  }
  
  getJobs() {
    const stmt = this.db.prepare('SELECT * FROM training_jobs ORDER BY created_at DESC');
    return stmt.all().map(row => ({
      ...row,
      config: JSON.parse(row.config)
    }));
  }
  
  // ... more methods
}

export const localDB = new LocalDatabase();
```

### 3.3 Replace Supabase Calls
**Status**: ⏸️ AWAITING APPROVAL

**Before (Supabase):**
```typescript
const { data, error } = await supabase
  .from('local_training_jobs')
  .select('*')
  .eq('user_id', userId);
```

**After (SQLite):**
```typescript
const jobs = localDB.getJobs();
```

---

## Phase 4: Remove Authentication

### 4.1 Simplify Page Wrappers
**File**: `components/layout/PageWrapper.tsx`

**Before:**
```typescript
export function PageWrapper({ user, signOut, children }) {
  if (!user) return <Login />;
  return <div>{children}</div>;
}
```

**After:**
```typescript
export function PageWrapper({ children }) {
  // No auth checks - single-user local app
  return <div>{children}</div>;
}
```

### 4.2 Remove Auth from API Routes
**File**: `app/api/training/route.ts`

**Before:**
```typescript
export async function GET(req: Request) {
  const token = req.headers.get('authorization');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // ...
}
```

**After:**
```typescript
export async function GET(req: Request) {
  // No auth - direct database access
  const configs = localDB.getConfigs();
  return NextResponse.json({ configs });
}
```

---

## Phase 5: Tauri Desktop Setup

### 5.1 Install Tauri
```bash
cd finetunelab-desktop
npm install @tauri-apps/cli @tauri-apps/api
npm run tauri init
```

### 5.2 Configure Tauri
**File**: `src-tauri/tauri.conf.json`

```json
{
  "build": {
    "beforeBuildCommand": "npm run build",
    "beforeDevCommand": "npm run dev",
    "devPath": "http://localhost:3000",
    "distDir": "../out"
  },
  "package": {
    "productName": "FineTune Lab Desktop",
    "version": "1.0.0"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "fs": {
        "all": true,
        "scope": ["$APPDATA/*", "$HOME/finetunelab/*"]
      },
      "shell": {
        "all": false,
        "execute": true,
        "scope": [
          { "name": "python", "cmd": "python" }
        ]
      }
    },
    "bundle": {
      "active": true,
      "identifier": "ai.finetunelab.desktop",
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/icon.ico",
        "icons/icon.icns"
      ],
      "resources": [
        "lib/training/*.py"
      ],
      "targets": ["msi", "app", "deb", "appimage"]
    },
    "windows": [
      {
        "title": "FineTune Lab Desktop",
        "width": 1400,
        "height": 900,
        "resizable": true,
        "fullscreen": false
      }
    ]
  }
}
```

### 5.3 Build Commands
```json
// package.json
{
  "scripts": {
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "tauri:build:windows": "tauri build --target x86_64-pc-windows-msvc",
    "tauri:build:mac": "tauri build --target aarch64-apple-darwin",
    "tauri:build:linux": "tauri build --target x86_64-unknown-linux-gnu"
  }
}
```

---

## Phase 6: Testing & Verification

### 6.1 Core Functionality Tests
**Status**: ⏸️ PENDING IMPLEMENTATION

- [ ] Start desktop app and verify UI loads
- [ ] Create new training config
- [ ] Upload dataset
- [ ] Start local training job
- [ ] Monitor training metrics in real-time
- [ ] Stop training job mid-run
- [ ] Load trained model for inference
- [ ] Export trained model

### 6.2 Database Persistence Tests
- [ ] Create config, close app, reopen - config should persist
- [ ] Start training, close app, reopen - job status should persist
- [ ] Verify metrics are saved to SQLite correctly

### 6.3 GPU Compatibility Tests
- [ ] Test on NVIDIA GTX 1080 (8GB VRAM)
- [ ] Test on NVIDIA RTX 3090 (24GB VRAM)
- [ ] Test on NVIDIA RTX 4090 (24GB VRAM)
- [ ] Test with CUDA 11.8 and CUDA 12.1

---

## Phase 7: Distribution

### 7.1 Build Binaries
```bash
# Build for all platforms
npm run tauri:build:windows  # Creates .msi installer
npm run tauri:build:mac      # Creates .app bundle
npm run tauri:build:linux    # Creates .deb and .AppImage
```

### 7.2 Create GitHub Release
**Status**: ⏸️ PENDING BUILD

1. Go to `finetunelab-desktop` repository
2. Create new release: v1.0.0
3. Upload binaries:
   - `FineTuneLab-Desktop-1.0.0-Setup.msi` (Windows)
   - `FineTuneLab-Desktop-1.0.0.dmg` (macOS)
   - `finetunelab-desktop_1.0.0_amd64.deb` (Linux Debian/Ubuntu)
   - `FineTuneLab-Desktop-1.0.0.AppImage` (Linux Universal)

### 7.3 Update README
**File**: `README.md`

```markdown
# FineTune Lab Desktop

Free, local-only desktop application for fine-tuning LLMs on your own hardware.

## Features
- ✅ Train models locally on your NVIDIA GPU
- ✅ Support for LoRA, QLoRA, and full fine-tuning
- ✅ Real-time training metrics and GPU monitoring
- ✅ Dataset management and validation
- ✅ Model inference testing
- ✅ No cloud dependencies, no subscriptions

## Requirements
- NVIDIA GPU with 8GB+ VRAM
- CUDA 11.8 or 12.1
- Windows 10+, macOS 12+, or Linux (Ubuntu 20.04+)

## Download
Download the latest version from [Releases](https://github.com/canfieldjuan/finetunelab-desktop/releases)

## Installation
### Windows
1. Download `FineTuneLab-Desktop-Setup.msi`
2. Run the installer
3. Launch from Start Menu

### macOS
1. Download `FineTuneLab-Desktop.dmg`
2. Open DMG and drag to Applications
3. Right-click → Open (first time only, due to Gatekeeper)

### Linux
**Debian/Ubuntu:**
```bash
sudo dpkg -i finetunelab-desktop_amd64.deb
```

**Universal AppImage:**
```bash
chmod +x FineTuneLab-Desktop.AppImage
./FineTuneLab-Desktop.AppImage
```

## First Run
1. The app will create a local database in your user data directory
2. Start training by clicking "New Training Config"
3. Upload a dataset in JSONL format
4. Configure training parameters
5. Click "Start Training"

## Source Code
This is a free, local-only version. The source code for the web SaaS version is proprietary.

## Support
- Issues: [GitHub Issues](https://github.com/canfieldjuan/finetunelab-desktop/issues)
- Docs: [Documentation](https://finetunelab.ai/docs)

## License
[Choose appropriate license - MIT, GPL, etc.]
```

---

## Risk Assessment

### High Risk Items
1. **Python Dependency Bundling**: Tauri needs to bundle Python + PyTorch + CUDA
   - **Mitigation**: Use PyInstaller to create standalone Python executable
   - **Alternative**: Require user to install Python/PyTorch separately

2. **CUDA Version Compatibility**: Users may have different CUDA versions
   - **Mitigation**: Ship multiple builds for CUDA 11.8 and 12.1
   - **Alternative**: Auto-detect CUDA and download appropriate PyTorch

3. **Large Binary Size**: PyTorch + CUDA can be 2-5GB
   - **Mitigation**: Use installer that downloads PyTorch on first run
   - **Alternative**: Separate "runtime" download

### Medium Risk Items
1. **Database Migration**: Converting Supabase schema to SQLite
   - **Mitigation**: Extensive testing, schema validation

2. **Real-time Metrics**: No Supabase Realtime for live updates
   - **Mitigation**: Use WebSocket or polling for local metrics updates

### Low Risk Items
1. **UI/UX Changes**: Minimal changes to React components
2. **File System Access**: Tauri provides good FS APIs

---

## File Manifest

### Files to KEEP (Local Training Core)

**Python Training Engine:**
```
lib/training/standalone_trainer.py
lib/training/pretokenize_dataset.py
lib/training/convert_to_gguf.py
lib/training/test_*.py (testing utilities)
```

**TypeScript Types & Services:**
```
lib/training/training-config.types.ts
lib/training/dataset.types.ts
lib/training/dataset-url-service.ts
```

**Frontend Pages:**
```
app/training/page.tsx
app/datasets/page.tsx
app/layout.tsx
app/page.tsx (landing - simplify)
```

**Training Components (92 files):**
```
components/training/TrainingWorkflow.tsx
components/training/DatasetManager.tsx
components/training/ConfigEditor.tsx
components/training/TrainingDashboard.tsx
components/training/ModelSelector.tsx
components/training/LoRAConfig.tsx
components/training/LossChart.tsx
components/training/GPUMemoryChart.tsx
components/training/MetricsOverviewCard.tsx
components/training/DatasetUpload.tsx
components/training/DatasetPreview.tsx
components/training/CheckpointSelector.tsx
... (82 more training components)
```

**UI Components:**
```
components/ui/* (all Shadcn components)
components/layout/PageWrapper.tsx (simplified)
components/layout/PageHeader.tsx
components/branding/*
```

**API Routes (Local Only):**
```
app/api/training/route.ts
app/api/training/local/route.ts
app/api/training/local/metrics/route.ts
app/api/datasets/route.ts
app/api/training/[id]/route.ts
app/api/training/checkpoints/list/route.ts
```

**Configuration:**
```
next.config.ts
tailwind.config.ts
tsconfig.json
package.json (modified dependencies)
```

### Files to REMOVE (Cloud Dependencies)

**Authentication & Supabase (Complete Removal):**
```
lib/supabase/
lib/supabaseAdmin.ts
lib/supabaseClient.ts
lib/auth.ts
contexts/AuthContext.tsx
app/api/auth/
```

**Payment & Subscription:**
```
lib/stripe/
lib/subscriptions/
lib/pricing/
app/api/stripe/
app/upgrade/
components/subscription/
components/pricing/
```

**Cloud Training:**
```
app/api/training/deploy/
app/api/training/cloud-check/
lib/training/runpod-service.ts
lib/training/distributed-orchestrator.ts
lib/training/deployment.types.ts
lib/training/job-handlers.ts (cloud parts)
components/training/CloudDeploymentWizard.tsx
components/training/CloudDeploymentConfirmationDialog.tsx
components/training/DeploymentTargetSelector.tsx
components/training/UnifiedPackageGenerator.tsx
components/training/PackageGenerator.tsx
components/training/GeneratedPackageDisplay.tsx
```

**Content Pages:**
```
app/lab-academy/
app/lab-notes/
app/case-studies/
app/chat/
app/graphrag-demo/
app/inference/ (cloud inference)
app/docs/
```

**Analytics & Admin:**
```
app/analytics/
lib/analytics/
lib/logging/ (cloud logging)
components/analytics/
```

**Testing & Development (Optional Cleanup):**
```
__tests__/
test-*.js
*.test.ts
*.test.tsx
check_*.js
verify_*.js
debug_*.js
analyze_*.py
```

**Documentation (Keep only relevant):**
```
*.md (most can be removed, keep README)
PROJECT_LOGS/ (remove all logs)
docs/ (remove)
```

---

## Dependencies Cleanup

### Remove from package.json
```json
{
  "dependencies": {
    // REMOVE:
    "@supabase/supabase-js",
    "@supabase/ssr",
    "stripe",
    // Analytics
    "@vercel/analytics",
    "posthog-js",
    // Cloud integrations
    "aws-sdk",
    // KEEP:
    "next",
    "react",
    "react-dom",
    "tailwindcss",
    "@radix-ui/*",
    "lucide-react",
    "recharts",
    "zod",
    "react-hook-form"
  }
}
```

### Add Desktop Dependencies
```json
{
  "dependencies": {
    "@tauri-apps/api": "^1.5.0",
    "better-sqlite3": "^9.2.0",
    "@types/better-sqlite3": "^7.6.8"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^1.5.0"
  }
}
```

---

## Environment Variables

### Remove (Cloud-specific)
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# Stripe
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET

# Analytics
NEXT_PUBLIC_POSTHOG_KEY
VERCEL_ANALYTICS_ID

# Cloud Providers
RUNPOD_API_KEY
LAMBDA_API_KEY
```

### Keep (Local Only)
```bash
# Optional: HuggingFace for model downloads
HUGGINGFACE_TOKEN

# Python path (auto-detected or user-configured)
PYTHON_PATH=/usr/bin/python3
```

---

## Success Criteria

### Phase 2-3 Success Metrics
- [ ] New repository created and accessible
- [ ] All cloud-specific files removed
- [ ] SQLite database initialized successfully
- [ ] All training pages load without errors
- [ ] No Supabase imports remain in codebase

### Phase 4-5 Success Metrics
- [ ] Desktop app builds successfully for Windows/Mac/Linux
- [ ] App launches without errors
- [ ] Database persists between app restarts
- [ ] Training can start and complete successfully

### Phase 6-7 Success Metrics
- [ ] All core tests pass
- [ ] Binaries created for all platforms
- [ ] GitHub release published
- [ ] README and documentation complete
- [ ] At least 3 different GPU models tested successfully

---

## Timeline Estimate

**Phase 2: Repository Setup** - 1 hour
- Create repo, clone, initial cleanup

**Phase 3: Database Migration** - 8-12 hours
- Implement SQLite service
- Replace all Supabase calls
- Test CRUD operations

**Phase 4: Remove Auth** - 4-6 hours
- Simplify page wrappers
- Remove auth from API routes
- Test all pages load correctly

**Phase 5: Tauri Setup** - 6-8 hours
- Install and configure Tauri
- Bundle Python dependencies
- Build and test desktop app

**Phase 6: Testing** - 8-10 hours
- Core functionality tests
- GPU compatibility tests
- Database persistence tests
- Bug fixes

**Phase 7: Distribution** - 4-6 hours
- Build binaries for all platforms
- Create GitHub release
- Write documentation

**Total Estimated Time**: 31-43 hours

---

## Next Steps - AWAITING APPROVAL

1. **Review this plan** and provide feedback
2. **Approve Phase 2** (Repository Setup)
3. **Execute file removal script** after verification
4. **Begin Phase 3** (Database Migration)

---

## Notes & Considerations

1. **Code Signing**: Windows/Mac binaries may need code signing for distribution
   - Windows: Requires EV Code Signing Certificate (~$300/year)
   - Mac: Requires Apple Developer Account ($99/year)
   - Linux: No signing required

2. **Auto-Updates**: Consider implementing auto-update mechanism (Tauri supports this)

3. **Error Reporting**: Since no cloud backend, consider local crash logs

4. **User Data Location**:
   - Windows: `C:\Users\<username>\AppData\Roaming\finetunelab-desktop\`
   - Mac: `~/Library/Application Support/finetunelab-desktop/`
   - Linux: `~/.local/share/finetunelab-desktop/`

5. **Backup/Export**: Implement database export feature for user data backup

---

**END OF PLAN**
**Status**: Phase 1 Complete, Awaiting Approval for Phase 2
