#!/bin/bash
# Manual API Endpoint Testing Guide
# Date: 2025-10-17

echo "========================================="
echo "API Endpoint Testing with curl"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

API_BASE="http://localhost:3000/api"

echo -e "${YELLOW}Step 1: Get your authentication token${NC}"
echo ""
echo "Option A: Use Supabase Dashboard"
echo "  1. Go to: https://tkizlemssfmrfluychsn.supabase.co"
echo "  2. Login with your credentials"
echo "  3. Open browser console and run:"
echo "     localStorage.getItem('sb-tkizlemssfmrfluychsn-auth-token')"
echo ""
echo "Option B: Create test user via curl"
echo "  curl -X POST 'https://tkizlemssfmrfluychsn.supabase.co/auth/v1/signup' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -H 'apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}' \\"
echo "    -d '{\"email\":\"test@example.com\",\"password\":\"testpass123\"}'"
echo ""
echo -e "${YELLOW}Paste your access token here (or press Enter to skip):${NC}"
read AUTH_TOKEN

if [ -z "$AUTH_TOKEN" ]; then
  echo -e "${RED}No token provided. Skipping authenticated tests.${NC}"
  echo ""
else
  echo ""
  echo -e "${GREEN}Testing with authentication token...${NC}"
  echo ""
  
  # Test 1: Create API Key
  echo -e "${YELLOW}Test 1: Create API Key${NC}"
  echo "curl -X POST $API_BASE/user/api-keys \\"
  echo "  -H 'Authorization: Bearer $AUTH_TOKEN' \\"
  echo "  -H 'Content-Type: application/json' \\"
  echo "  -d '{\"name\": \"Test Widget Key\"}'"
  echo ""
  
  API_KEY_RESPONSE=$(curl -s -X POST "$API_BASE/user/api-keys" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name": "Test Widget Key"}')
  
  echo "Response:"
  echo "$API_KEY_RESPONSE" | jq '.' 2>/dev/null || echo "$API_KEY_RESPONSE"
  echo ""
  
  # Extract API key from response
  API_KEY=$(echo "$API_KEY_RESPONSE" | jq -r '.apiKey.key' 2>/dev/null)
  KEY_ID=$(echo "$API_KEY_RESPONSE" | jq -r '.apiKey.id' 2>/dev/null)
  
  if [ "$API_KEY" != "null" ] && [ ! -z "$API_KEY" ]; then
    echo -e "${GREEN}✅ API Key created: $API_KEY${NC}"
    echo ""
    
    # Test 2: List API Keys
    echo -e "${YELLOW}Test 2: List API Keys${NC}"
    echo "curl -X GET $API_BASE/user/api-keys \\"
    echo "  -H 'Authorization: Bearer $AUTH_TOKEN'"
    echo ""
    
    LIST_RESPONSE=$(curl -s -X GET "$API_BASE/user/api-keys" \
      -H "Authorization: Bearer $AUTH_TOKEN")
    
    echo "Response:"
    echo "$LIST_RESPONSE" | jq '.' 2>/dev/null || echo "$LIST_RESPONSE"
    echo ""
    
    # Test 3: Submit Feedback with API Key
    echo -e "${YELLOW}Test 3: Submit Feedback${NC}"
    echo "curl -X POST $API_BASE/feedback/collect \\"
    echo "  -H 'X-API-Key: $API_KEY' \\"
    echo "  -H 'Content-Type: application/json' \\"
    echo "  -d '{...feedback data...}'"
    echo ""
    
    FEEDBACK_RESPONSE=$(curl -s -X POST "$API_BASE/feedback/collect" \
      -H "X-API-Key: $API_KEY" \
      -H "Content-Type: application/json" \
      -d "{
        \"message_id\": \"test-msg-$(date +%s)\",
        \"rating\": 5,
        \"thumbs\": \"up\",
        \"comment\": \"Great response! Testing from curl.\",
        \"category_tags\": [\"test\", \"integration\"]
      }")
    
    echo "Response:"
    echo "$FEEDBACK_RESPONSE" | jq '.' 2>/dev/null || echo "$FEEDBACK_RESPONSE"
    echo ""
    
    if echo "$FEEDBACK_RESPONSE" | grep -q '"success":true'; then
      echo -e "${GREEN}✅ Feedback submitted successfully!${NC}"
    else
      echo -e "${RED}❌ Feedback submission failed${NC}"
    fi
    echo ""
    
    # Test 4: Test Invalid API Key
    echo -e "${YELLOW}Test 4: Test Invalid API Key (should fail)${NC}"
    INVALID_RESPONSE=$(curl -s -X POST "$API_BASE/feedback/collect" \
      -H "X-API-Key: wak_invalid_key_12345" \
      -H "Content-Type: application/json" \
      -d "{\"message_id\": \"test\", \"rating\": 5}")
    
    echo "Response:"
    echo "$INVALID_RESPONSE" | jq '.' 2>/dev/null || echo "$INVALID_RESPONSE"
    echo ""
    
    if echo "$INVALID_RESPONSE" | grep -q '"success":false'; then
      echo -e "${GREEN}✅ Invalid key correctly rejected${NC}"
    else
      echo -e "${RED}❌ Invalid key should be rejected${NC}"
    fi
    echo ""
    
    # Test 5: Delete API Key
    if [ "$KEY_ID" != "null" ] && [ ! -z "$KEY_ID" ]; then
      echo -e "${YELLOW}Test 5: Delete API Key${NC}"
      echo "curl -X DELETE $API_BASE/user/api-keys/$KEY_ID \\"
      echo "  -H 'Authorization: Bearer $AUTH_TOKEN'"
      echo ""
      
      DELETE_RESPONSE=$(curl -s -X DELETE "$API_BASE/user/api-keys/$KEY_ID" \
        -H "Authorization: Bearer $AUTH_TOKEN")
      
      echo "Response:"
      echo "$DELETE_RESPONSE" | jq '.' 2>/dev/null || echo "$DELETE_RESPONSE"
      echo ""
      
      # Test 6: Verify revoked key doesn't work
      echo -e "${YELLOW}Test 6: Verify Revoked Key Doesn't Work${NC}"
      REVOKED_RESPONSE=$(curl -s -X POST "$API_BASE/feedback/collect" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"message_id\": \"test\", \"rating\": 5}")
      
      echo "Response:"
      echo "$REVOKED_RESPONSE" | jq '.' 2>/dev/null || echo "$REVOKED_RESPONSE"
      echo ""
      
      if echo "$REVOKED_RESPONSE" | grep -q '"success":false'; then
        echo -e "${GREEN}✅ Revoked key correctly rejected${NC}"
      else
        echo -e "${RED}❌ Revoked key should be rejected${NC}"
      fi
    fi
    
  else
    echo -e "${RED}❌ Failed to create API key${NC}"
  fi
fi

echo ""
echo "========================================="
echo "Testing Complete!"
echo "========================================="
