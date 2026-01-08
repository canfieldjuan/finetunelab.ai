#!/bin/bash

# This script will show the remaining recordUsageEvent calls to comment out
# Run this to verify what still needs to be done

echo "=== Remaining recordUsageEvent Calls to Comment Out ==="
echo ""

echo "File 3: app/api/graphrag/search/route.ts"
grep -n "recordUsageEvent" app/api/graphrag/search/route.ts
echo ""

echo "File 4: app/api/batch-testing/run/route.ts"
grep -n "recordUsageEvent" app/api/batch-testing/run/route.ts
echo ""

echo "File 5: app/api/analytics/chat/route.ts"
grep -n "recordUsageEvent" app/api/analytics/chat/route.ts
echo ""

echo "File 6: app/api/analytics/anomalies/detect/route.ts"
grep -n "recordUsageEvent" app/api/analytics/anomalies/detect/route.ts
echo ""

echo "File 7: app/api/v1/predict/route.ts"
grep -n "recordUsageEvent" app/api/v1/predict/route.ts
echo ""

echo "File 8: app/api/evaluation/judge/route.ts"
grep -n "recordUsageEvent" app/api/evaluation/judge/route.ts
echo ""

echo "File 9: app/api/training/execute/[id]/status/route.ts"
grep -n "recordUsageEvent" app/api/training/execute/[id]/status/route.ts
echo ""

echo "File 10: lib/evaluation/scheduler-worker.ts"
grep -n "recordUsageEvent" lib/evaluation/scheduler-worker.ts
echo ""
