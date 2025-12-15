# Demo v2: Test Your Model + Atlas Analytics

**Date:** 2025-12-15
**Status:** Design Phase

---

## Concept

A demo that showcases FineTuneLab's **batch testing** and **Atlas NLP analytics**:

1. User connects their fine-tuned model (wherever it's deployed)
2. Run batch tests from curated test suites
3. **Atlas answers questions about results in natural language**
4. Export results as a "keepsake"

**Primary Goal:** Showcase Atlas - the NLP analytics assistant that lets users query their model performance data conversationally.

**Secondary Goal:** Demonstrate batch testing infrastructure for evaluating fine-tuned models.

---

## User Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TEST YOUR MODEL + ATLAS DEMO                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. WELCOME                                                          │
│     "Test your fine-tuned model and explore results with Atlas"      │
│     [Start Demo]                                                     │
│                                                                      │
│  2. CHOOSE TASK DOMAIN                                               │
│     □ Customer Support                                               │
│     □ Code Generation                                                │
│     □ Q&A / Knowledge                                                │
│     □ Creative Writing                                               │
│                                                                      │
│  3. CONNECT YOUR MODEL (Ephemeral - credentials deleted after demo)  │
│     ┌──────────────────────────────────────────────────┐             │
│     │ Your Fine-Tuned Model                            │             │
│     │ API Endpoint: [https://api.together.xyz/v1/___]  │             │
│     │ API Key:      [sk-___________________________]   │             │
│     │ Model ID:     [your-org/your-fine-tuned-model]   │             │
│     │                                                  │             │
│     │ ⓘ Supports any OpenAI-compatible endpoint        │             │
│     │   (Together, Fireworks, OpenRouter, vLLM, etc.)  │             │
│     └──────────────────────────────────────────────────┘             │
│     [Test Connection] [Run Batch Test]                               │
│                                                                      │
│  4. BATCH TESTING (Progress UI)                                      │
│     Running 10 prompts from "Customer Support" test suite...         │
│     ████████████░░░░░░░░ 60%                                         │
│     ✓ Prompt 1: 1.2s | 142 tokens                                    │
│     ✓ Prompt 2: 0.9s | 98 tokens                                     │
│     ✓ Prompt 3: 1.5s | 167 tokens                                    │
│     ⏳ Prompt 4: Running...                                           │
│                                                                      │
│  5. ATLAS ANALYTICS (⭐ The Star of the Show)                        │
│     ┌──────────────────────────────────────────────────┐             │
│     │ 🤖 Atlas: Your batch test is complete! Here's    │             │
│     │ what I found:                                    │             │
│     │                                                  │             │
│     │ • 10/10 prompts completed successfully           │             │
│     │ • Average latency: 1.1s                          │             │
│     │ • Average response length: 134 tokens            │             │
│     │                                                  │             │
│     │ Ask me anything about your results...            │             │
│     └──────────────────────────────────────────────────┘             │
│                                                                      │
│     User: "Which prompts had the slowest responses?"                 │
│     Atlas: "The 3 slowest responses were prompt #7 (2.1s),           │
│             prompt #3 (1.8s), and prompt #9 (1.6s)..."               │
│                                                                      │
│     User: "Show me responses under 100 tokens"                       │
│     Atlas: "4 responses were under 100 tokens: #2, #5, #8, #10..."   │
│                                                                      │
│     User: "What's my p95 latency?"                                   │
│     Atlas: "Your p95 latency is 1.8s. Here's the distribution..."    │
│                                                                      │
│     User: "Any errors or failed requests?"                           │
│     Atlas: "All 10 requests completed successfully with no errors."  │
│                                                                      │
│  6. EXPORT & CLEANUP                                                 │
│     [Download PDF Report] [Download CSV]                             │
│     ✓ Your API credentials have been securely deleted.               │
│     "Thanks for trying FineTuneLab! Sign up to unlock more."         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Atlas Query Examples

The key value prop is Atlas answering NLP questions about batch test results:

**Performance Queries:**
- "What's my average latency?"
- "What's the p95/p99 latency?"
- "Which prompts took the longest?"
- "Show me the latency distribution"

**Response Analysis:**
- "What's the average response length?"
- "Show me the shortest/longest responses"
- "Which responses were truncated?"
- "How many tokens did I use total?"

**Error Analysis:**
- "Were there any failed requests?"
- "What errors occurred?"
- "Which prompts timed out?"

**Content Queries:**
- "Show me responses that mention [keyword]"
- "Which responses seem incomplete?"
- "Find responses that asked follow-up questions"

**Export Queries:**
- "Export all results to CSV"
- "Generate a summary report"
- "Give me the raw data"

---

## Technical Architecture

### API Endpoints

1. **POST /api/demo/v2/configure**
   - Store ephemeral model config (encrypted, session-scoped)
   - Generate demo_session_id
   - Set TTL for auto-cleanup (1 hour max)
   - Test connection to endpoint

2. **POST /api/demo/v2/batch-test**
   - Run batch tests against user's model endpoint
   - Store results in demo_batch_test_results table
   - Return progress via SSE or polling

3. **POST /api/demo/v2/atlas**
   - Analytics assistant scoped to demo session
   - Can only query demo results for this session
   - Uses existing Analytics Assistant (Atlas) logic

4. **GET /api/demo/v2/export**
   - Generate PDF/CSV report
   - Include metrics, response samples

5. **POST /api/demo/v2/cleanup**
   - Delete all session data (called automatically)

### Database Schema

```sql
-- Ephemeral model config (single model, auto-deleted)
CREATE TABLE demo_model_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  endpoint_url TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  model_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Reuse existing demo_batch_test_runs and demo_batch_test_results tables
-- Add session_id column for scoping
```

### Security

1. **API Key Handling**
   - Encrypt at rest (AES-256)
   - Never log
   - Delete after batch test OR after 1 hour (whichever first)

2. **Rate Limiting**
   - 1 demo session per IP at a time
   - Max 20 prompts per session
   - 1 hour TTL

3. **Endpoint Validation**
   - Block internal IPs (SSRF protection)
   - Validate URL format
   - Test connection before batch test

---

## Implementation Phases

### Phase 1: Model Configuration
- [ ] ModelConfigForm component (endpoint, API key, model ID)
- [ ] Connection test endpoint
- [ ] Encryption utilities
- [ ] demo_model_configs table

### Phase 2: Batch Testing
- [ ] OpenAI-compatible caller service
- [ ] Batch test runner with progress SSE
- [ ] Results storage in demo tables

### Phase 3: Atlas Integration
- [ ] Scope Atlas to demo session
- [ ] Demo-specific tool functions
- [ ] Query demo_batch_test_results

### Phase 4: Export
- [ ] PDF report generation
- [ ] CSV export
- [ ] Auto-cleanup job

---

## Success Criteria

1. < 5 minutes end-to-end
2. No account required
3. Atlas answers 5+ different query types
4. User leaves with exportable report
5. Credentials securely deleted
