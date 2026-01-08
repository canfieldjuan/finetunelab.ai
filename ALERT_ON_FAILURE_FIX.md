# Alert On Failure Fix

## Problem
User was not receiving email alerts when scheduled evaluations failed, even though:
- Alert preferences were enabled (`alert_scheduled_eval_failed: true`)
- Email notifications were enabled (`email_enabled: true`)
- The alert system was functional

## Investigation

### Alert Preferences ✅
```
Email Enabled: true
Email Address: null (falls back to auth email)
Alert Scheduled Eval Failed: true
Alert Scheduled Eval Disabled: true
Alert Batch Test Failed: true
```

### Alert History 🔍
- **Zero** alerts sent in last 7 days
- All historical alerts from December 13th failed with:
  ```
  Resend API error: 403 - The example.com domain is not verified
  ```

### Root Causes Found

#### 1. Scheduler Not Calling Alert Service ❌
**File:** `scripts/check-schedules-once.ts`

The scheduler handled errors but **never called the alert service**:

```typescript
// BEFORE - Lines 207-225
} catch (error) {
  console.error(`[Scheduler] Error executing schedule ${schedule.name}:`, error);

  // Increment failure counter
  const newFailureCount = (schedule.consecutive_failures || 0) + 1;
  const shouldDisable = newFailureCount >= 3;

  await supabase
    .from('scheduled_evaluations')
    .update({
      consecutive_failures: newFailureCount,
      is_active: shouldDisable ? false : schedule.is_active,
    })
    .eq('id', schedule.id);

  if (shouldDisable) {
    console.log(`[Scheduler] Auto-disabled schedule ${schedule.name} after 3 failures`);
  }

  throw error;  // ❌ No alert sent!
}
```

#### 2. Resend Domain Configuration ✅ RESOLVED
- Old config used `example.com` (not verified)
- Current config defaults to `alerts@finetunelab.ai` (verified ✅)

## Solution

### Code Fix
Added alert calls when scheduled evaluations fail:

```typescript
// AFTER - Lines 207-254
} catch (error) {
  console.error(`[Scheduler] Error executing schedule ${schedule.name}:`, error);

  // Increment failure counter
  const newFailureCount = (schedule.consecutive_failures || 0) + 1;
  const shouldDisable = newFailureCount >= 3;

  await supabase
    .from('scheduled_evaluations')
    .update({
      consecutive_failures: newFailureCount,
      is_active: shouldDisable ? false : schedule.is_active,
    })
    .eq('id', schedule.id);

  // ✅ Send failure alert
  const errorMessage = error instanceof Error ? error.message : String(error);
  const alertData: ScheduledEvaluationAlertData = {
    scheduledEvaluationId: schedule.id,
    userId: schedule.user_id,
    scheduleName: schedule.name,
    modelId: schedule.model_id,
    status: 'failed',
    errorMessage,
    consecutiveFailures: newFailureCount,
  };

  try {
    await sendScheduledEvaluationAlert('scheduled_eval_failed', alertData);
    console.log(`[Scheduler] Sent scheduled_eval_failed alert for: ${schedule.name}`);
  } catch (alertError) {
    console.error(`[Scheduler] Failed to send alert:`, alertError);
  }

  if (shouldDisable) {
    console.log(`[Scheduler] Auto-disabled schedule ${schedule.name} after 3 failures`);

    // ✅ Send auto-disabled alert
    try {
      await sendScheduledEvaluationAlert('scheduled_eval_disabled', alertData);
      console.log(`[Scheduler] Sent scheduled_eval_disabled alert for: ${schedule.name}`);
    } catch (alertError) {
      console.error(`[Scheduler] Failed to send disabled alert:`, alertError);
    }
  }

  throw error;
}
```

### Imports Added
```typescript
import { sendScheduledEvaluationAlert } from '../lib/alerts/alert.service';
import type { ScheduledEvaluationAlertData } from '../lib/alerts/alert.types';
```

## Alert Types Now Sent

1. **`scheduled_eval_failed`** - Sent on every scheduler failure
   - Example: API errors, configuration errors, network errors
   - Helps user know when schedules aren't running

2. **`scheduled_eval_disabled`** - Sent when auto-disabled after 3 failures
   - Prevents infinite failure loops
   - Alerts user to check configuration

Note: `batch_test_failed` alerts are handled separately by the batch test API

## Expected Behavior After Fix

### Scenario 1: Single Failure
```
1. Scheduler fails to execute
2. consecutive_failures = 1
3. Email sent: "Scheduled Evaluation Failed: [Name]"
4. Schedule remains active
5. Will retry on next run
```

### Scenario 2: Triple Failure (Auto-Disable)
```
1. Scheduler fails 3rd time
2. consecutive_failures = 3
3. Two emails sent:
   a. "Scheduled Evaluation Failed: [Name]"
   b. "Scheduled Evaluation Auto-Disabled: [Name]"
4. is_active = false
5. User must manually re-enable after fixing
```

### Scenario 3: Success After Failures
```
1. Scheduler succeeds
2. consecutive_failures reset to 0
3. No alert sent (success alerts disabled by default)
4. Schedule continues normally
```

## Email Delivery

**FROM address:** `alerts@finetunelab.ai` (verified ✅)
**TO address:** User's auth email (canfieldjuan24@gmail.com)

**Default preferences:**
- `alert_scheduled_eval_failed: true` ✅
- `alert_scheduled_eval_disabled: true` ✅
- `alert_scheduled_eval_completed: false` (no spam)

## Files Modified

- `scripts/check-schedules-once.ts` - Added alert calls in error handler

## Testing

1. Create a scheduled evaluation with invalid model ID
2. Wait for schedule to run (or manually trigger)
3. Check email for "Scheduled Evaluation Failed" alert
4. After 3rd failure, check for "Auto-Disabled" alert
5. Verify alert_history table has entries

## Diagnostic Scripts Created

- `check-alert-prefs.mjs` - Check user alert preferences
- `check-alert-history.mjs` - View recent alerts and delivery status
- `check-recent-alerts.mjs` - Show alerts from last 7 days
