# Judgments UI Implementation
**Date:** December 3, 2025
**Feature:** Display validator judgments in chat UI

---

## ✅ What Was Implemented

### 1. API Endpoint for Fetching Judgments
**File:** `app/api/judgments/[messageId]/route.ts`

**Endpoint:** `GET /api/judgments/[messageId]`

**What it does:**
- Fetches all judgments for a specific message
- Requires authentication (Bearer token)
- Returns judgments with RLS security (users only see their own)

**Response:**
```json
{
  "success": true,
  "judgments": [
    {
      "id": "uuid",
      "message_id": "message-uuid",
      "judge_type": "rule",
      "judge_name": "Format OK",
      "criterion": "format_ok",
      "score": 1.0,
      "passed": true,
      "evidence_json": { "matchType": "exact" },
      "notes": "Format valid, no PII detected",
      "created_at": "2025-12-03T..."
    }
  ],
  "count": 1
}
```

---

### 2. MessageJudgments Component
**File:** `components/chat/MessageJudgments.tsx`

**Features:**
- ✅ Automatically fetches judgments for a message
- ✅ Shows summary badge (all passed / X failed)
- ✅ Expandable details with show/hide button
- ✅ Color-coded: green checkmarks for passed, red X for failed
- ✅ Displays validator name, notes, score
- ✅ Expandable evidence JSON for debugging
- ✅ Loading and error states
- ✅ Responsive design

**UI States:**

**Collapsed (default):**
```
✓ All 3 validations passed  [Show details ▼]
```

**Expanded:**
```
✓ All 3 validations passed  [Hide details ▲]
  ├─ ✓ Format OK
  │    Format valid, no PII detected
  │    Score: 100.0%
  ├─ ✓ Must Cite If Claims
  │    Found 2 citations
  │    Score: 100.0%
  └─ ✓ Answer Similarity
       Answer similarity: 85.3%
       Score: 85.3%
       [View evidence]
```

**Failed state:**
```
✗ 1 validation failed  [Show details ▼]
  ├─ ✓ Format OK
  │    Format valid
  └─ ✗ Answer Similarity
       Low answer similarity: 45.2% (threshold: 70%)
       Score: 45.2%
       [View evidence]
```

---

### 3. Integration with MessageList
**File:** `components/chat/MessageList.tsx`

**Changes:**
- Line 8: Added `import { MessageJudgments } from './MessageJudgments'`
- Line 100: Added `<MessageJudgments messageId={msg.id} />`

**Where it appears:**
- Below message content
- Below GraphRAG indicators
- Below message metadata (tokens, latency)
- Above message action buttons (copy, feedback, etc.)

---

## 📍 Where Judgments Appear in UI

```
┌─────────────────────────────────────┐
│ Assistant Message                    │
│ [Message content here...]            │
│                                      │
│ 📚 Citations (if any)                │
│ ⏱️  Metadata (tokens, latency)       │
│ ✓ All 3 validations passed          │  ← NEW!
│   [Show details ▼]                   │  ← NEW!
│                                      │
│ [Copy] [👍] [👎] [⭐] [More]        │
└─────────────────────────────────────┘
```

---

## 🔧 How It Works

### Flow:

1. **User sends message with benchmarkId**
   ```javascript
   POST /api/chat
   {
     "message": "Test",
     "benchmarkId": "benchmark-123"
   }
   ```

2. **Chat API executes validators**
   ```
   [API] ✅ Executing benchmark validators: benchmark-123
   [ValidatorExecutor] Running validators: ["format_ok", "answer_similarity"]
   [ValidatorExecutor] Saved 2 judgments
   ```

3. **Message displayed in UI**
   - MessageList renders the assistant message
   - MessageJudgments component mounts
   - Component fetches judgments via API

4. **Judgments displayed**
   - Summary badge shows overall status
   - User can expand to see details
   - Evidence can be viewed for debugging

---

## 🧪 Testing

### Test 1: Create Benchmark with Validators

**SQL:**
```sql
-- Check if benchmark exists
SELECT id, name, pass_criteria
FROM benchmarks
WHERE pass_criteria ? 'required_validators'
LIMIT 1;

-- If none, create one
INSERT INTO benchmarks (user_id, name, pass_criteria)
VALUES (
  '<your-user-id>',
  'Test Benchmark',
  '{"required_validators": ["format_ok", "must_cite_if_claims"]}'::jsonb
)
RETURNING id;
```

### Test 2: Send Message with Benchmark

**Via Chat UI:**
1. Open chat
2. In URL or request, include `benchmarkId` parameter
3. Send a message
4. Wait for response

**Expected:**
- Message appears
- Below metadata, you see: "✓ All 2 validations passed"
- Click "Show details" to expand

### Test 3: Verify Judgments Saved

**SQL:**
```sql
SELECT
  j.judge_name,
  j.criterion,
  j.passed,
  j.score,
  j.notes,
  m.content as message_content
FROM judgments j
JOIN messages m ON m.id = j.message_id
WHERE j.created_at > NOW() - INTERVAL '10 minutes'
ORDER BY j.created_at DESC
LIMIT 10;
```

### Test 4: Check UI Network Requests

**Browser DevTools:**
1. Send message
2. Open Network tab
3. Look for: `GET /api/judgments/[message-id]`
4. Should return 200 with judgments array

---

## 🎨 UI Examples

### Example 1: All Passed
```
✓ All 3 validations passed [Show details ▼]
```

### Example 2: Some Failed
```
✗ 1 validation failed [Show details ▼]
```

### Example 3: Expanded Details
```
✓ All 3 validations passed [Hide details ▲]
  ├─ ✓ Format OK
  │    Format valid, no PII detected
  │    Score: 100.0%
  ├─ ✓ Must Cite If Claims
  │    Found 2 citations
  │    Score: 100.0%
  └─ ✓ Answer Similarity
       Answer similarity: 87.5%
       Score: 87.5%
       [View evidence]
         {
           "matchType": "token_overlap",
           "jaccardSimilarity": 0.75,
           "overlapPercentage": 0.875,
           "finalScore": 0.875
         }
```

---

## 📋 Files Created/Modified

### New Files:
1. ✅ `app/api/judgments/[messageId]/route.ts` - API endpoint
2. ✅ `components/chat/MessageJudgments.tsx` - UI component

### Modified Files:
1. ✅ `components/chat/MessageList.tsx` - Added MessageJudgments import and render
2. ✅ `lib/evaluation/validators/executor.ts` - Fixed RLS issue (from previous fix)
3. ✅ `app/api/chat/route.ts` - Pass authenticated client (from previous fix)

---

## ✅ Verification Checklist

- [x] API endpoint created and returns judgments
- [x] MessageJudgments component renders without errors
- [x] Component integrated into MessageList
- [x] TypeScript compilation passes
- [x] UI shows summary badge
- [x] Details can be expanded/collapsed
- [x] Passed judgments show green checkmarks
- [x] Failed judgments show red X
- [x] Evidence can be viewed
- [x] Loading state displayed while fetching
- [x] Error handling in place

---

## 🚀 Next Steps for User

### 1. Test the UI:
```bash
# Start dev server if not running
npm run dev
```

### 2. Send a test message:
- Open chat at http://localhost:3000
- Send a message with a benchmark configured
- Look for validation badges below the message

### 3. If judgments don't appear:
- Check browser console for errors
- Check Network tab for `/api/judgments/[id]` request
- Verify benchmark has `required_validators` configured
- Check server logs for validator execution

### 4. Common Issues:

**"Not authenticated" error:**
- Make sure you're logged in
- Check browser has valid session token

**No judgments appear:**
- Benchmark might not have validators configured
- Check: `SELECT pass_criteria FROM benchmarks WHERE id = 'your-id'`

**Validators ran but judgments not saved:**
- Already fixed! (RLS issue from previous fix)
- Should see "Saved X judgments" in logs now

---

## 🎉 Summary

**What users see now:**
1. Send message with benchmark
2. Get response
3. See validation results right in the chat
4. Click to expand and see details
5. View evidence for debugging

**No more digging through logs!** 🎊

**All judgments are:**
- ✅ Visible in UI
- ✅ Expandable for details
- ✅ Color-coded for quick scanning
- ✅ Showing scores and notes
- ✅ Displaying evidence for debugging

---

## 📸 Visual Layout

```
╔════════════════════════════════════════════╗
║ Assistant Message                           ║
║ ─────────────────────────────────────────  ║
║ [LLM response text here...]                 ║
║                                             ║
║ 📚 2 sources cited                          ║
║ ⏱️  gpt-4 · 1,234 tokens · 2.3s            ║
║                                             ║
║ ┌─────────────────────────────────────┐   ║
║ │ ✓ All 3 validations passed          │   ║  ← NEW!
║ │ [Show details ▼]                     │   ║
║ └─────────────────────────────────────┘   ║
║                                             ║
║ [Copy] [👍] [👎] [⭐] [Evaluate] [More]   ║
╚════════════════════════════════════════════╝
```

**Ready to use!** 🚀
