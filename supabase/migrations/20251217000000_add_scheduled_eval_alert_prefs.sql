-- Migration: Add Scheduled Evaluation Alert Preferences
-- Date: 2025-12-17
-- Description: Adds alert toggles for scheduled evaluations

ALTER TABLE user_alert_preferences
  ADD COLUMN IF NOT EXISTS alert_scheduled_eval_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS alert_scheduled_eval_failed BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS alert_scheduled_eval_disabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS alert_scheduled_eval_regression BOOLEAN DEFAULT true;

ALTER TABLE user_webhooks
  ADD COLUMN IF NOT EXISTS alert_scheduled_eval_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS alert_scheduled_eval_failed BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS alert_scheduled_eval_disabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS alert_scheduled_eval_regression BOOLEAN DEFAULT true;
