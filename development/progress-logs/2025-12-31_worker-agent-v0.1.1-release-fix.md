# Worker Agent v0.1.1 Release Fix - Implementation Plan
**Date**: 2025-12-31
**Objective**: Update web UI to point to v0.1.1 and create proper platform-specific archives for download

## Problem Statement

### Current State
- Web UI points to v0.1.0 release (lib/workers/platform-utils.ts:26)
- GitHub has v0.1.1 release but NO platform-specific archives
- Expected download URLs return 404:
  - `training-agent-linux-amd64.tar.gz`
  - `training-agent-darwin-amd64.tar.gz`
  - `training-agent-windows-amd64.zip`

### Root Cause
- FineTune-Lab/training-agent repo was restructured (removed web-ui files)
- v0.1.1 release created but platform-specific archives were NOT uploaded
- Web UI still references old v0.1.0 version

## Impact
- Users cannot download worker agent from UI
- "Setup & Download" tab in Worker Agents page is broken
- Download links result in 404 errors

---

## Phased Implementation Plan

### Phase 1: Verification and Analysis
**Objective**: Verify current state and identify all affected files

**Tasks**:
1. Verify v0.1.1 release exists and has no archives
2. Find all files that reference version or download URLs
3. Check for environment variables that control version
4. Verify training-agent repo structure for archive creation
5. Check if any other components depend on platform-utils.ts

**Files to Review**:
- `/home/juan-canfield/Desktop/web-ui/lib/workers/platform-utils.ts`
- `/home/juan-canfield/Desktop/web-ui/components/workers/WorkerAgentSetupSection.tsx`
- `/home/juan-canfield/Desktop/web-ui/.env.local`
- `/home/juan-canfield/Desktop/web-ui/.env.example`
- Any TypeScript files importing from `@/lib/workers/platform-utils`

**Success Criteria**:
- Complete list of affected files identified
- No hardcoded versions in other files
- Archive creation approach verified

---

### Phase 2: Create Platform-Specific Archives
**Objective**: Create proper archives for Linux, macOS, and Windows

**Source**: `/tmp/training-agent-repo` (restructured repo)

**Archives to Create**:
1. **Linux**: `training-agent-linux-amd64.tar.gz`
   - Contents: src/, scripts/, .env.example, requirements.txt, README.md, etc.
   - Format: tar.gz

2. **macOS**: `training-agent-darwin-amd64.tar.gz`
   - Same contents as Linux
   - Format: tar.gz

3. **Windows**: `training-agent-windows-amd64.zip`
   - Same contents
   - Format: zip

**Steps**:
1. Verify source directory structure
2. Create tar.gz for Linux (exclude .git, .github)
3. Create tar.gz for macOS (same as Linux)
4. Create zip for Windows
5. Verify archive contents and sizes

**Success Criteria**:
- All 3 archives created successfully
- Archives contain correct files (no .git, no .github)
- File sizes reasonable (~20-30KB)

---

### Phase 3: Upload Archives to v0.1.1 Release
**Objective**: Upload platform-specific archives to GitHub release

**Steps**:
1. Verify v0.1.1 release exists
2. Upload training-agent-linux-amd64.tar.gz
3. Upload training-agent-darwin-amd64.tar.gz
4. Upload training-agent-windows-amd64.zip
5. Verify uploads succeeded and are downloadable

**Commands**:
```bash
cd /tmp/training-agent-repo
gh release upload v0.1.1 --repo FineTune-Lab/training-agent \
  training-agent-linux-amd64.tar.gz \
  training-agent-darwin-amd64.tar.gz \
  training-agent-windows-amd64.zip
```

**Success Criteria**:
- All 3 files uploaded to v0.1.1 release
- Files are publicly downloadable
- Download URLs return 200 (not 404)

---

### Phase 4: Update Web UI Version Reference
**Objective**: Update web UI to point to v0.1.1

**File to Modify**: `/home/juan-canfield/Desktop/web-ui/lib/workers/platform-utils.ts`

**Current Code (Line 26)**:
```typescript
export function getPlatformDownloads(version: string = 'v0.1.0'): PlatformDownload[] {
```

**Proposed Change**:
```typescript
export function getPlatformDownloads(version: string = 'v0.1.1'): PlatformDownload[] {
```

**Verification Steps**:
1. Read current file content
2. Verify exact line number and content
3. Verify no other files hardcode v0.1.0
4. Make change
5. Verify TypeScript compilation succeeds
6. Check if any imports or dependencies are affected

**Success Criteria**:
- Version updated to v0.1.1
- No TypeScript errors
- No breaking changes to dependent components

---

### Phase 5: Environment Variable Configuration (Optional Enhancement)
**Objective**: Make version configurable via environment variable for easier future updates

**File to Modify**: `/home/juan-canfield/Desktop/web-ui/lib/workers/platform-utils.ts`

**Proposed Enhancement**:
```typescript
export function getPlatformDownloads(
  version: string = process.env.NEXT_PUBLIC_TRAINING_AGENT_VERSION || 'v0.1.1'
): PlatformDownload[] {
```

**Environment Files**:
- `.env.local`: Add `NEXT_PUBLIC_TRAINING_AGENT_VERSION=v0.1.1`
- `.env.example`: Add comment explaining the variable

**Success Criteria**:
- Version can be overridden via env var
- Default value still v0.1.1 if not set
- No breaking changes

---

### Phase 6: Testing and Validation
**Objective**: Verify complete download flow works end-to-end

**Test Cases**:
1. Navigate to /workers page
2. Click "Setup & Download" tab
3. Verify detected platform shows correct download
4. Click platform-specific download button
5. Verify file downloads successfully
6. Verify "View all releases on GitHub" link works
7. Test on all 3 platform cards (Linux, macOS, Windows)

**Success Criteria**:
- All download links return 200
- Files download correctly
- GitHub releases link works
- No console errors
- No 404 errors

---

### Phase 7: Build and Deployment Verification
**Objective**: Ensure changes don't break production build

**Steps**:
1. Run TypeScript type checking: `npx tsc --noEmit`
2. Run build: `npm run build`
3. Verify no errors or warnings
4. Check build output for worker-related pages
5. Test in development mode: `npm run dev`

**Success Criteria**:
- TypeScript compilation succeeds
- Build completes without errors
- No runtime errors in development
- Worker Agents page renders correctly

---

## Files Affected

### To Modify:
1. `/home/juan-canfield/Desktop/web-ui/lib/workers/platform-utils.ts`
   - Line 26: Update version from 'v0.1.0' to 'v0.1.1'

### To Verify (No Changes):
1. `/home/juan-canfield/Desktop/web-ui/components/workers/WorkerAgentSetupSection.tsx`
   - Uses getPlatformDownloads() - should work after version update
2. `/home/juan-canfield/Desktop/web-ui/components/workers/WorkerAgentManagement.tsx`
   - Parent component - no version references
3. `/home/juan-canfield/Desktop/web-ui/app/workers/page.tsx`
   - Uses WorkerAgentManagement - no direct dependencies

### To Create:
1. Platform-specific archives in `/tmp/training-agent-repo/`
2. Upload to GitHub release v0.1.1

---

## Rollback Plan

If issues occur:

1. **Revert web UI change**:
   ```typescript
   // Revert platform-utils.ts line 26
   export function getPlatformDownloads(version: string = 'v0.1.0'): PlatformDownload[] {
   ```

2. **Create v0.1.0 release** (if needed):
   - Create v0.1.0 release with same archives
   - Keep v0.1.1 as alternate version

3. **Git revert**:
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

---

## Next Steps

**Awaiting Approval**: Proceed with Phase 1 verification?

**Estimated Time**: 30-45 minutes total
- Phase 1: 5 minutes
- Phase 2: 10 minutes
- Phase 3: 5 minutes
- Phase 4: 5 minutes
- Phase 5: 5 minutes (optional)
- Phase 6: 10 minutes
- Phase 7: 5 minutes
