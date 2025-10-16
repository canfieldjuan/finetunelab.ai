-- Web Search Cache Table
-- Stores normalized search results for durability and caching
-- Run in Supabase SQL editor or apply through migrations

CREATE TABLE IF NOT EXISTS web_search_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_hash TEXT NOT NULL,
    query_text TEXT NOT NULL,
    provider TEXT NOT NULL,
    max_results INTEGER NOT NULL,
    result_count INTEGER NOT NULL,
    results JSONB NOT NULL,
    raw_response JSONB,
    latency_ms INTEGER NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (query_hash, provider, max_results)
);

CREATE INDEX IF NOT EXISTS idx_web_search_results_provider ON web_search_results(provider);
CREATE INDEX IF NOT EXISTS idx_web_search_results_expires_at ON web_search_results(expires_at);
CREATE INDEX IF NOT EXISTS idx_web_search_results_query_hash ON web_search_results(query_hash);

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION set_web_search_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_web_search_results_updated_at ON web_search_results;

CREATE TRIGGER trg_web_search_results_updated_at
BEFORE UPDATE ON web_search_results
FOR EACH ROW
EXECUTE FUNCTION set_web_search_results_updated_at();
