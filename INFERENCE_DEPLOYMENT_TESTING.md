# Inference Deployment Testing Guide

**Feature:** Production Inference Deployment to RunPod Serverless
**Version:** 1.0.0
**Date:** 2025-11-12
**Status:** Ready for Testing (Pending Database Access)

---

## 📋 PRE-TESTING SETUP

### Prerequisites

**1. Database Setup**
```bash
# Apply Phase 1 migration
npx supabase db push

# Verify table exists
npx supabase db psql -c "\d inference_deployments"

# Expected: Table with 24 columns, 5 indexes, 4 RLS policies
```

**2. RunPod API Key**
- Go to Settings → Secrets
- Add RunPod API key
- Key name: "runpod"
- Verify key is encrypted in database

**3. Test Model**
- Train a model to completion
- Note the job ID
- Verify checkpoints are available

**4. Budget Allocation**
- Have at least $10 available in RunPod account
- Recommend starting with small budget ($1-$5) for testing

---

## 🧪 TEST PLAN

### Phase 1: Basic Deployment Flow

**Test 1.1: Deploy Button Visibility**
- ✅ Navigate to `/training/monitor?jobId=<completed-job>`
- ✅ Verify two deploy buttons appear:
  - "Deploy to vLLM" (existing, local)
  - "Deploy to Production" (new, RunPod)
- ✅ Both buttons should be side-by-side
- ✅ Only appear when job status is "completed"

**Test 1.2: Deployment Dialog Opens**
- ✅ Click "Deploy to Production"
- ✅ Modal opens with title "Deploy to Production Inference"
- ✅ All fields visible:
  - Deployment Name (input)
  - Checkpoint Selector (dropdown)
  - GPU Type (dropdown with 7 options)
  - Min Workers (number input, default 0)
  - Max Workers (number input, default 3)
  - Budget Limit (number input, default 10)
  - Auto-stop checkbox (default checked)
  - Cost estimation card
  - Important notice alert

**Test 1.3: Form Validation**
- ✅ Leave deployment name empty → Button disabled
- ✅ Don't select checkpoint → Button shows "Select Checkpoint"
- ✅ Set budget to 0 → Button disabled
- ✅ Set budget to negative → Button disabled
- ✅ Fill all required fields → Button enabled "Deploy to Production"

**Test 1.4: Cost Estimation**
- ✅ Default GPU (A4000): $0.0004/request
- ✅ Budget $10 → Shows ~25,000 requests
- ✅ Change GPU to H100: $0.0035/request
- ✅ Budget $10 → Shows ~2,857 requests
- ✅ Change budget to $1 → Request count updates
- ✅ Estimation card shows all details

**Test 1.5: Successful Deployment**
- ✅ Fill deployment name: "test-deployment-001"
- ✅ Select "best" checkpoint
- ✅ Keep default GPU (A4000)
- ✅ Set budget to $1 (for testing)
- ✅ Keep auto-stop enabled
- ✅ Click "Deploy to Production"
- ✅ Loading state shows "Deploying to Production..."
- ✅ Progress message: "Creating RunPod Serverless endpoint"
- ✅ Wait 2-3 minutes
- ✅ Success state shows "Deployment Started!"
- ✅ Redirects to `/inference` page
- ✅ Toast notification: "Inference endpoint deployed!"

---

### Phase 2: Deployment Management

**Test 2.1: Inference Page**
- ✅ Navigate to `/inference`
- ✅ Page loads without errors
- ✅ Stats cards show:
  - Active Endpoints: 1
  - Total Spend: $0.00
  - Budget Alerts: 0
- ✅ Deployment card appears in grid
- ✅ Filter dropdown shows all statuses

**Test 2.2: Deployment Card Display**
- ✅ Card shows deployment name: "test-deployment-001"
- ✅ Status badge shows "DEPLOYING" or "ACTIVE"
- ✅ Provider shows "RunPod Serverless"
- ✅ Endpoint URL visible (if active)
- ✅ Copy button works
- ✅ Configuration shows:
  - GPU Type: A4000
  - Workers: 0 - 3
  - Model Type: lora adapter
  - Base Model: (model name)
- ✅ Cost tracking section shows:
  - $0.00 spent / $1.00 limit
  - Green progress bar at 0%
  - 0 requests
  - Cost per request: $0.0004
- ✅ Timestamps show creation time

**Test 2.3: Auto-Refresh**
- ✅ Wait 30 seconds with active deployment
- ✅ Console logs: "[InferencePage] Auto-refreshing..."
- ✅ Card updates automatically
- ✅ No page reload
- ✅ Stop deployment
- ✅ Auto-refresh stops

---

### Phase 3: Cost Tracking & Budget Alerts

**Test 3.1: Make Test Requests**
```bash
# Using endpoint URL from deployment card
curl -X POST <endpoint-url> \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello", "max_tokens": 10}'

# Make 10 requests
for i in {1..10}; do
  curl -X POST <endpoint-url> \
    -H "Content-Type: application/json" \
    -d '{"prompt": "Test '$i'", "max_tokens": 10}'
  sleep 1
done
```

**Test 3.2: Cost Updates**
- ✅ Refresh inference page
- ✅ Current spend increases
- ✅ Request count increases
- ✅ Progress bar updates
- ✅ Stats card "Total Spend" updates

**Test 3.3: Budget Threshold Alerts**
- ✅ Make requests until 50% budget used (~$0.50)
- ✅ Yellow warning icon appears
- ✅ Alert message: "50% Budget Used"
- ✅ Progress bar turns yellow

- ✅ Continue to 80% budget used (~$0.80)
- ✅ Orange warning icon appears
- ✅ Alert message: "80% Budget Used"
- ✅ Progress bar turns orange
- ✅ Budget Alerts stat increases to 1

- ✅ Continue to 100% budget used (~$1.00)
- ✅ Red alert icon appears
- ✅ Alert message: "Budget Exceeded!"
- ✅ Progress bar turns red at 100%

**Test 3.4: Auto-Stop Triggers**
- ✅ Budget reaches 100%
- ✅ Wait 1-2 minutes for auto-stop
- ✅ Status changes to "STOPPED"
- ✅ Alert shows budget exceeded
- ✅ Can no longer make requests to endpoint
- ✅ Database `stopped_at` timestamp set

---

### Phase 4: Manual Controls

**Test 4.1: Manual Stop (Before Budget Exhausted)**
- ✅ Create new deployment with $5 budget
- ✅ Make a few test requests
- ✅ Click "Stop Deployment" button
- ✅ Confirmation dialog appears
- ✅ Message: "This will stop the inference endpoint..."
- ✅ Click "Cancel" → Dialog closes, nothing happens
- ✅ Click "Stop Deployment" again
- ✅ Click "Stop Deployment" in dialog
- ✅ Button shows loading: "Stopping..."
- ✅ Status changes to "STOPPED"
- ✅ Toast notification: "Deployment stopped successfully"
- ✅ Stop button disappears
- ✅ Can no longer make requests

**Test 4.2: View Endpoint**
- ✅ Deploy with active status
- ✅ "Open Endpoint" button visible
- ✅ Click button
- ✅ Opens endpoint URL in new tab
- ✅ Shows RunPod endpoint page

**Test 4.3: Copy Endpoint URL**
- ✅ Click copy icon next to endpoint URL
- ✅ Toast notification: "Endpoint URL copied to clipboard"
- ✅ Paste in editor → URL is correct

---

### Phase 5: Status Filtering

**Test 5.1: Filter Deployments**
- ✅ Create 3 deployments:
  - 1 active
  - 1 stopped
  - 1 failed (simulate by entering invalid config)
- ✅ Set filter to "All Deployments" → Shows 3
- ✅ Set filter to "Active" → Shows 1
- ✅ Set filter to "Stopped" → Shows 1
- ✅ Set filter to "Failed" → Shows 1
- ✅ "Showing X of Y deployments" text updates correctly

---

### Phase 6: Error Handling

**Test 6.1: No RunPod API Key**
- ✅ Remove RunPod API key from vault
- ✅ Try to deploy
- ✅ Error toast: "No RunPod API key found"
- ✅ Error details: "Please add your RunPod API key in Settings > Secrets"
- ✅ Deployment fails gracefully

**Test 6.2: Invalid Configuration**
- ✅ Set min_workers > max_workers
- ✅ Try to deploy
- ✅ Error caught and displayed
- ✅ No database record created

**Test 6.3: Network Errors**
- ✅ Disconnect internet
- ✅ Try to refresh deployments
- ✅ Error message shown
- ✅ No crash, page remains functional

**Test 6.4: Insufficient Budget**
- ✅ Set budget to $0.01 (very small)
- ✅ Deploy successfully
- ✅ Make 10 requests
- ✅ Auto-stop triggers quickly
- ✅ Status shows stopped

---

### Phase 7: UI/UX Testing

**Test 7.1: Responsive Design**
- ✅ Desktop (1920x1080): Cards in 2-column grid
- ✅ Tablet (768px): Cards in 1-column
- ✅ Mobile (375px): All elements stack vertically
- ✅ No horizontal scroll
- ✅ All buttons accessible

**Test 7.2: Loading States**
- ✅ Initial page load shows loading spinner
- ✅ Refresh button shows spinning icon
- ✅ Deployment dialog shows progress states
- ✅ Stop button shows "Stopping..."
- ✅ All loading states clear when complete

**Test 7.3: Empty States**
- ✅ No deployments → Shows empty state
- ✅ Message: "No Deployments Yet"
- ✅ Call-to-action button: "Go to Training"
- ✅ Filter with no results → Shows appropriate message

**Test 7.4: Accessibility**
- ✅ All buttons have aria-labels
- ✅ Form inputs have labels
- ✅ Keyboard navigation works
- ✅ Focus visible on interactive elements
- ✅ Screen reader friendly

---

### Phase 8: Performance Testing

**Test 8.1: Multiple Deployments**
- ✅ Create 10 deployments
- ✅ Page loads quickly (< 2 seconds)
- ✅ Filtering is responsive
- ✅ No lag when scrolling
- ✅ Auto-refresh doesn't cause flicker

**Test 8.2: Real-time Updates**
- ✅ Have 3 active deployments
- ✅ Auto-refresh every 30 seconds
- ✅ No memory leaks
- ✅ No excessive API calls
- ✅ Console has no errors

**Test 8.3: Long-Running Deployments**
- ✅ Deploy and leave running for 1 hour
- ✅ Cost tracking remains accurate
- ✅ Request count updates correctly
- ✅ No UI issues

---

### Phase 9: Integration Testing

**Test 9.1: Full Training-to-Production Flow**
1. ✅ Start model training
2. ✅ Training completes successfully
3. ✅ Navigate to training monitor
4. ✅ Both deploy buttons visible
5. ✅ Click "Deploy to Production"
6. ✅ Configure deployment
7. ✅ Deploy successfully
8. ✅ View on inference page
9. ✅ Make test requests
10. ✅ Monitor costs
11. ✅ Stop deployment
12. ✅ Verify stopped

**Test 9.2: Multiple Models**
- ✅ Train 3 different models
- ✅ Deploy all 3 to production
- ✅ Each has unique endpoint
- ✅ All show correct costs
- ✅ Can manage independently

---

## 🐛 KNOWN ISSUES (Track During Testing)

### Database Access
- [ ] Migration not applied yet (pending access)
- [ ] Cannot test until database available
- [ ] Alternative: Use local Supabase instance

### Potential Issues to Watch
- [ ] RunPod API rate limits
- [ ] Cost tracking accuracy
- [ ] Auto-stop timing
- [ ] Endpoint cold starts
- [ ] Budget calculation edge cases

---

## ✅ ACCEPTANCE CRITERIA

### Must-Have (MVP)
- [ ] User can deploy trained model to RunPod Serverless
- [ ] Deployment creates successfully
- [ ] Endpoint URL provided and accessible
- [ ] Budget limits enforced
- [ ] Cost tracking accurate within 10%
- [ ] User can stop deployment manually
- [ ] Status updates in UI
- [ ] No breaking changes to training features
- [ ] TypeScript compiles with 0 new errors
- [ ] No console errors in browser

### Should-Have
- [ ] Auto-refresh for active deployments
- [ ] Budget alerts at 50%, 80%, 100%
- [ ] Auto-stop on budget exceeded
- [ ] Filter deployments by status
- [ ] Copy endpoint URL
- [ ] Responsive on mobile
- [ ] Toast notifications for actions

### Nice-to-Have
- [ ] Real-time status updates (WebSocket)
- [ ] Cost projections
- [ ] Usage graphs
- [ ] Export deployment data
- [ ] Deployment templates

---

## 📊 TEST RESULTS TEMPLATE

```markdown
## Test Run: [Date]
**Tester:** [Name]
**Environment:** [Development/Staging/Production]
**RunPod Credits Used:** $X.XX

### Test Summary
- Total Tests: X
- Passed: X
- Failed: X
- Skipped: X

### Failed Tests
1. Test X.X: [Name]
   - Expected: [What should happen]
   - Actual: [What happened]
   - Error: [Error message if any]
   - Screenshots: [Links]

### Bugs Found
1. [Bug description]
   - Severity: Critical/High/Medium/Low
   - Steps to reproduce
   - Expected behavior
   - Actual behavior

### Performance Notes
- Page load time: X seconds
- API response time: X ms
- Auto-refresh impact: [Observations]

### Recommendations
- [Improvements suggested]
- [Edge cases to handle]
- [Future enhancements]
```

---

## 🚀 NEXT STEPS AFTER TESTING

1. **Fix Critical Bugs** - Address any blocking issues
2. **Optimize Performance** - Based on test results
3. **Update Documentation** - Based on actual behavior
4. **User Training** - Create user guide/video
5. **Production Deployment** - Deploy to production
6. **Monitor Initial Usage** - Watch for issues
7. **Gather Feedback** - Iterate based on user feedback

---

## 📝 NOTES

- Testing requires active RunPod account with credits
- Recommend starting with $10-20 for comprehensive testing
- Budget alerts are critical - test thoroughly
- Auto-stop must work reliably to prevent overspending
- Keep RunPod dashboard open to verify deployments
- Monitor database for correct record creation
- Check Supabase logs for any errors

---

**Last Updated:** 2025-11-12
**Document Version:** 1.0.0
**Status:** Ready for Testing (Pending Database Access)
