-- ============================================================================
-- APPLY THIS MIGRATION IN SUPABASE DASHBOARD
-- ============================================================================
-- Instructions:
-- 1. Go to your Supabase Dashboard (https://app.supabase.com)
-- 2. Navigate to: SQL Editor (left sidebar)
-- 3. Click "New Query"
-- 4. Copy and paste this ENTIRE file
-- 5. Click "Run" (or press Ctrl+Enter)
-- 6. Check output for success messages
-- ============================================================================

-- Create Training Package Versions Table
-- Purpose: Track versioned snapshots of training packages with draft/publish workflow
-- Date: 2025-01-31

-- ============================================================================
-- STEP 1: Create the main table
-- ============================================================================

CREATE TABLE IF NOT EXISTS training_package_versions (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES training_configs(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,

  -- Version metadata
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Configuration snapshots (JSONB for flexibility)
  config_snapshot JSONB NOT NULL,
  model_snapshot JSONB NOT NULL,
  dataset_snapshot JSONB NOT NULL,

  -- Change tracking
  change_summary TEXT,
  parent_version_id UUID REFERENCES training_package_versions(id) ON DELETE SET NULL,

  -- Deployment tracking
  is_deployed BOOLEAN NOT NULL DEFAULT FALSE,
  deployment_target TEXT CHECK (deployment_target IN ('local', 'hf_space')),
  deployment_url TEXT,
  deployment_id TEXT,

  -- Training status
  training_status TEXT CHECK (training_status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  training_started_at TIMESTAMPTZ,
  training_completed_at TIMESTAMPTZ,
  training_metrics JSONB,

  -- Cost tracking
  estimated_cost DECIMAL(10, 2),
  actual_cost DECIMAL(10, 2),
  budget_limit DECIMAL(10, 2),
  cost_alerts_sent JSONB,

  -- Constraints
  UNIQUE(package_id, version_number),

  -- Validation constraints
  CONSTRAINT valid_published_version CHECK (
    (status = 'published' AND published_at IS NOT NULL AND published_by IS NOT NULL) OR
    (status != 'published')
  ),
  CONSTRAINT valid_deployment CHECK (
    (is_deployed = TRUE AND deployment_target IS NOT NULL) OR
    (is_deployed = FALSE)
  )
);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_package_versions_package ON training_package_versions(package_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_package_versions_status ON training_package_versions(status);
CREATE INDEX IF NOT EXISTS idx_package_versions_user ON training_package_versions(created_by);
CREATE INDEX IF NOT EXISTS idx_package_versions_deployment ON training_package_versions(deployment_id) WHERE deployment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_package_versions_training_status ON training_package_versions(training_status) WHERE training_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_package_versions_parent ON training_package_versions(parent_version_id) WHERE parent_version_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_package_versions_config_snapshot ON training_package_versions USING GIN (config_snapshot);
CREATE INDEX IF NOT EXISTS idx_package_versions_model_snapshot ON training_package_versions USING GIN (model_snapshot);
CREATE INDEX IF NOT EXISTS idx_package_versions_dataset_snapshot ON training_package_versions USING GIN (dataset_snapshot);

-- ============================================================================
-- STEP 3: Enable RLS and create policies
-- ============================================================================

ALTER TABLE training_package_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own package versions" ON training_package_versions;
CREATE POLICY "Users can view own package versions"
  ON training_package_versions FOR SELECT
  USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can create own package versions" ON training_package_versions;
CREATE POLICY "Users can create own package versions"
  ON training_package_versions FOR INSERT
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can update own package versions" ON training_package_versions;
CREATE POLICY "Users can update own package versions"
  ON training_package_versions FOR UPDATE
  USING (auth.uid() = created_by AND status = 'draft');

DROP POLICY IF EXISTS "Users can delete own package versions" ON training_package_versions;
CREATE POLICY "Users can delete own package versions"
  ON training_package_versions FOR DELETE
  USING (auth.uid() = created_by AND status = 'draft');

-- ============================================================================
-- STEP 4: Create functions
-- ============================================================================

CREATE OR REPLACE FUNCTION update_training_package_versions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_next_version_number(p_package_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_next_version INTEGER;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO v_next_version
  FROM training_package_versions
  WHERE package_id = p_package_id;

  RETURN v_next_version;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_version_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE training_configs
    SET version_count = version_count + 1
    WHERE id = NEW.package_id;

    IF NEW.status = 'published' THEN
      UPDATE training_configs
      SET latest_published_version = GREATEST(COALESCE(latest_published_version, 0), NEW.version_number)
      WHERE id = NEW.package_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE training_configs
    SET version_count = GREATEST(version_count - 1, 0)
    WHERE id = OLD.package_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 5: Create triggers
-- ============================================================================

DROP TRIGGER IF EXISTS set_updated_at ON training_package_versions;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON training_package_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_training_package_versions_updated_at();

DROP TRIGGER IF EXISTS update_config_version_count ON training_package_versions;
CREATE TRIGGER update_config_version_count
  AFTER INSERT OR DELETE ON training_package_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_version_count();

-- ============================================================================
-- STEP 6: Update training_configs table
-- ============================================================================

ALTER TABLE training_configs
ADD COLUMN IF NOT EXISTS current_version_id UUID REFERENCES training_package_versions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS version_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS latest_published_version INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_training_configs_current_version ON training_configs(current_version_id);

-- ============================================================================
-- STEP 7: Verification
-- ============================================================================

DO $$
BEGIN
  -- Verify table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'training_package_versions') THEN
    RAISE NOTICE '✅ Table training_package_versions created successfully';
  ELSE
    RAISE EXCEPTION '❌ Failed to create training_package_versions table';
  END IF;

  -- Verify RLS
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'training_package_versions' AND rowsecurity = true) THEN
    RAISE NOTICE '✅ RLS enabled on training_package_versions';
  ELSE
    RAISE WARNING '⚠️  RLS not enabled on training_package_versions';
  END IF;

  -- Verify policies
  IF (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'training_package_versions') >= 4 THEN
    RAISE NOTICE '✅ RLS policies created (% policies)', (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'training_package_versions');
  ELSE
    RAISE WARNING '⚠️  Expected 4+ RLS policies, found %', (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'training_package_versions');
  END IF;

  -- Verify indexes
  IF (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'training_package_versions') >= 9 THEN
    RAISE NOTICE '✅ Indexes created (% indexes)', (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'training_package_versions');
  ELSE
    RAISE WARNING '⚠️  Expected 9+ indexes, found %', (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'training_package_versions');
  END IF;

  -- Verify training_configs columns
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'training_configs' AND column_name = 'current_version_id') THEN
    RAISE NOTICE '✅ training_configs updated with version tracking columns';
  ELSE
    RAISE WARNING '⚠️  training_configs missing current_version_id column';
  END IF;

  RAISE NOTICE '================================================================';
  RAISE NOTICE '✅ MIGRATION COMPLETE!';
  RAISE NOTICE '================================================================';
END $$;
