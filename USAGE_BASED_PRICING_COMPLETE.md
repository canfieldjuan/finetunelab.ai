# Usage-Based Pricing Model Implementation

**Date**: December 18, 2025  
**Status**: ✅ COMPLETE - Ready for Testing  
**Model**: Premium observability with two-meter + retention pricing

---

## Overview

Migrated from seat-based SaaS pricing to usage-based observability pricing that's **hard to game** and **value-aligned**.

### Key Principles

- ✅ **No free tier** - Time-boxed trial (14 days or $ credits)
- ✅ **Minimum commitment** - $250-$3,000/mo (no hobby pricing)
- ✅ **Value-aligned metering** - Charge for monitored traces (what customers value)
- ✅ **Cost-aligned guardrail** - Charge for payload storage (what costs us)
- ✅ **Premium positioning** - Feature gates create clear upgrade path

---

## Pricing Model

### Meter 1: Root Traces (Primary Value Metric)

- **Unit**: Per 1,000 root traces (top-level spans without parent)
- **Pricing**: $0.30-$0.50 per 1,000 traces (volume discounts available)
- **Included**: 100K-1M traces/month depending on tier
- **Why**: Aligns with customer value - "we monitored X production calls"

### Meter 2: Payload Budget (Cost Guardrail)

- **Unit**: GB of compressed payload beyond included
- **Pricing**: $0.10-$0.25 per GB overage
- **Included**: 10-30 KB per trace (compressed)
- **Why**: Prevents gaming via massive payloads, reflects storage costs

### Meter 3: Retention Multiplier

- **Base**: 14-30 days included
- **Extended**: 1.2x-2.5x multiplier for 60/90/180/365 days
- **Why**: Storage + index costs increase with retention

---

## Tier Configuration

| Tier | Minimum | Traces Included | $/1K Traces | Payload/Trace | Retention | Team Size |
|------|---------|----------------|-------------|---------------|-----------|-----------|
| **Starter** | $250/mo | 100K | $0.50 | 10 KB | 14 days | 5 |
| **Growth** | $500/mo | 250K | $0.40 | 15 KB | 30 days | 15 |
| **Business** | $1,000/mo | 500K | $0.35 | 20 KB | 30 days | Unlimited |
| **Enterprise** | $3,000/mo | 1M | $0.30* | 30 KB | 30 days | Unlimited |

\* Enterprise gets volume discounts: 10M traces = 10% off, 50M = 20% off, 100M = 30% off

---

## Feature Gates by Tier

### Security & Access

- **SSO**: Growth+
- **RBAC**: Growth+
- **Audit Logs**: Growth+
- **PII Controls**: Business+
- **VPC Peering**: Business+
- **BYOK**: Enterprise only
- **Data Residency**: Enterprise only

### Operations

- **Alert Channels**: 2 (Starter) → 5 (Growth) → 10 (Business) → Unlimited (Enterprise)
- **Custom Alert Rules**: Growth+
- **Webhooks**: All tiers
- **API Access**: Read-only (Starter), Full (Growth+)
- **Max Integrations**: 3 → 10 → 25 → Unlimited

### Support

- **Starter**: Standard support (24h SLA)
- **Growth**: Priority support (4h SLA)
- **Business**: Priority support (2h SLA)
- **Enterprise**: Dedicated support engineer (1h SLA)

---

## Implementation Files

### 1. Configuration (`/lib/pricing/usage-based-config.ts`)

- Tier definitions with pricing parameters
- Feature gate configuration
- Cost calculation functions
- Volume discount logic

**Key Functions**:

- `calculateMonthlyUsageCost()` - Compute total cost from usage
- `formatUsageLimits()` - Display-friendly limit formatting
- `hasFeatureAccess()` - Feature gate checking
- `getVolumeDiscount()` - Enterprise discount calculation

### 2. Database Migration (`/supabase/migrations/20251218000004_create_usage_based_pricing.sql`)

**Tables Created**:

- `usage_meters` - Real-time usage tracking per user per billing period
- `usage_commitments` - Subscription tier + pricing snapshot
- `usage_invoices` - Monthly generated invoices with detailed breakdown

**Functions Created**:

- `increment_root_trace_count()` - Atomically track trace + payload
- `get_current_usage()` - Query current period usage
- `calculate_estimated_cost()` - Real-time cost estimation

**Indexes**:

- Fast user+period lookups
- Stripe integration indexes
- Status filtering

**RLS**: All tables have user-scoped policies + service role access

### 3. Usage Metering Service (`/lib/billing/usage-meter.service.ts`)

**Core Functions**:

- `recordRootTraceUsage()` - Called by TraceService on root span completion
- `getCurrentUsage()` - Get current billing period usage
- `getEstimatedCost()` - Calculate estimated monthly cost
- `checkUsageWarnings()` - Alert when approaching 90% of included usage

**Payload Calculation**:

- Serializes `input_data` + `output_data` + `metadata` to JSON
- Compresses with gzip for accurate billing
- Tracks both uncompressed (for debugging) and compressed (for billing)

### 4. Trace Service Integration (`/lib/tracing/trace.service.ts`)

**Changes Made**:

- Import `recordRootTraceUsage` from usage-meter.service
- Hook into `endTrace()` function
- **Metering Logic**:
  - Only meters root traces (no `parentSpanId`)
  - Only meters successful traces (`status === 'success'`)
  - Non-blocking (errors don't break tracing)
  - Passes payload data for size calculation

---

## Usage Flow

### 1. Trace Creation

```typescript
// User calls LLM via your platform
const context = await startTrace({
  spanName: 'llm.completion',
  operationType: 'completion',
  modelName: 'gpt-4',
});
```

### 2. Trace Completion

```typescript
// Trace ends with input/output data
await endTrace(context, {
  endTime: new Date(),
  status: 'success',
  inputData: { prompt: '...', model: 'gpt-4' },
  outputData: { response: '...' },
  inputTokens: 150,
  outputTokens: 450,
});
```

### 3. Automatic Metering (if root trace)

```typescript
// TraceService automatically calls:
recordRootTraceUsage({
  userId: context.userId,
  traceId: context.traceId,
  inputData: result.inputData,
  outputData: result.outputData,
  metadata: result.metadata,
});

// This:
// 1. Calculates payload size (compressed)
// 2. Calls DB function: increment_root_trace_count()
// 3. Atomically updates usage_meters table
```

### 4. Real-Time Usage Tracking

```typescript
// User dashboard queries:
const usage = await getCurrentUsage(userId);
// Returns: { rootTraces: 45000, compressedPayloadGb: 2.3, ... }

const cost = await getEstimatedCost(userId);
// Returns: { baseMinimum: 500, traceOverage: 0, estimatedTotal: 500 }
```

### 5. Monthly Invoice Generation (Cron Job)

```sql
-- End of month: Generate invoice
INSERT INTO usage_invoices (
  user_id,
  period_month,
  period_year,
  root_traces_count,
  total_payload_gb,
  -- ... cost breakdown ...
)
SELECT 
  um.user_id,
  um.period_month,
  um.period_year,
  um.root_traces_count,
  um.compressed_payload_bytes / 1073741824.0,
  -- ... calculate costs ...
FROM usage_meters um
JOIN usage_commitments uc ON um.user_id = uc.user_id
WHERE uc.status = 'active';
```

---

## Cost Calculation Example

### Scenario: Growth Tier User

**Commitment**:

- Tier: Growth ($500/mo minimum)
- Included: 250K traces, 15 KB/trace, 30 days retention
- Overage: $0.40/1K traces, $0.20/GB payload

**Usage This Month**:

- Root traces: 320,000
- Compressed payload: 6.5 GB
- Retention: 30 days (base)

**Calculation**:

```
Base minimum:           $500.00
Trace overage:          70K traces × ($0.40/1K) = $28.00
Payload overage:        6.5 GB - (320K × 15 KB / 1M) = 6.5 - 4.8 = 1.7 GB
                        1.7 GB × $0.20 = $0.34
Retention multiplier:   1.0x (base 30 days)
---
Subtotal:              $528.34
Discount:              $0.00 (none)
---
TOTAL:                 $528.34
```

---

## Advantages Over Seat-Based Model

### For FineTune Lab

✅ **Harder to game** - Can't "share accounts" to avoid fees  
✅ **Value-aligned** - Revenue scales with actual platform usage  
✅ **Cost-aligned** - Payload overage covers storage costs  
✅ **Premium positioning** - $250 minimum filters out hobby users  
✅ **Predictable growth** - Usage metrics predict revenue

### For Customers

✅ **No seat tax** - Add unlimited team members (Business+)  
✅ **Pay for value** - Only charged for traces monitored  
✅ **Transparent** - Real-time usage dashboard  
✅ **Flexible** - Scale up/down without seat negotiations  
✅ **Volume discounts** - Enterprise gets 10-30% off at scale

---

## Migration Path from Old Pricing

### Phase 1: Dual Pricing (Transition)

- Keep old `user_subscriptions` table intact
- Run new usage-based system in parallel
- Display both models in dashboard for comparison
- Allow users to opt-in to new model

### Phase 2: Forced Migration (After 60 days)

- Email existing users with usage analysis
- Show: "You would have paid $X under new model"
- Automatically migrate accounts to equivalent tier
- Grandfather existing users with 15% discount for 6 months

### Phase 3: Legacy Cleanup (After 6 months)

- Deprecate old seat-based endpoints
- Remove `user_subscriptions` logic
- Full migration to usage-based only

---

## Next Steps

### 1. Create Stripe Products

```bash
# Starter tier (minimum $250/mo)
stripe products create \
  --name="Starter - Usage-Based" \
  --description="$250/mo minimum + usage overages"

# Create metered prices for:
# - Trace overages (per 1,000)
# - Payload overages (per GB)
# - Retention multipliers (30/60/90 days)
```

### 2. Build Dashboard UI

- Real-time usage meter component
- Cost estimator widget
- Usage warnings (approaching 90%)
- Historical usage charts
- Invoice history table

### 3. Create Billing Webhook

- Listen to Stripe `invoice.finalized` events
- Generate `usage_invoices` records
- Send usage reports to Stripe for metered billing
- Handle payment failures

### 4. Usage Analytics API

```typescript
// GET /api/usage/current - Real-time usage
// GET /api/usage/estimate - Cost estimation
// GET /api/usage/history?months=6 - Historical usage
// GET /api/invoices - Invoice list
// POST /api/usage/limits/alerts - Set usage alerts
```

### 5. Testing Checklist

- [ ] Create test users for each tier
- [ ] Simulate trace creation with varying payloads
- [ ] Verify metering accuracy (trace count + payload size)
- [ ] Test retention multiplier calculations
- [ ] Validate RLS policies (user isolation)
- [ ] Test volume discount calculation
- [ ] Generate test invoices
- [ ] Verify Stripe integration (sandbox)

---

## Production Deployment

### Environment Variables

```bash
# Already have (from old model):
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# New (add to .env.production):
USAGE_METERING_ENABLED=true
USAGE_INVOICE_GENERATION_DAY=1  # 1st of month
USAGE_WARNING_THRESHOLD=0.90    # 90% alert
```

### Monitoring

- Set up alerts for metering failures
- Track payload compression ratios
- Monitor invoice generation success rate
- Watch for unusual usage spikes (gaming detection)

### Rollback Plan

If issues arise:

1. Set `USAGE_METERING_ENABLED=false` to disable metering
2. Traces still recorded (TraceService unaffected)
3. Old pricing model remains functional
4. No data loss - all usage captured in `usage_meters`

---

## Cost Analysis: Why This Works

### Storage Costs (Our Side)

- LLM traces: ~2 KB/trace average
- With 10 KB/trace included: 5x cushion
- Overage pricing ($0.15-$0.25/GB) covers S3 + index costs
- Retention multiplier covers long-term storage

### Customer Value

- Observability platforms charge $0.10-$2.00 per 1K events (Datadog, New Relic)
- Our $0.30-$0.50 per 1K traces is **premium but competitive**
- Minimum $250/mo filters hobby users but accessible for startups
- Enterprise volume discounts (30% off) reward scale

### Gaming Resistance

- Can't "share accounts" - usage tied to traces
- Can't "split usage" - payload overage charges prevent massive logs
- Can't "fake low tier" - minimum commitment enforced
- Can't "abuse trial" - time-boxed with hard caps

---

**Status**: ✅ Ready for internal testing  
**Next Action**: Create test users + simulate trace workloads  
**Timeline**: 2 weeks testing → 4 weeks staged rollout → Full migration

---

## ⚠️ IMPLEMENTATION STATUS UPDATE (December 19, 2025)

### ✅ COMPLETE: Backend Infrastructure

- [x] Database schema (usage_meters, usage_commitments, usage_invoices)
- [x] Database functions (increment_root_trace_count, get_current_usage, calculate_estimated_cost)
- [x] Metering service (lib/billing/usage-meter.service.ts)
- [x] API endpoint (app/api/billing/usage/route.ts)
- [x] TraceService integration (automatic metering on endTrace())
- [x] Pricing configuration (4 tiers defined)

### ❌ INCOMPLETE: User-Facing Components

**CRITICAL GAP**: Zero UI components exist for usage dashboard

- [ ] UsageMeterCard - Show traces + payload consumption
- [ ] CostEstimatorCard - Real-time cost breakdown
- [ ] UsageWarningBanner - Alert at 90% threshold
- [ ] UsageDashboard - Main container component
- [ ] TierSelector - Tier comparison and upgrade flow
- [ ] UsageHistoryChart - Past 6 months trend
- [ ] InvoiceHistoryTable - Past invoices list

**Impact**: Users cannot see their usage or costs despite metering being active.

### ⚠️ INCOMPLETE: Trace Coverage

**Currently Traced**:

- ✅ LLM completions (streaming + non-streaming)

**NOT Traced** (estimated 20-30% of operations missing):

- [ ] Tool calls (web search, calculator, etc.)
- [ ] GraphRAG retrieval operations
- [ ] Embedding generation
- [ ] Prompt generation steps

**Impact**: Under-metering by ~20-30% → revenue leakage.

### ❌ MISSING: Stripe Integration

- [ ] Create Stripe products (4 tiers with metered pricing)
- [ ] Checkout endpoint (/api/stripe/create-usage-checkout)
- [ ] Webhook handler (/api/stripe/webhooks/usage)
- [ ] Usage reporting cron job

**Impact**: Cannot charge customers or process subscriptions.

---

## 📋 UPDATED Implementation Plan

**Full Details**: See `USAGE_BASED_PRICING_UI_IMPLEMENTATION_PLAN.md`

**6 Phases Defined**:

1. **Phase 1**: Core Usage Dashboard Components (3-4h) - P0 CRITICAL
2. **Phase 2**: Tier Management & Upgrade Flow (2-3h) - P1 HIGH
3. **Phase 3**: Usage History & Analytics (3-4h) - P2 MEDIUM
4. **Phase 4**: Expand Trace Coverage (2-3h) - P1 HIGH  
5. **Phase 5**: Account Page Integration (1-2h) - P1 HIGH
6. **Phase 6**: Stripe Integration (3-4h) - P1 HIGH

**Estimated Total Time**: 24 hours (3 working days)

**Status**: ⏳ Awaiting approval to proceed with Phase 1

**See Also**: `docs/progress/SESSION_2025_12_19_USAGE_PRICING_UI_PLANNING.md` for audit details

---

**UPDATED STATUS**: ✅ Backend Complete | ❌ UI Missing | ⏳ Awaiting Approval  
**Last Updated**: December 19, 2025  
**Next**: Implement Phase 1 (Core Usage Dashboard Components)
