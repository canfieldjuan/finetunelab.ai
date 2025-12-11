#!/bin/bash
# Lambda Labs API Test Script
# Tests the backend Lambda deployment API without UI

set -e

echo "==================================================================="
echo "Lambda Labs Backend API Test"
echo "==================================================================="
echo ""

# Check if jq is installed for JSON formatting
if ! command -v jq &> /dev/null; then
    echo "⚠️  Warning: 'jq' not found. Install for prettier JSON output: sudo apt install jq"
    echo ""
fi

# Configuration
API_URL="http://localhost:3000/api/training/deploy/lambda"
AUTH_TOKEN="${SUPABASE_AUTH_TOKEN}"

if [ -z "$AUTH_TOKEN" ]; then
    echo "❌ Error: SUPABASE_AUTH_TOKEN not set"
    echo ""
    echo "Get your token from .env.local and run:"
    echo "export SUPABASE_AUTH_TOKEN='your-token-here'"
    exit 1
fi

echo "Configuration:"
echo "  API URL: $API_URL"
echo "  Auth Token: ${AUTH_TOKEN:0:50}..."
echo ""

# You need to replace these values with real ones
TRAINING_CONFIG_ID="<your-training-config-id>"  # Get from your training_configs table
INSTANCE_TYPE="gpu_1x_a10"                       # Cheapest option for testing
REGION="us-west-1"                               # Closest to you
BUDGET_LIMIT="5.00"                              # Low budget for testing

echo "==================================================================="
echo "Test 1: Deploy to Lambda Labs"
echo "==================================================================="
echo ""
echo "Request:"
echo "  Training Config ID: $TRAINING_CONFIG_ID"
echo "  Instance Type: $INSTANCE_TYPE ($0.60/hr)"
echo "  Region: $REGION"
echo "  Budget Limit: \$$BUDGET_LIMIT"
echo ""

if [ "$TRAINING_CONFIG_ID" = "<your-training-config-id>" ]; then
    echo "❌ Error: Please update TRAINING_CONFIG_ID in this script"
    echo ""
    echo "To get a training config ID:"
    echo "1. Go to your web UI"
    echo "2. Create a training config"
    echo "3. Check the training_configs table in Supabase"
    echo "4. Copy the 'id' column value"
    exit 1
fi

echo "Sending POST request..."
echo ""

RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d "{
    \"training_config_id\": \"$TRAINING_CONFIG_ID\",
    \"instance_type\": \"$INSTANCE_TYPE\",
    \"region\": \"$REGION\",
    \"budget_limit\": $BUDGET_LIMIT
  }")

if command -v jq &> /dev/null; then
    echo "Response:"
    echo "$RESPONSE" | jq '.'
else
    echo "Response:"
    echo "$RESPONSE"
fi

echo ""

# Extract deployment_id if successful
DEPLOYMENT_ID=$(echo "$RESPONSE" | grep -o '"deployment_id":"[^"]*"' | cut -d'"' -f4)

if [ -n "$DEPLOYMENT_ID" ]; then
    echo "✅ Deployment created successfully!"
    echo "   Deployment ID: $DEPLOYMENT_ID"
    echo ""

    echo "==================================================================="
    echo "Test 2: Check Deployment Status"
    echo "==================================================================="
    echo ""

    sleep 5  # Wait a bit for instance to start

    echo "Sending GET request..."
    STATUS_RESPONSE=$(curl -s -X GET "$API_URL?deployment_id=$DEPLOYMENT_ID" \
      -H "Authorization: Bearer $AUTH_TOKEN")

    if command -v jq &> /dev/null; then
        echo "Status Response:"
        echo "$STATUS_RESPONSE" | jq '.'
    else
        echo "Status Response:"
        echo "$STATUS_RESPONSE"
    fi

    echo ""
    echo "==================================================================="
    echo "Test 3: Terminate Deployment (CLEANUP)"
    echo "==================================================================="
    echo ""
    echo "⚠️  This will terminate the Lambda instance to avoid charges"
    echo ""
    read -p "Terminate instance? (y/N): " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Sending DELETE request..."
        DELETE_RESPONSE=$(curl -s -X DELETE "$API_URL?deployment_id=$DEPLOYMENT_ID" \
          -H "Authorization: Bearer $AUTH_TOKEN")

        if command -v jq &> /dev/null; then
            echo "Delete Response:"
            echo "$DELETE_RESPONSE" | jq '.'
        else
            echo "Delete Response:"
            echo "$DELETE_RESPONSE"
        fi

        echo ""
        echo "✅ Instance terminated"
    else
        echo "⚠️  Instance NOT terminated - remember to stop it manually!"
        echo "   Go to: https://cloud.lambdalabs.com/instances"
    fi
else
    echo "❌ Deployment failed. Check the error above."
    echo ""
    echo "Common issues:"
    echo "  1. Lambda API key not in secrets vault (provider='lambda')"
    echo "  2. SSH key not registered at https://cloud.lambdalabs.com/ssh-keys"
    echo "  3. Training config not found"
    echo "  4. Invalid auth token"
fi

echo ""
echo "==================================================================="
echo "Test Complete"
echo "==================================================================="
