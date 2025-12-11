# Dashboard Implementation Plan - Home Page Overview

**Date:** December 1, 2025  
**Status:** 🔍 Investigation & Planning Phase  
**Goal:** Create a comprehensive dashboard as the default landing page after login

---

## 🎯 Executive Summary

Currently, users are redirected to `/chat` after login. This plan outlines creating a **Dashboard Overview** page (`/dashboard` or update `/` home) that provides:

- **At-a-glance metrics** across all platform features
- **Recent activity feed** for training, conversations, and models
- **Quick actions** to jump to key workflows
- **System health** indicators

---

## 📊 Current State Analysis

### Current Home Page Behavior
**File:** `/app/page.tsx`
- **Line 14-15:** Redirects authenticated users to `/chat`
- **No dashboard exists** - just a redirect page

### Existing Dashboard Components
✅ **Analytics Dashboard** (`/analytics`)
- Location: `/app/analytics/page.tsx` + `/components/analytics/AnalyticsDashboard.tsx`
- Features: Metrics overview, charts, model performance, session comparison
- Data: Pulls from conversations, messages, ratings, training data
- **Limitation:** Analytics-focused, not overview-focused

✅ **Training Monitor** (`/training/monitor`)
- Location: `/app/training/monitor/page.tsx`
- Features: Active jobs, progress tracking, metrics visualization
- Data: Training jobs, GPU metrics, real-time progress
- **Limitation:** Training-specific, not platform-wide

### Navigation Structure
**File:** `/components/layout/AppSidebar.tsx`
- Core items: Playground, Models, Datasets, Training Lab, Monitor Training, Testing, Observability
- Docs items: Quick Start, Features, API Reference, etc.
- User settings: Account, Secrets, Workspaces

---

## 🔍 Data Sources Investigation

### Available Database Tables

Based on codebase analysis, we have access to:

#### 1. **Conversations** (`conversations` table)
- Total conversation count
- Recent conversations
- Conversations by user/workspace
- Conversation ratings
- **API:** Likely `/api/conversations`

#### 2. **Messages** (`messages` table)
- Total message count
- Messages by conversation
- Token usage
- Model usage statistics
- **API:** Likely `/api/conversations/[id]/messages`

#### 3. **Training Jobs** (`local_training_jobs` table)
- Active/completed/failed jobs
- Training progress
- Recent jobs
- Success rate
- **API:** `/api/training/jobs` (verified in `/app/api/training/jobs/route.ts`)

#### 4. **Training Metrics** (`local_training_metrics` table)
- Training loss curves
- Evaluation metrics
- **API:** `/api/training/metrics/{job_id}`

#### 5. **Models** (`llm_models` table)
- Total models (global + personal)
- Recently added models
- Model types/providers
- **API:** `/api/models` (verified in `/app/api/models/route.ts`)

#### 6. **Inference Servers** (`local_inference_servers` table)
- Running servers
- Server status
- Resource usage
- **API:** `/api/servers` (likely)

#### 7. **Datasets** (`training_datasets` table)
- Total datasets
- Recent uploads
- Dataset sizes
- **API:** `/api/training/dataset`

#### 8. **Workspaces** (workspace-related tables)
- User workspaces
- Workspace members
- **Context:** `/contexts/WorkspaceContext`

---

## 🏗️ Proposed Dashboard Design

### Dashboard Layout

```
┌────────────────────────────────────────────────────────────┐
│  Fine Tune Lab                                    [User]    │
│  Dashboard Overview                                         │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │ 🗨️  Chats   │ │ 🎓 Training │ │ 📦 Models   │          │
│  │    156      │ │    12       │ │    28       │          │
│  │  Total      │ │  Active: 3  │ │  Running: 2 │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │ 📊 Datasets │ │ 💬 Messages │ │ ⚡ Tokens   │          │
│  │    24       │ │    2,450    │ │    1.2M     │          │
│  │  Ready      │ │  Today      │ │  This Week  │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
│                                                             │
├────────────────────────────────────────────────────────────┤
│  📈 Recent Activity                                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 🎓 Training job completed: llama-2-finance-v2        │  │
│  │    2 minutes ago                                     │  │
│  │                                                      │  │
│  │ 💬 New conversation: Customer Support Analysis      │  │
│  │    15 minutes ago                                    │  │
│  │                                                      │  │
│  │ 📦 Model deployed: gpt-4-turbo on vLLM              │  │
│  │    1 hour ago                                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
├────────────────────────────────────────────────────────────┤
│  🚀 Quick Actions                                           │
│  [New Chat] [Start Training] [Add Model] [Upload Dataset]  │
│                                                             │
├────────────────────────────────────────────────────────────┤
│  ⚠️ System Status                                           │
│  🟢 Training Server: Running                                │
│  🟢 Database: Connected                                     │
│  🟡 GPU Memory: 6.2 / 8 GB (78%)                           │
│  🟢 Inference Servers: 2 active                            │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

---

## 📋 Implementation Phases

### **Phase 1: Core Dashboard API** (Day 1-2)
**Goal:** Create backend endpoint to aggregate dashboard data

#### Files to Create:
1. **`/app/api/dashboard/overview/route.ts`** (NEW)
   - Aggregate statistics from all tables
   - Return JSON with counts, recent activity, system status

#### Data to Fetch:
```typescript
interface DashboardOverview {
  statistics: {
    totalConversations: number;
    totalMessages: number;
    totalTrainingJobs: number;
    activeTrainingJobs: number;
    totalModels: number;
    runningServers: number;
    totalDatasets: number;
    tokensThisWeek: number;
    messagesTo day: number;
  };
  
  recentActivity: Array<{
    type: 'training' | 'conversation' | 'model' | 'dataset';
    title: string;
    subtitle?: string;
    timestamp: string;
    link?: string;
  }>;
  
  systemStatus: {
    trainingServer: 'online' | 'offline';
    database: 'connected' | 'disconnected';
    gpuMemory?: {
      used: number;
      total: number;
      percentage: number;
    };
    inferenceServers: number;
  };
  
  quickStats: {
    trainingSuccessRate: number;
    averageConversationLength: number;
    mostUsedModel: string;
  };
}
```

#### Implementation Steps:
```typescript
// /app/api/dashboard/overview/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  // 1. Verify authentication
  // 2. Query conversations count
  // 3. Query training jobs (active + total)
  // 4. Query models count
  // 5. Query datasets count
  // 6. Query messages (today + total)
  // 7. Query inference servers
  // 8. Fetch recent activity (last 10 items)
  // 9. Check training server health
  // 10. Return aggregated data
}
```

**Dependencies:**
- No new packages needed
- Uses existing Supabase client
- May reuse query patterns from `/app/api/analytics` and `/app/api/training/jobs`

**Testing:**
```bash
# Test endpoint
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/dashboard/overview
```

---

### **Phase 2: Dashboard UI Component** (Day 3-4)
**Goal:** Create React component to display dashboard

#### Files to Create:
1. **`/components/dashboard/DashboardOverview.tsx`** (NEW)
   - Main dashboard component
   - Fetches data from `/api/dashboard/overview`
   - Renders stat cards, activity feed, quick actions

2. **`/components/dashboard/StatCard.tsx`** (NEW)
   - Reusable card for statistics
   - Icon, number, label, optional trend

3. **`/components/dashboard/ActivityFeedItem.tsx`** (NEW)
   - Individual activity item
   - Type icon, title, timestamp, link

4. **`/components/dashboard/SystemStatusIndicator.tsx`** (NEW)
   - Health checks display
   - Color-coded status dots

#### Component Structure:
```tsx
// /components/dashboard/DashboardOverview.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { StatCard } from './StatCard';
import { ActivityFeed } from './ActivityFeed';
import { QuickActions } from './QuickActions';
import { SystemStatus } from './SystemStatus';

export function DashboardOverview() {
  const { session } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    // Fetch from /api/dashboard/overview
  }

  return (
    <div className="space-y-6">
      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon="💬" label="Chats" value={data?.statistics.totalConversations} />
        <StatCard icon="🎓" label="Training" value={data?.statistics.activeTrainingJobs} />
        {/* ... more cards */}
      </div>

      {/* Recent Activity */}
      <ActivityFeed items={data?.recentActivity} />

      {/* Quick Actions */}
      <QuickActions />

      {/* System Status */}
      <SystemStatus status={data?.systemStatus} />
    </div>
  );
}
```

**Dependencies:**
- Uses existing UI components (Card, Button, Badge)
- Icons from `lucide-react`
- Chart library for mini sparklines (optional): `recharts` (already in use)

---

### **Phase 3: Page Integration** (Day 5)
**Goal:** Update routing to show dashboard by default

#### Option A: Update Home Page (Recommended)
**File to Modify:** `/app/page.tsx`

**Current Code (Lines 14-15):**
```tsx
router.push('/chat');
```

**New Code:**
```tsx
router.push('/dashboard');
```

**Then create:**
`/app/dashboard/page.tsx` (NEW)
```tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { DashboardOverview } from '@/components/dashboard/DashboardOverview';
import { PageHeader } from '@/components/layout/PageHeader';

export default function DashboardPage() {
  const { user, signOut, loading } = useAuth();

  if (loading) return <LoadingState />;
  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <PageWrapper currentPage="dashboard" user={user} signOut={signOut} maxWidth="7xl">
      <PageHeader
        title="Dashboard"
        description="Overview of your Fine Tune Lab workspace"
      />
      <DashboardOverview />
    </PageWrapper>
  );
}
```

#### Option B: Inline Dashboard on Home (Alternative)
Keep `/` as dashboard without separate route

**Changes to consider:**
- Update sidebar to highlight "Dashboard" when on `/`
- Add dashboard to navigation items in `AppSidebar.tsx`

---

### **Phase 4: Sidebar Navigation Update** (Day 5)
**Goal:** Add Dashboard to navigation

**File to Modify:** `/components/layout/AppSidebar.tsx`

**Insertion Point:** Line 117 (before `playgroundItem`)

**Code to Add:**
```tsx
const dashboardItem: NavItem = { 
  id: 'dashboard', 
  href: '/dashboard', 
  icon: LayoutDashboard, // Import from lucide-react
  label: 'Dashboard' 
};
```

**Update coreItems array (Line 121):**
```tsx
const coreItems: NavItem[] = [
  { id: 'chat', href: '/chat', icon: MessageSquare, label: 'Playground' },
  { id: 'models', href: '/models', icon: Boxes, label: 'Manage Models' },
  // ... rest
];
```

**Update navigation rendering** to show dashboard first:
```tsx
{/* Dashboard - First item */}
<div className="mb-4">
  <Link href={dashboardItem.href} className="block">
    {/* ...render dashboard nav item */}
  </Link>
</div>

{/* Playground - Second item */}
{/* ... */}
```

---

### **Phase 5: Real-Time Updates (Optional)** (Day 6-7)
**Goal:** Add live updates for training jobs and system status

#### Approach:
1. **WebSocket connection** to training server
2. **Polling** every 30 seconds for dashboard data
3. **Supabase real-time subscriptions** for new conversations/jobs

#### Implementation:
```tsx
// In DashboardOverview component
useEffect(() => {
  const interval = setInterval(() => {
    fetchDashboardData(); // Refresh data
  }, 30000); // Every 30 seconds

  return () => clearInterval(interval);
}, []);

// Optional: Supabase real-time
useEffect(() => {
  const subscription = supabase
    .channel('dashboard-updates')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'local_training_jobs'
    }, (payload) => {
      // Update activity feed with new job
    })
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, []);
```

---

## 🔍 Affected Files Analysis

### Files to CREATE (6 new files):
1. ✅ `/app/api/dashboard/overview/route.ts` - Dashboard API endpoint
2. ✅ `/app/dashboard/page.tsx` - Dashboard page component
3. ✅ `/components/dashboard/DashboardOverview.tsx` - Main dashboard UI
4. ✅ `/components/dashboard/StatCard.tsx` - Stat card component
5. ✅ `/components/dashboard/ActivityFeed.tsx` - Activity feed component
6. ✅ `/components/dashboard/SystemStatus.tsx` - System status component

### Files to MODIFY (2 files):
1. ⚠️ `/app/page.tsx` - Change redirect from `/chat` to `/dashboard`
   - **Line 14-15:** `router.push('/chat')` → `router.push('/dashboard')`
   - **Risk:** LOW - Simple redirect change
   - **Breaking changes:** None (just changes default landing page)

2. ⚠️ `/components/layout/AppSidebar.tsx` - Add dashboard to navigation
   - **Line ~117:** Add `dashboardItem` definition
   - **Line ~121:** Update navigation rendering order
   - **Risk:** LOW - Additive change only
   - **Breaking changes:** None (existing routes still work)

### Files POTENTIALLY Affected (dependencies):
- None - This is an additive feature
- Existing analytics and training APIs remain unchanged
- No schema changes required (read-only queries)

---

## 🧪 Testing Plan

### Unit Tests:
```typescript
// __tests__/api/dashboard/overview.test.ts
describe('Dashboard Overview API', () => {
  it('returns statistics for authenticated user', async () => {
    // Mock Supabase queries
    // Assert correct data structure
  });

  it('returns 401 for unauthenticated requests', async () => {
    // Test auth failure
  });

  it('handles database errors gracefully', async () => {
    // Mock DB error
    // Assert error response
  });
});
```

### Integration Tests:
1. **Navigate to `/dashboard`** after login
2. **Verify all stat cards render** with correct data
3. **Check activity feed** shows recent items
4. **Click quick actions** navigate to correct pages
5. **System status** reflects actual server state

### Manual Testing Checklist:
- [ ] Dashboard loads without errors
- [ ] Statistics display correct counts
- [ ] Activity feed shows recent items (max 10)
- [ ] Quick action buttons work
- [ ] System status indicators show correct colors
- [ ] Mobile responsive layout works
- [ ] Dark mode displays correctly
- [ ] Loading states display properly
- [ ] Error states handled gracefully

---

## 🚨 Risk Analysis

### Low Risk ✅
- **New API endpoint** - Self-contained, no side effects
- **New UI components** - Additive, no modifications to existing code
- **Sidebar update** - Additive navigation item

### Medium Risk ⚠️
- **Home page redirect change** - Users might expect `/chat` by default
  - **Mitigation:** Add "Go to Playground" quick action on dashboard
  - **Rollback:** One-line change to revert

### Zero Risk ✅
- **No database schema changes** - Read-only queries
- **No breaking API changes** - All new endpoints
- **No dependency changes** - Uses existing libraries

---

## 📊 Performance Considerations

### API Performance:
- **Query optimization:** Use `.select()` with specific columns only
- **Concurrent queries:** Use `Promise.all()` to fetch data in parallel
- **Caching:** Consider Redis cache for expensive aggregations (optional)
- **Pagination:** Activity feed limited to 10 items

### Frontend Performance:
- **Code splitting:** Lazy load dashboard components
- **Data fetching:** Use SWR or React Query for caching
- **Virtualization:** If activity feed grows, use virtual scrolling

### Estimated Load:
- **API calls:** 1 request per page load + optional polling
- **Data size:** ~10-20 KB per response
- **Database queries:** 8-10 SELECT queries (can be optimized)

---

## 🎯 Success Criteria

### Phase 1 Success:
- [ ] `/api/dashboard/overview` endpoint returns valid JSON
- [ ] All statistics calculated correctly
- [ ] Response time < 500ms for typical workload

### Phase 2 Success:
- [ ] Dashboard UI renders all components
- [ ] Mobile responsive (works on 360px width)
- [ ] Accessible (keyboard navigation works)

### Phase 3 Success:
- [ ] Users land on dashboard after login
- [ ] Dashboard is new default home page
- [ ] All navigation links work

### Phase 4 Success:
- [ ] Dashboard appears in sidebar
- [ ] Active state highlights correctly
- [ ] Quick access from any page

### Overall Success:
- [ ] No errors in console
- [ ] No TypeScript errors
- [ ] Page loads in < 2 seconds
- [ ] Users can navigate to all features
- [ ] System status reflects reality

---

## 🔧 Environment Setup

### No New Dependencies Required ✅
All existing dependencies support this feature:
- React / Next.js (already installed)
- Supabase client (already installed)
- Lucide icons (already installed)
- Tailwind CSS (already installed)
- shadcn/ui components (already installed)

### Configuration Changes:
None required - uses existing environment variables.

---

## 📝 Documentation Updates Needed

### User Documentation:
1. Update "Getting Started" guide to mention dashboard
2. Add "Dashboard Overview" page to docs
3. Update screenshots in documentation

### Developer Documentation:
1. Document `/api/dashboard/overview` endpoint
2. Add dashboard components to component library
3. Update architecture diagrams

---

## 🎓 Alternatives Considered

### Alternative 1: Keep `/chat` as default, add `/dashboard`
- **Pros:** No breaking changes, users keep familiar flow
- **Cons:** Dashboard not prominent, users might not discover it
- **Decision:** Not recommended - Dashboard should be front and center

### Alternative 2: Dashboard as modal/overlay
- **Pros:** Quick access from any page
- **Cons:** Less space for information, feels secondary
- **Decision:** Not recommended - Dashboard deserves dedicated page

### Alternative 3: Embed dashboard in sidebar
- **Pros:** Always visible
- **Cons:** Sidebar too crowded, not enough space for data
- **Decision:** Not recommended - Sidebar should be navigation-focused

---

## 📅 Timeline Estimate

| Phase | Days | Description |
|-------|------|-------------|
| Phase 1: API | 1-2 | Create `/api/dashboard/overview` endpoint |
| Phase 2: UI Components | 2-3 | Build dashboard components |
| Phase 3: Page Integration | 0.5 | Update routing and home page |
| Phase 4: Navigation | 0.5 | Add to sidebar |
| Phase 5: Real-time (Optional) | 1-2 | Add live updates |
| **Total** | **5-7 days** | Full dashboard implementation |

---

## 🚀 Next Steps

### Immediate Actions:
1. **Review this plan** - Get stakeholder approval
2. **Verify data sources** - Confirm all tables are accessible
3. **Create API endpoint** - Start with Phase 1
4. **Build UI prototype** - Create basic dashboard layout
5. **Test integration** - Ensure no breaking changes

### Before Starting:
- [ ] Approval from project lead
- [ ] Confirm design direction
- [ ] Set up development branch
- [ ] Create feature flag (optional)

---

## ❓ Open Questions

1. **Should dashboard be the absolute default?**
   - Or offer user preference to choose default page?

2. **What data is most valuable to users?**
   - Prioritize based on user feedback

3. **How often should data refresh?**
   - Polling interval: 30s, 60s, or manual refresh only?

4. **Should we support widgets/customization?**
   - Allow users to hide/show specific cards?

5. **Training server health check?**
   - How to verify training server status from Next.js?

---

## 📞 Stakeholder Communication

### Key Messages:
- **Non-breaking change** - Existing functionality preserved
- **Additive feature** - New dashboard doesn't remove anything
- **Quick turnaround** - 5-7 days for full implementation
- **User value** - Single pane of glass for platform overview

### Demo Plan:
1. Show current state (redirect to chat)
2. Show wireframe of dashboard
3. Demo working prototype
4. Gather feedback

---

**End of Plan** - Awaiting approval to proceed with implementation.
