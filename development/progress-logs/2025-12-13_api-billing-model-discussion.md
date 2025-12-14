# API Billing Model - Discussion Log
**Date:** 2025-12-13
**Status:** TABLED - Needs Further Consideration
**Priority:** High

## Overview
Discussion about implementing billing for API users. This is separate from the subscription system which handles feature access.

---

## Existing Infrastructure (Verified)

### Subscription System
| Component | Location | Purpose |
|-----------|----------|---------|
| `subscription_plans` table | Supabase | free/pro/enterprise tiers with limits |
| `user_subscriptions` table | Supabase | User's current subscription |
| `lib/stripe/client.ts` | Stripe SDK | Payment processing |
| `/api/stripe/webhook/route.ts` | Webhook handler | Subscription lifecycle |
| `/api/stripe/create-checkout-session/route.ts` | Checkout | New subscriptions |
| `/api/stripe/create-portal-session/route.ts` | Portal | Manage subscription |

### Usage Tracking System
| Component | Location | Purpose |
|-----------|----------|---------|
| `lib/usage/checker.ts` | Usage enforcement | Check limits, record usage |
| `lib/usage/types.ts` | Type definitions | `api_call`, `token_usage`, `storage_mb`, etc. |
| `current_usage_summary` | Materialized view | Monthly aggregated usage |
| `/api/usage/current/route.ts` | API endpoint | Get usage vs plan limits |
| Database functions | Supabase | `check_usage_limit`, `record_usage`, `get_usage_with_limits` |

### API Key Usage Tracking
| Component | Location | Purpose |
|-----------|----------|---------|
| `api_key_usage_logs` table | Supabase | Per-request logging |
| `lib/auth/api-key-usage-logger.ts` | Logger service | Fire-and-forget logging |
| `/api/user/api-keys/[id]/usage/route.ts` | API endpoint | Query usage per key |
| `ApiKeyUsageModal` | Settings UI | View usage per key |

---

## Requirements Discussed

### Access Control
- [ ] Must be subscribed to use API keys (no free API access)
- [ ] New "Developer" tier needed on separate pricing page

### Billing Thresholds (All Confirmed YES)
- [ ] Minimum balance before API calls fail
- [ ] Auto-recharge when balance low
- [ ] Monthly spending caps

### Payment Models (Both Required)
- [ ] **Prepaid Credits**: Buy credit packs, balance decreases with usage
- [ ] **Postpaid Metered**: Track usage, bill at end of billing cycle
- [ ] Let users choose their preferred model

### Pricing Model
- [ ] NOT charging per-token like OpenAI
- [ ] Charging for **metrics and monitoring** usage
- [ ] Exact pricing structure TBD

---

## Open Questions (Need Answers)

### 1. What Exactly Are We Charging For?
Options discussed:
- **Usage-Based**: Traces stored, API calls, data retention
- **Feature Access**: Real-time monitoring, exports, alerting
- **Hybrid**: Base fee + usage charges

### 2. Developer Tier Structure
- What features are included?
- How does it relate to Pro/Enterprise?
- Is it API-only (no UI access)?
- Different rate limits?

### 3. Pricing Details
- Price per unit (whatever unit we decide)
- Credit pack denominations ($10, $50, $100?)
- Metered billing cycle (monthly?)
- Overage handling

### 4. Technical Implementation
- Stripe Metered Billing vs custom credits system?
- Real-time balance checking vs periodic reconciliation?
- Grace period when balance hits zero?

---

## Potential Database Schema (Draft)

```sql
-- User credits/balance
CREATE TABLE user_credits (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  balance_cents INTEGER NOT NULL DEFAULT 0,
  auto_recharge_enabled BOOLEAN DEFAULT false,
  auto_recharge_threshold_cents INTEGER,
  auto_recharge_amount_cents INTEGER,
  monthly_spending_cap_cents INTEGER,
  current_month_spend_cents INTEGER DEFAULT 0,
  billing_model TEXT CHECK (billing_model IN ('prepaid', 'postpaid')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit transactions (audit log)
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  amount_cents INTEGER NOT NULL, -- positive = credit, negative = debit
  transaction_type TEXT, -- 'purchase', 'usage', 'refund', 'auto_recharge'
  description TEXT,
  api_key_id UUID REFERENCES user_api_keys,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pricing configuration
CREATE TABLE api_pricing (
  id UUID PRIMARY KEY,
  metric_type TEXT NOT NULL, -- 'api_call', 'trace_stored', etc.
  price_per_unit_cents INTEGER NOT NULL,
  unit_size INTEGER DEFAULT 1, -- e.g., 1000 for "per 1000 calls"
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Next Steps (When Resumed)

1. **Define pricing model** - What metrics, what prices
2. **Design Developer tier** - Features, limits, pricing
3. **Choose Stripe approach** - Metered billing vs custom credits
4. **Create implementation plan** - Phased approach
5. **Build credits system** - Database, APIs, UI
6. **Build usage dashboard** - Track costs, manage billing

---

## Related Files for Reference

### Stripe Integration
- `lib/stripe/client.ts`
- `lib/stripe/types.ts`
- `app/api/stripe/webhook/route.ts`
- `app/api/stripe/create-checkout-session/route.ts`
- `app/api/stripe/create-portal-session/route.ts`

### Usage/Billing
- `lib/usage/checker.ts`
- `lib/usage/types.ts`
- `lib/subscriptions/types.ts`
- `app/api/usage/current/route.ts`

### API Key Tracking
- `lib/auth/api-key-usage-logger.ts`
- `app/api/user/api-keys/[id]/usage/route.ts`
- `supabase/migrations/20251212200000_create_api_key_usage_logs.sql`

---

## Session Notes

- User needs time to think through pricing model more deeply
- Core infrastructure exists but needs extension for credits/metered billing
- Developer tier is a new concept that needs definition
- Dashboard for API usage tracking was originally requested but scope expanded to billing

**This discussion is TABLED until user has clarity on pricing model.**
