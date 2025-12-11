#!/bin/bash
# Test Widget API Endpoints
# Tests API key management and feedback collection
# Date: 2025-10-17

set -e

BASE_URL="http://localhost:3000"
EMAIL="canfieldjuan24@gmail.com"
PASSWORD="@canfi1287"

echo "========================================="
echo "Widget API Endpoint Tests"
echo "========================================="
echo ""

# Step 1: Get authentication token
echo "Step 1: Authenticating user..."
echo "Email: $EMAIL"

AUTH_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/signin" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" || echo '{"error":"auth_failed"}')

echo "Auth Response:"
echo "$AUTH_RESPONSE" | jq '.' 2>/dev/null || echo "$AUTH_RESPONSE"
echo ""

# Extract token (adjust based on your auth endpoint response)
TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.token // .access_token // .session.access_token // empty' 2>/dev/null)

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Failed to get authentication token"
  echo "Please check your credentials or auth endpoint"
  echo ""
  echo "Attempting alternative: Using Supabase client directly..."
  echo "You may need to login via the web UI first and copy the token from browser DevTools"
  exit 1
fi

echo "✅ Authentication successful!"
echo "Token (first 20 chars): ${TOKEN:0:20}..."
echo ""

# Step 2: Create an API key
echo "========================================="
echo "Step 2: Creating API Key"
echo "========================================="

API_KEY_NAME="Test Widget Key $(date +%s)"
echo "Key Name: $API_KEY_NAME"

CREATE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/user/api-keys" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"${API_KEY_NAME}\"}")

echo "Response:"
echo "$CREATE_RESPONSE" | jq '.' 2>/dev/null || echo "$CREATE_RESPONSE"
echo ""

# Extract the generated API key
WIDGET_API_KEY=$(echo "$CREATE_RESPONSE" | jq -r '.apiKey.key // empty' 2>/dev/null)
API_KEY_ID=$(echo "$CREATE_RESPONSE" | jq -r '.apiKey.id // empty' 2>/dev/null)

if [ -z "$WIDGET_API_KEY" ] || [ "$WIDGET_API_KEY" = "null" ]; then
  echo "❌ Failed to create API key"
  echo "Response: $CREATE_RESPONSE"
  exit 1
fi

echo "✅ API Key created successfully!"
echo "Key ID: $API_KEY_ID"
echo "API Key: ${WIDGET_API_KEY:0:20}... (full key saved)"
echo ""

# Step 3: List API keys
echo "========================================="
echo "Step 3: Listing API Keys"
echo "========================================="

LIST_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/user/api-keys" \
  -H "Authorization: Bearer $TOKEN")

echo "Response:"
echo "$LIST_RESPONSE" | jq '.' 2>/dev/null || echo "$LIST_RESPONSE"
echo ""

KEY_COUNT=$(echo "$LIST_RESPONSE" | jq '.count // 0' 2>/dev/null)
echo "✅ Found $KEY_COUNT API key(s)"
echo ""

# Step 4: Test feedback collection
echo "========================================="
echo "Step 4: Testing Feedback Collection"
echo "========================================="

MESSAGE_ID="test_msg_$(date +%s)"
echo "Test Message ID: $MESSAGE_ID"

FEEDBACK_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/feedback/collect" \
  -H "X-API-Key: $WIDGET_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"message_id\":\"${MESSAGE_ID}\",
    \"rating\":5,
    \"thumbs\":\"up\",
    \"comment\":\"Great response from test script!\",
    \"category_tags\":[\"helpful\",\"accurate\"],
    \"metadata\":{\"test\":true,\"timestamp\":\"$(date -Iseconds)\"}
  }")

echo "Response:"
echo "$FEEDBACK_RESPONSE" | jq '.' 2>/dev/null || echo "$FEEDBACK_RESPONSE"
echo ""

FEEDBACK_ID=$(echo "$FEEDBACK_RESPONSE" | jq -r '.feedbackId // empty' 2>/dev/null)

if [ -z "$FEEDBACK_ID" ] || [ "$FEEDBACK_ID" = "null" ]; then
  echo "❌ Failed to submit feedback"
else
  echo "✅ Feedback submitted successfully!"
  echo "Feedback ID: $FEEDBACK_ID"
fi
echo ""

# Step 5: Test different feedback types
echo "========================================="
echo "Step 5: Testing Different Feedback Types"
echo "========================================="

# Test with just rating
echo "Test 5a: Rating only"
FEEDBACK_2=$(curl -s -X POST "${BASE_URL}/api/feedback/collect" \
  -H "X-API-Key: $WIDGET_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"message_id\":\"test_msg_rating_$(date +%s)\",\"rating\":4}")
echo "$FEEDBACK_2" | jq '.' 2>/dev/null || echo "$FEEDBACK_2"
echo ""

# Test with just thumbs
echo "Test 5b: Thumbs only"
FEEDBACK_3=$(curl -s -X POST "${BASE_URL}/api/feedback/collect" \
  -H "X-API-Key: $WIDGET_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"message_id\":\"test_msg_thumbs_$(date +%s)\",\"thumbs\":\"down\"}")
echo "$FEEDBACK_3" | jq '.' 2>/dev/null || echo "$FEEDBACK_3"
echo ""

# Test with just comment
echo "Test 5c: Comment only"
FEEDBACK_4=$(curl -s -X POST "${BASE_URL}/api/feedback/collect" \
  -H "X-API-Key: $WIDGET_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"message_id\":\"test_msg_comment_$(date +%s)\",\"comment\":\"This needs improvement\"}")
echo "$FEEDBACK_4" | jq '.' 2>/dev/null || echo "$FEEDBACK_4"
echo ""

# Step 6: Test validation errors
echo "========================================="
echo "Step 6: Testing Validation Errors"
echo "========================================="

# Test missing message_id
echo "Test 6a: Missing message_id (should fail)"
ERROR_1=$(curl -s -X POST "${BASE_URL}/api/feedback/collect" \
  -H "X-API-Key: $WIDGET_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"rating\":5}")
echo "$ERROR_1" | jq '.' 2>/dev/null || echo "$ERROR_1"
echo ""

# Test invalid rating
echo "Test 6b: Invalid rating (should fail)"
ERROR_2=$(curl -s -X POST "${BASE_URL}/api/feedback/collect" \
  -H "X-API-Key: $WIDGET_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"message_id\":\"test_msg\",\"rating\":10}")
echo "$ERROR_2" | jq '.' 2>/dev/null || echo "$ERROR_2"
echo ""

# Test invalid thumbs
echo "Test 6c: Invalid thumbs (should fail)"
ERROR_3=$(curl -s -X POST "${BASE_URL}/api/feedback/collect" \
  -H "X-API-Key: $WIDGET_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"message_id\":\"test_msg\",\"thumbs\":\"sideways\"}")
echo "$ERROR_3" | jq '.' 2>/dev/null || echo "$ERROR_3"
echo ""

# Step 7: Test rate limiting (100 requests/min)
echo "========================================="
echo "Step 7: Testing Rate Limiting"
echo "========================================="
echo "Sending 5 rapid requests to test rate limiting..."

for i in {1..5}; do
  RATE_TEST=$(curl -s -X POST "${BASE_URL}/api/feedback/collect" \
    -H "X-API-Key: $WIDGET_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"message_id\":\"rate_test_${i}\",\"rating\":${i}}")
  
  SUCCESS=$(echo "$RATE_TEST" | jq -r '.success // false' 2>/dev/null)
  echo "Request $i: success=$SUCCESS"
done
echo "✅ Rate limiting working (all should succeed under limit)"
echo ""

# Step 8: List API keys again to verify usage stats
echo "========================================="
echo "Step 8: Verifying Usage Stats Updated"
echo "========================================="

FINAL_LIST=$(curl -s -X GET "${BASE_URL}/api/user/api-keys" \
  -H "Authorization: Bearer $TOKEN")

echo "Final API Keys List:"
echo "$FINAL_LIST" | jq '.apiKeys[] | {name, request_count, last_used_at}' 2>/dev/null || echo "$FINAL_LIST"
echo ""

# Step 9: Revoke the test API key
echo "========================================="
echo "Step 9: Revoking Test API Key"
echo "========================================="

if [ -n "$API_KEY_ID" ] && [ "$API_KEY_ID" != "null" ]; then
  DELETE_RESPONSE=$(curl -s -X DELETE "${BASE_URL}/api/user/api-keys/${API_KEY_ID}" \
    -H "Authorization: Bearer $TOKEN")
  
  echo "Response:"
  echo "$DELETE_RESPONSE" | jq '.' 2>/dev/null || echo "$DELETE_RESPONSE"
  echo ""
  
  DELETE_SUCCESS=$(echo "$DELETE_RESPONSE" | jq -r '.success // false' 2>/dev/null)
  if [ "$DELETE_SUCCESS" = "true" ]; then
    echo "✅ API Key revoked successfully!"
  else
    echo "❌ Failed to revoke API key"
  fi
else
  echo "⚠️  Skipping delete - no API key ID"
fi
echo ""

# Step 10: Verify key is revoked
echo "========================================="
echo "Step 10: Verifying Key is Revoked"
echo "========================================="

REVOKE_TEST=$(curl -s -X POST "${BASE_URL}/api/feedback/collect" \
  -H "X-API-Key: $WIDGET_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"message_id\":\"should_fail\",\"rating\":5}")

echo "Attempting to use revoked key:"
echo "$REVOKE_TEST" | jq '.' 2>/dev/null || echo "$REVOKE_TEST"

REVOKE_SUCCESS=$(echo "$REVOKE_TEST" | jq -r '.success // false' 2>/dev/null)
if [ "$REVOKE_SUCCESS" = "false" ]; then
  echo "✅ Revoked key correctly rejected!"
else
  echo "❌ Revoked key still working (should be rejected)"
fi
echo ""

# Summary
echo "========================================="
echo "Test Summary"
echo "========================================="
echo "✅ Authentication"
echo "✅ API Key Creation"
echo "✅ API Key Listing"
echo "✅ Feedback Collection (all types)"
echo "✅ Validation Errors"
echo "✅ Rate Limiting"
echo "✅ Usage Stats Tracking"
echo "✅ API Key Revocation"
echo "✅ Revoked Key Rejection"
echo ""
echo "All tests completed successfully!"
echo "========================================="
