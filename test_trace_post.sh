
#!/bin/bash
source .env.local

echo "Testing POST to /api/analytics/traces..."
echo "Using Service Key: ${SUPABASE_SERVICE_ROLE_KEY:0:10}..."

curl -X POST http://localhost:3000/api/analytics/traces \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{
    "trace_id": "test_trace_'$(date +%s)'",
    "span_id": "test_span_'$(date +%s)'",
    "span_name": "test_span",
    "operation_type": "test",
    "user_id": "38c85707-1fc5-40c6-84be-c017b3b8e750",
    "start_time": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
    "status": "completed",
    "input_tokens": 10,
    "output_tokens": 20
  }' -v
