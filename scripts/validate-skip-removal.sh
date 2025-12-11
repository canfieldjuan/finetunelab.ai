#!/bin/bash
# Final Validation Script
# Run this to verify all changes were applied correctly

echo "════════════════════════════════════════════════════════════════"
echo "  SKIP LOGIC REMOVAL - FINAL VALIDATION"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Check 1: Line count
echo "✓ CHECK 1: File size reduction"
CURRENT=$(wc -l < app/api/chat/route.ts)
BACKUP=$(wc -l < app/api/chat/route.ts.backup)
DIFF=$((BACKUP - CURRENT))
echo "  Before: $BACKUP lines"
echo "  After:  $CURRENT lines"
echo "  Reduction: $DIFF lines"
if [ $DIFF -gt 20 ]; then
  echo "  ✅ PASS: Significant reduction achieved"
else
  echo "  ❌ FAIL: Expected ~28 line reduction"
fi
echo ""

# Check 2: No shouldSkipGraphRAG references
echo "✓ CHECK 2: shouldSkipGraphRAG removed"
if grep -q "shouldSkipGraphRAG" app/api/chat/route.ts; then
  echo "  ❌ FAIL: Found references to shouldSkipGraphRAG"
  grep -n "shouldSkipGraphRAG" app/api/chat/route.ts
else
  echo "  ✅ PASS: No references found"
fi
echo ""

# Check 3: New logging present
echo "✓ CHECK 3: New logging statements"
if grep -q "GraphRAG found no relevant context" app/api/chat/route.ts; then
  echo "  ✅ PASS: New 'no context' logging found"
else
  echo "  ❌ FAIL: New logging not found"
fi
echo ""

# Check 4: Updated comments
echo "✓ CHECK 4: Updated comments"
if grep -q "inject document context for all queries" app/api/chat/route.ts; then
  echo "  ✅ PASS: Updated comment found"
else
  echo "  ❌ FAIL: Comment not updated"
fi
echo ""

# Check 5: TypeScript compilation
echo "✓ CHECK 5: TypeScript compilation"
if npx tsc --noEmit 2>&1 | grep -q "error TS"; then
  echo "  ❌ FAIL: TypeScript errors found"
  npx tsc --noEmit 2>&1 | grep "error TS"
else
  echo "  ✅ PASS: No TypeScript errors"
fi
echo ""

# Check 6: Backup exists
echo "✓ CHECK 6: Backup file"
if [ -f "app/api/chat/route.ts.backup" ]; then
  echo "  ✅ PASS: Backup file exists"
else
  echo "  ❌ FAIL: Backup file not found"
fi
echo ""

# Check 7: Test scripts updated
echo "✓ CHECK 7: Test scripts updated"
if grep -q "DEPRECATED" scripts/test-skip-graphrag.js; then
  echo "  ✅ PASS: test-skip-graphrag.js marked as deprecated"
else
  echo "  ❌ FAIL: Test script not updated"
fi
echo ""

echo "════════════════════════════════════════════════════════════════"
echo "  VALIDATION COMPLETE"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Next Steps:"
echo "1. Start dev server: npm run dev"
echo "2. Test pure math: 'calculate 23% of 456'"
echo "3. Test knowledge: 'What is RTX 4090 TDP?'"
echo "4. Test hybrid: 'I have 700W PSU, can I add RTX 4090?'"
echo ""
echo "Watch terminal for:"
echo "  [API] GraphRAG found no relevant context (pure math)"
echo "  [API] GraphRAG context added from X sources (knowledge)"
echo "  [ToolManager] Executing tool: calculator (tool usage)"
echo ""
