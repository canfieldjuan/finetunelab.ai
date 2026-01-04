# Fix Worker Agent Download Redirect Issue - Implementation Plan
**Date**: 2025-12-31
**Status**: 🔴 AWAITING APPROVAL

## Problem Statement

**Current Issue**:
- Download buttons in `/workers` page redirect to GitHub instead of downloading files directly
- Lines 111-120 and 131-144 in `WorkerAgentSetupSection.tsx` use `<a>` tags with `download` attribute
- `download` attribute does NOT work for cross-origin URLs (GitHub)
- Users are redirected to GitHub instead of getting a direct download

**Expected Behavior** (from original implementation plan):
1. User clicks download button → file downloads directly to their PC
2. User generates API key
3. User copies installation commands
4. User runs installer which installs to `~/.finetunelab/training-agent/`
5. User updates `.env` file with API key

**Root Cause**:
Cross-origin downloads using `<a download>` attribute don't work. Browser security prevents this.

---

## Solution Approach

### Option 1: Proxy API Endpoint (RECOMMENDED)
Create `/api/workers/download/[platform]` endpoint that:
1. Fetches file from GitHub releases
2. Streams to user with `Content-Disposition: attachment` header
3. Triggers browser download

**Pros**:
- Works across all browsers
- Consistent with existing download patterns in codebase
- No CORS issues
- Can add download analytics/tracking

**Cons**:
- Requires server resources for streaming
- Slightly slower (extra hop through server)

### Option 2: JavaScript Fetch + Blob Download
Use JavaScript to:
1. Fetch file from GitHub using `fetch()`
2. Convert to Blob
3. Create object URL
4. Trigger download

**Pros**:
- No server endpoint needed
- Direct download from GitHub CDN

**Cons**:
- May hit CORS issues
- Browser memory limitations for large files
- Less reliable across browsers

**DECISION**: Use Option 1 (Proxy API Endpoint) - matches existing patterns in codebase

---

## Implementation Plan

### Phase 1: Create Download API Endpoint

**File**: `/home/juan-canfield/Desktop/web-ui/app/api/workers/download/[platform]/route.ts` (NEW)

**Purpose**: Proxy downloads from GitHub releases to user's browser

**Code Structure**:
```typescript
/**
 * Worker Agent Download Proxy
 * Fetches training-agent from GitHub and streams to user
 * GET /api/workers/download/linux
 * GET /api/workers/download/darwin
 * GET /api/workers/download/windows
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
  // 1. Validate platform parameter
  // 2. Construct GitHub URL
  // 3. Fetch from GitHub
  // 4. Stream to user with proper headers
  // 5. Handle errors
}
```

**Validation**:
- Platform must be: 'linux', 'darwin', or 'windows'
- Version from env var or default to v0.1.2
- Return 400 for invalid platform

**GitHub URL Construction**:
```typescript
const version = process.env.NEXT_PUBLIC_TRAINING_AGENT_VERSION || 'v0.1.2';
const baseUrl = `https://github.com/FineTune-Lab/training-agent/releases/download/${version}`;

const fileMap = {
  linux: `training-agent-linux-amd64.tar.gz`,
  darwin: `training-agent-darwin-amd64.tar.gz`,
  windows: `training-agent-windows-amd64.zip`,
};

const filename = fileMap[platform];
const githubUrl = `${baseUrl}/${filename}`;
```

**Streaming Response**:
```typescript
const response = await fetch(githubUrl);

if (!response.ok) {
  return NextResponse.json(
    { error: 'Failed to fetch training agent' },
    { status: 404 }
  );
}

// Stream response
return new NextResponse(response.body, {
  status: 200,
  headers: {
    'Content-Type': platform === 'windows' ? 'application/zip' : 'application/gzip',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'public, max-age=3600',
  },
});
```

**Error Handling**:
- 400: Invalid platform
- 404: File not found on GitHub
- 500: Fetch error or streaming error

**Files to Create**:
1. `/app/api/workers/download/[platform]/route.ts` (NEW - ~100 lines)

---

### Phase 2: Update UI to Use New Endpoint

**File**: `/home/juan-canfield/Desktop/web-ui/lib/workers/platform-utils.ts` (MODIFY)

**Current Code** (Lines 26-51):
```typescript
export function getPlatformDownloads(
  version: string = process.env.NEXT_PUBLIC_TRAINING_AGENT_VERSION || 'v0.1.2'
): PlatformDownload[] {
  const baseUrl = `https://github.com/FineTune-Lab/training-agent/releases/download/${version}`;

  return [
    {
      platform: 'linux',
      label: 'Linux (AMD64)',
      url: `${baseUrl}/training-agent-linux-amd64.tar.gz`,
      filename: 'training-agent-linux-amd64.tar.gz',
      icon: 'Terminal',
    },
    // ...
  ];
}
```

**Proposed Change**:
```typescript
export function getPlatformDownloads(
  version: string = process.env.NEXT_PUBLIC_TRAINING_AGENT_VERSION || 'v0.1.2'
): PlatformDownload[] {
  // Use API proxy endpoint instead of direct GitHub URLs
  return [
    {
      platform: 'linux',
      label: 'Linux (AMD64)',
      url: `/api/workers/download/linux`,  // CHANGED
      filename: 'training-agent-linux-amd64.tar.gz',
      icon: 'Terminal',
    },
    {
      platform: 'darwin',
      label: 'macOS (AMD64)',
      url: `/api/workers/download/darwin`,  // CHANGED
      filename: 'training-agent-darwin-amd64.tar.gz',
      icon: 'Apple',
    },
    {
      platform: 'windows',
      label: 'Windows (AMD64)',
      url: `/api/workers/download/windows`,  // CHANGED
      filename: 'training-agent-windows-amd64.zip',
      icon: 'MonitorSmartphone',
    },
  ];
}
```

**Files to Modify**:
1. `/lib/workers/platform-utils.ts` - Lines 30, 37, 44 (3 URL changes)

**Impact**:
- `WorkerAgentSetupSection.tsx` uses `getPlatformDownloads()` - no changes needed
- Download links now point to local API endpoint
- `<a download>` attribute will work (same-origin)

---

### Phase 3: Update GitHub Releases Link

**File**: `/home/juan-canfield/Desktop/web-ui/components/workers/WorkerAgentSetupSection.tsx` (VERIFY ONLY)

**Current Code** (Lines 150-161):
```tsx
{/* GitHub Releases Link */}
<div className="mt-4 pt-4 border-t border-border">
  <a
    href="https://github.com/FineTune-Lab/training-agent/releases"
    target="_blank"
    rel="noopener noreferrer"
    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
  >
    View all releases on GitHub
    <ExternalLink className="h-3 w-3" />
  </a>
</div>
```

**Verification**: This link is correct - it's meant to open GitHub in new tab, not download

**No Changes Needed**: ✅

---

### Phase 4: Update Setup Instructions

**File**: `/home/juan-canfield/Desktop/web-ui/lib/workers/platform-utils.ts` (VERIFY ONLY)

**Current Code** (Lines 57-98):
```typescript
export function getSetupInstructions(platform: Platform, apiKey: string): string {
  const instructions = {
    linux: `# Step 1: Extract the downloaded file
cd ~/Downloads
tar -xzf training-agent-linux-amd64.tar.gz
cd training-agent

# Step 2: Run installer with API key
chmod +x scripts/install.sh
API_KEY="${apiKey}" ./scripts/install.sh
// ...
```

**Verification**:
- Instructions assume user already downloaded file
- Instructions are correct for post-download steps
- No changes needed

**No Changes Needed**: ✅

---

## Verification Plan

### Test Case 1: Linux Download
**Steps**:
1. Navigate to `/workers` page
2. Click "Download for Linux" button
3. Verify file downloads directly (not redirect to GitHub)
4. Check filename: `training-agent-linux-amd64.tar.gz`
5. Verify file size: ~50KB
6. Extract and verify contents

**Expected**:
- ✅ Direct download (no GitHub redirect)
- ✅ Correct filename
- ✅ Valid tar.gz file

### Test Case 2: macOS Download
**Steps**:
1. Click "macOS (AMD64)" card
2. Verify file downloads directly
3. Check filename: `training-agent-darwin-amd64.tar.gz`

**Expected**:
- ✅ Direct download
- ✅ Correct filename
- ✅ Valid tar.gz file

### Test Case 3: Windows Download
**Steps**:
1. Click "Windows (AMD64)" card
2. Verify file downloads directly
3. Check filename: `training-agent-windows-amd64.zip`

**Expected**:
- ✅ Direct download
- ✅ Correct filename
- ✅ Valid zip file

### Test Case 4: API Endpoint Error Handling
**Steps**:
1. Test `/api/workers/download/invalid` → 400 error
2. Test with broken GitHub release → 404 error
3. Test with network error → 500 error

**Expected**:
- ✅ Proper error responses
- ✅ No server crashes

### Test Case 5: End-to-End Setup Flow
**Steps**:
1. Download worker agent
2. Generate API key
3. Copy setup instructions
4. Follow instructions
5. Verify worker registers

**Expected**:
- ✅ Complete flow works
- ✅ No manual GitHub navigation needed

---

## Files Summary

### Files to Create (1)
1. `/app/api/workers/download/[platform]/route.ts` - Download proxy API (~100 lines)

### Files to Modify (1)
1. `/lib/workers/platform-utils.ts` - Update 3 URLs (Lines 30, 37, 44)

### Files to Verify (2)
1. `/components/workers/WorkerAgentSetupSection.tsx` - Verify no changes needed
2. `/lib/workers/platform-utils.ts` - Verify setup instructions correct

### Total Changes
- **New files**: 1
- **Modified files**: 1
- **Lines changed**: ~103 total (100 new + 3 modified)

---

## Breaking Changes Analysis

### API
- ✅ NEW endpoint `/api/workers/download/[platform]` (additive, non-breaking)
- ✅ No existing endpoints modified

### UI
- ✅ Download URLs changed from external (GitHub) to internal (API)
- ✅ Behavior improved (download instead of redirect)
- ✅ No UI component changes required

### User Experience
- ✅ IMPROVEMENT: Direct downloads instead of GitHub redirects
- ✅ IMPROVEMENT: Faster download experience
- ✅ IMPROVEMENT: Consistent with app UX patterns

### Backward Compatibility
- ✅ Old bookmarked GitHub URLs still work (external)
- ✅ No database changes
- ✅ No breaking changes

---

## Rollback Plan

If issues occur:

### Revert Code Changes
```bash
git diff lib/workers/platform-utils.ts
git checkout lib/workers/platform-utils.ts
rm -rf app/api/workers/download
```

### Quick Fix (Temporary)
Point URLs back to GitHub (will redirect but won't break):
```typescript
url: `https://github.com/FineTune-Lab/training-agent/releases/download/v0.1.2/training-agent-linux-amd64.tar.gz`
```

---

## Implementation Steps (Awaiting Approval)

### Step 1: Verify Current Behavior
- [ ] Navigate to `/workers` page
- [ ] Click Linux download button
- [ ] Confirm it redirects to GitHub (broken behavior)

### Step 2: Create API Endpoint
- [ ] Create `/app/api/workers/download/[platform]/route.ts`
- [ ] Implement download proxy logic
- [ ] Test endpoint manually with curl

### Step 3: Update platform-utils.ts
- [ ] Change 3 URLs to use new API endpoint
- [ ] Verify TypeScript compilation

### Step 4: Test Downloads
- [ ] Test Linux download
- [ ] Test macOS download
- [ ] Test Windows download
- [ ] Verify no GitHub redirects

### Step 5: End-to-End Test
- [ ] Complete worker setup flow
- [ ] Verify worker registers successfully

### Step 6: Build Verification
- [ ] Run `npx tsc --noEmit`
- [ ] Run `npm run build`
- [ ] Verify no errors

---

## Next Steps

**AWAITING USER APPROVAL**

Once approved, I will:
1. Create the download proxy API endpoint
2. Update the platform-utils.ts URLs
3. Test all download flows
4. Verify end-to-end setup works

**Estimated Time**: 30-45 minutes
- Create API endpoint: 20 minutes
- Update URLs: 5 minutes
- Testing: 15-20 minutes

---

**Status**: 🔴 AWAITING APPROVAL
**Date**: 2025-12-31
**Author**: Claude Code (Sonnet 4.5)
