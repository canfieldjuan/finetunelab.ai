#!/bin/bash

# ============================================================================
# Apply Notification Type Fix
# ============================================================================

echo "🔧 Applying notification RPC function type fix..."
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not found in environment"
    echo ""
    echo "Please set DATABASE_URL or run manually:"
    echo "  1. Open Supabase Dashboard → SQL Editor"
    echo "  2. Copy contents of fix_notification_type_mismatch.sql"
    echo "  3. Run the query"
    echo ""
    exit 1
fi

# Apply the fix using psql if available
if command -v psql &> /dev/null; then
    echo "✓ psql found, applying fix..."
    psql "$DATABASE_URL" -f fix_notification_type_mismatch.sql
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Fix applied successfully!"
        echo ""
        echo "Running verification test..."
        node check_notification_functions.js
    else
        echo ""
        echo "❌ Failed to apply fix"
        exit 1
    fi
else
    echo "⚠️  psql not installed"
    echo ""
    echo "📋 Manual Steps:"
    echo "  1. Open: https://supabase.com/dashboard → SQL Editor"
    echo "  2. Copy: fix_notification_type_mismatch.sql"
    echo "  3. Run the query"
    echo "  4. Then run: node check_notification_functions.js"
    echo ""
    exit 1
fi
