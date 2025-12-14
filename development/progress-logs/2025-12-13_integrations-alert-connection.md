# Integrations Alert Connection Implementation

**Date:** 2025-12-13
**Status:** IMPLEMENTED
**Goal:** Connect third-party integrations (Notion, Teams, Telegram, PagerDuty, Linear, Jira) to the alert system

---

## Problem Statement

The integrations system (`user_integrations` table) is completely separate from the alert system (`alert.service.ts`). When training events occur:

1. Python `alert_trigger.py` calls `/api/alerts/trigger`
2. Alert service dispatches to:
   - Email channel (`user_alert_preferences`)
   - Webhook channel (`user_webhooks`)
3. **MISSING**: User integrations are NEVER called

The `integration.service.ts` has `logToNotion()` but it's never invoked.

---

## Current State Analysis

### Working Components
| Component | File | Status |
|-----------|------|--------|
| Integration UI | `components/settings/IntegrationsManagement.tsx` | Working |
| Integration types | `lib/integrations/integration.types.ts` | Complete |
| Integration CRUD | `lib/integrations/integration.service.ts` | Working |
| Integration API | `app/api/integrations/route.ts` | Working |
| Integration test (Notion) | `app/api/integrations/[type]/test/route.ts` | Working |
| Integration test (Teams) | `app/api/integrations/[type]/test/route.ts` | Working |
| Integration test (Telegram) | `app/api/integrations/[type]/test/route.ts` | Working |
| Integration test (PagerDuty) | `app/api/integrations/[type]/test/route.ts` | Working |

### Missing Components
| Component | Status | Notes |
|-----------|--------|-------|
| Integration test (Linear) | NOT IMPLEMENTED | Returns 400 "Test not implemented" |
| Integration test (Jira) | NOT IMPLEMENTED | Returns 400 "Test not implemented" |
| `logToTeams()` function | NOT IMPLEMENTED | Teams test works but no delivery |
| `logToTelegram()` function | NOT IMPLEMENTED | Telegram test works but no delivery |
| `logToPagerDuty()` function | NOT IMPLEMENTED | PagerDuty test works but no delivery |
| `logToLinear()` function | NOT IMPLEMENTED | Missing entirely |
| `logToJira()` function | NOT IMPLEMENTED | Missing entirely |
| Alert → Integration dispatch | NOT IMPLEMENTED | The connection is missing |

---

## Architecture

### Current Flow (Broken)
```
Training Server → /api/alerts/trigger → AlertService.sendAlert()
                                              │
                                              ├→ EmailChannel
                                              └→ WebhookChannel (user_webhooks)

                                              ✗ user_integrations never called
```

### Target Flow (Fixed)
```
Training Server → /api/alerts/trigger → AlertService.sendAlert()
                                              │
                                              ├→ EmailChannel
                                              ├→ WebhookChannel (user_webhooks)
                                              └→ IntegrationChannel (NEW)
                                                    │
                                                    ├→ Notion
                                                    ├→ Teams
                                                    ├→ Telegram
                                                    ├→ PagerDuty
                                                    ├→ Linear (Phase 2)
                                                    └→ Jira (Phase 2)
```

---

## Files Affected

### Phase 1: Core Integration Channel
| File | Action | Risk |
|------|--------|------|
| `lib/alerts/channels/integration.channel.ts` | CREATE | None (new file) |
| `lib/alerts/alert.service.ts` | MODIFY | Low - add integration dispatch |
| `lib/alerts/alert.types.ts` | MODIFY | Low - add integration result type |
| `lib/alerts/index.ts` | MODIFY | Low - add export |
| `lib/integrations/integration.service.ts` | MODIFY | Low - add delivery functions |

### Phase 2: Missing Delivery Functions
| File | Action | Risk |
|------|--------|------|
| `lib/integrations/integration.service.ts` | MODIFY | Low - add Teams/Telegram/PagerDuty |

### Phase 3: Missing Test Endpoints
| File | Action | Risk |
|------|--------|------|
| `app/api/integrations/[type]/test/route.ts` | MODIFY | Low - add Linear/Jira tests |

---

## Implementation Plan

### Phase 1: Integration Channel (Core Connection)

**Goal:** Create the integration channel and connect it to the alert service

#### Step 1.1: Create Integration Channel
**File:** `lib/alerts/channels/integration.channel.ts` (NEW)

```typescript
// This file will:
// - Implement AlertChannel interface
// - Get user integrations from DB
// - Map alert types to integration config keys
// - Dispatch to appropriate integration delivery functions
```

#### Step 1.2: Add Integration Delivery Result Type
**File:** `lib/alerts/alert.types.ts`
**Insertion Point:** After line 135 (AlertDeliveryResult interface)

```typescript
export interface IntegrationDeliveryResult {
  success: boolean;
  integrationType: string;
  integrationId: string;
  error?: string;
}
```

#### Step 1.3: Modify Alert Service
**File:** `lib/alerts/alert.service.ts`
**Insertion Points:**
- Line 18 (imports): Add integration channel import
- Line 58 (sendAlert return type): Add integrationResults
- Line 63 (after webhooks): Get user integrations
- Line 80 (after webhook loop): Send via integration channel

#### Step 1.4: Update Exports
**File:** `lib/alerts/index.ts`
**Insertion Point:** After line 8

```typescript
export { integrationChannel } from './channels/integration.channel';
```

---

### Phase 2: Delivery Functions

**Goal:** Add delivery functions for Teams, Telegram, PagerDuty

#### Step 2.1: Add Teams Delivery
**File:** `lib/integrations/integration.service.ts`
**Insertion Point:** After `logToNotion()` (line 282)

```typescript
async logToTeams(
  credentials: TeamsCredentials,
  event: { type: string; title: string; ... }
): Promise<boolean>
```

#### Step 2.2: Add Telegram Delivery
**File:** `lib/integrations/integration.service.ts`
**Insertion Point:** After `logToTeams()`

```typescript
async logToTelegram(
  credentials: TelegramCredentials,
  event: { type: string; title: string; ... }
): Promise<boolean>
```

#### Step 2.3: Add PagerDuty Delivery
**File:** `lib/integrations/integration.service.ts`
**Insertion Point:** After `logToTelegram()`

```typescript
async logToPagerDuty(
  credentials: PagerDutyCredentials,
  event: { type: string; title: string; ... }
): Promise<boolean>
```

---

### Phase 3: Linear & Jira (Optional - Future)

**Goal:** Add Linear and Jira integration support

#### Step 3.1: Add Linear Test
**File:** `app/api/integrations/[type]/test/route.ts`
**Insertion Point:** After PagerDuty case (line 170)

#### Step 3.2: Add Jira Test
**File:** `app/api/integrations/[type]/test/route.ts`
**Insertion Point:** After Linear case

#### Step 3.3: Add Linear Delivery
**File:** `lib/integrations/integration.service.ts`

#### Step 3.4: Add Jira Delivery
**File:** `lib/integrations/integration.service.ts`

---

## Alert Type to Integration Config Mapping

| Alert Type | Integration Config Key |
|------------|----------------------|
| `job_started` | `log_job_started` |
| `job_completed` | `log_job_completed` |
| `job_failed` | `log_job_failed` |
| `job_cancelled` | `log_job_cancelled` |
| `gpu_oom` | `log_gpu_oom` |
| `timeout_warning` | (needs new config key) |
| `disk_warning` | (needs new config key) |

---

## Testing Plan

1. **Unit Tests:** Test integration channel in isolation
2. **Integration Test:** Start training job, verify integrations receive events
3. **Manual Test:** Configure Notion/Teams, run training, check logs

---

## Rollback Plan

If issues occur:
1. Remove integration channel import from `alert.service.ts`
2. Remove integration dispatch code from `sendAlert()`
3. Integrations will continue working for test but not alerts (current behavior)

---

## Dependencies

- `aiohttp` (Python) - already installed for alert_trigger.py
- No new npm packages required

---

## Session Continuity Notes

### Key Files to Reference
1. `lib/alerts/alert.service.ts` - Main alert dispatcher
2. `lib/alerts/channels/webhook.channel.ts` - Pattern to follow for integration channel
3. `lib/integrations/integration.service.ts` - Has `logToNotion()` pattern
4. `app/api/integrations/[type]/test/route.ts` - Has test patterns for each type

### Key Insertion Points
1. `alert.service.ts:63` - Add `getUserIntegrations()` call
2. `alert.service.ts:80` - Add integration dispatch loop
3. `integration.service.ts:282` - Add new delivery functions after `logToNotion()`

### Critical Considerations
- Integration config uses `log_*` prefix (e.g., `log_job_completed`)
- Alert types use plain names (e.g., `job_completed`)
- Need mapping function like `alertTypeToIntegrationKey()`

---

## Implementation Summary

**Completed:** 2025-12-13

### Files Created
1. `lib/alerts/channels/integration.channel.ts` - New integration dispatch channel

### Files Modified
1. `lib/alerts/alert.types.ts`
   - Added `IntegrationDeliveryResult` interface (line 137-142)
   - Added `alertTypeToIntegrationKey()` function (line 247-262)

2. `lib/alerts/alert.service.ts`
   - Added imports for integrationChannel, IntegrationDeliveryResult, UserIntegration
   - Modified `sendAlert()` to include integration dispatch
   - Added `getUserIntegrations()` method

3. `lib/alerts/index.ts`
   - Added export for integrationChannel

4. `lib/integrations/integration.types.ts`
   - Added `TelegramCredentials`, `PagerDutyCredentials`, `LinearCredentials`, `JiraCredentials` interfaces
   - Updated `IntegrationCredentials` union type

5. `lib/integrations/integration.service.ts`
   - Added imports for new credential types
   - Added `logToTeams()` function
   - Added `logToTelegram()` function
   - Added `logToPagerDuty()` function
   - Added helper methods: `getStatusColor()`, `getStatusEmoji()`, `getPagerDutySeverity()`

### Verification
- ESLint: PASSED
- TypeScript syntax: PASSED
- All imports resolve correctly
- No breaking changes to existing functionality

### Testing Notes
To test the integration:
1. Configure an integration (e.g., Telegram) in the Secrets page
2. Start a training job
3. Verify the integration receives the alert when job completes/fails

### Future Work (Phase 3 - Optional)
- Add `logToLinear()` function
- Add `logToJira()` function
- Add test endpoints for Linear and Jira
