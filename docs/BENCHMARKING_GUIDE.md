# Complete Guide to Benchmarking in Your LLM Application
**Date**: 2025-11-29
**Purpose**: Understand how benchmarking works, what parameters to set, and why

---

## 🎯 What is Benchmarking?

**Benchmarking** is a systematic way to measure LLM performance against **task-specific success criteria** that YOU define.

### Why Benchmarking vs. Regular Evaluation?

| Feature | Regular Evaluation | Benchmarking |
|---------|-------------------|--------------|
| **Scope** | Single message feedback | Systematic task measurement |
| **Criteria** | Subjective (thumbs up/down, star rating) | Objective (defined pass criteria) |
| **Aggregation** | Basic stats (avg rating, success rate) | Task-type performance analysis |
| **Use Case** | Quick feedback, user satisfaction | Performance tracking, regression testing |
| **Example** | "This response was helpful - 4 stars" | "95% of code generation tasks pass min quality threshold" |

**Think of it like**:
- **Regular Evaluation** = Individual student quiz scores
- **Benchmarking** = Standardized test scores (SAT, GRE) tracking performance over time

---

## 📋 How Benchmarking Works (Step-by-Step)

### Step 1: Create a Benchmark (Define Success Criteria)

**What**: Define what "good performance" means for a specific task type

**Where**: Benchmark Manager UI or `/api/benchmarks` API

**Parameters to Set**:

```typescript
{
  name: "Code Generation Quality",           // What you're measuring
  description: "Python code must be correct", // Details
  task_type: "code",                          // Category
  pass_criteria: {
    min_score: 0.8,                           // Must score >= 80%
    required_validators: ["format_ok"]        // Must pass validators
  },
  is_public: false                            // Share with team?
}
```

### Step 2: Run Tests Linked to Benchmark

**What**: Execute LLM calls and tag them with `benchmark_id`

**Where**: Batch testing or widget mode

**How**:
```javascript
// When making batch test runs:
POST /api/chat
{
  messages: [...],
  benchmark_id: "benchmark-uuid-here",  // Links test to benchmark
  batch_test_mode: true
}
```

### Step 3: Evaluate/Judge the Responses

**What**: Score each response against the benchmark criteria

**Where**: Manual evaluation or automated judges

**How**:
```javascript
POST /api/evaluation/judge
{
  message_id: "msg-uuid",
  benchmark_id: "benchmark-uuid",
  passed: true,              // Did it meet criteria?
  score: 0.85,              // Quality score (0-1)
  validators_passed: ["format_ok"]
}
```

This creates a **judgment** record.

### Step 4: View Benchmark Analysis

**What**: Aggregate all judgments to see performance metrics

**Where**: Analytics Dashboard → Benchmark Analysis card

**Shows**:
- Overall pass rate across all benchmarks
- Performance by task type (code, reasoning, etc.)
- Individual benchmark results
- Insights and recommendations

---

## 🔧 Parameters Explained

### 1. **Benchmark Name**
**Type**: String
**Example**: "Medical Q&A Accuracy"
**Why**: Human-readable identifier for tracking
**Best Practice**: Be specific - "GPT-4 Code Gen" not just "Code"

### 2. **Task Type**
**Type**: Enum
**Options**:
- `code` - Code generation tasks
- `reasoning` - Logical reasoning, math problems
- `domain_qa` - Domain-specific Q&A (medical, legal, etc.)
- `structured_output` - JSON, XML generation
- `rag` - Retrieval-augmented generation
- `other` - Custom tasks

**Why**: Groups similar benchmarks for comparison
**Example**: All "code" benchmarks can be analyzed together

### 3. **Pass Criteria - min_score**
**Type**: Number (0-1)
**Default**: 0.8 (80%)
**Example**: 0.6 = 60% minimum quality score

**Why**: Defines the threshold for "acceptable" performance

**How to Choose**:
```
Strict Quality (0.9-1.0):   Production critical tasks
Standard Quality (0.7-0.8): Most tasks
Lenient (0.5-0.6):          Experimental/creative tasks
```

**Real Example**:
```typescript
// Medical diagnosis - very strict
min_score: 0.95  // 95% accuracy required

// Blog post generation - more lenient
min_score: 0.7   // 70% acceptable
```

### 4. **Pass Criteria - required_validators**
**Type**: String array
**Available Validators**:
- `must_cite_if_claims` - Ensures responses cite sources for factual claims
- `format_ok` - Validates response follows expected format (JSON, Markdown, etc.)

**Why**: Enforce specific quality checks beyond just a score

**Example**:
```typescript
// For RAG tasks - must cite sources
required_validators: ["must_cite_if_claims"]

// For API response generation - must be valid JSON
required_validators: ["format_ok"]

// Both required
required_validators: ["must_cite_if_claims", "format_ok"]
```

### 5. **is_public**
**Type**: Boolean
**Default**: false
**Options**:
- `true` - Shared with your workspace/team
- `false` - Private to you only

**Why**: Collaboration vs. privacy

---

## 📊 What Gets Measured?

### Individual Benchmark Metrics

For **each benchmark**, you get:

1. **Total Judgments** - How many tests evaluated
2. **Passed Judgments** - How many met criteria
3. **Failed Judgments** - How many didn't meet criteria
4. **Pass Rate** - Percentage that passed
5. **Average Score** - Mean quality score
6. **Min Score** - Your defined threshold (from pass_criteria)

**Example Output**:
```
Benchmark: "Python Code Generation"
Total Judgments: 50
Passed: 43
Failed: 7
Pass Rate: 86%
Average Score: 0.84
Min Score Required: 0.80 ✓
```

### Task Type Performance

**Grouped by task type**, you get:
- How many benchmarks in this category
- Total judgments across all benchmarks
- Average pass rate for this task type
- Best performing benchmark

**Example**:
```
Task Type: "code"
Benchmarks: 3
Judgments: 150
Avg Pass Rate: 82%
Top Benchmark: "Python Code Gen" (86%)
```

### Overall Metrics

**Across all benchmarks**:
- Total benchmarks analyzed
- Total judgments collected
- Overall accuracy (how many judgments passed)
- Passing rate (how many benchmarks meet their min_score)

---

## 🎓 Real-World Example Workflow

### Scenario: You're building a coding assistant

#### Step 1: Create Benchmarks

**Benchmark 1: Python Code Quality**
```typescript
{
  name: "Python Code Quality",
  task_type: "code",
  pass_criteria: {
    min_score: 0.85,
    required_validators: ["format_ok"]
  }
}
```

**Benchmark 2: JavaScript Code Quality**
```typescript
{
  name: "JavaScript Code Quality",
  task_type: "code",
  pass_criteria: {
    min_score: 0.80,
    required_validators: ["format_ok"]
  }
}
```

**Benchmark 3: Code Explanation Quality**
```typescript
{
  name: "Code Explanation Quality",
  task_type: "reasoning",
  pass_criteria: {
    min_score: 0.75
  }
}
```

#### Step 2: Run Tests

You run 100 coding tasks:
- 50 Python generation tasks (linked to Benchmark 1)
- 30 JavaScript generation tasks (linked to Benchmark 2)
- 20 explanation tasks (linked to Benchmark 3)

#### Step 3: Evaluate

For each response, you (or an automated judge) scores:
```typescript
// Python task example
{
  benchmark_id: "python-benchmark-id",
  passed: true,
  score: 0.90,
  validators_passed: ["format_ok"]
}

// JavaScript task example
{
  benchmark_id: "js-benchmark-id",
  passed: false,  // Failed because score < 0.80
  score: 0.75,
  validators_passed: ["format_ok"]
}
```

#### Step 4: View Results

**Benchmark Analysis shows**:

```
Overall Performance:
- Benchmarks: 3
- Total Judgments: 100
- Pass Rate: 78%
- Overall Accuracy: 82%

Task Type Performance:
┌──────────┬────────────┬────────────┬──────────┐
│ Type     │ Benchmarks │ Judgments  │ Pass Rate│
├──────────┼────────────┼────────────┼──────────┤
│ code     │ 2          │ 80         │ 85%      │
│ reasoning│ 1          │ 20         │ 70%      │
└──────────┴────────────┴────────────┴──────────┘

Individual Benchmarks:
1. Python Code Quality: 88% pass rate (44/50)
2. JavaScript Code Quality: 80% pass rate (24/30)
3. Code Explanation Quality: 70% pass rate (14/20)

Insights:
✓ Best performing: Python Code Quality (88%)
⚠ Code Explanation needs improvement (70%)
```

---

## 🎯 How to Choose Parameters

### For Production Systems

**Strict Criteria**:
```typescript
{
  task_type: "code",
  pass_criteria: {
    min_score: 0.90,  // 90% minimum
    required_validators: ["format_ok", "must_cite_if_claims"]
  }
}
```

### For Experimentation

**Lenient Criteria**:
```typescript
{
  task_type: "other",
  pass_criteria: {
    min_score: 0.60  // Just want to track trends
  }
}
```

### For RAG Systems

**Citation-focused**:
```typescript
{
  task_type: "rag",
  pass_criteria: {
    min_score: 0.75,
    required_validators: ["must_cite_if_claims"]  // MUST cite sources
  }
}
```

### For Code Generation

**Format-focused**:
```typescript
{
  task_type: "code",
  pass_criteria: {
    min_score: 0.80,
    required_validators: ["format_ok"]  // Must be valid code
  }
}
```

---

## 📈 Workflow Integration

### Manual Testing Workflow

1. **Create benchmark** in Benchmark Manager
2. **Run tests** manually in chat (or batch testing)
3. **Manually evaluate** each response
   - Click "Evaluate" button
   - Select benchmark from dropdown
   - Enter score (0-1)
   - Mark validators passed
   - Submit
4. **View results** in Benchmark Analysis card

### Automated Testing Workflow

1. **Create benchmark** via API
2. **Run batch tests** with `benchmark_id` parameter
3. **Automated judge** evaluates responses
   - Uses LLM-as-judge
   - Checks validators automatically
   - Assigns scores
   - Creates judgments
4. **View results** in dashboard (auto-updates)

---

## 🔍 Database Schema

### benchmarks table
```sql
CREATE TABLE benchmarks (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL,  -- 'code', 'reasoning', etc.
  pass_criteria JSONB NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  is_public BOOLEAN DEFAULT FALSE
);
```

### judgments table
```sql
CREATE TABLE judgments (
  id UUID PRIMARY KEY,
  benchmark_id UUID REFERENCES benchmarks(id),
  message_id UUID REFERENCES messages(id),
  passed BOOLEAN,           -- Did it meet pass criteria?
  score NUMERIC(3,2),       -- Quality score (0.00-1.00)
  validators_passed TEXT[], -- Which validators passed
  created_at TIMESTAMPTZ,
  created_by UUID
);
```

**Link**: `judgments.benchmark_id → benchmarks.id`

---

## 📊 Benchmark Analysis Card

### What It Shows

**Summary Stats**:
- Total benchmarks being tracked
- Total judgments collected
- Overall pass rate (% of judgments meeting criteria)
- Overall accuracy (average score)

**Task Type Table**:
- Performance grouped by task type
- Shows which types of tasks you excel at
- Identifies weak areas

**Individual Benchmark Table**:
- Detailed results for each benchmark
- Pass/fail counts
- Average scores vs. minimum required
- Quick identification of failing benchmarks

**Insights**:
- Auto-generated recommendations
- Identifies best/worst performers
- Suggests areas for improvement

---

## ❓ Common Questions

### Q: What's the difference between `score` and `passed`?

**A**:
- `score` = Quality rating (0-1, like 0.85 = 85%)
- `passed` = Boolean decision based on `min_score` threshold

**Example**:
```typescript
// If min_score is 0.80:
score: 0.85 → passed: true  ✓
score: 0.75 → passed: false ✗
```

### Q: Can I change pass_criteria after creating a benchmark?

**A**: Yes, via update API or edit UI. But note:
- Existing judgments aren't re-evaluated
- Only new judgments use new criteria
- This can skew historical comparisons

### Q: How do validators work?

**A**:
1. Validator checks a specific condition (e.g., "has citations")
2. Returns pass/fail
3. If validator is "required", judgment must pass it
4. Stored in `validators_passed` array

### Q: What happens if I don't link a test to a benchmark?

**A**:
- Test still works normally
- Response can still be evaluated (star rating, thumbs up/down)
- But it won't appear in Benchmark Analysis
- No pass/fail criteria applied

### Q: Can one message belong to multiple benchmarks?

**A**:
- One judgment can only link to one benchmark
- But you can create multiple judgments for the same message
- Each judgment can reference a different benchmark

---

## 🚀 Getting Started Checklist

To start using benchmarking:

1. ✅ **Create your first benchmark**
   - Go to Benchmark Manager
   - Name it descriptively
   - Choose task_type that matches your use case
   - Set min_score (start with 0.75 for most tasks)
   - Add required_validators if needed

2. ✅ **Run tests with benchmark_id**
   - Use batch testing
   - Or manual tests in chat widget
   - Include `benchmark_id` parameter

3. ✅ **Evaluate responses**
   - Manual: Click "Evaluate" → Select benchmark → Enter score
   - Automated: Set up LLM-as-judge

4. ✅ **View results**
   - Analytics Dashboard → Benchmark Analysis card
   - Review pass rates
   - Check insights
   - Identify improvements needed

5. ✅ **Iterate**
   - Adjust min_score if too strict/lenient
   - Create more benchmarks for other task types
   - Track performance over time

---

## 📝 Best Practices

### 1. Start with 2-3 benchmarks
Don't try to benchmark everything at once. Focus on your most important tasks.

### 2. Use descriptive names
❌ Bad: "Benchmark 1", "Test A"
✓ Good: "Python Code Quality", "Medical Q&A Accuracy"

### 3. Group by task_type meaningfully
All similar tasks should share a task_type for aggregation to work well.

### 4. Set realistic min_score
- Too high (0.95+): Almost everything fails, demotivating
- Too low (0.50): Everything passes, not useful
- Sweet spot: 0.70-0.85 for most tasks

### 5. Use required_validators for critical checks
If a response MUST have citations or MUST be valid format, enforce it with validators.

### 6. Review Benchmark Analysis weekly
Track trends, identify regressions, celebrate improvements.

---

## 🔗 Related Documentation

- [Evaluation Guide](/docs/EVALUATION_GUIDE.md) - Star ratings, thumbs up/down
- [LLM-as-Judge Guide](/docs/LLM_AS_JUDGE.md) - Automated evaluation
- [Batch Testing Guide](/docs/BATCH_TESTING.md) - Running tests at scale

---

**Last Updated**: 2025-11-29
**Status**: Complete and ready to use!
