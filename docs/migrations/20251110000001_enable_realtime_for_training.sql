-- Migration: Enable realtime + read access for training monitor
-- Date: 2025-11-10
-- Purpose: Allow browser (anon/auth roles) to read training tables and receive realtime events

-- 1) Ensure tables are part of Supabase realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE local_training_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE local_training_metrics;

-- 2) Grant read permissions to browser roles
GRANT SELECT ON local_training_jobs TO anon, authenticated;
GRANT SELECT ON local_training_metrics TO anon, authenticated;

-- 3) (Idempotent) ensure sequences remain accessible when new rows inserted via realtime clients
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
