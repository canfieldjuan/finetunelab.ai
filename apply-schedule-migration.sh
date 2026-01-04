#!/bin/bash
# Apply Schedule Type Migration
# Adds 'every_5_minutes' to schedule_type constraint

set -e  # Exit on error

echo "=================================================="
echo "  Apply 'every_5_minutes' Schedule Type Migration"
echo "=================================================="
echo ""

# Check environment variables
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: Missing environment variables"
  echo "   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
  echo ""
  echo "   Load them with: source .env.local"
  exit 1
fi

# Extract database connection info from Supabase URL
DB_HOST=$(echo "$NEXT_PUBLIC_SUPABASE_URL" | sed -E 's|https://([^.]+)\.supabase\.co|\1.supabase.co|')
DB_NAME="postgres"
DB_USER="postgres"

echo "📋 Migration Details:"
echo "   File: supabase/migrations/20260104000000_add_every_5_minutes_schedule_type.sql"
echo "   Action: Add 'every_5_minutes' to schedule_type CHECK constraint"
echo ""

# Confirmation prompt
read -p "Apply this migration? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "❌ Migration cancelled"
  exit 0
fi

echo ""
echo "🔄 Applying migration..."
echo ""

# Apply migration using psql
PGPASSWORD="$SUPABASE_SERVICE_ROLE_KEY" psql \
  -h "db.$DB_HOST" \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -f supabase/migrations/20260104000000_add_every_5_minutes_schedule_type.sql

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Migration applied successfully!"
  echo ""
  echo "📊 Verification:"

  # Verify constraint
  PGPASSWORD="$SUPABASE_SERVICE_ROLE_KEY" psql \
    -h "db.$DB_HOST" \
    -p 5432 \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -c "SELECT conname, pg_get_constraintdef(oid)
        FROM pg_constraint
        WHERE conname = 'scheduled_evaluations_schedule_type_check';"

  echo ""
  echo "✅ You can now create schedules with 'every_5_minutes' type!"
else
  echo ""
  echo "❌ Migration failed!"
  echo "   Check error messages above"
  exit 1
fi
