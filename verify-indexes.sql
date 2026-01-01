-- Query to verify trace filtering indexes exist
-- Run this in Supabase Dashboard SQL Editor

SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'llm_traces'
    AND indexname IN (
        'idx_llm_traces_cost_usd',
        'idx_llm_traces_duration_ms',
        'idx_llm_traces_common_filters',
        'idx_llm_traces_has_error'
    )
ORDER BY indexname;

-- Expected results: 4 rows (one for each index)
-- If any are missing, run the migration file:
-- supabase/migrations/20251226000002_add_trace_filter_indexes.sql
