#!/bin/bash

echo "Testing if new code is running..."
echo ""
echo "Checking API endpoint response..."
echo ""

# Test the API endpoint
curl -s http://localhost:3000/api/billing/usage-history 2>&1 | head -20

echo ""
echo "---"
echo ""
echo "Expected to see: {\"error\":\"Unauthorized - missing authorization header\"}"
echo "If you see this, API route is responding."
echo ""
echo "Now check your terminal where 'npm run dev' is running."
echo "You should see these logs when you refresh the /account page:"
echo ""
echo "  [Usage History API] Found 2 usage records"
echo "  [Usage History API] Commitment tier: starter"
echo "  [Usage History API] Returning 2 months of data"
echo ""
