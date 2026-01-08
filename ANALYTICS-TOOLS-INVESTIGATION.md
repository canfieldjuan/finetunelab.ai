# Analytics Tools Investigation - Session Access

## Current Implementation (Verified)

### Existing Session Tools (Lines 160-230)

1. **`get_session_evaluations(conversationIds)`** - Line 160
   - Gets ratings, feedback, success/failure data
   - Requires: `conversationIds` (array of UUIDs)
   - Supports pagination: `limit`, `offset`

2. **`get_session_metrics(conversationIds)`** - Line 186
   - Gets token usage, costs, response times, tool usage
   - Requires: `conversationIds` (array of UUIDs)
   - Returns provider-specific cost breakdown

3. **`get_session_conversations(conversationIds)`** - Line 204
   - Gets full conversation messages and metadata
   - Requires: `conversationIds` (array of UUIDs)
   - Supports pagination: `limit`, `offset`

### Current System Message (Lines 1612-1633)

```
## CURRENT SESSION CONTEXT
Session ID: chat_model_f473a2_020
Experiment Name: Qwen3-235B - thinking
Total Conversations: 1

CONVERSATION IDS FOR THIS SESSION:
["uuid-here"]

⚠️ CRITICAL TOOL USAGE INSTRUCTION ⚠️
- ALWAYS use this exact conversationIds array
- DO NOT invent or guess conversation IDs
```

**Problem:** Assistant is **locked to ONE session** only!

---

## What's Missing

### No `list_available_sessions` Tool

**Current state:**
- ❌ No way to see all 55 available sessions
- ❌ No way to get conversationIds from other sessions
- ❌ Can't compare across sessions
- ❌ Can't analyze "all my batch tests"

**What we need:**
- ✅ `list_available_sessions()` tool
- ✅ Returns all sessions with metadata
- ✅ Includes conversationIds for each session
- ✅ Assistant can then use existing tools with any session

---

## Proposed Solution

### 1. Add New Tool: `list_available_sessions`

**Tool Definition:**
```typescript
{
  type: 'function',
  function: {
    name: 'list_available_sessions',
    description: 'Lists all available tagged sessions (batch tests, experiments) with metadata. Use this to discover sessions before analyzing them with get_session_metrics or get_session_evaluations.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum sessions to return (default: 100)'
        },
        model_filter: {
          type: 'string',
          description: 'Filter by model name (optional, e.g., "Qwen", "GPT-5")'
        },
        date_from: {
          type: 'string',
          description: 'Filter sessions after this date (ISO 8601)'
        },
        date_to: {
          type: 'string',
          description: 'Filter sessions before this date (ISO 8601)'
        }
      },
      required: []
    }
  }
}
```

**Returns:**
```json
{
  "total_sessions": 55,
  "sessions": [
    {
      "session_id": "chat_model_f473a2_020",
      "experiment_name": "Qwen3-235B - thinking",
      "conversation_ids": ["uuid1"],
      "conversation_count": 1,
      "created_at": "2025-12-28T03:33:00Z",
      "model": "Qwen3-235B"
    },
    // ... all sessions
  ]
}
```

### 2. Update System Message

**From:**
```
## CURRENT SESSION CONTEXT
Session ID: chat_model_f473a2_020
CONVERSATION IDS FOR THIS SESSION: ["uuid1"]
⚠️ ALWAYS use this exact conversationIds array
```

**To:**
```
## AVAILABLE SESSIONS
You have access to 55 tagged batch test sessions.

To analyze sessions:
1. Call list_available_sessions() to see all sessions
2. Pick sessions to analyze
3. Use get_session_metrics(conversationIds) with those sessions

Example workflows:
- "Compare last 3 Qwen tests" → list_available_sessions(model_filter="Qwen", limit=3)
- "What's my overall success rate?" → list_available_sessions() → get all conversationIds → get_session_evaluations()
- "Analyze this specific session" → Use conversationIds from the session you want
```

### 3. Implementation Function

**Location:** `app/api/analytics/chat/route.ts` (add after line 1097)

```typescript
async function listAvailableSessions(
  userId: string,
  filters?: {
    limit?: number;
    model_filter?: string;
    date_from?: string;
    date_to?: string;
  }
) {
  console.log('[AnalyticsAPI] Listing available sessions for user:', userId);

  let query = supabase
    .from('conversations')
    .select('id, session_id, experiment_name, llm_model_id, created_at')
    .eq('user_id', userId)
    .not('session_id', 'is', null)
    .not('experiment_name', 'is', null)
    .order('created_at', { ascending: false });

  if (filters?.model_filter) {
    query = query.ilike('experiment_name', `%${filters.model_filter}%`);
  }

  if (filters?.date_from) {
    query = query.gte('created_at', filters.date_from);
  }

  if (filters?.date_to) {
    query = query.lte('created_at', filters.date_to);
  }

  const limit = filters?.limit || 100;
  query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    return { error: `Failed to list sessions: ${error.message}` };
  }

  // Group by session
  const grouped = new Map();
  data?.forEach((conv) => {
    const key = `${conv.session_id}-${conv.experiment_name}`;
    if (grouped.has(key)) {
      const existing = grouped.get(key);
      existing.conversation_ids.push(conv.id);
      existing.conversation_count++;
    } else {
      grouped.set(key, {
        session_id: conv.session_id,
        experiment_name: conv.experiment_name,
        conversation_ids: [conv.id],
        conversation_count: 1,
        created_at: conv.created_at,
      });
    }
  });

  const sessions = Array.from(grouped.values());

  return {
    total_sessions: sessions.length,
    sessions,
  };
}
```

### 4. Add Tool to executeAnalyticsTool (Line ~1426)

```typescript
case 'list_available_sessions':
  result = await listAvailableSessions(
    userId,
    args as { limit?: number; model_filter?: string; date_from?: string; date_to?: string }
  );
  break;
```

---

## Benefits

✅ **Access to all sessions** - via tool, not bloating system message
✅ **Flexible queries** - filter by model, date, limit
✅ **Backward compatible** - existing tools still work
✅ **Scalable** - works with 100+ sessions
✅ **Natural UX** - "show me all my Qwen tests"

---

## Example Use Cases

### Use Case 1: Compare Last 3 Runs
**User:** "Compare my last 3 Qwen batch tests"

**Assistant:**
1. `list_available_sessions(model_filter="Qwen", limit=3)`
2. Extract conversationIds from results
3. `get_session_metrics(conversationIds: [...all 3 sessions])`

### Use Case 2: Overall Success Rate
**User:** "What's my overall success rate?"

**Assistant:**
1. `list_available_sessions(limit=100)` → gets all 55 sessions
2. Extract all conversationIds
3. `get_session_evaluations(conversationIds: [...all 55 sessions])`
4. Calculate aggregate success rate

### Use Case 3: Model Comparison
**User:** "Which model performed best?"

**Assistant:**
1. `list_available_sessions()` → all sessions
2. Group by model (from experiment_name)
3. For each model: `get_session_metrics(conversationIds)`
4. Compare and report

---

## Files to Modify

1. **`app/api/analytics/chat/route.ts`**
   - Add `listAvailableSessions()` function (~line 1098)
   - Add tool definition in tools array (~line 232)
   - Add case in executeAnalyticsTool (~line 1426)
   - Update system message (~line 1612)

---

## Ready to Implement

**Next Steps:**
1. User confirms this approach
2. Implement the 4 changes above
3. Test with real queries
4. Verify assistant can access all sessions

**Estimated effort:** 30 minutes
