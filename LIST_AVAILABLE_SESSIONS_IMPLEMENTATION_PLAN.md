# list_available_sessions Tool - Implementation Plan

## Verification Complete ✅

### What We Verified:
1. ✅ Assistant CAN see traces (via get_traces tool)
2. ✅ Assistant CAN see all analytics (18 tools exist)
3. ✅ Assistant CANNOT access all sessions (only sees current session's conversationIds)
4. ✅ list_available_sessions tool does NOT exist
5. ✅ Exact insertion points identified

---

## Implementation Plan

### File: app/api/analytics/chat/route.ts

### Change 1: Add listAvailableSessions Function
**Location:** After line 1107 (after getSessionConversations function)

```typescript
// List all available tagged sessions for the user
async function listAvailableSessions(
  userId: string,
  filters?: {
    limit?: number;
    model_filter?: string;
    date_from?: string;
    date_to?: string;
  },
  supabaseClient: SupabaseClient = supabase
) {
  console.log('[AnalyticsAPI] Listing available sessions for user:', userId, 'with filters:', filters);

  let query = supabaseClient
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
  query = query.limit(1000); // Get more to group properly

  const { data, error } = await query;

  if (error) {
    console.error('[AnalyticsAPI] Error listing sessions:', error);
    return { error: `Failed to list sessions: ${error.message}` };
  }

  // Group by session
  const grouped = new Map<string, {
    session_id: string;
    experiment_name: string;
    conversation_ids: string[];
    conversation_count: number;
    created_at: string;
    model: string | null;
  }>();

  data?.forEach((conv) => {
    const key = `${conv.session_id}-${conv.experiment_name}`;
    if (grouped.has(key)) {
      const existing = grouped.get(key)!;
      existing.conversation_ids.push(conv.id);
      existing.conversation_count++;
    } else {
      grouped.set(key, {
        session_id: conv.session_id,
        experiment_name: conv.experiment_name,
        conversation_ids: [conv.id],
        conversation_count: 1,
        created_at: conv.created_at,
        model: conv.llm_model_id
      });
    }
  });

  const sessions = Array.from(grouped.values())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);

  console.log(`[AnalyticsAPI] Found ${sessions.length} unique sessions`);

  return {
    total_sessions: sessions.length,
    sessions,
  };
}
```

### Change 2: Add Tool Definition
**Location:** After line 231 (after get_session_conversations tool)

```typescript
  {
    type: 'function',
    function: {
      name: 'list_available_sessions',
      description: 'Lists all available tagged sessions (batch tests, experiments) with metadata. Use this FIRST to discover which sessions exist before analyzing them. Returns session IDs, experiment names, and conversation IDs for each session.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of sessions to return (default: 100)'
          },
          model_filter: {
            type: 'string',
            description: 'Filter sessions by model name (case-insensitive partial match, e.g., "Qwen", "GPT-5", "Claude")'
          },
          date_from: {
            type: 'string',
            description: 'Filter sessions created after this date (ISO 8601 format, e.g., "2025-01-01T00:00:00Z")'
          },
          date_to: {
            type: 'string',
            description: 'Filter sessions created before this date (ISO 8601 format, e.g., "2025-12-31T23:59:59Z")'
          }
        },
        required: []
      }
    }
  },
```

### Change 3: Add Switch Case
**Location:** After line 1314 (after get_session_conversations case, before line 1326)

Find this section:
```typescript
      case 'get_session_conversations':
        console.log('[AnalyticsAPI] get_session_conversations called with args:', JSON.stringify(args));
        result = await getSessionConversations(
          args.conversationIds as string[],
          args.includeMessages as boolean | undefined,
          authClient || supabase,
          userId
        );
        break;
```

Add after it:
```typescript
      case 'list_available_sessions':
        console.log('[AnalyticsAPI] list_available_sessions called with args:', JSON.stringify(args));
        result = await listAvailableSessions(
          userId,
          args as { limit?: number; model_filter?: string; date_from?: string; date_to?: string },
          authClient || supabase
        );
        break;
```

### Change 4: Update System Message
**Location:** Lines 1612-1649

**Replace this section:**
```typescript
## CURRENT SESSION CONTEXT
Session ID: ${sessionId}
Experiment Name: ${experimentName || '(unnamed)'}
Total Conversations: ${conversationIds.length}

CONVERSATION IDS FOR THIS SESSION:
${JSON.stringify(conversationIds)}

⚠️ CRITICAL TOOL USAGE INSTRUCTION ⚠️
When calling ANY of these tools (get_session_evaluations, get_session_metrics, get_session_conversations):
- ALWAYS use this exact conversationIds array: ${JSON.stringify(conversationIds)}
- DO NOT use ["1"] or ["${conversationIds.length}"] or any number
- DO NOT invent or guess conversation IDs
- COPY the exact UUID array shown above

EXAMPLE CORRECT TOOL CALL:
{
  "name": "get_session_metrics",
  "arguments": {
    "conversationIds": ${JSON.stringify(conversationIds)}
  }
}

## YOUR 17 TOOLS
```

**With this:**
```typescript
## AVAILABLE SESSIONS

You have access to ALL tagged batch test sessions and experiments.

### How to Access Sessions:

1. **Discover sessions:** Call \`list_available_sessions()\` to see all available sessions
   - Returns: session_id, experiment_name, conversation_ids, conversation_count, created_at
   - Optional filters: model_filter, date_from, date_to, limit

2. **Analyze sessions:** Use the conversation_ids from step 1 with these tools:
   - \`get_session_metrics(conversationIds)\` - Token usage, costs, performance
   - \`get_session_evaluations(conversationIds)\` - Ratings, feedback, success rates
   - \`get_session_conversations(conversationIds)\` - Full message content

### Example Workflows:

**Compare last 3 Qwen tests:**
1. \`list_available_sessions(model_filter: "Qwen", limit: 3)\`
2. Extract conversation_ids from each session
3. \`get_session_metrics(conversationIds: [...])\` for each session
4. Compare results

**Overall success rate:**
1. \`list_available_sessions(limit: 100)\`
2. Combine all conversation_ids
3. \`get_session_evaluations(conversationIds: [all UUIDs])\`
4. Calculate aggregate metrics

**Current session (selected in UI):**
Session ID: ${sessionId}
Experiment Name: ${experimentName || '(unnamed)'}
Conversation IDs: ${JSON.stringify(conversationIds)}

## YOUR 18 TOOLS
```

---

## Verification Steps After Implementation

### 1. TypeScript Compilation
```bash
timeout 60 npx tsc --noEmit
```
**Expected:** No NEW errors (pre-existing errors are OK)

### 2. Test list_available_sessions Tool
Create test file: `test-list-sessions.mjs`

```javascript
const response = await fetch('http://localhost:3000/api/analytics/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify({
    messages: [
      {
        role: 'user',
        content: 'List all available sessions'
      }
    ]
  })
});
```

**Expected:** Should see assistant call list_available_sessions and return all 55 sessions

### 3. Test Multi-Session Analysis
```javascript
{
  role: 'user',
  content: 'Compare my last 3 Qwen batch tests'
}
```

**Expected:**
1. Assistant calls `list_available_sessions(model_filter: "Qwen", limit: 3)`
2. Extracts conversationIds from results
3. Calls `get_session_metrics(conversationIds: [...])`
4. Provides comparison

### 4. Test Cross-Session Queries
```javascript
{
  role: 'user',
  content: 'What is my overall success rate across all sessions?'
}
```

**Expected:**
1. Assistant calls `list_available_sessions()`
2. Combines all conversation_ids
3. Calls `get_session_evaluations(conversationIds: [all UUIDs])`
4. Calculates aggregate success rate

---

## Success Criteria

✅ TypeScript compiles without NEW errors
✅ list_available_sessions returns all 55 sessions
✅ Can filter by model_filter (e.g., "Qwen")
✅ Can filter by date range
✅ Returns correct conversation_ids for each session
✅ Assistant can use returned conversationIds with existing tools
✅ Multi-session comparison queries work
✅ Cross-session aggregate queries work

---

## Rollback Plan

If issues arise:

1. **Revert function:** Remove listAvailableSessions function (after line 1107)
2. **Revert tool definition:** Remove tool from tools array (after line 231)
3. **Revert switch case:** Remove case from executeAnalyticsTool
4. **Revert system message:** Restore original CURRENT SESSION CONTEXT message

Original can be restored from git history.

---

## Implementation Ready

All verification complete. Exact insertion points identified. Implementation plan validated.

**Next:** Proceed with implementation.
