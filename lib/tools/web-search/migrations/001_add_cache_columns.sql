-- Migration: Add missing columns to search_summaries table for web search cache
-- This fixes the cache implementation to work with the Base AI plan

-- Step 1: Check if columns exist and add them if missing
DO $$ 
BEGIN
  -- Add query_hash column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'search_summaries' 
    AND column_name = 'query_hash'
  ) THEN
    ALTER TABLE search_summaries 
    ADD COLUMN query_hash TEXT;
    
    RAISE NOTICE 'Added query_hash column';
  END IF;

  -- Add expires_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'search_summaries' 
    AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE search_summaries 
    ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;
    
    RAISE NOTICE 'Added expires_at column';
  END IF;

  -- Add provider column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'search_summaries' 
    AND column_name = 'provider'
  ) THEN
    ALTER TABLE search_summaries 
    ADD COLUMN provider TEXT DEFAULT 'brave';
    
    RAISE NOTICE 'Added provider column';
  END IF;

  -- Add max_results column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'search_summaries' 
    AND column_name = 'max_results'
  ) THEN
    ALTER TABLE search_summaries 
    ADD COLUMN max_results INTEGER DEFAULT 5;
    
    RAISE NOTICE 'Added max_results column';
  END IF;

  -- Add result_count column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'search_summaries' 
    AND column_name = 'result_count'
  ) THEN
    ALTER TABLE search_summaries 
    ADD COLUMN result_count INTEGER DEFAULT 0;
    
    RAISE NOTICE 'Added result_count column';
  END IF;

  -- Add latency_ms column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'search_summaries' 
    AND column_name = 'latency_ms'
  ) THEN
    ALTER TABLE search_summaries 
    ADD COLUMN latency_ms INTEGER DEFAULT 0;
    
    RAISE NOTICE 'Added latency_ms column';
  END IF;

  -- Add raw_response column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'search_summaries' 
    AND column_name = 'raw_response'
  ) THEN
    ALTER TABLE search_summaries 
    ADD COLUMN raw_response JSONB;
    
    RAISE NOTICE 'Added raw_response column';
  END IF;
END $$;

-- Step 2: Create index on query_hash for fast lookups
CREATE INDEX IF NOT EXISTS idx_search_summaries_query_hash 
ON search_summaries(query_hash);

-- Step 3: Create index on expires_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_search_summaries_expires_at 
ON search_summaries(expires_at);

-- Step 4: Create composite index for cache lookups
CREATE INDEX IF NOT EXISTS idx_search_summaries_cache_lookup 
ON search_summaries(query_hash, provider, max_results);

-- Step 5: Add constraint to ensure unique cache entries
ALTER TABLE search_summaries 
DROP CONSTRAINT IF EXISTS unique_cache_entry;

ALTER TABLE search_summaries 
ADD CONSTRAINT unique_cache_entry 
UNIQUE (query_hash, provider, max_results);

COMMENT ON TABLE search_summaries IS 'Cache for web search results with AI inference rights (Base AI plan)';
COMMENT ON COLUMN search_summaries.query_hash IS 'SHA-256 hash of query + provider + maxResults for fast lookups';
COMMENT ON COLUMN search_summaries.expires_at IS 'Timestamp when cache entry expires (TTL from config)';
COMMENT ON COLUMN search_summaries.provider IS 'Search provider (brave, serper, etc)';
COMMENT ON COLUMN search_summaries.max_results IS 'Maximum number of results requested';
COMMENT ON COLUMN search_summaries.result_count IS 'Actual number of results returned';
COMMENT ON COLUMN search_summaries.latency_ms IS 'API response time in milliseconds';
COMMENT ON COLUMN search_summaries.raw_response IS 'Raw API response for debugging';
