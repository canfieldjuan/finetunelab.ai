-- Fix worker_metrics data types to accept decimal values
-- The system monitor sends decimal values but columns were BIGINT
-- Date: 2026-01-01

-- Change BIGINT columns to NUMERIC to accept decimal values
ALTER TABLE public.worker_metrics
  ALTER COLUMN memory_used_mb TYPE NUMERIC USING memory_used_mb::NUMERIC,
  ALTER COLUMN memory_total_mb TYPE NUMERIC USING memory_total_mb::NUMERIC,
  ALTER COLUMN disk_used_gb TYPE NUMERIC USING disk_used_gb::NUMERIC;

-- Update comments
COMMENT ON COLUMN public.worker_metrics.memory_used_mb IS 'Memory used in megabytes (decimal precision)';
COMMENT ON COLUMN public.worker_metrics.memory_total_mb IS 'Total memory in megabytes (decimal precision)';
COMMENT ON COLUMN public.worker_metrics.disk_used_gb IS 'Disk used in gigabytes (decimal precision)';
