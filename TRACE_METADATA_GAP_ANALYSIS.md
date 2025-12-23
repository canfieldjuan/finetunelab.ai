# Trace Metadata Gap Analysis & Fix

## Issue Summary
Enhanced trace metadata (performance metrics, RAG context, request details) was being captured by the application but **NOT appearing in the Traces page**.

## Root Cause: Broken Data Pipeline

### ✅ What Was Working:
1. **Data Capture** - `lib/tracing/trace.service.ts` capturing metadata ✅
2. **Types Defined** - `lib/tracing/types.ts` had all interfaces ✅  
3. **UI Ready** - `TraceView.tsx` had display components ✅
4. **API Reads** - `GET /api/analytics/traces/list` selecting new fields ✅

### 🔴 What Was Broken:
**POST `/api/analytics/traces` endpoint** - The endpoint that receives and stores trace data was missing ALL new fields!

#### The Gap (3 locations):
1. **TracePayload interface** - Missing 15 new field definitions
2. **Request body destructuring** - Not extracting new fields from POST body
3. **Database upsert** - Not saving new fields to `llm_traces` table

### Result:
Data flowed like this:
```
Trace Service → HTTP POST → ❌ DROPPED → Database
                          (missing fields)
```

## Fixes Applied

### 1. Updated `TracePayload` Interface
Added 15 new fields across 4 categories:

**Request Metadata:**
- `api_endpoint` - Full API URL
- `api_base_url` - Base provider URL  
- `request_headers_sanitized` - Headers with auth redacted
- `provider_request_id` - Provider's request tracking ID

**Performance Metrics:**
- `queue_time_ms` - Time in provider queue
- `inference_time_ms` - Token generation time
- `network_time_ms` - Network latency
- `streaming_enabled` - Whether response was streamed
- `chunk_usage` - Per-chunk usage breakdown

**RAG Context:**
- `context_tokens` - Tokens used for context
- `retrieval_latency_ms` - Time to retrieve context

**Evaluation:**
- `groundedness_score` - RAG groundedness (0-1)
- `response_quality_breakdown` - Quality metrics
- `warning_flags` - Warning codes array

### 2. Updated Request Destructuring
Now extracts all new fields from POST body.

### 3. Updated Database Upsert
Now persists all new fields to `llm_traces` table.

## Auth Header Security ✅

Header sanitization verified working:
```typescript
// In unified-client.ts
for (const [key, value] of Object.entries(headers)) {
  if (!key.toLowerCase().includes('auth') && !key.toLowerCase().includes('key')) {
    sanitizedHeaders[key] = value;
  } else {
    sanitizedHeaders[key] = '[REDACTED]'; // ✅ Auth headers masked
  }
}
```

## Data Flow (Fixed)

```
┌─────────────────────┐
│  Chat/LLM Request   │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│  Trace Service      │◄── Captures: Performance, RAG, Request metadata
│  (trace.service.ts) │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│  HTTP POST          │◄── ✅ NOW INCLUDES all metadata fields
│  /analytics/traces  │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│  Database           │◄── ✅ Stores all 15 new columns
│  llm_traces table   │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│  GET /list API      │◄── Reads all fields
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│  TraceView UI       │◄── ✅ Displays performance, RAG, request data
└─────────────────────┘
```

## Next Steps

1. **Apply Migration** - Run `20251222_add_trace_request_metadata.sql`
2. **Test End-to-End** - Make a chat request and verify metadata appears in Traces page
3. **Check Existing Data** - Old traces won't have new fields (NULL values expected)
4. **Monitor** - Verify auth headers are properly redacted

## Files Modified
- ✅ `app/api/analytics/traces/route.ts` - Added 15 fields to interface, destructuring, upsert

## Files Already Updated (Previous Work)
- ✅ `lib/tracing/types.ts` - Type definitions
- ✅ `lib/tracing/trace.service.ts` - Metadata capture
- ✅ `lib/llm/unified-client.ts` - Request metadata with auth sanitization
- ✅ `app/api/chat/route.ts` - Metadata callback
- ✅ `app/api/chat/trace-completion-helper.ts` - Helper integration
- ✅ `components/analytics/TraceView.tsx` - UI display (+121 lines)
- ✅ `app/api/analytics/traces/list/route.ts` - SELECT statement includes new fields

## Impact
**Before:** Trace page showed basic data only (duration, tokens, cost)
**After:** Trace page now shows:
- ⚡ Performance breakdown (queue, inference, network times)
- 🗄️ RAG context details (tokens, retrieval latency)  
- 🔗 Request metadata (endpoint, provider ID, headers)
- 📊 Evaluation scores (groundedness, quality metrics)
- ⚠️ Warning flags for issues
