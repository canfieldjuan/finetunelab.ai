# FineTune Lab — Graph RAG Demo Portal

## Quick Start Guide

---

### Welcome

This guide walks you through testing our production RAG system. You'll upload documents, run queries, and inspect detailed traces showing exactly how retrieval works.

**Your Credentials:**

- URL: `[provided separately]`
- Email: `[provided separately]`
- Password: `[provided separately]`

**Required:** You'll need to provide your own OpenAI API key to use the system. This ensures you're testing with your own infrastructure and have full control over usage.

---

### 1. Logging In

1. Navigate to the portal URL
2. Click **Sign In**
3. Enter your credentials
4. You'll land on the **Graph RAG Demo Portal**

---

### 2. Adding Your API Key

Before uploading documents, you'll need to connect your OpenAI API key:

1. Look at the **bottom left corner** of the screen
2. Click on your **User Account Menu**
3. Select **Secrets Vault**
4. Find **OpenAI** in the list of providers
5. Click to expand and paste your API key
6. Click **Save**

Once saved, the system will use your key for embeddings and LLM responses. Your key, your control, your usage.

---

### 3. Uploading Documents

1. Go to the **Chat** page
2. Find the chat input box at the bottom
3. Click the **+ (plus sign)** on the far left of the input box
4. A **Knowledge Base** popup will appear

**In the Knowledge Base popup:**

| Option | Description |
| ------ | ----------- |
| **Mark as Historical Data** | Checkbox to flag documents as historical (optional) |
| **Advanced Chunking Settings** | Adjust chunk size (up to ~4000 characters) and overlap |
| **Upload Area** | Drag and drop your documents here |

1. Drag and drop your files (PDF, TXT, MD, DOCX, or code files)
2. Click **Upload Documents**
3. Wait for processing — status shows at the bottom under **My Documents**
4. Once status shows **Processed**, you're ready to query

---

### 4. Running Queries & Understanding Retrieval Types

With documents processed, start testing different query types. Each type triggers different retrieval strategies—you can verify this in the **Traces** page.

**RAG Toggle:** You can turn GraphRAG on/off to compare responses with and without document context. This is useful for seeing the quality difference RAG provides.

**Source Indicator:** When RAG is enabled, you'll see **"Enhanced with GraphRAG Context - X sources"** below responses, showing exactly which sources were used.

**Query Types & What to Expect:**

| Query Type | Example | Retrieval Method | What to Look For in Traces |
| ---------- | ------- | ---------------- | -------------------------- |
| **Direct Fact** | *"What is the TDP of the RTX 4090?"* | Hybrid (semantic + keyword) | High confidence scores, single entity match |
| **Comparison** | *"Compare X and Y specifications"* | Hybrid, multiple entities | Multiple sources retrieved, different entities |
| **Relationship** | *"How is Engineering connected to Sales?"* | Graph Traversal | `searchMethod: traversal`, path between entities |
| **Temporal** | *"When was the RTX 4090 released?"* | Hybrid + Query Expansion | `queryExpansion: extract_entity_from_temporal` |
| **Multi-Part** | *"What is 50*2 and tell me about RTX 4090?"* | Hybrid + Tool Execution | RAG retrieval + calculator tool called |
| **Complex/Multi-Entity** | *"Tell me everything about the Engineering and Sales divisions"* | Decomposed Query | `decomposed: true`, multiple sub-queries merged |
| **Follow-Up** | *"Tell me more about that"* | Conversation Context + Hybrid | Model references prior turn, retrieves additional context |
| **Out-of-Scope** | *"What is the capital of France?"* | Hybrid (low/no matches) | Low confidence scores or no sources retrieved |

---

**Test Prompts to Try (With Your Data):**

Replace the examples below with entities from your uploaded documents:

```plaintext
# Direct Fact
What is [specific attribute] of [entity in your docs]?

# Comparison
Compare [entity A] and [entity B] from my documents

# Relationship
How is [entity A] connected to [entity B]?
What is the relationship between [entity A] and [entity B]?

# Temporal
When was [entity] created/released/founded?
What is the history of [entity]?

# Multi-Part (Math + RAG)
Calculate [math expression] and also tell me about [entity]

# Complex Multi-Entity
Tell me everything you know about [entity A] and [entity B]
List all [category] and their [attributes]

# Follow-Up (Tests Conversation Context)
[First ask about an entity, then follow up with:]
Tell me more about that
How does it compare to [other entity]?
When was it released?

# Out-of-Scope (Tests Graceful Handling)
[Ask about something NOT in your documents]
```

---

**What You're Validating:**

| Capability | How to Confirm |
| ---------- | -------------- |
| Hybrid search works | Direct fact queries return high-confidence matches |
| Query expansion improves recall | Temporal queries find relevant docs (check `queryExpansion` in trace) |
| Graph traversal finds relationships | Relationship queries show `traversalUsed: true` |
| Query decomposition handles complexity | Multi-entity queries show `decomposed: true` |
| System handles mixed queries | Math + RAG returns both calculation AND document context |
| Multi-turn reasoning works | Follow-up questions reference prior context correctly |
| RAG vs vanilla comparison | Toggle RAG off, ask same question, compare response quality |
| Graceful degradation | Out-of-scope queries return low/no sources, model acknowledges gap |

---

### 5. Inspecting Traces

See exactly what happened during each request:

1. Navigate to **Traces** in the sidebar
2. Click any request to expand full details

**Trace data includes:**

| Metric | What It Shows |
| -------- | --------------- |
| **Retrieval Time** | How long the knowledge graph query took |
| **Sources Retrieved** | Number of document chunks pulled |
| **Confidence Scores** | Relevance score for each source (0-100%) |
| **Threshold Applied** | Minimum confidence filter (default: 70%) |
| **Search Method** | Hybrid, semantic, keyword, or traversal |
| **Query Expansion** | Transformations applied to improve recall |
| **LLM Latency** | Time for model response |
| **Token Usage** | Input/output tokens consumed |

This is production-grade observability—the same data you'd use to debug and optimize a live RAG system.

---

### 6. Batch Testing (Optional)

Run multiple queries at once to evaluate performance:

1. Navigate to **Model Testing** in the sidebar
2. You'll be redirected to the **Batch Testing UI**
3. Create a test suite:
   - Create a **TXT file** with one prompt per line
   - **Tip:** Avoid numbering, categories, or formatting that could confuse the model—just clean prompts
4. Upload your test suite
5. Select your model
6. Start the test
7. Review results:
   - Response for each prompt
   - Latency per query
   - Sources used and confidence scores
   - Optional LLM-as-judge evaluation

**Example test suite (test-prompts.txt):**

```txt
What is the TDP of the RTX 4090?
Compare the Engineering and Sales divisions
How is Alice connected to Bob?
When was the company founded?
Tell me everything about the RTX 4090
What is 100/4 and what memory does the RTX 4090 have?
```

---

### 7. Connecting Additional LLMs (Optional)

Want to test with models beyond OpenAI? You can connect:

| Provider | What You Need |
| -------- | ------------- |
| **Anthropic** | API key |
| **RunPod** | Endpoint URL + API key |
| **vLLM** | Base URL of your deployment |
| **Ollama** | Host URL (local or remote) |

Go to **Models** → **Add Model** and follow the prompts.

---

### 8. What You're Evaluating

| Capability | Where to See It |
| ---------- | --------------- |
| Document ingestion & chunking | Knowledge Base popup |
| Hybrid search (semantic + keyword) | Traces → Search Method |
| Confidence thresholding | Traces → Threshold Applied |
| Query expansion | Traces → Query Expansion |
| Citation generation | Chat responses |
| Multi-turn reasoning | Follow-up questions in Chat |
| Multi-model support | Models page |
| Full request tracing | Traces page |
| RAG on/off comparison | Toggle in Chat, compare same query |
| Batch evaluation | Model Testing page |

---

### Questions?

Reply to this thread or let me know when you'd like to walk through the architecture. Happy to explain any design decisions, tradeoffs, or dive deeper into specific components.

---

**Built by Juan Canfield**
Senior RAG/LLM Engineer

