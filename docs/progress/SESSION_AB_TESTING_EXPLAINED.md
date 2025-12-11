# Session-Based A/B Testing - Complete Explanation
**Date**: November 28, 2025
**Feature**: Analytics Dashboard - Session A/B Testing
**Location**: `/analytics` page

---

## What Is Being Compared?

The Session-Based A/B Testing feature allows you to **compare different test sessions** to see which performs better. It's designed for comparing:

### Common Use Cases

1. **Model Comparisons**:
   - Session "baseline" uses GPT-4
   - Session "variant-1" uses Claude 3
   - **Compare**: Which model has better quality/cost?

2. **Prompt Engineering**:
   - Session "prompt-v1" uses original system prompt
   - Session "prompt-v2" uses improved prompt
   - **Compare**: Which prompt gets better success rates?

3. **Parameter Testing**:
   - Session "temp-07" uses temperature 0.7
   - Session "temp-10" uses temperature 1.0
   - **Compare**: Which temperature setting is more creative vs accurate?

4. **Fine-tuned Model Testing**:
   - Session "base-model" uses base Llama 3.2
   - Session "fine-tuned" uses your custom-trained model
   - **Compare**: Did fine-tuning improve quality?

5. **Cost Optimization**:
   - Session "expensive" uses GPT-4
   - Session "budget" uses GPT-4o-mini
   - **Compare**: Is the quality loss worth the cost savings?

---

## Metrics Being Compared

### Quality Metrics (Primary)

#### 1. **Average Rating** ⭐
- **What**: Average of all user ratings (1-5 stars)
- **Source**: Manual thumbs up/down or star ratings
- **Use**: Which session produces better quality responses?
- **Example**: Session A = 4.5⭐, Session B = 3.8⭐

#### 2. **Success Rate** ✅ (Most Important!)
- **What**: Percentage of messages marked as "successful"
- **Source**: User evaluations (thumbs up/down)
- **Use**: Which session solves user problems better?
- **Example**: Session A = 87.5%, Session B = 72.0%
- **Includes**: 95% Confidence Interval (statistical significance)
- **Shows**: "Significant" badge if difference is statistically meaningful

#### 3. **Error Rate**
- **What**: Percentage of messages with errors
- **Source**: Error tracking in messages
- **Use**: Which session is more reliable?
- **Example**: Session A = 5.0%, Session B = 12.0%

---

### Performance Metrics

#### 4. **Average Latency**
- **What**: Average response time in milliseconds
- **Source**: Tracked per message
- **Use**: Which session responds faster?
- **Example**: Session A = 1200ms, Session B = 3400ms

---

### Volume Metrics

#### 5. **Total Conversations**
- **What**: Number of conversations in this session
- **Use**: How much testing has been done?
- **Example**: Session A = 50 conversations, Session B = 45 conversations

#### 6. **Total Messages**
- **What**: Number of assistant messages in session
- **Use**: Sample size for metrics
- **Example**: Session A = 250 messages, Session B = 230 messages

---

### Cost Metrics

#### 7. **Total Cost**
- **What**: Cumulative cost for all messages in session
- **Source**: Token usage × pricing
- **Use**: Which session is more cost-effective?
- **Example**: Session A = $12.50, Session B = $2.30

#### 8. **Token Metrics**
- **Avg Input Tokens**: How much context is used?
- **Avg Output Tokens**: How verbose are responses?

---

## How Sessions Work

### Creating a Session

**You tag conversations with two fields**:

1. **session_id** (string):
   - Unique identifier for THIS specific test run
   - Examples: "baseline-test-1", "variant-gpt4-001", "experiment-2025-01"

2. **experiment_name** (string, optional):
   - Groups related sessions together
   - Examples: "gpt4-vs-claude", "prompt-optimization", "temperature-test"

### Example Session Setup

```
Experiment: "model-comparison"
├─ Session: "baseline-gpt4"
│  ├─ Conversation 1 (10 messages, 5 thumbs up)
│  ├─ Conversation 2 (8 messages, 3 thumbs up)
│  └─ Conversation 3 (12 messages, 4 thumbs up)
│
└─ Session: "variant-claude"
   ├─ Conversation 1 (9 messages, 6 thumbs up)
   ├─ Conversation 2 (11 messages, 5 thumbs up)
   └─ Conversation 3 (10 messages, 7 thumbs up)
```

---

## How Tagging Works (From Earlier Fix!)

**Remember the chat tagging feature we just fixed?** That's how you create sessions!

### In Chat Interface

1. Open a conversation
2. Click "Tag Session" button in header
3. Enter:
   - **Session ID**: `baseline-gpt4`
   - **Experiment Name**: `model-comparison`
4. Click Save

**This tags the current conversation** with these session identifiers.

### In Database

```sql
UPDATE conversations
SET
  session_id = 'baseline-gpt4',
  experiment_name = 'model-comparison'
WHERE id = '<conversation-id>';
```

---

## How Comparison Works

### Step 1: Data Aggregation

**Code**: `aggregateBySession()` (useAnalytics.ts:988-1100)

1. **Find all conversations** with a session_id
2. **Group by session_id** (e.g., all "baseline-gpt4" conversations together)
3. **For each session**:
   - Gather all messages from those conversations
   - Gather all evaluations (ratings) for those messages
   - Calculate aggregate metrics

### Step 2: Display in Table

**UI**: `SessionComparisonTable.tsx`

Displays sessions grouped by experiment:

```
Session-Based A/B Testing
Top two sessions p-value: 0.023 (significant at 95%)

┌── Experiment: "model-comparison" (2 sessions) ──────────┐
│                                                          │
│ Session ID     Avg Rating  Success Rate  Avg Latency    │
│ ──────────────────────────────────────────────────────  │
│ baseline-gpt4  4.5 ⭐      87.5%          1234ms        │
│                            95% CI [82% – 93%]           │
│                            [Significant badge]          │
│                                                          │
│ variant-claude 4.2 ⭐      72.0%          2100ms        │
│                            95% CI [65% – 79%]           │
└──────────────────────────────────────────────────────────┘
```

### Step 3: Statistical Significance

**Code**: `useSignificance()` hook (components/analytics/hooks/useSignificance.ts)

Calculates:
- **95% Confidence Intervals** for each session's success rate
- **P-value** comparing top two sessions
- **"Significant" badge** if p < 0.05 (statistically significant difference)

**What this means**:
- If p-value < 0.05: **The difference is real** (not just random chance)
- If p-value ≥ 0.05: **Difference might be random** (need more data)

---

## Practical Example

### Scenario: Testing GPT-4 vs GPT-4o-mini

**Goal**: Is GPT-4o-mini good enough to replace GPT-4?

**Setup**:
1. **Week 1**: Use GPT-4 for all conversations
   - Tag with: session_id="gpt4-baseline", experiment_name="cost-reduction"

2. **Week 2**: Use GPT-4o-mini for all conversations
   - Tag with: session_id="gpt4o-mini-test", experiment_name="cost-reduction"

3. **Users rate responses** (thumbs up/down)

**Results**:
```
Experiment: "cost-reduction"

Session: gpt4-baseline
- Success Rate: 92.0% [89% – 95%]
- Avg Rating: 4.7 ⭐
- Avg Latency: 1500ms
- Total Cost: $45.60

Session: gpt4o-mini-test
- Success Rate: 88.0% [84% – 92%]
- Avg Rating: 4.4 ⭐
- Avg Latency: 900ms
- Total Cost: $8.20

P-value: 0.12 (not significant)
```

**Interpretation**:
- ✅ **Cost savings**: $45.60 → $8.20 (82% reduction!)
- ✅ **Faster**: 1500ms → 900ms (40% faster)
- ⚠️ **Slight quality drop**: 92% → 88% success (but not statistically significant)
- 📊 **P-value 0.12**: Difference could be random chance
- **Decision**: Switch to GPT-4o-mini! Quality difference is negligible, cost savings huge.

---

## Default Visible Metrics

**When you first open the table**, you see:

1. **Avg Rating** ⭐
2. **Success Rate** (with 95% CI and significance)
3. **Avg Latency**
4. **Conversations**
5. **Messages**
6. **Total Cost**

**You can customize** by clicking "Show Metrics" button.

---

## How to Use It

### Step-by-Step Workflow

1. **Plan your A/B test**:
   - What are you testing? (model, prompt, parameters)
   - What's your hypothesis? (X will be better than Y)

2. **Tag conversations**:
   - Control group: session_id="control", experiment_name="my-test"
   - Variant group: session_id="variant", experiment_name="my-test"

3. **Collect data**:
   - Run conversations in both sessions
   - Get users to rate responses (thumbs up/down)
   - Aim for at least 30+ messages per session (better statistics)

4. **Compare in analytics**:
   - Go to `/analytics`
   - Scroll to "Session-Based A/B Testing" section
   - Click "Show Metrics" to customize what you see

5. **Interpret results**:
   - Look for "Significant" badge (statistically meaningful)
   - Check confidence intervals (overlapping = might not be different)
   - Consider all metrics (cost, quality, speed)

6. **Make decision**:
   - If variant is significantly better → roll it out!
   - If no significant difference → keep cheaper/faster option
   - If more data needed → continue testing

---

## Statistical Significance Explained

### Confidence Intervals (95% CI)

**Example**: Success Rate = 87.5% [82% – 93%]

**Meaning**:
- We're 95% confident the TRUE success rate is between 82% and 93%
- The wider the range, the less certain we are
- More data = narrower confidence intervals

### Overlapping vs Non-Overlapping

**Scenario 1: Overlapping CIs**
```
Session A: 87% [82% – 92%]
Session B: 83% [78% – 88%]
          ─────────────────
           ^^^^ Overlap
```
**Result**: Difference might be random (need more data)

**Scenario 2: Non-Overlapping CIs**
```
Session A: 90% [87% – 93%]
Session B: 75% [70% – 80%]
          ─────────────────
                No overlap
```
**Result**: Session A is statistically better!

### P-Value

**P-value < 0.05**: "Significant" ✅
- Only 5% chance this difference is random
- Safe to say Session A is truly better

**P-value ≥ 0.05**: Not significant ⚠️
- Could be random variation
- Need more data or accept they're similar

---

## Pro Tips

### 1. Sample Size Matters
- **Minimum**: 30 messages per session
- **Better**: 100+ messages per session
- **More data** = more confident conclusions

### 2. Control Variables
- Change ONE thing at a time
- Don't change model AND prompt AND temperature
- Isolate what you're testing

### 3. Random Assignment
- Randomly assign users to sessions
- Don't put all "easy" questions in one session
- Avoid bias

### 4. Track Context
- Use experiment_name to group related tests
- Document what changed between sessions
- Add notes about test conditions

### 5. Cost vs Quality Trade-offs
- Don't just optimize for one metric
- Consider: quality × speed × cost
- Sometimes "good enough" is better than "perfect but expensive"

---

## Common A/B Test Scenarios

### 1. Model Selection
```
baseline-gpt4        vs  variant-claude3
baseline-gpt4        vs  variant-llama32
gpt4-turbo          vs  gpt4o-mini
```

### 2. Prompt Engineering
```
prompt-v1           vs  prompt-v2
system-default      vs  system-cot (chain of thought)
zero-shot           vs  few-shot
```

### 3. Temperature Testing
```
temp-0.0 (deterministic)  vs  temp-0.7 (balanced)
temp-0.7                  vs  temp-1.0 (creative)
```

### 4. Fine-tuning Validation
```
base-model          vs  fine-tuned-v1
fine-tuned-v1       vs  fine-tuned-v2
pre-training        vs  post-training
```

### 5. RAG Configuration
```
rag-top3            vs  rag-top5 (retrieval count)
rag-cosine          vs  rag-bm25 (ranking algorithm)
```

---

## Summary

**What's being compared**: Different testing sessions (tagged conversation groups)

**Metrics compared**:
- **Quality**: Success rate, average rating, error rate
- **Performance**: Latency, tokens
- **Cost**: Total cost, cost efficiency
- **Volume**: Conversations, messages

**Statistical analysis**:
- 95% confidence intervals
- P-values for significance testing
- Visual indicators for significant differences

**Purpose**: Data-driven decisions about:
- Which model to use
- Which prompts work best
- Whether fine-tuning helped
- Cost vs quality trade-offs
- Optimal parameters

**How to use**:
1. Tag conversations with session_id + experiment_name
2. Collect data (get ratings!)
3. Compare metrics in analytics
4. Check statistical significance
5. Make informed decision

---

## Related Features

- **Chat Tagging** (just fixed!): How you create sessions
- **Model Performance Table**: Compare models overall (not session-specific)
- **Training Effectiveness**: Compare training methods
- **Export**: Download session data for external analysis

---

**The Session A/B Testing feature is your data-driven decision making tool for optimizing your LLM application!**
