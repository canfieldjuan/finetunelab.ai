# ✅ Pre-Implementation Verification Checklist

**Date**: December 19, 2025  
**Purpose**: Verify all dependencies before starting Phase 1 implementation

---

## 🔍 Phase 1 Prerequisites (Core UI Components)

### Database Dependencies

- [ ] Migration deployed to database

  ```sql
  -- Run this query to verify tables exist:
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name IN ('usage_meters', 'usage_commitments', 'usage_invoices');
  -- Expected: 3 rows
  ```

- [ ] Functions exist

  ```sql
  -- Verify functions:
  SELECT routine_name FROM information_schema.routines 
  WHERE routine_schema = 'public' 
  AND routine_name IN ('increment_root_trace_count', 'get_current_usage', 'calculate_estimated_cost');
  -- Expected: 3 rows
  ```

- [ ] RLS policies enabled

  ```sql
  -- Check RLS:
  SELECT tablename, rowsecurity FROM pg_tables 
  WHERE schemaname = 'public' 
  AND tablename IN ('usage_meters', 'usage_commitments', 'usage_invoices');
  -- Expected: All should have rowsecurity = true
  ```

### API Dependencies

- [ ] API endpoint responds successfully

  ```bash
  # Test endpoint (replace $TOKEN with real auth token):
  curl -X GET http://localhost:3000/api/billing/usage \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json"
  # Expected: 200 OK with JSON response
  ```

- [ ] Metering service accessible

  ```typescript
  // Verify import works:
  import { getCurrentUsage } from '@/lib/billing/usage-meter.service';
  // Should compile without errors
  ```

- [ ] Pricing config accessible

  ```typescript
  // Verify import works:
  import { USAGE_PLANS } from '@/lib/pricing/usage-based-config';
  // Should compile without errors
  ```

### UI Dependencies (Shadcn Components)

- [ ] Button component exists

  ```bash
  test -f components/ui/button.tsx && echo "✅ Button exists" || echo "❌ Button missing"
  ```

- [ ] Card component exists

  ```bash
  test -f components/ui/card.tsx && echo "✅ Card exists" || echo "❌ Card missing"
  ```

- [ ] Progress component exists

  ```bash
  test -f components/ui/progress.tsx && echo "✅ Progress exists" || echo "❌ Progress missing"
  ```

- [ ] Alert component exists

  ```bash
  test -f components/ui/alert.tsx && echo "✅ Alert exists" || echo "❌ Alert missing"
  ```

- [ ] Badge component exists

  ```bash
  test -f components/ui/badge.tsx && echo "✅ Badge exists" || echo "❌ Badge missing"
  ```

### Environment Variables

- [ ] Supabase credentials set

  ```bash
  # Verify in .env or .env.local:
  grep -E "NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY" .env.local
  # Should show both variables
  ```

- [ ] Service role key set (for server-side)

  ```bash
  grep "SUPABASE_SERVICE_ROLE_KEY" .env.local
  # Should exist (needed for usage-meter.service.ts)
  ```

### TypeScript Compilation

- [ ] No existing errors

  ```bash
  npm run build 2>&1 | grep -i error
  # Should show 0 errors
  ```

### File System Checks

- [ ] Components directory exists

  ```bash
  test -d components && echo "✅ components/ exists" || echo "❌ Create components/"
  ```

- [ ] Billing subdirectory ready

  ```bash
  mkdir -p components/billing && echo "✅ components/billing/ created"
  ```

- [ ] Account page accessible

  ```bash
  test -f app/account/page.tsx && echo "✅ Account page exists" || echo "❌ Account page missing"
  ```

---

## 🔍 Phase 4 Prerequisites (Expand Tracing)

### Trace Service Dependencies

- [ ] TraceService imports correctly

  ```typescript
  import { startTrace, endTrace } from '@/lib/tracing/trace.service';
  // Should compile without errors
  ```

- [ ] Trace types available

  ```typescript
  import type { TraceContext, OperationType } from '@/lib/tracing/types';
  // Should compile without errors
  ```

### Chat Route Location

- [ ] Chat route exists

  ```bash
  test -f app/api/chat/route.ts && echo "✅ Chat route exists" || echo "❌ Chat route missing"
  ```

- [ ] Tool execution code located

  ```bash
  # Search for tool execution pattern:
  grep -n "toolCallHandler\|executeTool" app/api/chat/route.ts | head -5
  # Should show lines where tools are called
  ```

### GraphRAG Service Location

- [ ] GraphRAG service exists

  ```bash
  find lib -name "*graphrag*.ts" -type f | head -5
  # Should show graphrag service files
  ```

- [ ] Retrieval function identified

  ```bash
  grep -n "retrieve\|query\|search" lib/services/graphrag*.ts | head -10
  # Should show retrieval function locations
  ```

---

## 🔍 Phase 6 Prerequisites (Stripe Integration)

### Stripe Dependencies

- [ ] Stripe SDK installed

  ```bash
  npm list stripe | grep stripe
  # Should show stripe package version
  ```

- [ ] Stripe frontend SDK installed

  ```bash
  npm list @stripe/stripe-js | grep stripe-js
  # Should show @stripe/stripe-js version
  ```

### Stripe Credentials

- [ ] Stripe secret key set

  ```bash
  grep "STRIPE_SECRET_KEY" .env.local
  # Should exist
  ```

- [ ] Stripe publishable key set

  ```bash
  grep "STRIPE_PUBLISHABLE_KEY" .env.local | grep -v "^#"
  # Should exist and not be commented
  ```

### Existing Stripe Integration

- [ ] Stripe client module exists

  ```bash
  test -f lib/stripe/client.ts && echo "✅ Stripe client exists" || echo "❌ Create Stripe client"
  ```

- [ ] Existing webhook handler (if any)

  ```bash
  find app/api -name "*webhook*" -type f | grep stripe
  # May or may not exist
  ```

---

## 🔍 Pre-Phase 1 Quick Verification Script

```bash
#!/bin/bash
# Run this script to verify all Phase 1 prerequisites

echo "🔍 Verifying Phase 1 Prerequisites..."
echo ""

# 1. Check database tables
echo "1️⃣ Database Tables:"
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('usage_meters', 'usage_commitments', 'usage_invoices');" 2>/dev/null || echo "⚠️ Cannot connect to database (deploy migration first)"
echo ""

# 2. Check API endpoint
echo "2️⃣ API Endpoint:"
test -f app/api/billing/usage/route.ts && echo "✅ API endpoint exists" || echo "❌ API endpoint missing"
echo ""

# 3. Check UI dependencies
echo "3️⃣ UI Components:"
for component in button card progress alert badge; do
  test -f "components/ui/${component}.tsx" && echo "✅ ${component}.tsx exists" || echo "❌ ${component}.tsx missing"
done
echo ""

# 4. Check environment variables
echo "4️⃣ Environment Variables:"
grep -q "NEXT_PUBLIC_SUPABASE_URL" .env.local && echo "✅ Supabase URL set" || echo "❌ Supabase URL missing"
grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY" .env.local && echo "✅ Supabase anon key set" || echo "❌ Supabase anon key missing"
grep -q "SUPABASE_SERVICE_ROLE_KEY" .env.local && echo "✅ Service role key set" || echo "❌ Service role key missing"
echo ""

# 5. Check TypeScript compilation
echo "5️⃣ TypeScript Compilation:"
npm run build --silent 2>&1 | grep -i error | wc -l | xargs -I {} echo "Found {} TypeScript errors"
echo ""

# 6. Create billing directory
echo "6️⃣ File System:"
mkdir -p components/billing && echo "✅ components/billing/ ready"
echo ""

echo "✅ Verification complete!"
```

Save as `verify-prerequisites.sh` and run:

```bash
chmod +x verify-prerequisites.sh
./verify-prerequisites.sh
```

---

## 🔍 Manual Verification Steps

### Step 1: Verify Metering is Active

```bash
# 1. Start dev server
npm run dev

# 2. Send a chat message (triggers LLM call)
# Use the UI or API

# 3. Query usage_meters table
psql $DATABASE_URL -c "SELECT user_id, root_traces_count, compressed_payload_bytes FROM usage_meters LIMIT 5;"

# Expected: Should see trace count increment
```

### Step 2: Verify API Endpoint

```bash
# Get auth token from browser (DevTools → Application → Local Storage)
export TOKEN="your_supabase_auth_token"

# Query API endpoint
curl http://localhost:3000/api/billing/usage \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq

# Expected: JSON response with usage data
```

### Step 3: Verify Pricing Config

```bash
# Open Node REPL
node

# Import and inspect
const config = require('./lib/pricing/usage-based-config.ts');
console.log(config.USAGE_PLANS.starter);
// Expected: Starter tier configuration
```

---

## 🚨 Common Issues & Solutions

### Issue 1: Database tables don't exist

**Solution**: Deploy migration first

```bash
supabase db push
```

### Issue 2: API endpoint returns 500

**Check**: Service role key in .env.local

```bash
grep SUPABASE_SERVICE_ROLE_KEY .env.local
```

### Issue 3: TypeScript errors on import

**Solution**: Run `npm install` to ensure all deps installed

```bash
npm install
```

### Issue 4: Shadcn components missing

**Solution**: Install missing components

```bash
npx shadcn-ui@latest add button card progress alert badge
```

### Issue 5: Cannot connect to database

**Check**: DATABASE_URL or Supabase credentials

```bash
echo $DATABASE_URL
# or
grep SUPABASE .env.local
```

---

## ✅ Ready to Proceed Checklist

Before starting Phase 1, all these must be ✅:

**Database**:

- [ ] Migration deployed (`supabase db push`)
- [ ] Tables exist (usage_meters, usage_commitments, usage_invoices)
- [ ] Functions exist (increment_root_trace_count, get_current_usage, calculate_estimated_cost)
- [ ] RLS policies enabled

**API**:

- [ ] `/api/billing/usage` endpoint responds successfully
- [ ] Metering service accessible (`lib/billing/usage-meter.service.ts`)
- [ ] Pricing config accessible (`lib/pricing/usage-based-config.ts`)

**UI**:

- [ ] Shadcn components exist (button, card, progress, alert, badge)
- [ ] `components/billing/` directory created
- [ ] Account page accessible (`app/account/page.tsx`)

**Environment**:

- [ ] NEXT_PUBLIC_SUPABASE_URL set
- [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY set
- [ ] SUPABASE_SERVICE_ROLE_KEY set

**Build**:

- [ ] `npm run build` succeeds with 0 errors
- [ ] Dev server starts successfully (`npm run dev`)

**Metering**:

- [ ] At least 1 trace recorded in `usage_meters` table
- [ ] API endpoint returns usage data for authenticated user

---

## 🎯 If Everything is ✅

**You are ready to proceed with Phase 1!**

Next steps:

1. Review `USAGE_BASED_PRICING_UI_IMPLEMENTATION_PLAN.md` Phase 1 section
2. Create `components/billing/UsageMeterCard.tsx`
3. Create `components/billing/CostEstimatorCard.tsx`
4. Create `components/billing/UsageWarningBanner.tsx`
5. Create `components/billing/UsageDashboard.tsx`
6. Test with real usage data
7. Integrate into `app/account/page.tsx`

**Estimated Time**: 3-4 hours  
**Complexity**: Medium  
**Risk**: Low

---

**Last Updated**: December 19, 2025  
**Status**: ⏳ Awaiting Phase 1 approval and prerequisites verification
