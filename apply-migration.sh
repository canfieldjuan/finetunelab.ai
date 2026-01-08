#!/bin/bash

# Apply worker metrics data type fix migration
# This script applies the migration to fix BIGINT -> NUMERIC for decimal values

MIGRATION_FILE="supabase/migrations/20260101000002_fix_worker_metrics_data_types.sql"

echo "=================================================="
echo "  APPLYING WORKER METRICS DATA TYPE FIX"
echo "=================================================="
echo ""
echo "Migration: $MIGRATION_FILE"
echo ""

# Load environment variables
if [ -f .env.local ]; then
    export $(grep -v '^#' .env.local | xargs)
fi

# Check if we have the Supabase connection string
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo "❌ Error: NEXT_PUBLIC_SUPABASE_URL not found in .env.local"
    exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in .env.local"
    exit 1
fi

echo "✓ Supabase URL: $NEXT_PUBLIC_SUPABASE_URL"
echo "✓ Service key found"
echo ""

# Extract database connection info from Supabase URL
PROJECT_REF=$(echo $NEXT_PUBLIC_SUPABASE_URL | sed -E 's|https://([^.]+)\.supabase\.co|\1|')
echo "Project Reference: $PROJECT_REF"
echo ""

echo "=================================================="
echo "  MIGRATION OPTIONS"
echo "=================================================="
echo ""
echo "Option 1: Run via Supabase Dashboard (Recommended)"
echo "  1. Go to: https://supabase.com/dashboard/project/$PROJECT_REF/sql/new"
echo "  2. Copy and paste the SQL from: $MIGRATION_FILE"
echo "  3. Click 'Run'"
echo ""
echo "Option 2: View the SQL below and run manually"
echo ""
cat "$MIGRATION_FILE"
echo ""
echo "=================================================="
