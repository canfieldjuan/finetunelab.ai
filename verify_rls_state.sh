#!/bin/bash

echo "=== SUPABASE RLS VERIFICATION SCRIPT ==="
echo "This script will verify the current state of RLS policies in the database"
echo "Time: $(date)"
echo

# Get Supabase credentials from environment
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "ERROR: Supabase credentials not found in environment"
    echo "Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set"
    exit 1
fi

# Extract database connection info from Supabase URL
DB_HOST=$(echo $SUPABASE_URL | sed 's|https://||' | sed 's|http://||' | cut -d'.' -f1).pooler.supabase.com
DB_NAME="postgres"
DB_USER="postgres.$(echo $SUPABASE_URL | sed 's|https://||' | sed 's|http://||' | cut -d'.' -f1)"
DB_PASSWORD="$SUPABASE_SERVICE_KEY"

echo "Database Host: $DB_HOST"
echo "Database User: $DB_USER"
echo

# Function to execute SQL query
execute_sql() {
    local query="$1"
    local description="$2"
    
    echo "--- $description ---"
    echo "Query: $query"
    echo
    
    PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -d "$DB_NAME" \
        -U "$DB_USER" \
        -p 6543 \
        -c "$query" \
        2>&1
    
    echo
    echo "---"
    echo
}

echo "=== EXECUTING VERIFICATION QUERIES ==="
echo

# Query 1: Check if RLS is enabled on local_training_metrics
execute_sql "SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename = 'local_training_metrics';" "RLS Status for local_training_metrics"

# Query 2: List all RLS policies on local_training_metrics
execute_sql "SELECT * FROM pg_policies WHERE tablename = 'local_training_metrics';" "RLS Policies for local_training_metrics"

# Query 3: Check table permissions for anon role
execute_sql "SELECT grantee, privilege_type FROM information_schema.table_privileges WHERE table_name = 'local_training_metrics' AND grantee IN ('anon', 'authenticated');" "Table Privileges for local_training_metrics"

# Query 4: Check if our specific RLS policy exists
execute_sql "SELECT policyname, cmd, permissive, roles, qual, with_check FROM pg_policies WHERE tablename = 'local_training_metrics' AND policyname = 'Allow insert metrics with valid job token';" "Check for specific RLS policy"

# Query 5: Verify local_training_jobs table structure (for reference check)
execute_sql "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'local_training_jobs' ORDER BY ordinal_position;" "local_training_jobs table structure"

echo "=== VERIFICATION COMPLETE ==="
echo "Time: $(date)"