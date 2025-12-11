#!/bin/bash
# Quick script to apply the migration
# Run this: ./apply-migration.sh

echo "🔄 Applying migration: Make message_id optional..."
echo ""
echo "Copy and paste this SQL into your Supabase SQL Editor:"
echo "=========================================="
cat supabase/migrations/20251018000003_make_message_id_optional.sql
echo ""
echo "=========================================="
echo ""
echo "Or run this command if you have Supabase CLI:"
echo "supabase db push"
