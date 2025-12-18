#!/usr/bin/env python3
"""
Real-world user scenario: Capture and query production analytics
An ML engineer wants to track production inference metrics and traces
"""

import sys
sys.path.insert(0, '/home/juan-canfield/Desktop/web-ui/python-package')

from finetune_lab import FinetuneLabClient
import time
from datetime import datetime

# User's API key (with 'production' or 'all' scope)
API_KEY = 'wak_J1E8DNQiJsiJdocIkTXOTLxQdBQMFtNJ'  # Has 'all' scope
BASE_URL = 'http://localhost:3000'

print("=" * 70)
print("📈 PRODUCTION ANALYTICS MONITORING")
print("=" * 70)
print(f"\nUsing API: {BASE_URL}\n")

# Initialize the SDK
client = FinetuneLabClient(api_key=API_KEY, base_url=BASE_URL)

# Scenario 1: Create a trace for production inference
print("1️⃣  Logging a production inference trace...")
print("-" * 70)
try:
    trace_id = f"trace_{int(time.time() * 1000)}"
    span_id = f"span_{int(time.time() * 1000)}"

    import datetime as dt
    now = dt.datetime.now(dt.UTC).isoformat()

    trace_data = {
        "trace_id": trace_id,
        "span_id": span_id,
        "span_name": "chat_completion",
        "start_time": now,
        "end_time": now,
        "duration_ms": 1250,
        "operation_type": "llm_call",  # Valid types: llm_call, tool_call, etc.
        "model_name": "gpt-4",
        "model_provider": "openai",
        "input_tokens": 150,
        "output_tokens": 200,
        "status": "completed",  # Valid statuses: completed, failed, pending
        "metadata": {
            "user_message": "Explain fine-tuning",
            "temperature": 0.7,
            "max_tokens": 500
        }
    }

    result = client.analytics.create_trace(trace_data)
    trace_id_created = result.get('data', {}).get('id', result.get('id', 'unknown'))
    print(f"✓ Created trace: {trace_id_created}")
    print(f"   • Model: {trace_data['model_name']}")
    print(f"   • Duration: {trace_data['duration_ms']}ms")
    print(f"   • Tokens: {trace_data['input_tokens']} in, {trace_data['output_tokens']} out")
    print()

except Exception as e:
    print(f"✗ Failed to create trace: {e}\n")

# Scenario 2: Query recent traces
print("\n2️⃣  Querying recent production traces...")
print("-" * 70)
try:
    traces_response = client.analytics.traces(limit=5)
    traces_list = traces_response.get('data', traces_response.get('traces', []))

    print(f"✓ Retrieved {len(traces_list)} recent traces")

    if traces_list:
        print()
        for i, trace in enumerate(traces_list[:3], 1):
            print(f"   Trace {i}:")
            print(f"   • ID: {trace.get('trace_id', 'N/A')}")
            print(f"   • Model: {trace.get('model_name', 'N/A')}")
            print(f"   • Operation: {trace.get('operation_type', 'N/A')}")
            print(f"   • Duration: {trace.get('duration_ms', 'N/A')}ms")
            print(f"   • Status: {trace.get('status', 'N/A')}")
            print(f"   • Created: {trace.get('created_at', 'N/A')}")
            print()
    else:
        print("   No traces found. Create some inference traces first!")
        print()

except Exception as e:
    print(f"✗ Failed to query traces: {e}\n")

# Scenario 3: Get aggregated analytics data
print("\n3️⃣  Fetching aggregated analytics metrics...")
print("-" * 70)
try:
    # Get analytics for the last 7 days
    from datetime import timedelta
    end_date = dt.datetime.now(dt.UTC)
    start_date = end_date - timedelta(days=7)

    analytics = client.analytics.data(
        start_date=start_date.strftime('%Y-%m-%d'),
        end_date=end_date.strftime('%Y-%m-%d'),
        granularity='day'
    )

    print(f"✓ Retrieved analytics data")

    if analytics.get('timeseries'):
        print(f"   • Data points: {len(analytics['timeseries'])}")
        print()

        # Show summary stats
        if analytics.get('summary'):
            summary = analytics['summary']
            print("   Summary Statistics:")
            print(f"   • Total traces: {summary.get('total_traces', 0)}")
            print(f"   • Average duration: {summary.get('avg_duration_ms', 0):.0f}ms")
            print(f"   • Total tokens: {summary.get('total_tokens', 0)}")
            print(f"   • Error rate: {summary.get('error_rate', 0):.2%}")
            print()

        # Show recent data points
        print("   Recent activity:")
        for point in analytics['timeseries'][:3]:
            print(f"   • {point.get('timestamp', 'N/A')}: {point.get('count', 0)} traces")

    else:
        print("   No analytics data available yet.")
        print("   Create some traces first to see aggregated metrics!")
    print()

except Exception as e:
    print(f"✗ Failed to fetch analytics: {e}\n")

# Scenario 4: Filter traces by conversation
print("\n4️⃣  Demonstrating trace filtering...")
print("-" * 70)
try:
    # Query with pagination
    page1_response = client.analytics.traces(limit=10, offset=0)
    page1_list = page1_response.get('data', page1_response.get('traces', []))

    print(f"✓ Pagination working:")
    print(f"   • Retrieved {len(page1_list)} traces (limit: 10)")
    print(f"   • Use offset parameter to fetch more")
    print()

    # Example of filtering by specific trace
    if page1_list:
        sample_trace_id = page1_list[0].get('trace_id')
        if sample_trace_id:
            filtered_response = client.analytics.traces(trace_id=sample_trace_id)
            filtered_list = filtered_response.get('data', filtered_response.get('traces', []))
            print(f"✓ Filtered by trace_id:")
            print(f"   • Found {len(filtered_list)} matching trace(s)")
            print()

except Exception as e:
    print(f"✗ Failed to filter traces: {e}\n")

print("=" * 70)
print("✅ Analytics monitoring complete!")
print("=" * 70)
print("\n💡 Use cases demonstrated:")
print("   • Log production inference traces")
print("   • Query and filter traces")
print("   • View aggregated analytics metrics")
print("   • Pagination and filtering")
print()
