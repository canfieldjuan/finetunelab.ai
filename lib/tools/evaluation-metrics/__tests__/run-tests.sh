#!/bin/bash
# Test Runner for Evaluation Metrics Tool
# Runs all unit and integration tests

echo "========================================"
echo "Evaluation Metrics - Test Suite"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track test results
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
  local test_name=$1
  local test_file=$2
  
  echo -e "${YELLOW}Running: ${test_name}${NC}"
  echo "----------------------------------------"
  
  if npx tsx "$test_file"; then
    echo -e "${GREEN}✓ ${test_name} PASSED${NC}"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗ ${test_name} FAILED${NC}"
    ((TESTS_FAILED++))
  fi
  
  echo ""
}

# Run all unit tests
echo "=== Unit Tests ==="
echo ""

run_test "Advanced Sentiment Analysis" \
  "lib/tools/evaluation-metrics/__tests__/advancedSentimentAnalysis.test.ts"

run_test "Predictive Quality Modeling" \
  "lib/tools/evaluation-metrics/__tests__/predictiveQualityModeling.test.ts"

run_test "Anomaly Detection" \
  "lib/tools/evaluation-metrics/__tests__/anomalyDetection.test.ts"

# Run integration tests
echo "=== Integration Tests ==="
echo ""

run_test "E2E Integration" \
  "lib/tools/evaluation-metrics/__tests__/e2e.integration.test.ts"

# Print summary
echo "========================================"
echo "Test Summary"
echo "========================================"
echo -e "Tests Passed: ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Tests Failed: ${RED}${TESTS_FAILED}${NC}"
echo "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed!${NC}"
  exit 1
fi
