# User Alert System

**Date:** 2025-12-12
**Status:** IMPLEMENTED
**Goal:** Build comprehensive alert system for training job events, resource alerts, and scheduled reports

---

## Requirements

### Triggers
1. **Training Job Events**
   - Job started
   - Job completed (success)
   - Job failed (with error details)
   - Job cancelled

2. **Resource Alerts**
   - GPU OOM detected
   - Disk space warning
   - Timeout warning (no progress for X minutes)

3. **Scheduled Reports**
   - Daily training summary
   - Weekly performance digest

### Delivery Channels
1. **Email** - Using existing `intelligent_email` tool
2. **Webhook** - POST to user-configured URLs (Slack, Discord, custom)

### Storage
- Supabase tables for preferences and history

---

## Database Schema

### Table: `user_alert_preferences`

```sql
CREATE TABLE user_alert_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Email settings
  email_enabled BOOLEAN DEFAULT true,
  email_address TEXT,  -- Override, defaults to user's auth email

  -- Training job alerts
  alert_job_started BOOLEAN DEFAULT false,
  alert_job_completed BOOLEAN DEFAULT true,
  alert_job_failed BOOLEAN DEFAULT true,
  alert_job_cancelled BOOLEAN DEFAULT false,

  -- Resource alerts
  alert_gpu_oom BOOLEAN DEFAULT true,
  alert_disk_warning BOOLEAN DEFAULT true,
  alert_timeout_warning BOOLEAN DEFAULT true,

  -- Scheduled reports
  daily_summary_enabled BOOLEAN DEFAULT false,
  daily_summary_time TIME DEFAULT '09:00:00',
  weekly_digest_enabled BOOLEAN DEFAULT false,
  weekly_digest_day INTEGER DEFAULT 1,  -- 0=Sunday, 1=Monday, etc.

  -- Quiet hours (no alerts)
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME DEFAULT '22:00:00',
  quiet_hours_end TIME DEFAULT '08:00:00',
  timezone TEXT DEFAULT 'UTC',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);
```

### Table: `user_webhooks`

```sql
CREATE TABLE user_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,  -- "Slack #ml-alerts", "Discord Bot"
  url TEXT NOT NULL,

  -- Webhook type for formatting
  webhook_type TEXT DEFAULT 'generic',  -- 'slack', 'discord', 'generic'

  -- Secret for signature verification (optional)
  secret TEXT,

  -- Which alerts to send
  alert_job_started BOOLEAN DEFAULT false,
  alert_job_completed BOOLEAN DEFAULT true,
  alert_job_failed BOOLEAN DEFAULT true,
  alert_job_cancelled BOOLEAN DEFAULT false,
  alert_gpu_oom BOOLEAN DEFAULT true,
  alert_disk_warning BOOLEAN DEFAULT true,
  alert_timeout_warning BOOLEAN DEFAULT true,

  -- Status
  enabled BOOLEAN DEFAULT true,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `alert_history`

```sql
CREATE TABLE alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Alert details
  alert_type TEXT NOT NULL,  -- 'job_completed', 'job_failed', 'gpu_oom', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,

  -- Related entity
  job_id UUID,  -- Reference to training job if applicable

  -- Delivery status
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  email_error TEXT,

  webhook_sent BOOLEAN DEFAULT false,
  webhook_sent_at TIMESTAMPTZ,
  webhook_id UUID REFERENCES user_webhooks(id) ON DELETE SET NULL,
  webhook_error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying user's alert history
CREATE INDEX idx_alert_history_user_created ON alert_history(user_id, created_at DESC);
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ALERT SYSTEM                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐                                               │
│  │ TRIGGER SOURCES │                                               │
│  ├─────────────────┤                                               │
│  │ Training Server │──┐                                            │
│  │ (job events)    │  │                                            │
│  ├─────────────────┤  │    ┌──────────────────┐                   │
│  │ Resource Monitor│──┼───▶│ AlertService     │                   │
│  │ (GPU/disk)      │  │    │                  │                   │
│  ├─────────────────┤  │    │ - checkPrefs()   │                   │
│  │ Cron Scheduler  │──┘    │ - formatAlert()  │                   │
│  │ (reports)       │       │ - dispatch()     │                   │
│  └─────────────────┘       └────────┬─────────┘                   │
│                                     │                              │
│                    ┌────────────────┼────────────────┐            │
│                    │                │                │            │
│                    ▼                ▼                ▼            │
│           ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│           │ EmailChannel │  │WebhookChannel│  │ AlertHistory │   │
│           │              │  │              │  │              │   │
│           │ (intelligent │  │ - Slack fmt  │  │ (Supabase)   │   │
│           │  _email tool)│  │ - Discord fmt│  │              │   │
│           │              │  │ - Generic    │  │              │   │
│           └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
lib/alerts/
├── index.ts                    # Main exports
├── alert.service.ts            # Core AlertService class
├── alert.types.ts              # TypeScript interfaces
├── channels/
│   ├── email.channel.ts        # Email delivery (uses intelligent_email)
│   └── webhook.channel.ts      # Webhook delivery with formatting
├── formatters/
│   ├── slack.formatter.ts      # Slack Block Kit formatting
│   ├── discord.formatter.ts    # Discord embed formatting
│   └── email.formatter.ts      # HTML email templates
├── triggers/
│   ├── training-job.trigger.ts # Job event triggers
│   └── resource.trigger.ts     # Resource alert triggers
└── templates/
    ├── job-completed.ts        # Template for completed jobs
    ├── job-failed.ts           # Template for failed jobs
    └── daily-summary.ts        # Template for daily reports

app/api/alerts/
├── preferences/route.ts        # GET/PUT user preferences
├── webhooks/route.ts           # CRUD webhooks
├── webhooks/[id]/route.ts      # Individual webhook ops
├── webhooks/[id]/test/route.ts # Test webhook delivery
└── history/route.ts            # Alert history
```

---

## Implementation Phases

### Phase 1: Database & Types
- [ ] Create Supabase migration
- [ ] Define TypeScript interfaces
- [ ] Set up RLS policies

### Phase 2: Core Alert Service
- [ ] Create AlertService class
- [ ] Implement preference checking
- [ ] Add quiet hours logic
- [ ] Create alert history logging

### Phase 3: Email Channel
- [ ] Create email.channel.ts
- [ ] Build HTML email templates
- [ ] Integrate with intelligent_email tool

### Phase 4: Webhook Channel
- [ ] Create webhook.channel.ts
- [ ] Implement Slack formatter
- [ ] Implement Discord formatter
- [ ] Add signature verification
- [ ] Handle retries and failures

### Phase 5: API Routes
- [ ] Preferences API (GET/PUT)
- [ ] Webhooks CRUD API
- [ ] Webhook test endpoint
- [ ] Alert history API

### Phase 6: Training Integration
- [ ] Add triggers to training_server.py
- [ ] Or: Use Supabase realtime triggers
- [ ] Emit alerts on status changes

### Phase 7: Scheduled Reports (Optional)
- [ ] Set up cron/scheduler
- [ ] Daily summary generation
- [ ] Weekly digest generation

---

## Alert Types

| Type | Trigger | Default Email | Default Webhook |
|------|---------|---------------|-----------------|
| `job_started` | Job status → 'running' | OFF | OFF |
| `job_completed` | Job status → 'completed' | ON | ON |
| `job_failed` | Job status → 'failed' | ON | ON |
| `job_cancelled` | Job status → 'cancelled' | OFF | OFF |
| `gpu_oom` | OOM detected in logs | ON | ON |
| `disk_warning` | Disk usage > 90% | ON | ON |
| `timeout_warning` | No progress 30+ min | ON | ON |
| `daily_summary` | Cron at user's time | OFF | N/A |
| `weekly_digest` | Cron on user's day | OFF | N/A |

---

## Example Alert Payloads

### Slack Webhook (job_completed)

```json
{
  "blocks": [
    {
      "type": "header",
      "text": {"type": "plain_text", "text": "✅ Training Complete"}
    },
    {
      "type": "section",
      "fields": [
        {"type": "mrkdwn", "text": "*Model:*\nmistral-7b-custom"},
        {"type": "mrkdwn", "text": "*Duration:*\n2h 34m"},
        {"type": "mrkdwn", "text": "*Final Loss:*\n0.342"},
        {"type": "mrkdwn", "text": "*Steps:*\n5000/5000"}
      ]
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {"type": "plain_text", "text": "View Details"},
          "url": "https://app.example.com/training/monitor?jobId=xxx"
        }
      ]
    }
  ]
}
```

### Discord Webhook (job_failed)

```json
{
  "embeds": [{
    "title": "❌ Training Failed",
    "color": 15158332,
    "fields": [
      {"name": "Model", "value": "mistral-7b-custom", "inline": true},
      {"name": "Error", "value": "CUDA OOM", "inline": true},
      {"name": "Duration", "value": "45m", "inline": true}
    ],
    "footer": {"text": "Job ID: abc-123"}
  }]
}
```

---

## Security Considerations

1. **Webhook URLs**: Store encrypted, validate HTTPS
2. **Webhook Secrets**: HMAC signature for verification
3. **Rate Limiting**: Max alerts per hour per user
4. **PII**: Don't include sensitive data in webhooks
5. **RLS**: Users can only access their own alerts

---

## Approval Required

Ready to implement? Phases can be done incrementally.
