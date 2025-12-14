# API Usage Dashboard - Dedicated Page Implementation
**Date:** 2025-12-13
**Status:** SUPERSEDED - See 2025-12-13_api-billing-model-discussion.md
**Priority:** High
**Extends:** 2025-12-12_api-key-usage-tracking-plan.md

> **NOTE:** This plan was superseded by a broader discussion about API billing models.
> The dashboard requirement evolved into a need for a full billing/credits system.
> See `2025-12-13_api-billing-model-discussion.md` for the current state.

## Overview
Create a dedicated API Usage Dashboard page with comprehensive visualizations for API key usage tracking. This extends the existing implementation which provides per-key usage modal in settings.

## Current State Analysis

### Existing Infrastructure (VERIFIED)
| Component | Location | Status |
|-----------|----------|--------|
| `api_key_usage_logs` table | Supabase | WORKING |
| `lib/auth/api-key-usage-logger.ts` | Logging service | WORKING |
| `app/api/user/api-keys/[id]/usage/route.ts` | Per-key usage API | WORKING |
| `ApiKeyUsageModal` in settings | Table view per key | WORKING |

### What's Missing for Dashboard
| Component | Purpose |
|-----------|---------|
| Aggregate usage API | Query ALL keys at once with aggregations |
| Time-series API | Daily/hourly breakdown for charts |
| Dashboard page | `/api-usage` route |
| Sidebar navigation | Link to dashboard |
| Chart components | Usage visualizations |

---

## Phased Implementation Plan

### Phase 1: API Endpoints for Aggregated Data
**Goal:** Create API endpoints that return aggregated usage data for dashboard

**New Files:**
| File | Purpose |
|------|---------|
| `app/api/user/usage/route.ts` | Aggregated usage for all user's API keys |
| `app/api/user/usage/timeline/route.ts` | Time-series data for charts |

**Endpoint 1: `/api/user/usage` (GET)**
Returns summary stats across ALL user's API keys:
```typescript
{
  summary: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgLatencyMs: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    uniqueEndpoints: number;
  },
  byApiKey: Array<{
    keyId: string;
    keyName: string;
    keyPrefix: string;
    requestCount: number;
    successRate: number;
    totalTokens: number;
    lastUsed: string | null;
  }>,
  byEndpoint: Array<{
    endpoint: string;
    requestCount: number;
    avgLatencyMs: number;
    errorRate: number;
  }>,
  recentErrors: Array<{
    id: string;
    endpoint: string;
    errorType: string;
    errorMessage: string;
    timestamp: string;
  }>
}
```

**Endpoint 2: `/api/user/usage/timeline` (GET)**
Returns time-series data for charts:
```typescript
Query params:
  - period: 'day' | 'week' | 'month' (default: 'week')
  - groupBy: 'hour' | 'day' (default: 'day')

Response:
{
  timeline: Array<{
    date: string;           // ISO date
    requests: number;
    successCount: number;
    errorCount: number;
    avgLatencyMs: number;
    inputTokens: number;
    outputTokens: number;
  }>,
  period: string;
  groupBy: string;
}
```

**Integration Points:**
- Uses existing `api_key_usage_logs` table
- Uses service role client for server-side queries
- Requires user authentication (session token)

---

### Phase 2: Dashboard Page Component
**Goal:** Create the main dashboard page with layout

**New Files:**
| File | Purpose |
|------|---------|
| `app/api-usage/page.tsx` | Dashboard page route |
| `components/api-usage/ApiUsageDashboard.tsx` | Main dashboard component |
| `hooks/useApiUsage.ts` | Data fetching hook |

**Dashboard Layout:**
```
+----------------------------------------------------------+
|  API Usage Dashboard                        [Date Range] |
+----------------------------------------------------------+
|                                                          |
|  +------------+  +------------+  +------------+          |
|  | Total Req  |  | Success %  |  | Avg Latency|  +2 more |
|  +------------+  +------------+  +------------+          |
|                                                          |
|  +--------------------------------------------------+   |
|  |           Requests Over Time (Line Chart)         |   |
|  +--------------------------------------------------+   |
|                                                          |
|  +----------------------+  +-------------------------+   |
|  | Token Usage (Line)   |  | Latency Trend (Line)    |   |
|  +----------------------+  +-------------------------+   |
|                                                          |
|  +----------------------+  +-------------------------+   |
|  | By Endpoint (Bar)    |  | By API Key (Table)      |   |
|  +----------------------+  +-------------------------+   |
|                                                          |
|  +--------------------------------------------------+   |
|  |           Recent Errors (Table)                   |   |
|  +--------------------------------------------------+   |
+----------------------------------------------------------+
```

---

### Phase 3: Chart Components
**Goal:** Create reusable chart components for API usage

**New Files:**
| File | Purpose |
|------|---------|
| `components/api-usage/ApiRequestsChart.tsx` | Requests over time line chart |
| `components/api-usage/ApiTokenUsageChart.tsx` | Token usage over time |
| `components/api-usage/ApiLatencyChart.tsx` | Latency trend chart |
| `components/api-usage/ApiEndpointBreakdown.tsx` | Bar chart by endpoint |
| `components/api-usage/ApiKeyUsageTable.tsx` | Table of usage by key |
| `components/api-usage/ApiRecentErrors.tsx` | Recent errors table |
| `components/api-usage/ApiUsageStats.tsx` | Summary stat cards |
| `components/api-usage/index.ts` | Barrel export |

**Reuses:**
- Recharts library (already installed for analytics)
- Card, Table UI components from shadcn

---

### Phase 4: Navigation Integration
**Goal:** Add dashboard link to sidebar

**Files to Modify:**
| File | Changes | Line Numbers |
|------|---------|--------------|
| `components/layout/AppSidebar.tsx` | Add 'api-usage' to evaluationItems | ~166-169 |

**Change:**
```typescript
// Current (line ~166-169):
const evaluationItems: NavItem[] = [
  { id: 'testing', href: '/testing', icon: TestTube2, label: 'Model Testing' },
  { id: 'analytics', href: '/analytics', icon: BarChart3, label: 'Observability' },
];

// After:
const evaluationItems: NavItem[] = [
  { id: 'testing', href: '/testing', icon: TestTube2, label: 'Model Testing' },
  { id: 'analytics', href: '/analytics', icon: BarChart3, label: 'Observability' },
  { id: 'api-usage', href: '/api-usage', icon: Activity, label: 'API Usage' },
];
```

**Also update auto-expand logic (line ~115):**
```typescript
// Add 'api-usage' to evaluation group pages
if (['testing', 'analytics', 'api-usage'].includes(currentPage)) {
  newExpanded.add('evaluation');
}
```

---

## Impact Analysis

### Files to Create (No Breaking Changes)
| File | Risk |
|------|------|
| `app/api/user/usage/route.ts` | None - new file |
| `app/api/user/usage/timeline/route.ts` | None - new file |
| `app/api-usage/page.tsx` | None - new route |
| `components/api-usage/*.tsx` | None - new components |
| `hooks/useApiUsage.ts` | None - new hook |

### Files to Modify (Low Risk)
| File | Changes | Risk |
|------|---------|------|
| `components/layout/AppSidebar.tsx` | Add nav item (additive) | Very Low |

### No Files Deleted or Replaced

---

## Pre-Implementation Verification Checklist

### Database Verification
- [ ] `api_key_usage_logs` table exists with correct schema
- [ ] Indexes exist for efficient queries
- [ ] RLS policies allow user to query their own logs
- [ ] Sample data exists for testing

### API Verification
- [ ] `/api/user/api-keys` returns user's keys correctly
- [ ] `/api/user/api-keys/[id]/usage` returns usage logs
- [ ] Authentication works via session token

### Component Verification
- [ ] Recharts is available (`npm ls recharts`)
- [ ] UI components (Card, Table) exist
- [ ] AppSidebar structure allows adding items

---

## Implementation Order

1. **Phase 1A:** Create `/api/user/usage` endpoint
2. **Phase 1B:** Create `/api/user/usage/timeline` endpoint
3. **Phase 2A:** Create `useApiUsage` hook
4. **Phase 2B:** Create dashboard page shell
5. **Phase 3A:** Create stat cards component
6. **Phase 3B:** Create requests chart
7. **Phase 3C:** Create token usage chart
8. **Phase 3D:** Create latency chart
9. **Phase 3E:** Create endpoint breakdown
10. **Phase 3F:** Create API key table
11. **Phase 3G:** Create errors table
12. **Phase 4:** Add sidebar navigation

---

## Verification Steps (Post-Implementation)

### API Endpoints
- [ ] `/api/user/usage` returns correct summary data
- [ ] `/api/user/usage/timeline` returns time-series data
- [ ] Both endpoints require authentication
- [ ] Both endpoints handle empty data gracefully

### Dashboard Page
- [ ] Page loads at `/api-usage`
- [ ] Shows loading state while fetching
- [ ] Shows empty state when no data
- [ ] All charts render correctly
- [ ] Date range filter works
- [ ] Responsive on mobile

### Navigation
- [ ] Sidebar shows "API Usage" link
- [ ] Link navigates to correct page
- [ ] Group auto-expands when on page

---

## Rollback Plan

If issues arise:
1. Revert sidebar changes (git checkout)
2. Delete new page and components
3. Delete new API endpoints
4. No database changes needed (uses existing table)

---

## Approval Required

Please review this plan and confirm:
1. Dashboard layout meets requirements
2. API endpoint design is acceptable
3. Chart selection is appropriate
4. Navigation placement is correct

**Awaiting user approval before implementation.**
