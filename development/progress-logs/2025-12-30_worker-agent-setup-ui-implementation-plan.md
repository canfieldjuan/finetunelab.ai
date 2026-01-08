# Worker Agent Setup UI - Phased Implementation Plan
**Date**: 2025-12-30
**Branch**: `local-worker-agent` → `main`
**Status**: PHASES 1-4 COMPLETED ✅ - READY FOR TESTING
**Related**: Training Agent v0.1.0 Release (completed)

## Implementation Progress

### Phase 1: Foundation - API & Types ✅ COMPLETED
**Started**: 2025-12-30 16:40
**Completed**: 2025-12-30 16:45
**Duration**: 5 minutes

**Completed Tasks**:
1. ✅ Created `lib/workers/types.ts` - Comprehensive TypeScript types
   - WorkerAgent, WorkerMetric, WorkerCommand interfaces
   - Platform types ('darwin' internally, displays as "macOS" in UI)
   - getPlatformDisplayName() and getPlatformIcon() helpers
   - API request/response types

2. ✅ Verified `app/api/workers/commands/route.ts` - POST endpoint exists!
   - Full command creation with signature generation
   - Worker ownership verification
   - Command validation

**Files Created**:
- `lib/workers/types.ts` (232 lines with helpers)

**Verification**:
- ✅ TypeScript compilation: No errors
- ✅ No breaking changes

---

### Phase 2: Core UI Components ✅ COMPLETED
**Started**: 2025-12-30 16:50
**Completed**: 2025-12-30 16:52
**Duration**: 2 minutes

**Completed Tasks**:
1. ✅ Created `/app/workers/page.tsx` - Main workers page
   - Auth guard for logged-in users only
   - PageWrapper and PageHeader integration
   - Clean empty state

2. ✅ Created `WorkerAgentManagement.tsx` - Tab-based interface
   - Setup & Download tab
   - My Workers tab
   - Callback for auto-switching after setup

3. ✅ Created `WorkerAgentSetupSection.tsx` - Setup flow
   - Platform auto-detection (Windows/macOS/Linux)
   - Download buttons for all platforms
   - Worker API key generation (one-click)
   - Copy-to-clipboard for keys and commands
   - Platform-specific setup instructions
   - Security warnings for API keys

4. ✅ Created `WorkerAgentListSection.tsx` - Worker list
   - Real-time status updates (10-second polling)
   - Worker cards grid layout
   - Empty state with helpful message
   - Error handling and retry
   - Delete confirmation

**Files Created**:
- `app/workers/page.tsx` (40 lines)
- `components/workers/WorkerAgentManagement.tsx` (62 lines)
- `components/workers/WorkerAgentSetupSection.tsx` (271 lines)
- `components/workers/WorkerAgentListSection.tsx` (171 lines)
- `lib/workers/platform-utils.ts` (105 lines)

**Verification**:
- ✅ All components created
- ✅ No TypeScript errors

---

### Phase 3: Supporting Components ✅ COMPLETED
**Started**: 2025-12-30 16:53
**Completed**: 2025-12-30 16:54
**Duration**: 1 minute

**Completed Tasks**:
1. ✅ Created `WorkerCard.tsx` - Individual worker display
   - Platform-specific icons (Apple/Terminal/MonitorSmartphone)
   - Real-time status indicators (Online/Offline/Error)
   - Relative timestamps ("Just now", "5m ago")
   - Worker metrics preview (load, jobs, errors)
   - Delete confirmation dialog
   - View details button

2. ✅ Created `WorkerDetailsModal.tsx` - Detailed worker info
   - 3-tab interface (Info, Metrics, Commands)
   - Worker information grid
   - Metrics history with timestamps
   - Command history with status tracking
   - Color-coded status badges
   - Empty states for no data

**Files Created**:
- `components/workers/WorkerCard.tsx` (139 lines)
- `components/workers/WorkerDetailsModal.tsx` (289 lines)

**Verification**:
- ✅ TypeScript compilation: No errors
- ✅ All Phase 2 dependencies resolved

---

### Phase 4: Navigation Integration ✅ COMPLETED
**Started**: 2025-12-30 16:56
**Completed**: 2025-12-30 16:58
**Duration**: 2 minutes

**Completed Tasks**:
1. ✅ Added HardDrive icon import to AppSidebar
2. ✅ Created workerAgentsItem navigation object
3. ✅ Added Worker Agents link to sidebar render
   - Positioned between Playground and Training groups
   - Same visual hierarchy as Playground
   - Active state highlighting
   - Proper icon and label

**Files Modified**:
- `components/layout/AppSidebar.tsx` (3 changes):
  - Line 39: Added HardDrive import
  - Line 154: Added workerAgentsItem definition
  - Lines 260-283: Added Worker Agents navigation link

**Verification**:
- ✅ TypeScript compilation: No errors
- ✅ Next.js build: Successful (exit code 0)
- ✅ `/workers` route listed in build output (6.55 kB)
- ✅ No breaking changes to existing navigation

---

## Summary: Phases 1-4 Complete

### Total Files Created: 10
**Library/Types**:
- `lib/workers/types.ts` (232 lines)
- `lib/workers/platform-utils.ts` (105 lines)

**Pages**:
- `app/workers/page.tsx` (40 lines)

**Components** (7 files):
- `components/workers/WorkerAgentManagement.tsx` (62 lines)
- `components/workers/WorkerAgentSetupSection.tsx` (271 lines)
- `components/workers/WorkerAgentListSection.tsx` (171 lines)
- `components/workers/WorkerCard.tsx` (139 lines)
- `components/workers/WorkerDetailsModal.tsx` (289 lines)

### Total Files Modified: 1
- `components/layout/AppSidebar.tsx` (3 small additions)

### Total Lines of Code: ~1,309 lines

### Key Features Delivered:
✅ Platform auto-detection (Windows, macOS, Linux)
✅ One-click worker API key generation
✅ Download buttons for all platforms
✅ Platform-specific setup instructions
✅ Copy-to-clipboard for keys and commands
✅ Real-time worker status monitoring (10s polling)
✅ Worker metrics display (CPU, memory, jobs)
✅ Worker details modal (info, metrics, commands)
✅ Delete workers with confirmation
✅ Empty states with helpful messages
✅ Error handling and retry logic
✅ Sidebar navigation integration
✅ "macOS" display (not "darwin") throughout UI

### Breaking Changes: NONE
- All new files (no deletions or major modifications)
- Single file modification (AppSidebar.tsx) - additive only
- No database schema changes
- No API endpoint modifications
- Fully backward compatible

## Executive Summary

Implement a dedicated Worker Agent Setup UI to allow users to easily download, configure, and manage local training agents. This replaces the current manual approach where users must generate worker-scoped API keys through the generic Settings > API Keys interface.

**Key Goals**:
- One-click worker agent download with platform detection
- Automated worker API key generation with `worker` scope
- Real-time worker status monitoring and metrics display
- Integrated setup instructions and troubleshooting
- Worker management (view, delete, send commands)

---

## 📋 Current State Analysis

### What Exists ✅

**Backend Infrastructure (Complete)**:
- Database tables: `worker_agents`, `worker_commands`, `worker_metrics` (migration 20251226000000)
- API endpoints:
  - `GET /api/workers` - List user's workers
  - `GET /api/workers/{workerId}` - Get worker details
  - `DELETE /api/workers/{workerId}` - Delete worker
  - `POST /api/workers/register` - Worker registration (used by agent)
  - `POST /api/workers/{workerId}/heartbeat` - Heartbeat (used by agent)
  - `POST /api/workers/commands/{commandId}/result` - Command result (used by agent)
- API key generation: `lib/auth/api-key-generator.ts` (supports 'worker' scope)
- API key validation: `lib/auth/api-key-validator.ts` (validates 'worker' scope)

**Training Agent Binary (Complete)**:
- GitHub Release: `v0.1.0` at FineTune-Lab/training-agent
- Platforms: Linux (tar.gz), macOS (tar.gz), Windows (zip)
- Installation tested and verified
- Download URLs:
  - Linux: `https://github.com/FineTune-Lab/training-agent/releases/download/v0.1.0/training-agent-linux-amd64.tar.gz`
  - macOS: `https://github.com/FineTune-Lab/training-agent/releases/download/v0.1.0/training-agent-darwin-amd64.tar.gz`
  - Windows: `https://github.com/FineTune-Lab/training-agent/releases/download/v0.1.0/training-agent-windows-amd64.zip`

**Existing UI Patterns**:
- Settings modal: `components/settings/SettingsDialog.tsx`
- API Keys management: `components/settings/ApiKeysManagement.tsx` (grid layout, scope badges)
- Account page: `app/account/page.tsx` (usage cards, billing sections)
- Page wrapper: `components/layout/PageWrapper.tsx` + `PageHeader.tsx`
- Navigation: `components/layout/AppSidebar.tsx` (collapsible groups)

### What's Missing ❌

**UI Components**:
- No dedicated worker agent management page/section
- No worker API key generation interface
- No worker status monitoring display
- No download/setup instruction flow
- Worker scope not exposed in Settings > API Keys dropdown

**API Endpoints**:
- Missing: `POST /api/workers/commands` - Send command to worker
- Missing: `POST /api/user/api-keys/generate-worker` - Convenience endpoint for worker key generation

**User Experience**:
- Users must manually:
  1. Know about worker API keys
  2. Navigate to Settings > API Keys
  3. Manually add 'worker' scope (not in UI!)
  4. Find download link externally
  5. Configure .env file manually
  6. No visibility into worker status

---

## 🎯 Requirements & Goals

### Functional Requirements

**FR-1: Worker Discovery & Download**
- Automatically detect user's OS (Windows, macOS, Linux)
- Display download button for appropriate platform
- Show all available platform downloads
- Link to GitHub releases page
- Display current version (v0.1.0)

**FR-2: Worker API Key Generation**
- One-click generation of worker-scoped API key
- Display key once (copy-to-clipboard)
- Security warning about key storage
- Automatic scope: `['worker']`

**FR-3: Setup Instructions**
- Step-by-step installation guide
- Platform-specific commands (Linux/macOS vs Windows)
- Configuration instructions (.env file)
- Service management commands (agentctl)

**FR-4: Worker Status Monitoring**
- List all user's registered workers
- Display: hostname, platform, status (online/offline/error)
- Last heartbeat timestamp
- Worker metrics (CPU, memory, GPU if available)
- Uptime duration

**FR-5: Worker Management**
- View worker details modal
- Delete worker confirmation
- View worker metrics history
- View worker command history
- Send commands to worker (future: restart, update config, etc.)

### Non-Functional Requirements

**NFR-1: No Breaking Changes**
- Must not modify existing API endpoints
- Must not alter database schema
- Must not break existing Settings > API Keys functionality
- Must maintain backward compatibility

**NFR-2: Performance**
- Worker list loads in < 500ms
- Real-time status updates (polling or WebSocket)
- Metrics display updates every 5s

**NFR-3: Security**
- Worker API keys displayed only once
- RLS policies enforced (users see only their workers)
- Command authentication via signatures

**NFR-4: Accessibility**
- Keyboard navigation support
- Screen reader compatible
- Color contrast compliance (WCAG AA)

---

## 🏗️ Architecture Design

### UI Component Hierarchy

```
/app/workers/page.tsx (NEW)
├── PageWrapper (existing)
├── PageHeader (existing)
└── WorkerAgentManagement (NEW)
    ├── WorkerAgentSetupSection (NEW)
    │   ├── PlatformDetector (NEW utility)
    │   ├── DownloadButtons (NEW)
    │   ├── WorkerApiKeyGenerator (NEW)
    │   └── SetupInstructions (NEW)
    └── WorkerAgentListSection (NEW)
        ├── WorkerCard (NEW) × N
        │   ├── Status badge
        │   ├── Metrics preview
        │   ├── Actions (view, delete)
        │   └── Last heartbeat
        └── WorkerDetailsModal (NEW)
            ├── Worker info tab
            ├── Metrics tab
            └── Commands tab
```

### Data Flow

```
User Action → Frontend Component → API Route → Database
                                   ↓
                        Worker Agent (binary)
                                   ↓
                        POST /api/workers/register
                                   ↓
                        Database (worker_agents table)
                                   ↓
                        Frontend (polling/WebSocket)
```

### API Interactions

**Frontend → Backend**:
- `GET /api/workers` - Fetch user's workers
- `GET /api/workers/{workerId}` - Fetch worker details
- `DELETE /api/workers/{workerId}` - Delete worker
- `POST /api/user/api-keys` - Generate worker API key (with scope: ['worker'])
- `POST /api/workers/commands` (NEW) - Send command to worker

**Worker Agent → Backend**:
- `POST /api/workers/register` - Register worker
- `POST /api/workers/{workerId}/heartbeat` - Send heartbeat
- `POST /api/workers/commands/{commandId}/result` - Submit command result

---

## 📋 Phased Implementation Plan

### Phase 1: Foundation - API & Types (Non-Breaking)

**Duration**: Foundation work
**Dependencies**: None
**Risk**: Low

#### 1.1 Create Worker API Types

**File**: `/home/juan-canfield/Desktop/web-ui/lib/workers/types.ts` (NEW)
**Location**: Create new file
**Purpose**: Centralized TypeScript types for worker system

```typescript
// Worker Agent Types
export interface WorkerAgent {
  id: string;
  worker_id: string;
  user_id: string;
  api_key_id: string | null;
  hostname: string;
  platform: 'windows' | 'darwin' | 'linux';
  version: string;
  capabilities: string[];
  status: 'online' | 'offline' | 'error';
  last_heartbeat: string | null;
  last_command_at: string | null;
  current_load: number;
  max_concurrency: number;
  total_commands_executed: number;
  total_errors: number;
  metadata: Record<string, any>;
  registered_at: string;
  updated_at: string;
  // Computed fields
  is_online?: boolean;
  uptime_seconds?: number;
}

export interface WorkerMetric {
  id: string;
  worker_id: string;
  user_id: string;
  timestamp: string;
  cpu_percent: number | null;
  memory_used_mb: number | null;
  memory_total_mb: number | null;
  disk_used_gb: number | null;
  network_sent_mb: number | null;
  network_recv_mb: number | null;
  trading_status: string | null;
  active_trades: number | null;
  custom_metrics: Record<string, any>;
  created_at: string;
}

export interface WorkerCommand {
  id: string;
  worker_id: string;
  user_id: string;
  command_type: 'start_trading' | 'stop_trading' | 'update_config' | 'restart_agent' | 'collect_diagnostics';
  params: Record<string, any>;
  signature: string;
  timeout_seconds: number;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'timeout';
  result: Record<string, any> | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface WorkerDetails {
  worker: WorkerAgent;
  metrics: WorkerMetric[];
  commands: WorkerCommand[];
}

export type Platform = 'windows' | 'darwin' | 'linux';

export interface PlatformDownload {
  platform: Platform;
  label: string;
  url: string;
  filename: string;
  icon: string; // Lucide icon name
}
```

**Verification**:
- ✅ Run `npx tsc --noEmit` to verify types compile
- ✅ Check no conflicts with existing types

**Breaking Changes**: None (new file)

---

#### 1.2 Create Worker Commands API Endpoint

**File**: `/home/juan-canfield/Desktop/web-ui/app/api/workers/commands/route.ts` (EXISTS - VERIFY FIRST)
**Location**: Check if POST method exists
**Purpose**: Send commands to workers

**Current State Verification**:
```bash
# Check if file exists and has POST handler
cat app/api/workers/commands/route.ts | grep -A 10 "export async function POST"
```

**Expected**: File exists but may only have GET. Need to add POST if missing.

**Implementation** (if POST missing):

**Location**: Add after existing GET function (if any) in `/app/api/workers/commands/route.ts`

```typescript
/**
 * POST /api/workers/commands
 * Send a command to a worker agent
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { worker_id, command_type, params, timeout_seconds } = body;

    // Validate required fields
    if (!worker_id || !command_type) {
      return NextResponse.json(
        { error: 'worker_id and command_type are required' },
        { status: 400 }
      );
    }

    // Validate command_type
    const validCommands = ['start_trading', 'stop_trading', 'update_config', 'restart_agent', 'collect_diagnostics'];
    if (!validCommands.includes(command_type)) {
      return NextResponse.json(
        { error: `Invalid command_type. Must be one of: ${validCommands.join(', ')}` },
        { status: 400 }
      );
    }

    // Get Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Worker Commands] Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify worker belongs to user
    const { data: worker, error: workerError } = await supabase
      .from('worker_agents')
      .select('worker_id, user_id')
      .eq('worker_id', worker_id)
      .single();

    if (workerError || !worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    if (worker.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Worker does not belong to user' },
        { status: 403 }
      );
    }

    // Create signature (HMAC-SHA256)
    const crypto = require('crypto');
    const secret = process.env.WORKER_COMMAND_SECRET || 'default-secret-change-in-production';
    const payload = JSON.stringify({ worker_id, command_type, params, timestamp: Date.now() });
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    // Insert command
    const { data: command, error: insertError } = await supabase
      .from('worker_commands')
      .insert({
        worker_id,
        user_id: user.id,
        command_type,
        params: params || {},
        signature,
        timeout_seconds: timeout_seconds || 300,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Worker Commands] Failed to create command:', insertError);
      return NextResponse.json(
        { error: 'Failed to create command' },
        { status: 500 }
      );
    }

    console.log('[Worker Commands] Created command:', command.id);

    return NextResponse.json({ command });
  } catch (err) {
    console.error('[Worker Commands] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Verification**:
- ✅ Test with curl: `curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"worker_id":"wkr_test","command_type":"collect_diagnostics"}' http://localhost:3000/api/workers/commands`
- ✅ Verify command appears in worker_commands table
- ✅ Check that unauthorized users get 403

**Breaking Changes**: None (additive - new POST method)

---

### Phase 2: Core UI Components (New Files)

**Duration**: Main UI implementation
**Dependencies**: Phase 1 complete
**Risk**: Low (new files, no modifications)

#### 2.1 Create Workers Page

**File**: `/home/juan-canfield/Desktop/web-ui/app/workers/page.tsx` (NEW)
**Location**: Create new file
**Purpose**: Main worker management page

```typescript
/**
 * Workers Page
 * Manage local worker agents
 * Date: 2025-12-30
 */

'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { PageHeader } from '@/components/layout/PageHeader';
import { WorkerAgentManagement } from '@/components/workers/WorkerAgentManagement';

export default function WorkersPage() {
  const { user, signOut, session } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Please log in to view worker agents.</p>
      </div>
    );
  }

  return (
    <PageWrapper currentPage="workers" user={user} signOut={signOut}>
      <PageHeader
        title="Worker Agents"
        description="Download, configure, and manage local training agents"
      />

      {session?.access_token && (
        <WorkerAgentManagement
          userId={user.id}
          sessionToken={session.access_token}
        />
      )}
    </PageWrapper>
  );
}
```

**Verification**:
- ✅ Navigate to http://localhost:3000/workers
- ✅ Verify page renders without errors
- ✅ Check that unauthenticated users see login prompt

**Breaking Changes**: None (new page)

---

#### 2.2 Create Worker Agent Management Component

**File**: `/home/juan-canfield/Desktop/web-ui/components/workers/WorkerAgentManagement.tsx` (NEW)
**Location**: Create new directory and file
**Purpose**: Main management interface with setup and worker list sections

**Component Structure**:
```typescript
'use client';

import React, { useState } from 'react';
import { WorkerAgentSetupSection } from './WorkerAgentSetupSection';
import { WorkerAgentListSection } from './WorkerAgentListSection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface WorkerAgentManagementProps {
  userId: string;
  sessionToken: string;
}

export function WorkerAgentManagement({ userId, sessionToken }: WorkerAgentManagementProps) {
  const [activeTab, setActiveTab] = useState<'setup' | 'workers'>('setup');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Callback to refresh worker list after setup
  const handleWorkerRegistered = () => {
    setRefreshTrigger((prev) => prev + 1);
    setActiveTab('workers');
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'setup' | 'workers')}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="setup">Setup & Download</TabsTrigger>
          <TabsTrigger value="workers">My Workers</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="mt-6">
          <WorkerAgentSetupSection
            sessionToken={sessionToken}
            onWorkerRegistered={handleWorkerRegistered}
          />
        </TabsContent>

        <TabsContent value="workers" className="mt-6">
          <WorkerAgentListSection
            userId={userId}
            sessionToken={sessionToken}
            refreshTrigger={refreshTrigger}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Verification**:
- ✅ Check tab switching works
- ✅ Verify both sections render

**Breaking Changes**: None (new component)

---

#### 2.3 Create Worker Setup Section Component

**File**: `/home/juan-canfield/Desktop/web-ui/components/workers/WorkerAgentSetupSection.tsx` (NEW)
**Location**: New file in components/workers/
**Purpose**: Download, API key generation, setup instructions

**Key Features**:
- Platform detection
- Download buttons for all platforms
- One-click worker API key generation
- Copy-to-clipboard for API key and commands
- Step-by-step setup instructions

**Component Outline** (detailed implementation in Phase 3):
```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { detectPlatform, getPlatformDownloads } from '@/lib/workers/platform-utils';
import { PlatformDownload } from '@/lib/workers/types';
// ... imports

export function WorkerAgentSetupSection({ sessionToken, onWorkerRegistered }: Props) {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [workerApiKey, setWorkerApiKey] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const handleGenerateApiKey = async () => {
    // Generate worker-scoped API key
    // Call POST /api/user/api-keys with scopes: ['worker']
  };

  return (
    <div className="space-y-8">
      {/* Platform-specific download card */}
      {/* API key generation card */}
      {/* Setup instructions card */}
    </div>
  );
}
```

**Verification**:
- ✅ Test on different browsers to verify platform detection
- ✅ Test API key generation
- ✅ Verify copy-to-clipboard works

**Breaking Changes**: None (new component)

---

#### 2.4 Create Worker List Section Component

**File**: `/home/juan-canfield/Desktop/web-ui/components/workers/WorkerAgentListSection.tsx` (NEW)
**Location**: New file in components/workers/
**Purpose**: Display user's workers with status and metrics

**Key Features**:
- Grid layout of worker cards
- Real-time status (online/offline)
- Last heartbeat display
- Worker metrics preview
- Delete confirmation
- Empty state for no workers

**Component Outline**:
```typescript
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { WorkerCard } from './WorkerCard';
import { WorkerDetailsModal } from './WorkerDetailsModal';
import type { WorkerAgent } from '@/lib/workers/types';

export function WorkerAgentListSection({ userId, sessionToken, refreshTrigger }: Props) {
  const [workers, setWorkers] = useState<WorkerAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<WorkerAgent | null>(null);

  const fetchWorkers = useCallback(async () => {
    // Fetch from GET /api/workers
  }, [sessionToken]);

  useEffect(() => {
    fetchWorkers();
    // Set up polling every 5s for status updates
    const interval = setInterval(fetchWorkers, 5000);
    return () => clearInterval(interval);
  }, [fetchWorkers, refreshTrigger]);

  return (
    <div className="space-y-4">
      {/* Loading state */}
      {/* Empty state */}
      {/* Worker cards grid */}
      {/* Worker details modal */}
    </div>
  );
}
```

**Verification**:
- ✅ Test with 0 workers (empty state)
- ✅ Test with multiple workers
- ✅ Verify polling updates status
- ✅ Test delete functionality

**Breaking Changes**: None (new component)

---

### Phase 3: Supporting Components & Utilities

**Duration**: Helper components and utilities
**Dependencies**: Phase 2 complete
**Risk**: Low

#### 3.1 Create Platform Detection Utility

**File**: `/home/juan-canfield/Desktop/web-ui/lib/workers/platform-utils.ts` (NEW)
**Location**: Create new file
**Purpose**: Detect user's platform and provide download URLs

```typescript
import type { Platform, PlatformDownload } from './types';

/**
 * Detect user's platform from browser user agent
 */
export function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'linux'; // SSR fallback

  const ua = window.navigator.userAgent.toLowerCase();

  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac')) return 'darwin';
  return 'linux'; // Default to linux
}

/**
 * Get download information for all platforms
 */
export function getPlatformDownloads(version: string = 'v0.1.0'): PlatformDownload[] {
  const baseUrl = `https://github.com/FineTune-Lab/training-agent/releases/download/${version}`;

  return [
    {
      platform: 'linux',
      label: 'Linux (AMD64)',
      url: `${baseUrl}/training-agent-linux-amd64.tar.gz`,
      filename: 'training-agent-linux-amd64.tar.gz',
      icon: 'Terminal', // Lucide icon
    },
    {
      platform: 'darwin',
      label: 'macOS (AMD64)',
      url: `${baseUrl}/training-agent-darwin-amd64.tar.gz`,
      filename: 'training-agent-darwin-amd64.tar.gz',
      icon: 'Apple',
    },
    {
      platform: 'windows',
      label: 'Windows (AMD64)',
      url: `${baseUrl}/training-agent-windows-amd64.zip`,
      filename: 'training-agent-windows-amd64.zip',
      icon: 'MonitorSmartphone',
    },
  ];
}

/**
 * Get setup instructions for a platform
 */
export function getSetupInstructions(platform: Platform, apiKey: string): string {
  const instructions = {
    linux: `# Download and extract
curl -sSL https://github.com/FineTune-Lab/training-agent/releases/download/v0.1.0/training-agent-linux-amd64.tar.gz | tar -xz
cd training-agent

# Run installer
./scripts/install.sh

# Edit configuration
nano ~/.finetunelab/training-agent/.env

# Update API_KEY:
API_KEY=${apiKey}

# Restart agent
~/.finetunelab/training-agent/scripts/agentctl restart`,

    darwin: `# Download and extract
curl -sSL https://github.com/FineTune-Lab/training-agent/releases/download/v0.1.0/training-agent-darwin-amd64.tar.gz | tar -xz
cd training-agent

# Run installer
./scripts/install.sh

# Edit configuration
open ~/.finetunelab/training-agent/.env

# Update API_KEY:
API_KEY=${apiKey}

# Restart agent
~/.finetunelab/training-agent/scripts/agentctl restart`,

    windows: `# Download and extract (PowerShell)
Invoke-WebRequest https://github.com/FineTune-Lab/training-agent/releases/download/v0.1.0/training-agent-windows-amd64.zip -OutFile agent.zip
Expand-Archive agent.zip -DestinationPath training-agent
cd training-agent

# Run installer
scripts\\install.ps1

# Edit configuration
notepad %LOCALAPPDATA%\\FineTuneLab\\training-agent\\.env

# Update API_KEY:
API_KEY=${apiKey}

# Restart agent (reboot or restart scheduled task)`,
  };

  return instructions[platform];
}
```

**Verification**:
- ✅ Test detection on Windows, macOS, Linux browsers
- ✅ Verify download URLs are correct
- ✅ Check setup instructions render correctly

**Breaking Changes**: None (new utility)

---

#### 3.2 Create Worker Card Component

**File**: `/home/juan-canfield/Desktop/web-ui/components/workers/WorkerCard.tsx` (NEW)
**Location**: New file
**Purpose**: Display individual worker with status and actions

```typescript
'use client';

import React, { useState } from 'react';
import { Trash2, BarChart3, Circle, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WorkerAgent } from '@/lib/workers/types';

interface WorkerCardProps {
  worker: WorkerAgent;
  onDelete: (workerId: string) => void;
  onViewDetails: () => void;
}

export function WorkerCard({ worker, onDelete, onViewDetails }: WorkerCardProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete worker "${worker.hostname}"? This action cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    await onDelete(worker.worker_id);
    setDeleting(false);
  };

  const getStatusColor = () => {
    if (worker.is_online) return 'bg-green-500 text-green-500';
    if (worker.status === 'error') return 'bg-red-500 text-red-500';
    return 'bg-gray-500 text-gray-500';
  };

  const getStatusLabel = () => {
    if (worker.is_online) return 'Online';
    if (worker.status === 'error') return 'Error';
    return 'Offline';
  };

  const formatLastSeen = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="border border-border rounded-lg p-4 bg-card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        {/* Worker info */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="p-2 bg-primary/10 rounded-md flex-shrink-0">
            <Terminal className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base truncate">{worker.hostname}</h3>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor()} bg-opacity-10`}>
                <Circle className={`h-2 w-2 ${getStatusColor()} fill-current`} />
                {getStatusLabel()}
              </span>
            </div>

            {/* Platform & version */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <span className="capitalize">{worker.platform}</span>
              <span>•</span>
              <span>v{worker.version}</span>
            </div>

            {/* Last heartbeat */}
            <div className="text-xs text-muted-foreground mt-1">
              Last seen: {formatLastSeen(worker.last_heartbeat)}
            </div>

            {/* Metrics preview */}
            {worker.is_online && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                <span>Load: {worker.current_load}/{worker.max_concurrency}</span>
                <span>•</span>
                <span>Jobs: {worker.total_commands_executed}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 flex-shrink-0 ml-2">
          <button
            onClick={onViewDetails}
            className="p-2 hover:bg-primary/10 rounded transition-colors text-primary"
            title="View details"
          >
            <BarChart3 className="h-4 w-4" />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 hover:bg-destructive/10 rounded transition-colors text-destructive disabled:opacity-50"
            title="Delete worker"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Verification**:
- ✅ Test with online worker
- ✅ Test with offline worker
- ✅ Test delete confirmation
- ✅ Check responsive layout

**Breaking Changes**: None (new component)

---

#### 3.3 Create Worker Details Modal Component

**File**: `/home/juan-canfield/Desktop/web-ui/components/workers/WorkerDetailsModal.tsx` (NEW)
**Location**: New file
**Purpose**: Display detailed worker information, metrics, and commands

```typescript
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Activity, Terminal, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { WorkerAgent, WorkerDetails } from '@/lib/workers/types';

interface WorkerDetailsModalProps {
  workerId: string;
  sessionToken: string;
  onClose: () => void;
}

export function WorkerDetailsModal({ workerId, sessionToken, onClose }: WorkerDetailsModalProps) {
  const [details, setDetails] = useState<WorkerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/workers/${workerId}`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch worker details');
      }

      const data = await response.json();
      setDetails(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load details');
    } finally {
      setLoading(false);
    }
  }, [workerId, sessionToken]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold">Worker Details</h2>
            <p className="text-sm text-muted-foreground">{details?.worker.hostname || workerId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-md border border-destructive/20">
              <p>{error}</p>
              <Button variant="outline" size="sm" onClick={fetchDetails} className="mt-2">
                Retry
              </Button>
            </div>
          )}

          {!loading && !error && details && (
            <Tabs defaultValue="info">
              <TabsList>
                <TabsTrigger value="info">
                  <Terminal className="h-4 w-4 mr-2" />
                  Info
                </TabsTrigger>
                <TabsTrigger value="metrics">
                  <Activity className="h-4 w-4 mr-2" />
                  Metrics ({details.metrics.length})
                </TabsTrigger>
                <TabsTrigger value="commands">
                  <Clock className="h-4 w-4 mr-2" />
                  Commands ({details.commands.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="mt-4">
                {/* Worker information display */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Worker ID</span>
                      <div className="text-foreground mt-1 font-mono text-sm">{details.worker.worker_id}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Platform</span>
                      <div className="text-foreground mt-1 capitalize">{details.worker.platform}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Version</span>
                      <div className="text-foreground mt-1">v{details.worker.version}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Status</span>
                      <div className="text-foreground mt-1 capitalize">{details.worker.status}</div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="metrics" className="mt-4">
                {/* Metrics display */}
                {details.metrics.length > 0 ? (
                  <div className="space-y-2">
                    {details.metrics.map((metric) => (
                      <div key={metric.id} className="border rounded p-3">
                        <div className="text-xs text-muted-foreground">
                          {new Date(metric.timestamp).toLocaleString()}
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                          {metric.cpu_percent !== null && (
                            <div>CPU: {metric.cpu_percent.toFixed(1)}%</div>
                          )}
                          {metric.memory_used_mb !== null && metric.memory_total_mb !== null && (
                            <div>
                              Memory: {metric.memory_used_mb.toFixed(0)}/{metric.memory_total_mb.toFixed(0)} MB
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No metrics data yet</p>
                )}
              </TabsContent>

              <TabsContent value="commands" className="mt-4">
                {/* Commands display */}
                {details.commands.length > 0 ? (
                  <div className="space-y-2">
                    {details.commands.map((command) => (
                      <div key={command.id} className="border rounded p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{command.command_type}</span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            command.status === 'completed' ? 'bg-green-100 text-green-800' :
                            command.status === 'failed' ? 'bg-red-100 text-red-800' :
                            command.status === 'executing' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {command.status}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Created: {new Date(command.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No commands yet</p>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Verification**:
- ✅ Test opening/closing modal
- ✅ Verify tabs switch correctly
- ✅ Test with worker that has metrics/commands
- ✅ Test with worker that has no data

**Breaking Changes**: None (new component)

---

### Phase 4: Navigation Integration

**Duration**: Quick integration
**Dependencies**: Phase 2 complete
**Risk**: Low (additive only)

#### 4.1 Add Workers Page to Sidebar Navigation

**File**: `/home/juan-canfield/Desktop/web-ui/components/layout/AppSidebar.tsx` (MODIFY)
**Location**: Line 149-198 (navigation groups definition)
**Purpose**: Add Workers link to sidebar

**Current Code** (line 149):
```typescript
const playgroundItem: NavItem = { id: 'chat', href: '/chat', icon: MessageSquare, label: 'Playground' };
```

**Insertion Point**: After line 149, before training items definition

**Add Import** (line 14-39):
```typescript
import {
  MessageSquare,
  // ... existing imports
  HardDrive, // ADD THIS
} from 'lucide-react';
```

**Add Navigation Item** (after line 149):
```typescript
const playgroundItem: NavItem = { id: 'chat', href: '/chat', icon: MessageSquare, label: 'Playground' };

// NEW: Worker agents item
const workerAgentsItem: NavItem = { id: 'workers', href: '/workers', icon: HardDrive, label: 'Worker Agents' };
```

**Modify Render** (find the section around line 265-290 where navigation items are rendered):

**Find this section**:
```typescript
{/* Playground - separated for visual hierarchy */}
<Link
  href={playgroundItem.href}
  className={...}
>
  ...
</Link>
```

**Add after playground item**:
```typescript
{/* Playground - separated for visual hierarchy */}
<Link href={playgroundItem.href} ...>
  ...
</Link>

{/* Worker Agents - NEW */}
<Link
  href={workerAgentsItem.href}
  className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
    currentPage === workerAgentsItem.id
      ? 'bg-primary text-primary-foreground'
      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
  }`}
  title={workerAgentsItem.label}
>
  <workerAgentsItem.icon className="h-5 w-5" />
  <span>{workerAgentsItem.label}</span>
</Link>
```

**Verification**:
- ✅ Run `npm run build` to check for TypeScript errors
- ✅ Navigate to http://localhost:3000
- ✅ Verify "Worker Agents" appears in sidebar
- ✅ Click link and verify navigation to /workers
- ✅ Check that link is highlighted when on /workers page

**Breaking Changes**: None (additive - new navigation item)

**Impact Analysis**:
- ✅ Existing navigation items unaffected
- ✅ Sidebar layout unchanged (adds 1 item)
- ✅ No changes to routing logic

---

### Phase 5: Optional Enhancements (Future)

**Duration**: Nice-to-have features
**Dependencies**: All previous phases complete
**Risk**: Low

#### 5.1 Add Worker Scope to Settings > API Keys UI

**File**: `/home/juan-canfield/Desktop/web-ui/components/settings/ApiKeysManagement.tsx` (MODIFY)
**Location**: Line 21 - Update type definition
**Purpose**: Allow manual worker API key generation from Settings

**Current Code** (line 21):
```typescript
type ApiKeyScope = 'all' | 'training' | 'production' | 'testing';
```

**Change To**:
```typescript
type ApiKeyScope = 'all' | 'training' | 'production' | 'testing' | 'worker';
```

**Add Scope Config** (line 23-48, add to SCOPE_CONFIG):
```typescript
const SCOPE_CONFIG: Record<ApiKeyScope, { label: string; description: string; icon: React.ElementType; color: string }> = {
  // ... existing scopes
  worker: {
    label: 'Worker Agent',
    description: 'Local training agent access',
    icon: HardDrive,
    color: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400',
  },
};
```

**Add Import** (line 18):
```typescript
import { Key, Plus, Trash2, Copy, Check, AlertCircle, Shield, Beaker, Activity, Zap, BarChart3, X, ChevronLeft, ChevronRight, HardDrive } from 'lucide-react';
```

**Verification**:
- ✅ Open Settings > API Keys
- ✅ Click "New Key"
- ✅ Verify "Worker Agent" scope appears
- ✅ Generate key with worker scope
- ✅ Verify key works with worker agent

**Breaking Changes**: None (additive - new scope option)

---

#### 5.2 Real-time Status Updates (WebSocket)

**Future Enhancement**: Replace polling with WebSocket connection for real-time worker status updates

**Deferred**: Implement in future iteration to reduce initial complexity

---

## 🚨 Breaking Changes Analysis

### Database Schema
**No changes required** ✅
- All tables exist from migration 20251226000000
- RLS policies already in place
- No schema modifications needed

### API Endpoints
**Changes**:
- ✅ NEW: `POST /api/workers/commands` (additive, non-breaking)
- ✅ All existing endpoints unchanged

### UI Components
**Changes**:
- ✅ NEW: `/app/workers/page.tsx` (new page)
- ✅ NEW: `/components/workers/*` (new components)
- ✅ MODIFY: `AppSidebar.tsx` (add navigation item - non-breaking)
- ✅ OPTIONAL MODIFY: `ApiKeysManagement.tsx` (add worker scope - non-breaking)

### User Experience
**Impact**:
- ✅ New navigation item appears in sidebar
- ✅ Users gain new /workers page access
- ✅ No changes to existing workflows
- ✅ Backward compatible (users can still use old method if desired)

---

## 🔬 Testing Plan

### Unit Tests Required

**1. Platform Detection** (`lib/workers/platform-utils.test.ts`):
```typescript
describe('detectPlatform', () => {
  it('detects Windows from user agent', () => { ... });
  it('detects macOS from user agent', () => { ... });
  it('defaults to Linux for unknown platforms', () => { ... });
});
```

**2. Worker API** (`app/api/workers/commands/route.test.ts`):
```typescript
describe('POST /api/workers/commands', () => {
  it('creates command for valid request', () => { ... });
  it('rejects unauthorized requests', () => { ... });
  it('validates command types', () => { ... });
  it('prevents cross-user command creation', () => { ... });
});
```

### Integration Tests

**1. End-to-End Worker Setup Flow**:
- User navigates to /workers
- Generates worker API key
- Downloads agent binary
- Installs and configures agent
- Agent appears in worker list
- Status updates reflect online/offline

**2. Worker Management Flow**:
- User views worker details
- Worker metrics display correctly
- User deletes worker
- Worker removed from list and database

### Manual Verification Checklist

- [ ] Navigate to /workers page
- [ ] Platform auto-detection works
- [ ] Download buttons link correctly
- [ ] Worker API key generation works
- [ ] API key displays only once
- [ ] Copy-to-clipboard functions work
- [ ] Setup instructions render correctly
- [ ] Worker list shows registered workers
- [ ] Status badges update (online/offline)
- [ ] Worker details modal opens
- [ ] Metrics and commands display
- [ ] Delete worker works with confirmation
- [ ] Sidebar navigation highlights correctly
- [ ] Page loads without console errors
- [ ] Responsive layout works on mobile

---

## 📊 Dependency Graph

```
Phase 1: Foundation
    ├── 1.1 Types (lib/workers/types.ts)
    ├── 1.2 Commands API (app/api/workers/commands/route.ts)
    │
    └─> Phase 2: Core UI
            ├── 2.1 Workers Page (app/workers/page.tsx)
            ├── 2.2 Management Component (components/workers/WorkerAgentManagement.tsx)
            ├── 2.3 Setup Section (components/workers/WorkerAgentSetupSection.tsx)
            ├── 2.4 List Section (components/workers/WorkerAgentListSection.tsx)
            │
            └─> Phase 3: Supporting Components
                    ├── 3.1 Platform Utils (lib/workers/platform-utils.ts)
                    ├── 3.2 Worker Card (components/workers/WorkerCard.tsx)
                    ├── 3.3 Details Modal (components/workers/WorkerDetailsModal.tsx)
                    │
                    └─> Phase 4: Navigation
                            ├── 4.1 Sidebar Integration (components/layout/AppSidebar.tsx)
                            │
                            └─> Phase 5: Optional
                                    ├── 5.1 Settings Integration (components/settings/ApiKeysManagement.tsx)
                                    └── 5.2 WebSocket (future)
```

---

## 📝 Session Continuity Notes

**Key Context for Future Sessions**:
1. Worker agent v0.1.0 released and tested (2025-12-30)
2. Backend API fully functional (database + endpoints)
3. Training agent uses Python (not Go as in worker-agent/ directory)
4. Training agent installs to `~/.finetunelab/training-agent/`
5. Worker API keys use `wak_` prefix with `worker` scope
6. Worker agents register via `POST /api/workers/register`

**Files Created in This Plan**:
- lib/workers/types.ts
- lib/workers/platform-utils.ts
- app/workers/page.tsx
- components/workers/WorkerAgentManagement.tsx
- components/workers/WorkerAgentSetupSection.tsx
- components/workers/WorkerAgentListSection.tsx
- components/workers/WorkerCard.tsx
- components/workers/WorkerDetailsModal.tsx

**Files Modified in This Plan**:
- app/api/workers/commands/route.ts (added POST method)
- components/layout/AppSidebar.tsx (added navigation item)
- components/settings/ApiKeysManagement.tsx (optional - added worker scope)

**Related Documentation**:
- Training Agent: `worktrees/local-worker-agent/training-agent/README.md`
- Installation: `worktrees/local-worker-agent/training-agent/QUICK_START.md`
- Database: `supabase/migrations/20251226000000_create_worker_system.sql`
- Python Worker Fixes: `development/progress-logs/2025-12-28_python-worker-integration-fixes.md`

---

## ✅ Pre-Implementation Verification Checklist

Before starting implementation, verify:

- [ ] All backend API endpoints exist and are functional
  - [ ] `GET /api/workers` returns 200
  - [ ] `GET /api/workers/{workerId}` returns worker details
  - [ ] `DELETE /api/workers/{workerId}` deletes worker
  - [ ] `POST /api/user/api-keys` can create worker-scoped keys
- [ ] Database tables exist and have correct schema
  - [ ] `worker_agents` table structure verified
  - [ ] `worker_commands` table structure verified
  - [ ] `worker_metrics` table structure verified
  - [ ] RLS policies enforced
- [ ] Training agent binary is accessible
  - [ ] v0.1.0 release exists on GitHub
  - [ ] Download URLs work
  - [ ] Installation scripts functional
- [ ] No conflicting files exist
  - [ ] `app/workers/page.tsx` does not exist
  - [ ] `components/workers/` directory does not exist
  - [ ] `lib/workers/` directory does not exist
- [ ] Development environment ready
  - [ ] Next.js dev server runs without errors
  - [ ] TypeScript compilation works
  - [ ] Supabase connection functional

---

## 🎯 Implementation Order

### Recommended Execution Sequence:

1. **Verify Current State** (30 mins)
   - Check all API endpoints with curl/Postman
   - Verify database schema in Supabase dashboard
   - Test training agent download and installation

2. **Phase 1: Foundation** (1-2 hours)
   - Create types file
   - Add POST /api/workers/commands endpoint
   - Test endpoint with curl

3. **Phase 2: Core UI** (3-4 hours)
   - Create workers page
   - Create management component
   - Create setup and list sections
   - Test basic rendering

4. **Phase 3: Supporting Components** (2-3 hours)
   - Create platform utils
   - Create worker card
   - Create details modal
   - Test interactions

5. **Phase 4: Navigation** (30 mins)
   - Add sidebar link
   - Test navigation
   - Verify highlighting

6. **Phase 5: Optional** (1 hour)
   - Add worker scope to settings
   - Test end-to-end flow

7. **Testing & Verification** (2-3 hours)
   - Run all manual tests
   - Fix bugs
   - Verify no breaking changes

**Total Estimated Time**: 10-14 hours

---

## 🚀 Next Steps (Awaiting Approval)

1. **User Reviews This Document**
2. **User Approves or Requests Changes**
3. **Begin Phase 1**: Create types and verify APIs
4. **Test Phase 1**: Verify all endpoints work
5. **Begin Phase 2**: Create core UI components
6. **Test Phase 2**: Verify UI renders and navigates
7. **Continue through remaining phases**
8. **Final Testing**: End-to-end worker setup flow

---

**END OF IMPLEMENTATION PLAN**

**Status**: 🔴 AWAITING USER APPROVAL
**Last Updated**: 2025-12-30
**Author**: Claude Code (Sonnet 4.5)
**Related Plans**: 2025-12-28_python-worker-integration-fixes.md
