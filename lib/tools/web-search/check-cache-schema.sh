#!/bin/bash
# Check Supabase table schema and apply migration if needed

echo "======================================"
echo "Web Search Cache - Schema Diagnostic"
echo "======================================"
echo ""

# Check if we have the Supabase credentials
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "ERROR: Supabase credentials not found in environment"
    echo "Please make sure .env file has:"
    echo "  - NEXT_PUBLIC_SUPABASE_URL"
    echo "  - SUPABASE_SERVICE_ROLE_KEY"
    exit 1
fi

echo "Supabase URL: $NEXT_PUBLIC_SUPABASE_URL"
echo ""

# Check current table columns
echo "Step 1: Checking current table schema..."
echo ""

COLUMNS=$(curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/?apikey=$SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" | jq -r '.definitions.search_summaries.properties | keys[]' 2>/dev/null)

if [ -z "$COLUMNS" ]; then
    echo "WARNING: Could not fetch table schema. Table might not exist."
    echo ""
    read -p "Do you want to create the search_summaries table? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Creating table..."
        # Run creation script
        exit 0
    else
        echo "Skipping table creation."
        exit 1
    fi
fi

echo "Current columns in search_summaries table:"
echo "$COLUMNS"
echo ""

# Check for required columns
REQUIRED_COLS=("query_hash" "expires_at" "provider" "max_results" "result_count" "latency_ms" "raw_response")
MISSING_COLS=()

for col in "${REQUIRED_COLS[@]}"; do
    if ! echo "$COLUMNS" | grep -q "^$col$"; then
        MISSING_COLS+=("$col")
    fi
done

if [ ${#MISSING_COLS[@]} -eq 0 ]; then
    echo "SUCCESS: All required columns are present!"
    echo ""
    echo "Cache is ready to use with Base AI plan."
    exit 0
else
    echo "WARNING: Missing columns detected:"
    for col in "${MISSING_COLS[@]}"; do
        echo "  - $col"
    done
    echo ""
    echo "Step 2: Applying migration..."
    echo ""
    echo "Please run the following SQL in your Supabase SQL Editor:"
    echo ""
    cat ./lib/tools/web-search/migrations/001_add_cache_columns.sql
    echo ""
    echo "Or apply it automatically using Supabase CLI:"
    echo "  supabase db push"
    echo ""
fi
