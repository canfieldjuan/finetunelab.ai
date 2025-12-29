#!/bin/bash
# Fix all NEXT_PUBLIC_SUPABASE_URL! non-null assertions

# Find all TypeScript files with the pattern
files=$(grep -rl "process\.env\.NEXT_PUBLIC_SUPABASE_URL!" . --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git | grep -v "scripts/" | grep -v "diagnose" | grep -v "test" | grep -v "apply_" | grep -v "debug_" | grep -v "\.backup")

echo "Found $(echo "$files" | wc -l) files to fix"

for file in $files; do
  echo "Fixing: $file"

  # Replace NEXT_PUBLIC_SUPABASE_URL! with fallback
  sed -i "s/process\.env\.NEXT_PUBLIC_SUPABASE_URL!/process.env.NEXT_PUBLIC_SUPABASE_URL || 'https:\/\/xxxxxxxxxxxxx.supabase.co'/g" "$file"

  # Replace NEXT_PUBLIC_SUPABASE_ANON_KEY! with fallback
  sed -i "s/process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY!/process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE'/g" "$file"

  # Replace SUPABASE_SERVICE_ROLE_KEY! with fallback
  sed -i "s/process\.env\.SUPABASE_SERVICE_ROLE_KEY!/process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY0NTE5MjgyMCwiZXhwIjoxOTYwNzY4ODIwfQ.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE'/g" "$file"
done

echo "Done!"
