# Usage-Based Pricing UI Implementation Plan

**Date**: December 19, 2025  
**Status**: 🔄 PLANNING - Awaiting Approval  
**Phase**: UI Development for Usage-Based Pricing Model

---

## Executive Summary

**Problem**: Usage-based pricing backend is complete (database, API, metering) but **NO UI EXISTS** for users to view their usage, costs, or manage subscriptions.

**Current State**:

- ✅ Database schema deployed (3 tables + 3 functions)
- ✅ Metering service integrated with TraceService
- ✅ API endpoint created (`/api/billing/usage`)
- ❌ **NO React components for usage dashboard**
- ❌ **Old seat-based UI still in use** (`app/account/page.tsx`)
- ❌ No user visibility into traces consumed or costs

**Goal**: Build complete usage dashboard UI to display real-time usage, cost estimates, warnings, and tier management.

---

## Audit Findings (Verified via Code Analysis)

### ✅ What Works

1. **Metering Logic** (`lib/tracing/trace.service.ts:181-196`)
   - Root trace detection: `!context.parentSpanId`
   - Success-only metering: `status === 'success'`
   - Non-blocking error handling
   - Gzip payload compression

2. **API Endpoint** (`app/api/billing/usage/route.ts`)
   - Authentication via Authorization header
   - Queries `usage_commitments` + `usage_meters`
   - Returns: period, tier, usage, cost, warnings
   - 90% threshold warnings

3. **Database Schema** (Migration `20251218000004_create_usage_based_pricing.sql`)
   - `usage_meters` table with RLS policies
   - `usage_commitments` table with pricing snapshots
   - `usage_invoices` table for monthly billing
   - Functions: `increment_root_trace_count()`, `get_current_usage()`, `calculate_estimated_cost()`

4. **Pricing Config** (`lib/pricing/usage-based-config.ts`)
   - 4 tiers: Starter ($250), Growth ($500), Business ($1,000), Enterprise ($3,000)
   - Complete feature gates
   - Volume discount logic

### ❌ What's Missing

1. **NO usage dashboard UI components** (searched `components/billing/*` - not found)
2. **NO usage meter widgets** (no real-time display)
3. **NO cost estimator** (no live calculations shown to user)
4. **NO usage warnings UI** (no 90% threshold alerts)
5. **NO tier selector** (can't upgrade/downgrade)
6. **NO invoice history** (can't view past bills)

### ⚠️ What's Incomplete

1. **Trace Coverage** - Only LLM calls traced, missing:
   - Tool calls (`tool_call` operation type)
   - GraphRAG retrieval (`retrieval` operation type)
   - Embedding generation (`embedding` operation type)
   - Prompt generation (`prompt_generation` operation type)

2. **Account Page** - Still using old seat-based UI
   - File: `app/account/page.tsx`
   - Queries: `/api/subscriptions/current` (old endpoint)
   - Displays: API calls, storage, models (old metrics)

---

## Phased Implementation Plan

### **Phase 1: Core Usage Dashboard Components** 🎯 PRIORITY 1

**Goal**: Give users visibility into their current usage and costs

**Estimated Time**: 3-4 hours  
**Dependencies**: None (API endpoint exists)

#### Components to Create

**1.1 UsageMeterCard** (`components/billing/UsageMeterCard.tsx`)

- **Purpose**: Display single usage metric with progress bar
- **Props**:

  ```typescript
  interface UsageMeterCardProps {
    label: string;              // "Root Traces"
    current: number;            // 85,432
    included: number;           // 100,000
    overage?: number;           // 0
    unit: string;               // "traces"
    warningThreshold?: number;  // 90 (percent)
  }
  ```

- **Features**:
  - Progress bar (green < 75%, yellow 75-90%, red > 90%)
  - Overage indicator
  - Percentage display
  - Responsive design
- **Integration Point**: Used by `UsageDashboard`

**1.2 CostEstimatorCard** (`components/billing/CostEstimatorCard.tsx`)

- **Purpose**: Real-time monthly cost breakdown
- **Props**:

  ```typescript
  interface CostBreakdown {
    baseMinimum: number;      // $500.00
    traceOverage: number;     // $28.00
    payloadOverage: number;   // $0.34
    retentionMultiplier: number; // 1.0
    estimatedTotal: number;   // $528.34
  }
  ```

- **Features**:
  - Line-item cost breakdown
  - Estimated total with "as of today" note
  - Comparison to base minimum
  - Projected month-end cost
- **Integration Point**: Queries `/api/billing/usage` endpoint

**1.3 UsageWarningBanner** (`components/billing/UsageWarningBanner.tsx`)

- **Purpose**: Alert when approaching/exceeding limits
- **Props**:

  ```typescript
  interface WarningData {
    traceWarning: boolean;       // true if > 90%
    payloadWarning: boolean;     // true if > 90%
    traceUsagePercent: number;   // 128
    payloadUsagePercent: number; // 85
  }
  ```

- **Features**:
  - Dismissible alert banner
  - Color-coded severity (yellow warning, red critical)
  - Actionable suggestions ("Upgrade to Growth tier")
  - Links to tier selector
- **Integration Point**: Conditional render in `UsageDashboard`

**1.4 UsageDashboard** (`components/billing/UsageDashboard.tsx`)

- **Purpose**: Main container for all usage UI
- **Features**:
  - Fetches data from `/api/billing/usage`
  - Loading states
  - Error handling
  - Displays: warnings, meters, cost estimator
  - Auto-refresh every 30 seconds (optional)
- **Integration Point**: Imported into `app/account/page.tsx`

#### Files to Verify Before Editing

1. ✅ `app/api/billing/usage/route.ts` - API endpoint exists
2. ✅ `lib/pricing/usage-based-config.ts` - Tier configs available
3. ⚠️ `app/account/page.tsx` - Needs modification to integrate new components
4. ⚠️ `components/ui/alert.tsx` - Verify Shadcn alert component exists
5. ⚠️ `components/ui/progress.tsx` - Verify Shadcn progress component exists

#### Validation Steps

- [ ] Run TypeScript compilation: `npm run build`
- [ ] Test API endpoint manually: `curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/billing/usage`
- [ ] Verify no breaking changes to existing account page
- [ ] Test with mock data (no commitment, with commitment, over limits)

---

### **Phase 2: Tier Management & Upgrade Flow** 🎯 PRIORITY 2

**Goal**: Allow users to view tiers and upgrade/downgrade

**Estimated Time**: 2-3 hours  
**Dependencies**: Phase 1 complete

#### Components to Create

**2.1 TierComparisonCard** (`components/billing/TierComparisonCard.tsx`)

- **Purpose**: Display single tier with features
- **Props**:

  ```typescript
  interface TierCardProps {
    tier: UsageTier;           // 'starter' | 'growth' | ...
    config: UsagePlanConfig;   // From usage-based-config.ts
    currentTier: boolean;      // Highlight current
    onSelect: () => void;      // Upgrade/downgrade handler
  }
  ```

- **Features**:
  - Tier name, tagline, price
  - Included traces, payload, retention
  - Feature list (checkmarks)
  - "Current Plan" badge
  - "Upgrade" / "Contact Sales" button
- **Integration Point**: Used by `TierSelector`

**2.2 TierSelector** (`components/billing/TierSelector.tsx`)

- **Purpose**: Grid of all 4 tiers for comparison
- **Features**:
  - 2x2 grid (responsive)
  - Current tier highlighted
  - Feature comparison table
  - Upgrade flow trigger
- **Integration Point**: Modal or dedicated page

**2.3 UpgradeConfirmationModal** (Modify existing: `components/pricing/UpgradeConfirmationModal.tsx`)

- **Purpose**: Confirm tier change before Stripe checkout
- **Modifications Needed**:
  - Add support for usage-based tiers
  - Display: new minimum, included usage, overage rates
  - Stripe checkout session with new price IDs
- **Integration Point**: Triggered from `TierSelector`

#### Files to Verify

1. ⚠️ `components/pricing/UpgradeConfirmationModal.tsx` - Exists, needs modification
2. ⚠️ `components/pricing/PricingTiers.tsx` - Old seat-based, don't modify (dual pricing during migration)
3. ✅ `lib/pricing/usage-based-config.ts` - Tier configs ready
4. ❌ `app/api/stripe/create-usage-checkout/route.ts` - NEEDS CREATION

#### Validation Steps

- [ ] Verify tier configs render correctly
- [ ] Test upgrade flow (don't charge real card)
- [ ] Verify feature gates display properly
- [ ] Check responsive design on mobile

---

### **Phase 3: Usage History & Analytics** 🎯 PRIORITY 3

**Goal**: Show historical usage trends and past invoices

**Estimated Time**: 3-4 hours  
**Dependencies**: Phase 1 complete

#### Components to Create

**3.1 UsageHistoryChart** (`components/billing/UsageHistoryChart.tsx`)

- **Purpose**: Line chart of past 6 months usage
- **Data Source**: Query `usage_meters` table for past periods
- **Features**:
  - Dual y-axis (traces + payload GB)
  - Month-over-month comparison
  - Trend indicators
  - Export to CSV
- **Library**: Recharts or Chart.js
- **Integration Point**: New tab in account page

**3.2 InvoiceHistoryTable** (`components/billing/InvoiceHistoryTable.tsx`)

- **Purpose**: List of past invoices
- **Data Source**: Query `usage_invoices` table
- **Features**:
  - Period, total cost, status
  - Download PDF link (Stripe invoice)
  - Payment status (paid, pending, failed)
  - Sortable columns
- **Integration Point**: New tab in account page

**3.3 API Endpoints to Create**:

- `/api/billing/usage/history` - Past 6 months usage
- `/api/billing/invoices` - Invoice list

#### Files to Create

1. ❌ `app/api/billing/usage/history/route.ts`
2. ❌ `app/api/billing/invoices/route.ts`
3. ❌ `components/billing/UsageHistoryChart.tsx`
4. ❌ `components/billing/InvoiceHistoryTable.tsx`

#### Validation Steps

- [ ] Query historical data successfully
- [ ] Chart renders with multiple months
- [ ] Invoice download links work
- [ ] Table pagination works

---

### **Phase 4: Expand Trace Coverage** 🎯 PRIORITY 4

**Goal**: Meter all operation types, not just LLM calls

**Estimated Time**: 2-3 hours  
**Dependencies**: None (independent of UI)

#### Instrumentation Points

**4.1 Tool Calls** (`app/api/chat/route.ts`)

- **Current**: Not traced
- **Location**: Where tools are invoked (calculator, web search, etc.)
- **Add**:

  ```typescript
  const toolContext = await startTrace({
    spanName: `tool.${toolName}`,
    operationType: 'tool_call',
    parentContext: mainContext,  // Link to parent LLM call
  });
  ```

- **Impact**: More accurate metering (nested traces won't be metered as root)

**4.2 GraphRAG Retrieval** (`lib/services/graphrag.service.ts`)

- **Current**: Not traced
- **Add**:

  ```typescript
  const retrievalContext = await startTrace({
    spanName: 'graphrag.retrieval',
    operationType: 'retrieval',
    parentContext,
  });
  ```

- **Impact**: Visibility into retrieval latency

**4.3 Embedding Generation** (wherever embeddings are created)

- **Current**: Not traced
- **Add**:

  ```typescript
  const embeddingContext = await startTrace({
    spanName: 'embedding.generate',
    operationType: 'embedding',
  });
  ```

#### Files to Modify

1. ⚠️ `app/api/chat/route.ts` - Add tool call tracing
2. ⚠️ `lib/services/graphrag.service.ts` - Add retrieval tracing
3. ⚠️ Find embedding generation code (needs grep search)

#### Validation Steps

- [ ] New operation types appear in `llm_traces` table
- [ ] Parent-child relationships preserved
- [ ] Only root traces metered (no double-counting)
- [ ] TraceView UI displays nested traces

---

### **Phase 5: Account Page Integration** 🎯 PRIORITY 5

**Goal**: Replace old seat-based UI with usage-based dashboard

**Estimated Time**: 1-2 hours  
**Dependencies**: Phase 1 + Phase 2 complete

#### Modifications to `app/account/page.tsx`

**5.1 Replace Usage Display**

- **Remove**: Old `UsageCard` components for API calls, storage, models
- **Add**: New `UsageDashboard` component
- **Keep**: User info, sign out, account deletion

**5.2 Replace Subscription Management**

- **Remove**: Old "Manage Subscription" button (Stripe portal)
- **Add**: New `TierSelector` component
- **Keep**: Stripe integration for checkout

**5.3 Add Tabbed Interface**

```tsx
<Tabs defaultValue="usage">
  <TabsList>
    <TabsTrigger value="usage">Current Usage</TabsTrigger>
    <TabsTrigger value="tiers">Plans & Pricing</TabsTrigger>
    <TabsTrigger value="history">Usage History</TabsTrigger>
    <TabsTrigger value="invoices">Invoices</TabsTrigger>
    <TabsTrigger value="settings">Settings</TabsTrigger>
  </TabsList>
  {/* ... */}
</Tabs>
```

#### Files to Modify

1. ⚠️ `app/account/page.tsx` - Major refactor (keep old as `page_old.tsx`)

#### Validation Steps

- [ ] All tabs render correctly
- [ ] No TypeScript errors
- [ ] Existing functionality preserved (sign out, delete account)
- [ ] Responsive design maintained
- [ ] Loading states work

---

### **Phase 6: Stripe Integration** 🎯 PRIORITY 6

**Goal**: Create Stripe products and handle webhooks

**Estimated Time**: 3-4 hours  
**Dependencies**: Phase 2 complete

#### Tasks

**6.1 Create Stripe Products**

- **Manual Task**: Create 4 products in Stripe Dashboard
  - Starter: $250 recurring + metered usage
  - Growth: $500 recurring + metered usage
  - Business: $1,000 recurring + metered usage
  - Enterprise: $3,000 recurring + metered usage
- **Save Price IDs** to `.env`:

  ```bash
  STRIPE_PRICE_STARTER_BASE=price_xxx
  STRIPE_PRICE_STARTER_TRACES=price_xxx
  STRIPE_PRICE_STARTER_PAYLOAD=price_xxx
  # ... repeat for all tiers
  ```

**6.2 Create Checkout Endpoint**

- **File**: `app/api/stripe/create-usage-checkout/route.ts`
- **Purpose**: Create Stripe checkout session for tier subscription
- **Logic**:
  1. Validate user + tier selection
  2. Create checkout session with metered products
  3. Create pending `usage_commitments` record
  4. Return session URL

**6.3 Create Webhook Handler**

- **File**: `app/api/stripe/webhooks/usage/route.ts`
- **Purpose**: Handle Stripe events
- **Events to Handle**:
  - `checkout.session.completed` - Activate commitment
  - `invoice.finalized` - Report usage to Stripe
  - `invoice.payment_succeeded` - Mark invoice paid
  - `customer.subscription.deleted` - Cancel commitment

**6.4 Usage Reporting to Stripe**

- **Cron Job**: Daily report usage for current period
- **Logic**:
  1. Query all active commitments
  2. Get current usage from `usage_meters`
  3. Report to Stripe Usage API
  4. Stripe will invoice at month-end

#### Files to Create

1. ❌ `app/api/stripe/create-usage-checkout/route.ts`
2. ❌ `app/api/stripe/webhooks/usage/route.ts`
3. ❌ `lib/stripe/usage-reporting.ts` (cron job logic)

#### Validation Steps

- [ ] Test checkout flow in Stripe test mode
- [ ] Verify webhook signatures
- [ ] Test usage reporting with mock data
- [ ] Verify invoice generation

---

## Risk Assessment & Mitigation

### High Risk ⚠️

1. **Breaking Existing Account Page**
   - **Mitigation**: Copy `page.tsx` to `page_old.tsx` before modifications
   - **Rollback**: Git revert + switch to old endpoint

2. **Double-Metering if Root Trace Logic Fails**
   - **Mitigation**: Add extensive logging in `recordRootTraceUsage()`
   - **Monitoring**: Query `usage_meters` daily for anomalies

3. **Stripe Webhook Signature Validation**
   - **Mitigation**: Use Stripe's official library
   - **Testing**: Stripe CLI for local webhook testing

### Medium Risk ⚠️

1. **UI Performance with Large Datasets**
   - **Mitigation**: Paginate invoice history, limit chart to 6 months
   - **Optimization**: React.memo on meter components

2. **Cost Calculation Mismatches**
   - **Mitigation**: Write unit tests for `calculateMonthlyUsageCost()`
   - **Validation**: Manual verification with spreadsheet

### Low Risk ✅

1. **Component Styling Issues**
   - **Mitigation**: Use existing Shadcn components
   - **Testing**: Visual regression testing

---

## Testing Strategy

### Unit Tests

- [ ] `calculateMonthlyUsageCost()` function
- [ ] `hasFeatureAccess()` function
- [ ] `getVolumeDiscount()` function
- [ ] Meter component rendering

### Integration Tests

- [ ] `/api/billing/usage` endpoint with real user
- [ ] Metering service with mock traces
- [ ] Stripe checkout flow (test mode)
- [ ] Webhook handling

### Manual Tests

- [ ] Create user with no commitment → see empty state
- [ ] Create user with Starter tier → see usage meters
- [ ] Simulate 95% usage → see warning banner
- [ ] Upgrade to Growth tier → see new limits
- [ ] View invoice history → see past bills

---

## Dependencies & Prerequisites

### Environment Variables (Add to `.env`)

```bash
# Usage-based pricing Stripe products
STRIPE_PRICE_STARTER_BASE=price_xxx
STRIPE_PRICE_STARTER_TRACES=price_xxx
STRIPE_PRICE_STARTER_PAYLOAD=price_xxx
STRIPE_PRICE_GROWTH_BASE=price_xxx
STRIPE_PRICE_GROWTH_TRACES=price_xxx
STRIPE_PRICE_GROWTH_PAYLOAD=price_xxx
STRIPE_PRICE_BUSINESS_BASE=price_xxx
STRIPE_PRICE_BUSINESS_TRACES=price_xxx
STRIPE_PRICE_BUSINESS_PAYLOAD=price_xxx
STRIPE_PRICE_ENTERPRISE_BASE=price_xxx
STRIPE_PRICE_ENTERPRISE_TRACES=price_xxx
STRIPE_PRICE_ENTERPRISE_PAYLOAD=price_xxx

# Webhook signing secret
STRIPE_USAGE_WEBHOOK_SECRET=whsec_xxx
```

### NPM Packages (If Not Already Installed)

```bash
npm install recharts            # For usage history chart
npm install date-fns            # For date formatting
npm install @stripe/stripe-js   # Stripe frontend SDK (likely exists)
npm install stripe              # Stripe backend SDK (likely exists)
```

### Database Migration

- **Status**: ✅ Already created
- **File**: `supabase/migrations/20251218000004_create_usage_based_pricing.sql`
- **Deploy**: Run `supabase db push` to staging first

---

## Success Criteria

### Phase 1 (UI) Success ✅

- [ ] User can see current usage (traces + payload)
- [ ] User can see estimated monthly cost
- [ ] User sees warning banner at 90% usage
- [ ] All data fetched from `/api/billing/usage`
- [ ] Zero TypeScript errors
- [ ] Responsive design on mobile

### Phase 2 (Tiers) Success ✅

- [ ] User can view all 4 tiers with features
- [ ] User can initiate upgrade flow
- [ ] Stripe checkout creates session successfully
- [ ] Commitment record created after payment

### Phase 3 (History) Success ✅

- [ ] User can view past 6 months usage trend
- [ ] User can view invoice history
- [ ] Chart renders with accurate data
- [ ] Invoices link to Stripe PDFs

### Phase 4 (Tracing) Success ✅

- [ ] Tool calls appear in traces table
- [ ] Retrieval operations traced
- [ ] Nested traces don't increase meter count
- [ ] TraceView UI displays hierarchy

### Phase 5 (Integration) Success ✅

- [ ] Account page uses new UI
- [ ] Old seat-based UI hidden/deprecated
- [ ] Tabbed interface works smoothly
- [ ] No breaking changes to other features

### Phase 6 (Stripe) Success ✅

- [ ] Products created in Stripe
- [ ] Checkout flow completes successfully
- [ ] Webhooks processed correctly
- [ ] Usage reported to Stripe monthly
- [ ] Invoices generated and paid

---

## Timeline Estimate

| Phase | Duration | Cumulative | Status |
|-------|----------|------------|--------|
| Phase 1: Core UI | 3-4 hours | 4h | ⏳ Not Started |
| Phase 2: Tiers | 2-3 hours | 7h | ⏳ Not Started |
| Phase 3: History | 3-4 hours | 11h | ⏳ Not Started |
| Phase 4: Tracing | 2-3 hours | 14h | ⏳ Not Started |
| Phase 5: Integration | 1-2 hours | 16h | ⏳ Not Started |
| Phase 6: Stripe | 3-4 hours | 20h | ⏳ Not Started |
| **Testing & QA** | 4 hours | **24h** | ⏳ Not Started |

**Total Estimated Time**: 24 hours (3 working days)

---

## Rollback Plan

### If Phase 1 Fails

- **Action**: Revert component files, keep old account page
- **Impact**: Users see old seat-based UI (no downtime)

### If Phase 2 Fails

- **Action**: Disable tier selector, keep usage view
- **Impact**: Users can see usage but can't upgrade

### If Phase 6 Fails (Stripe)

- **Action**: Manual Stripe setup, disable auto-checkout
- **Impact**: Contact sales for all upgrades

---

## Next Steps - Awaiting Approval

**Decision Point**: Which phase should we start with?

**Recommendation**: Start with **Phase 1 (Core UI)** because:

1. Highest user value (visibility into usage)
2. No Stripe integration required (can test independently)
3. Uses existing API endpoint (no backend changes)
4. Can ship incrementally

**Alternative**: Start with **Phase 4 (Tracing)** if revenue accuracy is priority.

---

## Questions for Review

1. **Priority**: Should we start with UI (Phase 1) or expanded tracing (Phase 4)?
2. **Stripe Products**: Should I create the Stripe products manually, or do you have a script?
3. **Migration Timeline**: When should we deploy the database migration to production?
4. **Dual Pricing**: How long should we run dual pricing (old seat-based + new usage)?
5. **Grandfather Pricing**: Should existing users get discounted rates?

---

**Status**: 🔄 Awaiting approval to proceed with Phase 1  
**Last Updated**: December 19, 2025
