#!/bin/bash
# Check Schedule Type Constraint
# Verifies current allowed values for schedule_type

set -e

echo "=================================================="
echo "  Check schedule_type Constraint"
echo "=================================================="
echo ""

# Check environment variables
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: Missing environment variables"
  echo "   Load them with: source .env.local"
  exit 1
fi

# Extract database connection info
DB_HOST=$(echo "$NEXT_PUBLIC_SUPABASE_URL" | sed -E 's|https://([^.]+)\.supabase\.co|\1.supabase.co|')
DB_NAME="postgres"
DB_USER="postgres"

echo "🔍 Querying constraint..."
echo ""

# Check constraint definition
PGPASSWORD="$SUPABASE_SERVICE_ROLE_KEY" psql \
  -h "db.$DB_HOST" \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -c "SELECT
        conname AS constraint_name,
        pg_get_constraintdef(oid) AS constraint_definition
      FROM pg_constraint
      WHERE conname = 'scheduled_evaluations_schedule_type_check'
      AND conrelid = 'public.scheduled_evaluations'::regclass;"

echo ""
echo "📋 Current Status:"

# Parse the constraint to show allowed values
CONSTRAINT_DEF=$(PGPASSWORD="$SUPABASE_SERVICE_ROLE_KEY" psql \
  -h "db.$DB_HOST" \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -t \
  -c "SELECT pg_get_constraintdef(oid)
      FROM pg_constraint
      WHERE conname = 'scheduled_evaluations_schedule_type_check';")

echo "$CONSTRAINT_DEF"
echo ""

# Check if 'every_5_minutes' is included
if echo "$CONSTRAINT_DEF" | grep -q "every_5_minutes"; then
  echo "✅ Constraint includes 'every_5_minutes'"
  echo "   You can create schedules with this type!"
else
  echo "⚠️  Constraint does NOT include 'every_5_minutes'"
  echo "   Run: ./apply-schedule-migration.sh to add it"
fi
