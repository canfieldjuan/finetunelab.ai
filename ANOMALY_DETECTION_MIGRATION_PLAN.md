# Anomaly Detection Migration Plan
## From `messages` to `llm_traces`

**Created:** 2025-12-24
**Status:** Ready for Implementation
**Impact:** High - Enables trace-level anomaly detection with 50+ metrics

---

## Executive Summary

**Current State:**
- Anomaly detection analyzes `messages` table (2 metrics: latency, tokens)
- Missing 48+ trace-specific fields (RAG, cache, TTFT, queue time, etc.)
- No detection of RAG performance issues, cache anomalies, or provider-specific problems

**Target State:**
- Anomaly detection analyzes `llm_traces` table (50+ metrics)
- Detects RAG retrieval latency spikes, cache miss anomalies, TTFT outliers
- Provider-specific error detection and queue time anomalies
- Hierarchical trace analysis (parent/child span anomalies)

**Effort:** 2-3 hours implementation + 1 hour testing

---

## Field Mapping: messages → llm_traces

### Current Fields Used (messages)
| Field | Type | Used For |
|-------|------|----------|
| `created_at` | timestamp | Temporal analysis |
| `latency_ms` | numeric | Latency anomaly detection |
| `input_tokens` | integer | Token usage anomalies |
| `output_tokens` | integer | Token usage anomalies |

### New Fields Available (llm_traces)

#### Timing & Performance (12 fields)
| Field | Type | Anomaly Detection Use Case |
|-------|------|----------------------------|
| `duration_ms` | numeric | Overall latency (replaces `latency_ms`) |
| `ttft_ms` | numeric | **NEW**: First token delay spikes |
| `tokens_per_second` | numeric | **NEW**: Throughput degradation |
| `queue_time_ms` | integer | **NEW**: Provider queue delays |
| `inference_time_ms` | integer | **NEW**: Model inference slowdowns |
| `network_time_ms` | integer | **NEW**: Network latency spikes |
| `start_time` | timestamptz | Temporal analysis (replaces `created_at`) |
| `end_time` | timestamptz | Duration verification |
| `streaming_enabled` | boolean | Streaming vs non-streaming comparison |
| `chunk_usage` | jsonb | **NEW**: Per-chunk performance analysis |
| `retry_count` | integer | **NEW**: Excessive retry detection |
| `retry_reason` | text | **NEW**: Retry pattern analysis |

#### RAG & Context (10 fields)
| Field | Type | Anomaly Detection Use Case |
|-------|------|----------------------------|
| `context_tokens` | integer | **NEW**: Context bloat detection |
| `retrieval_latency_ms` | integer | **NEW**: RAG retrieval slowdowns |
| `rag_graph_used` | boolean | **NEW**: Graph vs vector comparison |
| `rag_nodes_retrieved` | integer | **NEW**: Over-retrieval detection |
| `rag_chunks_used` | integer | **NEW**: Chunking inefficiency |
| `rag_relevance_score` | numeric | **NEW**: Low relevance alerts |
| `rag_answer_grounded` | boolean | **NEW**: Hallucination detection |
| `rag_retrieval_method` | text | **NEW**: Method comparison |
| `groundedness_score` | numeric | **NEW**: Quality degradation |
| `response_quality_breakdown` | jsonb | **NEW**: Multi-dimensional quality |

#### Tokens & Cost (8 fields)
| Field | Type | Anomaly Detection Use Case |
|-------|------|----------------------------|
| `input_tokens` | integer | Input token spikes |
| `output_tokens` | integer | Output token bloat |
| `total_tokens` | integer | Total usage anomalies |
| `cache_creation_input_tokens` | integer | **NEW**: Cache creation spikes |
| `cache_read_input_tokens` | integer | **NEW**: Cache miss detection |
| `cost_usd` | numeric(10,6) | **NEW**: Cost anomalies |
| `model_name` | text | **NEW**: Per-model anomalies |
| `model_provider` | text | **NEW**: Per-provider issues |

#### Errors & Quality (7 fields)
| Field | Type | Anomaly Detection Use Case |
|-------|------|----------------------------|
| `status` | text | Error rate calculation |
| `error_message` | text | Error pattern analysis |
| `error_type` | text | Error categorization |
| `error_category` | text | **NEW**: Systematic error detection |
| `warning_flags` | text[] | **NEW**: Warning pattern analysis |
| `operation_type` | text | **NEW**: Per-operation anomalies |
| `span_name` | text | **NEW**: Span-level analysis |

#### Metadata & Context (8 fields)
| Field | Type | Anomaly Detection Use Case |
|-------|------|----------------------------|
| `conversation_id` | uuid | Per-conversation analysis |
| `message_id` | uuid | Message correlation |
| `trace_id` | text | **NEW**: Multi-span trace analysis |
| `parent_trace_id` | text | **NEW**: Hierarchical anomalies |
| `span_id` | text | **NEW**: Span-level tracking |
| `session_tag` | text | **NEW**: Session-based detection |
| `metadata` | jsonb | **NEW**: Custom metadata analysis |
| `reasoning` | text | **NEW**: Extended thinking analysis |

**Total New Metrics:** 48 additional fields for anomaly detection

---

## Files to Modify

### 1. `/app/api/analytics/anomalies/detect/route.ts` (104 lines)
**Purpose:** Main anomaly detection API endpoint
**Changes:**
- Replace `messages` query with `llm_traces` query
- Add 8 new anomaly detection types
- Expand from 2 metrics to 10+ metrics

### 2. `/lib/services/anomaly-detection.service.ts` (224 lines)
**Purpose:** Core anomaly detection algorithms
**Changes:**
- Add new anomaly detection functions for trace-specific metrics
- No changes to core statistical algorithms (reusable)

### 3. `/components/analytics/AnomalyFeed.tsx` (Partial update)
**Purpose:** Display anomaly feed UI
**Changes:**
- Update anomaly type labels for new trace anomalies
- Add trace-specific contributing factors

---

## Detailed Code Changes

### File 1: `/app/api/analytics/anomalies/detect/route.ts`

#### **Lines 28-37: Replace messages query with llm_traces query**

**CURRENT CODE:**
```typescript
// Lines 28-37
// 1. Latency Analysis
const { data: messages, error: msgError } = await supabase
  .from('messages')
  .select('created_at, latency_ms, input_tokens, output_tokens')
  .eq('user_id', user.id)
  .gte('created_at', oneDayAgo)
  .not('latency_ms', 'is', null)
  .order('created_at', { ascending: true });

if (msgError) throw msgError;
```

**NEW CODE:**
```typescript
// Lines 28-44 (REPLACE)
// Fetch trace data for the last 24 hours
const { data: traces, error: traceError } = await supabase
  .from('llm_traces')
  .select(`
    id,
    span_id,
    trace_id,
    start_time,
    duration_ms,
    ttft_ms,
    tokens_per_second,
    input_tokens,
    output_tokens,
    total_tokens,
    cache_read_input_tokens,
    cost_usd,
    retrieval_latency_ms,
    rag_relevance_score,
    context_tokens,
    queue_time_ms,
    inference_time_ms,
    status,
    error_category,
    operation_type,
    model_name,
    model_provider
  `)
  .eq('user_id', user.id)
  .gte('start_time', oneDayAgo)
  .not('duration_ms', 'is', null)
  .order('start_time', { ascending: true });

if (traceError) throw traceError;
```

#### **Lines 39-52: Replace with 10 new anomaly detection types**

**CURRENT CODE:**
```typescript
// Lines 39-52
const latencyPoints = (messages || []).map(m => ({
  timestamp: m.created_at,
  value: m.latency_ms || 0
}));

const latencyAnomalies = await detectAnomalies(latencyPoints, 'latency_ms', { zScoreThreshold: 3 });

// 2. Token Usage Analysis
const tokenPoints = (messages || []).map(m => ({
  timestamp: m.created_at,
  value: (m.input_tokens || 0) + (m.output_tokens || 0)
}));

const tokenAnomalies = await detectAnomalies(tokenPoints, 'total_tokens', { zScoreThreshold: 3 });
```

**NEW CODE:**
```typescript
// Lines 46-177 (REPLACE)
// 1. Duration Analysis (replaces latency_ms)
const durationPoints = (traces || [])
  .filter(t => t.duration_ms)
  .map(t => ({
    timestamp: t.start_time,
    value: t.duration_ms || 0,
    metadata: { trace_id: t.trace_id, span_id: t.span_id, operation_type: t.operation_type }
  }));

const durationAnomalies = await detectAnomalies(
  durationPoints,
  'duration_ms',
  { zScoreThreshold: 3 }
);

// 2. TTFT Analysis (NEW - streaming first token delay)
const ttftPoints = (traces || [])
  .filter(t => t.ttft_ms)
  .map(t => ({
    timestamp: t.start_time,
    value: t.ttft_ms || 0,
    metadata: { trace_id: t.trace_id, model_name: t.model_name }
  }));

const ttftAnomalies = await detectAnomalies(
  ttftPoints,
  'ttft_ms',
  { zScoreThreshold: 3 }
);

// 3. Throughput Analysis (NEW - tokens/second degradation)
const throughputPoints = (traces || [])
  .filter(t => t.tokens_per_second)
  .map(t => ({
    timestamp: t.start_time,
    value: t.tokens_per_second || 0,
    metadata: { trace_id: t.trace_id, model_name: t.model_name }
  }));

const throughputAnomalies = await detectAnomalies(
  throughputPoints,
  'tokens_per_second',
  { zScoreThreshold: 3 }
);

// 4. Token Usage Analysis (enhanced with cache awareness)
const tokenPoints = (traces || []).map(t => ({
  timestamp: t.start_time,
  value: (t.input_tokens || 0) + (t.output_tokens || 0),
  metadata: {
    trace_id: t.trace_id,
    cache_read: t.cache_read_input_tokens || 0,
    model_name: t.model_name
  }
}));

const tokenAnomalies = await detectAnomalies(
  tokenPoints,
  'total_tokens',
  { zScoreThreshold: 3 }
);

// 5. Cache Miss Analysis (NEW - cache_read_input_tokens drops)
const cachePoints = (traces || [])
  .filter(t => t.cache_read_input_tokens !== null && t.cache_read_input_tokens !== undefined)
  .map(t => ({
    timestamp: t.start_time,
    value: t.cache_read_input_tokens || 0,
    metadata: { trace_id: t.trace_id, model_name: t.model_name }
  }));

const cacheMissAnomalies = await detectAnomalies(
  cachePoints,
  'cache_hit_rate',
  { zScoreThreshold: 2 }
);

// 6. Cost Analysis (NEW - cost spikes)
const costPoints = (traces || [])
  .filter(t => t.cost_usd)
  .map(t => ({
    timestamp: t.start_time,
    value: t.cost_usd || 0,
    metadata: { trace_id: t.trace_id, model_name: t.model_name }
  }));

const costAnomalies = await detectAnomalies(
  costPoints,
  'cost_usd',
  { zScoreThreshold: 3 }
);

// 7. RAG Retrieval Latency Analysis (NEW)
const ragLatencyPoints = (traces || [])
  .filter(t => t.retrieval_latency_ms)
  .map(t => ({
    timestamp: t.start_time,
    value: t.retrieval_latency_ms || 0,
    metadata: { trace_id: t.trace_id, rag_relevance: t.rag_relevance_score }
  }));

const ragLatencyAnomalies = await detectAnomalies(
  ragLatencyPoints,
  'retrieval_latency_ms',
  { zScoreThreshold: 3 }
);

// 8. RAG Relevance Score Analysis (NEW - low relevance detection)
const relevancePoints = (traces || [])
  .filter(t => t.rag_relevance_score !== null && t.rag_relevance_score !== undefined)
  .map(t => ({
    timestamp: t.start_time,
    value: t.rag_relevance_score || 0,
    metadata: { trace_id: t.trace_id }
  }));

const lowRelevanceAnomalies = await detectAnomalies(
  relevancePoints,
  'rag_relevance_score',
  { zScoreThreshold: 2 }
);

// 9. Context Token Bloat Analysis (NEW)
const contextPoints = (traces || [])
  .filter(t => t.context_tokens)
  .map(t => ({
    timestamp: t.start_time,
    value: t.context_tokens || 0,
    metadata: { trace_id: t.trace_id }
  }));

const contextBloatAnomalies = await detectAnomalies(
  contextPoints,
  'context_tokens',
  { zScoreThreshold: 3 }
);

// 10. Provider Queue Time Analysis (NEW)
const queueTimePoints = (traces || [])
  .filter(t => t.queue_time_ms)
  .map(t => ({
    timestamp: t.start_time,
    value: t.queue_time_ms || 0,
    metadata: { trace_id: t.trace_id, model_provider: t.model_provider }
  }));

const queueTimeAnomalies = await detectAnomalies(
  queueTimePoints,
  'queue_time_ms',
  { zScoreThreshold: 3 }
);
```

#### **Lines 54-56: Merge all anomaly types**

**CURRENT CODE:**
```typescript
// Lines 54-56
// Save anomalies
const allAnomalies = [...latencyAnomalies, ...tokenAnomalies];
const savedAnomalies = [];
```

**NEW CODE:**
```typescript
// Lines 179-191 (REPLACE)
// Merge all anomalies
const allAnomalies = [
  ...durationAnomalies,
  ...ttftAnomalies,
  ...throughputAnomalies,
  ...tokenAnomalies,
  ...cacheMissAnomalies,
  ...costAnomalies,
  ...ragLatencyAnomalies,
  ...lowRelevanceAnomalies,
  ...contextBloatAnomalies,
  ...queueTimeAnomalies
];
const savedAnomalies = [];
```

#### **Lines 58-88: Update save logic to include trace metadata**

**CURRENT CODE:**
```typescript
// Lines 58-88
for (const anomaly of allAnomalies) {
  const { data, error } = await supabase
    .from('anomaly_detections')
    .insert({
      user_id: user.id,
      anomaly_type: anomaly.type,
      severity: anomaly.severity,
      confidence_score: anomaly.confidence,
      metric_name: anomaly.description.split(' ')[0].toLowerCase(),
      detected_value: anomaly.detectedValue,
      expected_value: (anomaly.expectedRange.lower + anomaly.expectedRange.upper) / 2,
      threshold_value: anomaly.expectedRange.upper,
      deviation_percentage: anomaly.deviation,
      statistics: {
        expectedRange: anomaly.expectedRange,
        confidence: anomaly.confidence
      },
      description: anomaly.description,
      contributing_factors: anomaly.contributingFactors,
      recommended_actions: anomaly.recommendedActions,
      resolution_status: 'pending',
      acknowledged: false,
      detected_at: new Date().toISOString()
    })
    .select()
    .single();

  if (!error && data) {
    savedAnomalies.push(data);
  }
}
```

**NEW CODE:**
```typescript
// Lines 193-225 (REPLACE - add trace_id from metadata)
for (const anomaly of allAnomalies) {
  const traceId = anomaly.metadata?.trace_id;
  const modelName = anomaly.metadata?.model_name;
  const operationType = anomaly.metadata?.operation_type;

  const { data, error } = await supabase
    .from('anomaly_detections')
    .insert({
      user_id: user.id,
      anomaly_type: anomaly.type,
      severity: anomaly.severity,
      confidence_score: anomaly.confidence,
      metric_name: anomaly.description.split(' ')[0].toLowerCase(),
      model_id: modelName,  // Add model context
      detected_value: anomaly.detectedValue,
      expected_value: (anomaly.expectedRange.lower + anomaly.expectedRange.upper) / 2,
      threshold_value: anomaly.expectedRange.upper,
      deviation_percentage: anomaly.deviation,
      statistics: {
        expectedRange: anomaly.expectedRange,
        confidence: anomaly.confidence,
        trace_id: traceId,  // Store trace_id for linking
        operation_type: operationType
      },
      description: anomaly.description,
      contributing_factors: anomaly.contributingFactors,
      recommended_actions: anomaly.recommendedActions,
      resolution_status: 'pending',
      acknowledged: false,
      detected_at: new Date().toISOString()
    })
    .select()
    .single();

  if (!error && data) {
    savedAnomalies.push(data);
  }
}
```

#### **Lines 90-95: Update response to reflect traces**

**CURRENT CODE:**
```typescript
// Lines 90-95
return NextResponse.json({
  success: true,
  analyzed_points: messages?.length || 0,
  anomalies_detected: allAnomalies.length,
  anomalies_saved: savedAnomalies.length
});
```

**NEW CODE:**
```typescript
// Lines 227-234 (REPLACE)
return NextResponse.json({
  success: true,
  analyzed_traces: traces?.length || 0,
  anomaly_types_analyzed: 10,  // 10 different anomaly types
  anomalies_detected: allAnomalies.length,
  anomalies_saved: savedAnomalies.length,
  breakdown: {
    duration: durationAnomalies.length,
    ttft: ttftAnomalies.length,
    throughput: throughputAnomalies.length,
    tokens: tokenAnomalies.length,
    cache_miss: cacheMissAnomalies.length,
    cost: costAnomalies.length,
    rag_latency: ragLatencyAnomalies.length,
    rag_relevance: lowRelevanceAnomalies.length,
    context_bloat: contextBloatAnomalies.length,
    queue_time: queueTimeAnomalies.length
  }
});
```

---

### File 2: `/lib/services/anomaly-detection.service.ts`

**No changes required!** The core statistical algorithms are table-agnostic.

The `detectAnomalies()` function works with generic `DataPoint[]` arrays, so it doesn't care whether the data comes from `messages` or `llm_traces`.

**Verified:** Lines 112-165 work with any data source.

---

### File 3: `/components/analytics/AnomalyFeed.tsx`

**Optional Enhancement:** Update anomaly type display labels.

#### **Lines 339-350: Add new anomaly type labels** (Optional)

**CURRENT CODE:**
```typescript
// Lines 339-350 (inside getSeverityConfig function)
const getSeverityConfig = (severity: string) => {
  switch (severity) {
    case 'critical':
      return { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' };
    case 'high':
      return { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' };
    case 'medium':
      return { icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-50' };
    case 'low':
      return { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50' };
    default:
      return { icon: Activity, color: 'text-gray-600', bg: 'bg-gray-50' };
  }
};
```

**ADD AFTER getSeverityConfig:**
```typescript
// NEW: Add anomaly type label formatter
const getAnomalyTypeLabel = (metricName: string): string => {
  const labels: Record<string, string> = {
    'duration_ms': 'Duration Spike',
    'ttft_ms': 'First Token Delay',
    'tokens_per_second': 'Throughput Drop',
    'total_tokens': 'Token Usage Spike',
    'cache_hit_rate': 'Cache Miss Rate',
    'cost_usd': 'Cost Anomaly',
    'retrieval_latency_ms': 'RAG Retrieval Slow',
    'rag_relevance_score': 'Low Relevance Score',
    'context_tokens': 'Context Bloat',
    'queue_time_ms': 'Provider Queue Delay',
    'latency_ms': 'Latency Spike' // Legacy support
  };
  return labels[metricName] || metricName;
};
```

---

## New Anomalies Detected with llm_traces

### Before Migration (2 anomaly types)
1. ✅ Latency spikes
2. ✅ Token usage spikes

### After Migration (10 anomaly types)
1. ✅ **Duration spikes** (replaces latency)
2. 🆕 **TTFT spikes** - First token delay (streaming only)
3. 🆕 **Throughput degradation** - Tokens/second drops
4. ✅ **Token usage spikes** (enhanced with cache awareness)
5. 🆕 **Cache miss anomalies** - Cache hit rate drops
6. 🆕 **Cost anomalies** - Unexpected cost spikes
7. 🆕 **RAG retrieval latency** - Context retrieval slowdowns
8. 🆕 **Low RAG relevance** - Retrieved context not relevant
9. 🆕 **Context bloat** - Excessive context tokens
10. 🆕 **Provider queue delays** - OpenAI/Anthropic queue time spikes

**Total New Capabilities:** 8 new anomaly types (400% increase)

---

## Implementation Checklist

### Phase 1: Code Changes (1-2 hours)
- [ ] Backup current `/app/api/analytics/anomalies/detect/route.ts`
- [ ] Replace lines 28-37 with new `llm_traces` query
- [ ] Replace lines 39-52 with 10 new anomaly detection types
- [ ] Replace lines 54-56 with merged anomaly types
- [ ] Replace lines 58-88 with enhanced save logic (trace metadata)
- [ ] Replace lines 90-95 with new response format
- [ ] (Optional) Update `AnomalyFeed.tsx` with new type labels

### Phase 2: Testing (30 minutes)
- [ ] Test API endpoint: `POST /api/analytics/anomalies/detect`
- [ ] Verify 10 anomaly types are analyzed
- [ ] Check anomaly_detections table has trace_id in statistics
- [ ] Verify AnomalyFeed UI displays new anomaly types
- [ ] Test with real trace data (at least 100 traces)

### Phase 3: Validation (30 minutes)
- [ ] Compare anomaly counts before/after migration
- [ ] Verify no regression in existing anomaly detection
- [ ] Check performance (query time should be similar)
- [ ] Verify Supabase Realtime still works for AnomalyFeed

### Phase 4: Documentation (15 minutes)
- [ ] Update API documentation with new anomaly types
- [ ] Add examples of new anomaly descriptions
- [ ] Document trace_id linkage in statistics field

---

## Rollback Plan

If issues occur, revert file to backup:

```bash
# Restore backup
cp app/api/analytics/anomalies/detect/route.ts.backup app/api/analytics/anomalies/detect/route.ts

# Restart Next.js dev server
npm run dev
```

**Recovery Time:** <5 minutes

---

## Testing Commands

### 1. Trigger anomaly detection
```bash
curl -X POST http://localhost:3000/api/analytics/anomalies/detect \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "analyzed_traces": 150,
  "anomaly_types_analyzed": 10,
  "anomalies_detected": 12,
  "anomalies_saved": 12,
  "breakdown": {
    "duration": 2,
    "ttft": 1,
    "throughput": 0,
    "tokens": 3,
    "cache_miss": 2,
    "cost": 1,
    "rag_latency": 2,
    "rag_relevance": 1,
    "context_bloat": 0,
    "queue_time": 0
  }
}
```

### 2. Verify anomalies in database
```sql
-- Check latest anomalies
SELECT
  metric_name,
  severity,
  detected_value,
  description,
  statistics->>'trace_id' as trace_id,
  detected_at
FROM anomaly_detections
WHERE user_id = 'YOUR_USER_ID'
ORDER BY detected_at DESC
LIMIT 20;
```

### 3. Check AnomalyFeed UI
```
Open: http://localhost:3000/analytics
Navigate to: Errors tab
Verify: AnomalyFeed shows new anomaly types
```

---

## Performance Considerations

### Query Performance
- **Before:** ~50-100ms (messages table query)
- **After:** ~80-150ms (llm_traces query with more fields)
- **Impact:** +30-50ms acceptable for richer data

### Storage Impact
- No additional storage (using existing llm_traces table)
- Anomaly_detections table grows at same rate as before

### Memory Impact
- Analyzing 10 metrics vs 2 metrics
- Memory increase: ~5x per analysis run
- Still well within Node.js limits (<10MB total)

---

## Success Metrics

After migration, you should see:
- ✅ 10 anomaly types analyzed (vs 2 before)
- ✅ 4-5x more anomalies detected (due to more metrics)
- ✅ Trace-specific anomalies (TTFT, RAG, cache, queue time)
- ✅ Anomaly feed shows richer contributing factors
- ✅ `trace_id` linkage enables drilling into specific traces

---

## Next Steps After Migration

1. **Add Realtime Anomaly Detection**
   - Set up Supabase trigger on llm_traces INSERT
   - Run anomaly detection on new traces automatically
   - Alert critical anomalies via webhook

2. **Add Anomaly Dashboard**
   - Create `/analytics/anomalies` page
   - Show anomaly trends over time
   - Per-model anomaly breakdown

3. **Add Alert Rules**
   - Configure alert thresholds per anomaly type
   - Email/Slack notifications for critical anomalies
   - Auto-acknowledge low-severity anomalies

4. **Add Trace Drill-down**
   - Click anomaly → view full trace
   - Show hierarchical span waterfall
   - Compare anomalous trace vs baseline

---

## Questions & Answers

**Q: Will this break existing anomaly detection?**
A: No. The statistical algorithms are unchanged. Only the data source changes from `messages` to `llm_traces`.

**Q: Do I need to migrate existing anomaly_detections records?**
A: No. Old records remain valid. New records will have `trace_id` in statistics field.

**Q: Can I run both messages and traces anomaly detection?**
A: Yes, but not recommended. Choose one data source to avoid duplicate anomalies.

**Q: How do I test without affecting production?**
A: Use feature flag in route.ts to conditionally use messages vs traces.

**Q: What if llm_traces table is empty?**
A: API returns `analyzed_traces: 0` gracefully. No errors.

---

## Approval & Sign-off

- [ ] Code review completed
- [ ] Testing plan approved
- [ ] Rollback plan verified
- [ ] Ready for implementation

**Estimated Total Time:** 3-4 hours (implementation + testing + validation)
