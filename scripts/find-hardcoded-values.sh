#!/bin/bash
# Find Hardcoded Values Script
# Usage: ./scripts/find-hardcoded-values.sh [directory]
# Default directory: lib/training

TARGET_DIR="${1:-lib/training}"

echo "========================================"
echo "Searching for hardcoded values in: $TARGET_DIR"
echo "========================================"
echo ""

echo "1. HARDCODED FILE PATHS:"
echo "----------------------------------------"
grep -rn "C:/Users/\|/home/[a-z-]*/Desktop" "$TARGET_DIR" --include="*.py" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "trainer_venv\|test_venv\|node_modules" | head -20
echo ""

echo "2. HARDCODED LOCALHOST URLs:"
echo "----------------------------------------"
grep -rn "localhost:[0-9]\{4\}\|http://localhost" "$TARGET_DIR" --include="*.py" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "trainer_venv\|test_venv\|node_modules" | head -20
echo ""

echo "3. HARDCODED TIMEOUTS (in code):"
echo "----------------------------------------"
grep -rn "timeout.*=.*[0-9]\+\|TIMEOUT.*=.*[0-9]\+\|sleep([0-9]\+)" "$TARGET_DIR" --include="*.py" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "trainer_venv\|test_venv\|node_modules" | head -20
echo ""

echo "4. HARDCODED MODEL PREFIXES:"
echo "----------------------------------------"
grep -rn "startswith.*Qwen-\|startswith.*Meta-\|startswith.*mistral" "$TARGET_DIR" --include="*.py" 2>/dev/null | grep -v "trainer_venv\|test_venv" | head -15
echo ""

echo "5. HARDCODED PORT NUMBERS:"
echo "----------------------------------------"
grep -rn "port.*=.*[0-9]\{4\}\|PORT.*=.*[0-9]\{4\}" "$TARGET_DIR" --include="*.py" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "trainer_venv\|test_venv\|node_modules" | head -15
echo ""

echo "6. HARDCODED RETRY COUNTS:"
echo "----------------------------------------"
grep -rn "MAX_RETRIES.*=\|max_retries.*=\|retries.*=.*[0-9]" "$TARGET_DIR" --include="*.py" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "trainer_venv\|test_venv\|node_modules" | head -15
echo ""

echo "========================================"
echo "Search complete!"
echo "========================================"
