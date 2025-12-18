#!/bin/bash

# Apply message_evaluations migration
# This script applies the migration to create the message_evaluations table

MIGRATION_FILE="supabase/migrations/20251216_create_message_evaluations.sql"

echo "=================================================="
echo "  APPLYING MESSAGE EVALUATIONS MIGRATION"
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
echo "Option 2: Run via psql (if you have credentials)"
echo "  psql 'postgres://postgres:[PASSWORD]@db.$PROJECT_REF.supabase.co:5432/postgres' -f $MIGRATION_FILE"
echo ""
echo "Option 3: Use Supabase CLI"
echo "  npx supabase db push"
echo ""
echo "=================================================="
echo ""

# Try to show the SQL file contents
if [ -f "$MIGRATION_FILE" ]; then
    echo "Migration SQL preview (first 30 lines):"
    echo "---"
    head -30 "$MIGRATION_FILE"
    echo "---"
    echo ""
    echo "✓ Migration file ready at: $MIGRATION_FILE"
else
    echo "❌ Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo ""
echo "After applying the migration, quality metrics in analytics will work!"
