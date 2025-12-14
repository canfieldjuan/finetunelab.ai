-- Migration: Add Batch Testing Alert Preferences
-- Date: 2025-12-12
-- Description: Adds alert toggles for continuous testing / batch test runs

ALTER TABLE user_alert_preferences
  ADD COLUMN IF NOT EXISTS alert_batch_test_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS alert_batch_test_failed BOOLEAN DEFAULT true;

ALTER TABLE user_webhooks
  ADD COLUMN IF NOT EXISTS alert_batch_test_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS alert_batch_test_failed BOOLEAN DEFAULT true;

