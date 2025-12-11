#!/bin/bash
# Fix deployment foreign key issue

echo "🔧 Fixing local_inference_servers foreign key constraint..."
echo ""
echo "This will:"
echo "  • Allow training_job_id to be NULL"
echo "  • Enable deploying base models and external models"
echo ""

# Get Supabase connection string
if [ -f .env ]; then
  source .env
else
  echo "❌ .env file not found"
  exit 1
fi

# Extract connection details from SUPABASE_URL if DATABASE_URL not set
if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  DATABASE_URL not found in .env"
  echo ""
  echo "Please go to Supabase Dashboard > Settings > Database"
  echo "Copy the 'Connection string' (URI format)"
  echo "Add to .env as: DATABASE_URL=postgresql://..."
  echo ""
  echo "OR run the SQL manually in Supabase SQL Editor:"
  echo ""
  cat /tmp/run_migration.sql
  exit 1
fi

# Run migration
psql "$DATABASE_URL" < /tmp/run_migration.sql

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Migration applied successfully!"
  echo ""
  echo "🎯 Now try deploying your model again"
else
  echo ""
  echo "❌ Migration failed"
  echo ""
  echo "Please run manually in Supabase SQL Editor:"
  cat /tmp/run_migration.sql
fi
