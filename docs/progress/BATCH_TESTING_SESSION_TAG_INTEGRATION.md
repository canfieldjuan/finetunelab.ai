# Batch Testing + Session Tagging + Assistant as Judge Integration

**Date:** 2025-12-03
**Feature:** Integrate session tagging with batch testing for real-time assistant-based evaluation
**Goal:** Use the assistant to observe and judge batch test metrics as they happen

---

## Executive Summary

You want to connect three powerful systems:
1. **Session Tagging** - Tag conversations with session_id + experiment_name
2. **Batch Testing** - Run automated test suites through models
3. **Assistant as Judge** - Use the chat assistant to evaluate responses in real-time

**Vision:** When a batch test runs, it auto-generates (or uses manual) session tags, sends prompts through the chat system, and the assistant can observe/judge the metrics as they happen.

---

## Current State Analysis

### What You Have ✅

**1. Session Tagging System** (Working)
- `SessionManager` component in chat UI
- User can tag conversations with session_id + experiment_name
- Stored in `conversations` table
- Analytics dashboard can compare sessions
- Statistical significance testing (p-values, confidence intervals)

**2. Batch Testing System** (Working)
- API: `/api/batch-testing/run`
- Creates `batch_test_runs` record
- Sends prompts through `/api/chat` endpoint
- Auto-creates conversation with `widget_session_id`
- Tracks progress, success/failure, latency, tokens
- Links to experiment `runs` table

**3. LLM-as-Judge System** (Working)
- `LLMJudge` class with GPT-4/Claude support
- API: `/api/evaluation/judge`
- 5 standard criteria (helpfulness, accuracy, clarity, safety, completeness)
- Stores results in `judgments` table
- Evidence extraction (reasoning, confidence, suggestions)

**4. Chat System** (Working)
- `/api/chat` endpoint
- Stores messages in `messages` table
- Linked to conversations
- Tracks metadata (tokens, latency, cost)
- Supports session tagging

### What's Missing ❌

**Integration Gaps:**
1. Batch tests don't use session_id/experiment_name (only widget_session_id)
2. Assistant can't "observe" batch tests in real-time
3. No automatic LLM-as-judge evaluation during batch tests
4. Session tagging UI not available in batch testing interface
5. No way to manually trigger assistant evaluation of batch test results

---

## Proposed Architecture

### Core Concept

**Batch Test → Tagged Session → Assistant Observation → Real-time Judgment**

```
┌─────────────────────────────────────────────────────────────┐
│                    BATCH TEST RUN                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. User starts batch test                                  │
│     ├─ Selects model: GPT-4                                │
│     ├─ Selects test suite: "Customer Support 50Qs"         │
│     └─ Options:                                             │
│        ├─ Auto-generate session tag ✓                       │
│        └─ Use assistant as judge ✓                          │
│                                                             │
│  2. System auto-generates session tag                       │
│     ├─ session_id: "batch-gpt4-20251203-143052"           │
│     ├─ experiment_name: "gpt4-customer-support"            │
│     └─ Stores in conversation.session_id                   │
│                                                             │
│  3. Sends each prompt through /api/chat                     │
│     ├─ Creates messages in tagged conversation             │
│     ├─ Assistant responds to each prompt                   │
│     ├─ Metrics auto-collected (tokens, latency, cost)      │
│     └─ All linked to session_id                            │
│                                                             │
│  4. Assistant as judge evaluates (if enabled)               │
│     ├─ After each assistant response                       │
│     ├─ Calls /api/evaluation/judge                         │
│     ├─ Scores: helpfulness, accuracy, clarity, etc.        │
│     ├─ Stores in judgments table                           │
│     └─ Linked to message_id                                │
│                                                             │
│  5. Real-time metrics available                             │
│     ├─ Chat page: View full conversation                   │
│     ├─ Analytics: Session comparison with judgments        │
│     └─ Batch Testing: Progress with quality scores         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Design

### Phase 1: Session Tag Integration

**Goal:** Connect batch testing with session tagging system

#### 1.1 Update Batch Testing Configuration UI

**File:** `components/training/BatchTesting.tsx`

**Add Fields:**
```tsx
// New state
const [useSessionTag, setUseSessionTag] = useState(true); // Auto-generate by default
const [sessionId, setSessionId] = useState('');
const [experimentName, setExperimentName] = useState('');
const [autoGenerateTag, setAutoGenerateTag] = useState(true);

// New UI section
<Card className="p-4">
  <h3 className="font-medium mb-3">Session Tagging (Optional)</h3>

  <div className="space-y-3">
    {/* Toggle */}
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        id="use-session-tag"
        checked={useSessionTag}
        onChange={(e) => setUseSessionTag(e.target.checked)}
      />
      <label htmlFor="use-session-tag" className="text-sm">
        Tag this batch test for analytics tracking
      </label>
    </div>

    {useSessionTag && (
      <>
        {/* Auto-generate toggle */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="auto-generate-tag"
            checked={autoGenerateTag}
            onChange={(e) => setAutoGenerateTag(e.target.checked)}
          />
          <label htmlFor="auto-generate-tag" className="text-sm">
            Auto-generate session tag
          </label>
        </div>

        {!autoGenerateTag && (
          <>
            {/* Manual session ID */}
            <div>
              <Label htmlFor="session-id">Session ID</Label>
              <Input
                id="session-id"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                placeholder="e.g., baseline-gpt4-test"
              />
            </div>

            {/* Manual experiment name */}
            <div>
              <Label htmlFor="experiment-name">Experiment Name (Optional)</Label>
              <Input
                id="experiment-name"
                value={experimentName}
                onChange={(e) => setExperimentName(e.target.value)}
                placeholder="e.g., model-comparison"
              />
            </div>
          </>
        )}

        {/* Preview auto-generated tag */}
        {autoGenerateTag && (
          <div className="p-2 bg-muted rounded text-xs">
            <p className="font-medium mb-1">Auto-generated tag (preview):</p>
            <p className="text-muted-foreground">
              batch-{selectedModelId}-{new Date().toISOString().slice(0, 10)}
            </p>
          </div>
        )}
      </>
    )}
  </div>
</Card>
```

#### 1.2 Auto-Generate Session Tag Function

**Add to BatchTesting.tsx:**
```typescript
/**
 * Generate a unique session tag for batch test
 * Format: "batch-{model}-{date}-{time}"
 */
function generateSessionTag(modelId: string): {
  sessionId: string;
  experimentName: string;
} {
  const timestamp = new Date().toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, '');

  const modelShort = modelId
    .replace(/^(gpt|claude|llama)/i, '$1')
    .toLowerCase()
    .slice(0, 20);

  return {
    sessionId: `batch-${modelShort}-${timestamp}`,
    experimentName: `batch-testing-${modelShort}`
  };
}
```

#### 1.3 Update API to Accept Session Tags

**File:** `app/api/batch-testing/run/route.ts`

**Add to request body:**
```typescript
// In POST handler, after parsing config
const sessionTag = config.session_tag ? {
  session_id: config.session_tag.session_id,
  experiment_name: config.session_tag.experiment_name
} : null;

// When creating conversation (line 458)
const { data: conversation, error: convError } = await supabaseAdmin
  .from('conversations')
  .insert({
    user_id: userId,
    title: `Batch Test - ${new Date().toISOString()}`,
    widget_session_id: widgetSessionId,
    is_widget_session: true,
    llm_model_id: config.model_name,
    run_id: runId,
    batch_test_run_id: testRunId,
    // NEW: Add session tagging
    session_id: sessionTag?.session_id || null,
    experiment_name: sessionTag?.experiment_name || null
  })
  .select()
  .single();
```

---

### Phase 2: Assistant as Judge Integration

**Goal:** Use assistant to evaluate batch test responses in real-time

#### 2.1 Add Judge Options to Batch Testing UI

**Add to BatchTesting.tsx:**
```tsx
// New state
const [useAssistantJudge, setUseAssistantJudge] = useState(false);
const [judgeCriteria, setJudgeCriteria] = useState([
  'helpfulness',
  'accuracy',
  'clarity'
]);
const [judgeModel, setJudgeModel] = useState('claude-3-5-sonnet');

// New UI section
<Card className="p-4">
  <h3 className="font-medium mb-3">Assistant as Judge (Optional)</h3>

  <div className="space-y-3">
    {/* Toggle */}
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        id="use-assistant-judge"
        checked={useAssistantJudge}
        onChange={(e) => setUseAssistantJudge(e.target.checked)}
      />
      <label htmlFor="use-assistant-judge" className="text-sm">
        Evaluate responses with LLM judge
      </label>
    </div>

    {useAssistantJudge && (
      <>
        {/* Judge model selection */}
        <div>
          <Label htmlFor="judge-model">Judge Model</Label>
          <Select value={judgeModel} onValueChange={setJudgeModel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4-turbo">GPT-4 Turbo ($$$)</SelectItem>
              <SelectItem value="claude-3-5-sonnet">Claude 3.5 Sonnet ($$)</SelectItem>
              <SelectItem value="gpt-4o-mini">GPT-4o Mini ($)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Est. cost: ~$0.01 per message with Claude
          </p>
        </div>

        {/* Criteria selection */}
        <div>
          <Label>Evaluation Criteria</Label>
          <div className="space-y-2 mt-2">
            {['helpfulness', 'accuracy', 'clarity', 'safety', 'completeness'].map(criterion => (
              <div key={criterion} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`criterion-${criterion}`}
                  checked={judgeCriteria.includes(criterion)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setJudgeCriteria([...judgeCriteria, criterion]);
                    } else {
                      setJudgeCriteria(judgeCriteria.filter(c => c !== criterion));
                    }
                  }}
                />
                <label htmlFor={`criterion-${criterion}`} className="text-sm capitalize">
                  {criterion}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Cost estimate */}
        <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
          <p className="font-medium text-yellow-800">Cost Estimate:</p>
          <p className="text-yellow-700">
            ~${(promptCount * 0.01).toFixed(2)} for {promptCount} prompts
            ({judgeCriteria.length} criteria)
          </p>
        </div>
      </>
    )}
  </div>
</Card>
```

#### 2.2 Update API to Trigger Judge After Each Response

**File:** `app/api/batch-testing/run/route.ts`

**Modify processSinglePrompt function:**
```typescript
async function processSinglePrompt(
  testRunId: string,
  modelId: string,
  prompt: string,
  authHeader: string,
  promptIndex: number,
  runId: string | null,
  benchmarkId: string | undefined,
  widgetSessionId: string,
  judgeConfig?: {
    enabled: boolean;
    model: string;
    criteria: string[];
  }
): Promise<boolean> {
  console.log(`[Process Prompt] ${promptIndex + 1}: Sending to /api/chat`);

  try {
    // 1. Send prompt to chat API
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const chatResponse = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        modelId: modelId,
        widgetSessionId: widgetSessionId,
        forceNonStreaming: true,
        runId: runId,
        benchmarkId: benchmarkId
      })
    });

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      console.error(`[Process Prompt] ${promptIndex + 1}: API error`, errorText);
      return false;
    }

    const responseData = await chatResponse.json();
    const messageId = responseData.messageId; // Assuming API returns message ID

    console.log(`[Process Prompt] ${promptIndex + 1}: Chat success, message ID:`, messageId);

    // 2. If judge enabled, evaluate the response
    if (judgeConfig?.enabled && messageId) {
      console.log(`[Process Prompt] ${promptIndex + 1}: Starting judge evaluation`);

      const judgeResponse = await fetch(`${baseUrl}/api/evaluation/judge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          message_id: messageId,
          criteria: judgeConfig.criteria,
          judge_model: judgeConfig.model,
          save_to_db: true
        })
      });

      if (judgeResponse.ok) {
        const judgeData = await judgeResponse.json();
        console.log(`[Process Prompt] ${promptIndex + 1}: Judge evaluation complete`, {
          avgScore: judgeData.evaluations?.reduce((sum: number, e: any) => sum + e.score, 0) / judgeData.evaluations?.length
        });
      } else {
        console.error(`[Process Prompt] ${promptIndex + 1}: Judge evaluation failed`);
      }
    }

    return true;

  } catch (error) {
    console.error(`[Process Prompt] ${promptIndex}: Error:`, error);
    return false;
  }
}
```

**Update call site in processBackgroundBatch:**
```typescript
const success = await processSinglePrompt(
  testRunId,
  config.model_name,
  prompt,
  authHeader,
  i,
  runId,
  config.benchmark_id,
  widgetSessionId,
  config.judge_config // NEW: Pass judge configuration
);
```

#### 2.3 Update Batch Test Runs UI to Show Quality Scores

**File:** `components/training/BatchTesting.tsx`

**Add quality metrics to test run display:**
```tsx
{run.status === 'completed' && (
  <div className="mt-2 pt-2 border-t">
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium">Quality Scores</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => fetchQualityScores(run.id)}
      >
        View Details
      </Button>
    </div>

    {qualityScores[run.id] && (
      <div className="mt-2 space-y-1">
        {Object.entries(qualityScores[run.id]).map(([criterion, score]) => (
          <div key={criterion} className="flex items-center justify-between text-xs">
            <span className="capitalize text-muted-foreground">{criterion}</span>
            <div className="flex items-center gap-2">
              <div className="w-24 bg-gray-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${
                    score >= 8 ? 'bg-green-600' :
                    score >= 6 ? 'bg-yellow-600' :
                    'bg-red-600'
                  }`}
                  style={{ width: `${score * 10}%` }}
                />
              </div>
              <span className="font-medium">{score.toFixed(1)}/10</span>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

---

### Phase 3: Real-time Observation

**Goal:** Allow assistant to observe and comment on batch test progress

#### 3.1 Create Batch Test Observation Chat

**New Component:** `components/training/BatchTestObserver.tsx`

```typescript
/**
 * BatchTestObserver Component
 * Allows chatting with assistant about ongoing batch test
 */
export function BatchTestObserver({ testRunId }: { testRunId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch batch test progress
  const { data: testRun, refetch } = useQuery({
    queryKey: ['batch-test', testRunId],
    queryFn: () => fetchTestRun(testRunId),
    refetchInterval: 2000 // Poll every 2s while running
  });

  // Send message to assistant with batch test context
  const handleSend = async () => {
    if (!input.trim()) return;

    setLoading(true);

    // Create context message with batch test data
    const contextMessage = `
Current batch test status:
- Model: ${testRun.model_name}
- Progress: ${testRun.completed_prompts}/${testRun.total_prompts}
- Success rate: ${((testRun.completed_prompts - testRun.failed_prompts) / testRun.completed_prompts * 100).toFixed(1)}%
- Session: ${testRun.session_id}

User question: ${input}
    `.trim();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...messages,
            { role: 'user', content: contextMessage }
          ],
          modelId: 'claude-3-5-sonnet',
          sessionId: `batch-observer-${testRunId}`
        })
      });

      const data = await response.json();

      setMessages([
        ...messages,
        { role: 'user', content: input },
        { role: 'assistant', content: data.response }
      ]);

      setInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4">
      <h3 className="font-medium mb-3">Ask Assistant About This Test</h3>

      {/* Progress display */}
      <div className="mb-4 p-3 bg-muted rounded">
        <p className="text-sm">
          <strong>Progress:</strong> {testRun?.completed_prompts}/{testRun?.total_prompts}
        </p>
        <p className="text-sm">
          <strong>Session:</strong> {testRun?.session_id}
        </p>
      </div>

      {/* Chat messages */}
      <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`p-2 rounded ${
              msg.role === 'user' ? 'bg-blue-50 ml-8' : 'bg-gray-50 mr-8'
            }`}
          >
            <p className="text-xs font-medium mb-1 capitalize">{msg.role}</p>
            <p className="text-sm">{msg.content}</p>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about test progress, quality, errors..."
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <Button onClick={handleSend} disabled={loading || !input.trim()}>
          Send
        </Button>
      </div>

      {/* Quick prompts */}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setInput('How is the test performing so far?')}
        >
          How is it going?
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setInput('What are the quality scores looking like?')}
        >
          Quality scores?
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setInput('Are there any errors or issues?')}
        >
          Any errors?
        </Button>
      </div>
    </Card>
  );
}
```

#### 3.2 Integrate Observer into Batch Testing Page

**In BatchTesting.tsx:**
```tsx
{selectedRunForObservation && (
  <Dialog open={!!selectedRunForObservation} onOpenChange={() => setSelectedRunForObservation(null)}>
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Observe Test Run</DialogTitle>
      </DialogHeader>
      <BatchTestObserver testRunId={selectedRunForObservation.id} />
    </DialogContent>
  </Dialog>
)}

{/* Add "Observe" button to running tests */}
{run.status === 'running' && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => setSelectedRunForObservation(run)}
  >
    <Eye className="w-3 h-3 mr-1" />
    Observe with Assistant
  </Button>
)}
```

---

## Data Flow Diagram

### Complete Flow with Session Tagging + Judge

```
USER
 │
 ├─► Start Batch Test
 │    ├─ Select model: GPT-4
 │    ├─ Select test suite: 50 questions
 │    ├─ Enable session tag: ✓ (auto-generate)
 │    └─ Enable assistant judge: ✓ (Claude Sonnet, 3 criteria)
 │
 ▼
BATCH TEST API (/api/batch-testing/run)
 │
 ├─► Generate session tag
 │    ├─ session_id: "batch-gpt4-20251203143052"
 │    └─ experiment_name: "batch-testing-gpt4"
 │
 ├─► Create batch_test_runs record
 │    └─ Store config with session tag + judge config
 │
 ├─► Create conversation (with session tag)
 │    ├─ session_id: "batch-gpt4-20251203143052"
 │    ├─ experiment_name: "batch-testing-gpt4"
 │    ├─ widget_session_id: "batch_test_{run_id}"
 │    └─ batch_test_run_id: {run_id}
 │
 ▼
FOR EACH PROMPT (Background Processing)
 │
 ├─► Send to CHAT API (/api/chat)
 │    ├─ Creates user message
 │    ├─ Assistant responds
 │    ├─ Creates assistant message (with message_id)
 │    ├─ Collects metrics: tokens, latency, cost
 │    └─ Linked to session_id
 │
 ├─► If judge enabled → JUDGE API (/api/evaluation/judge)
 │    ├─ Input: message_id, criteria, judge_model
 │    ├─ LLM evaluates response
 │    ├─ Returns: scores (1-10), evidence, reasoning
 │    └─ Saves to judgments table
 │
 └─► Update progress in batch_test_runs
      └─ completed_prompts++
 │
 ▼
COMPLETE
 │
 ├─► Mark batch_test_runs as completed
 ├─► All messages linked to session_id
 ├─► All judgments linked to message_ids
 │
 ▼
USER CAN NOW
 │
 ├─► View in /chat
 │    └─ See full conversation with session tag
 │
 ├─► View in /analytics
 │    ├─ Session comparison table
 │    ├─ Statistical significance
 │    └─ Quality scores from judgments
 │
 ├─► View in /testing (batch test runs)
 │    ├─ Progress tracking
 │    ├─ Quality scores inline
 │    └─ Validator breakdown (if benchmark used)
 │
 └─► Chat with assistant about results
      └─ "How did the GPT-4 batch test perform?"
```

---

## Database Schema Changes

### No Breaking Changes Needed! ✅

Everything already exists:

**conversations table** (already has):
- `session_id` VARCHAR
- `experiment_name` VARCHAR
- `widget_session_id` VARCHAR
- `batch_test_run_id` UUID (FK)

**messages table** (already has):
- `conversation_id` UUID (FK)
- All metadata fields

**judgments table** (already has):
- `message_id` UUID (FK)
- `judge_name` VARCHAR
- `criterion` VARCHAR
- `score` INTEGER (1-10)
- `passed` BOOLEAN
- `evidence_json` JSONB

**batch_test_runs table** (already has):
- `config` JSONB (can store session_tag and judge_config)

### Optional: Index for Performance

```sql
-- Speed up session-based queries
CREATE INDEX IF NOT EXISTS idx_conversations_session_id
  ON conversations(session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_experiment_name
  ON conversations(experiment_name)
  WHERE experiment_name IS NOT NULL;

-- Speed up judgment queries
CREATE INDEX IF NOT EXISTS idx_judgments_message_id
  ON judgments(message_id);
```

---

## Use Cases

### Use Case 1: A/B Test Two Models

**Scenario:** Compare GPT-4 vs Claude 3.5 Sonnet on customer support questions

**Setup:**
1. Create test suite: "Customer Support 50Qs"
2. Run batch test #1:
   - Model: GPT-4
   - Session: auto-generate ("batch-gpt4-...")
   - Experiment: "customer-support-comparison"
   - Judge: Claude Sonnet, all 5 criteria
3. Run batch test #2:
   - Model: Claude 3.5 Sonnet
   - Session: auto-generate ("batch-claude-...")
   - Experiment: "customer-support-comparison"
   - Judge: Claude Sonnet, all 5 criteria

**Results:**
- Both tests tagged with same experiment_name
- Analytics dashboard shows side-by-side comparison
- Quality scores from LLM judge
- Statistical significance testing
- Can chat with assistant: "Which model performed better?"

### Use Case 2: Monitor Fine-tuned Model Quality

**Scenario:** Track quality regression after model updates

**Setup:**
1. Baseline test (before fine-tuning):
   - Session: "baseline-v1"
   - Experiment: "fine-tune-monitoring"
2. Test after fine-tuning:
   - Session: "fine-tuned-v1"
   - Experiment: "fine-tune-monitoring"
3. Weekly regression tests:
   - Session: "fine-tuned-v1-week-{N}"
   - Experiment: "fine-tune-monitoring"

**Results:**
- Track quality trends over time
- Catch regressions early
- Historical comparison

### Use Case 3: Real-time Debugging

**Scenario:** Test is failing, need to understand why

**Flow:**
1. Start batch test with 100 prompts
2. After 20 prompts, notice high failure rate
3. Click "Observe with Assistant" button
4. Ask: "Why are so many prompts failing?"
5. Assistant analyzes:
   - Error patterns
   - Common failure modes
   - Suggests fixes
6. User cancels test, fixes issue, reruns

---

## Benefits

### 1. Unified System ✅
- Single source of truth for metrics
- Session tagging connects everything
- No duplicate tracking systems

### 2. Real-time Insights ✅
- Assistant can observe as tests run
- Immediate feedback on quality
- No waiting for batch completion

### 3. Flexible Evaluation ✅
- Choose when to use judge (cost control)
- Select specific criteria
- Compare judge models

### 4. Statistical Rigor ✅
- Leverage existing A/B testing infrastructure
- Confidence intervals
- P-values for significance

### 5. Cost Transparency ✅
- Show estimated judge costs upfront
- Optional feature (not forced)
- Use cheaper models for judging

---

## Implementation Checklist

### Phase 1: Session Tag Integration
- [ ] Add session tagging UI to BatchTesting.tsx
- [ ] Implement auto-generate function
- [ ] Update /api/batch-testing/run to accept session tags
- [ ] Store session_id and experiment_name in conversation
- [ ] Test: Verify batch test creates tagged conversation

### Phase 2: Assistant Judge Integration
- [ ] Add judge configuration UI to BatchTesting.tsx
- [ ] Update processSinglePrompt to call judge API
- [ ] Display quality scores in test run cards
- [ ] Add "View Quality Details" modal
- [ ] Test: Verify judgments are created and linked

### Phase 3: Real-time Observation
- [ ] Create BatchTestObserver component
- [ ] Add "Observe" button to running tests
- [ ] Implement context injection for assistant
- [ ] Add quick prompt buttons
- [ ] Test: Verify assistant can answer questions about test

### Phase 4: Analytics Integration
- [ ] Verify session comparison works with batch tests
- [ ] Add quality score columns to session table
- [ ] Show judge results in analytics
- [ ] Test: Compare two batch test sessions

### Phase 5: Documentation & Polish
- [ ] User guide for session tagging
- [ ] Cost calculator for judge usage
- [ ] Example workflows
- [ ] FAQ section

---

## Cost Analysis

### Batch Test Costs

**Scenario:** 50 prompts through GPT-4

**Without Judge:**
- Model responses: 50 × ~$0.02 = **$1.00**
- Total: **$1.00**

**With Judge (Claude Sonnet, 5 criteria):**
- Model responses: 50 × ~$0.02 = **$1.00**
- Judge evaluations: 50 × ~$0.01 = **$0.50**
- Total: **$1.50** (+50% overhead)

**Trade-off:**
- 50% higher cost
- But get automated quality scores
- No manual review needed
- Statistical comparison ready

**Cost Reduction Strategies:**
1. Use GPT-4o Mini for judging (~$0.002/eval) = **$1.10 total**
2. Sample evaluation (judge 20% of responses) = **$1.10 total**
3. Delayed judgment (judge after reviewing results) = **$1.00 initially**

---

## Alternative: Lightweight Approach

If you want to start simpler:

### Minimal Viable Integration

**Phase 1a: Just Session Tags** (No Judge Yet)
1. Add session tag fields to batch test config
2. Store in conversation.session_id
3. View in analytics → session comparison
4. Manually rate in chat UI (thumbs up/down)
5. Compare success rates

**Benefits:**
- No additional API costs
- Use existing analytics infrastructure
- Manual quality assessment
- Still get statistical comparison

**Then later add:**
- Assistant judge (automated)
- Real-time observation (advanced)

---

## Questions for Discussion

### 1. Session Tag Generation
**Q:** Auto-generate by default, or manual by default?
**Options:**
- A) Always auto-generate (simplest)
- B) Default auto, allow manual override (recommended)
- C) Manual only (most control)

### 2. Judge Timing
**Q:** When should assistant judge evaluate?
**Options:**
- A) Real-time (after each response) - slower but immediate feedback
- B) After batch completes - faster test, delayed evaluation
- C) User-triggered (button to evaluate) - full control

### 3. Judge Cost Control
**Q:** How to prevent surprise costs?
**Options:**
- A) Show estimate, require confirmation
- B) Set budget limit (stop if exceeded)
- C) Default to cheapest judge model
- D) Sample evaluation (only judge subset)

### 4. Observation UI
**Q:** Where should "Observe with Assistant" feature live?
**Options:**
- A) Inline in batch test runs list
- B) Modal/dialog (recommended)
- C) Separate page (/testing/observe/[id])
- D) Sidebar panel

### 5. Analytics Integration Priority
**Q:** What's most important to see first?
**Options:**
- A) Session comparison with quality scores
- B) Real-time observation chat
- C) Quality score trends over time
- D) Cost analysis dashboard

---

## Next Steps

**What do you think?**

1. **Does this architecture align with your vision?**
2. **Which phase should we start with?**
   - Phase 1 (session tags) = 4-6 hours
   - Phase 2 (assistant judge) = 6-8 hours
   - Phase 3 (observation) = 4-6 hours
3. **Any modifications or additions?**
4. **Cost concerns about judge API calls?**

**I'm ready to start implementing once we align on the approach!** 🚀
