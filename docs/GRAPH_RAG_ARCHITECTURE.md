# FineTune Lab — Graph RAG Architecture

## System Overview

---

### High-Level Architecture

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FINETUNE LAB RAG SYSTEM                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────────┐     ┌──────────────────────────────────────────────────────┐ │
│  │   DOCUMENTS  │     │                 INGESTION PIPELINE                   │ │
│  │              │     │  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌────────┐  │ │
│  │  PDF, TXT,   │────▶│  │ Chunker │─▶│Embeddings│─▶│ Entity  │─▶│ Index  │  │ │
│  │  MD, DOCX,   │     │  │         │  │ Generator│  │Extractor│  │        │  │ │
│  │  Code Files  │     │  └─────────┘  └──────────┘  └─────────┘  └────────┘  │ │
│  └──────────────┘     └───────────────────────────────────┬──────────────────┘ │
│                                                           │                    │
│                                                           ▼                    │
│                       ┌───────────────────────────────────────────────────┐    │
│                       │              KNOWLEDGE STORE                      │    │
│                       │  ┌─────────────────┐    ┌─────────────────────┐   │    │
│                       │  │    Neo4j        │    │   Vector Index      │   │    │
│                       │  │  Knowledge      │◄──▶│   (Embeddings)      │   │    │
│                       │  │    Graph        │    │                     │   │    │
│                       │  └─────────────────┘    └─────────────────────┘   │    │
│                       └───────────────────────────────────────────────────┘    │
│                                                           ▲                    │
│                                                           │                    │
│  ┌──────────────┐     ┌──────────────────────────────────┴───────────────────┐ │
│  │    USER      │     │                 RETRIEVAL PIPELINE                   │ │
│  │    QUERY     │     │                                                      │ │
│  │              │     │  ┌─────────┐  ┌────────┐  ┌────────┐  ┌──────────┐   │ │
│  │  "What is    │────▶│  │ Query   │─▶│ Hybrid │─▶│Threshold│─▶│ Reranker │   │ │
│  │   the TDP?"  │     │  │Processing│ │ Search │  │ Filter │  │          │   │ │
│  │              │     │  └─────────┘  └────────┘  └────────┘  └──────────┘   │ │
│  └──────────────┘     └──────────────────────────────────┬───────────────────┘ │
│                                                          │                     │
│                                                          ▼                     │
│                       ┌──────────────────────────────────────────────────────┐ │
│                       │              CONTEXT INJECTION                       │ │
│                       │  ┌────────────────────────────────────────────────┐  │ │
│                       │  │  Chat History + RAG Sources + User Query →     │  │ │
│                       │  │  Enhanced Prompt with Citations [1], [2]...    │  │ │
│                       │  └────────────────────────────────────────────────┘  │ │
│                       └──────────────────────────────────┬───────────────────┘ │
│                                                          │                     │
│                                                          ▼                     │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                         LLM ADAPTER LAYER                                │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐  │  │
│  │  │ OpenAI  │ │Anthropic│ │ RunPod  │ │  vLLM   │ │ Ollama  │ │ Azure  │  │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                          │                     │
│                                                          ▼                     │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                         RESPONSE + CITATIONS                             │  │
│  │  "The RTX 4090 has a TDP of 450W [1], with 16,384 CUDA cores [2]..."    │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                         OBSERVABILITY LAYER                              │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────────┐  │  │
│  │  │  Tracing   │  │  Latency   │  │   Token    │  │  Retrieval         │  │  │
│  │  │  (Spans)   │  │  Metrics   │  │   Usage    │  │  Analytics         │  │  │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow Summary

1. INGEST:   Document → Chunk → Embed → Extract Entities → Store
2. QUERY:    User Input → Classify → Expand → Decompose (if complex)
3. RETRIEVE: Search Graph → Filter by Threshold → Rerank
4. CONTEXT:  RAG Sources + Conversation History → Enhanced Prompt
5. GENERATE: Inject Context → LLM → Format Citations
6. OBSERVE:  Trace All Steps → Log Metrics → Store Analytics
```

---

## Component Details

### Ingestion Pipeline

| Component | Technology | Purpose |
| --------- | ---------- | ------- |
| **Chunker** | Custom semantic splitter | Breaks documents into meaningful sections with configurable overlap |
| **Embedding Generator** | OpenAI / Local models | Converts text chunks to vector representations |
| **Entity Extractor** | Graphiti / LLM-powered | Identifies entities and relationships for knowledge graph |

### Knowledge Store

| Component | Technology | Purpose |
| --------- | ---------- | ------- |
| **Knowledge Graph** | Neo4j + Graphiti | Stores entities, relationships, enables multi-hop reasoning |
| **Vector Index** | Embedded in Graphiti | Fast similarity search for semantic retrieval |

### Query Processing

| Component | Purpose |
| --------- | ------- |
| **Query Classifier** | Detects query type (math, temporal, web search) to route appropriately |
| **Query Expansion** | Transforms queries for better recall (e.g., "When was X released?" → "X release") |
| **Query Decomposer** | Breaks complex queries into sub-queries for comprehensive retrieval |

### Retrieval Pipeline

| Component | Purpose |
| --------- | ------- |
| **Hybrid Search** | Combines semantic similarity + keyword matching for best recall |
| **Threshold Filter** | Removes low-confidence results (configurable, default 0.7) |
| **Reranker** | Re-scores results for relevance (heuristic or cross-encoder) |

### Context Assembly

| Component | Purpose |
| --------- | ------- |
| **Conversation History** | Injects full chat history for multi-turn reasoning (follow-up questions, pronoun resolution) |
| **RAG Context** | Retrieved sources with confidence scores and citations |
| **Context Injection** | Merges history + RAG sources + user query into enhanced prompt |

**Multi-turn capabilities enabled:**

- Follow-up questions: "Tell me more about that"
- Comparisons: "How does that compare to the previous one?"
- Pronoun resolution: "When was it released?" (refers to entity from prior turn)
- Conversation continuity with or without RAG enabled

### LLM Adapter Layer

Unified adapter pattern supporting multiple providers:

| Provider | Integration Type |
| -------- | ---------------- |
| **OpenAI** | GPT-4, GPT-4o, GPT-3.5 via API |
| **Anthropic** | Claude 3.5, Claude 3 via API |
| **RunPod** | Custom deployed models via serverless endpoints |
| **vLLM** | Self-hosted inference servers |
| **Ollama** | Local model deployment |
| **Azure OpenAI** | Enterprise deployments |

### Observability Layer

| Metric | Description |
| ------ | ----------- |
| **Request Tracing** | Full span tracking from query to response |
| **Retrieval Analytics** | Sources retrieved, confidence scores, search method used |
| **Latency Metrics** | TTFT, total response time, retrieval time breakdown |
| **Token Usage** | Input/output tokens, GraphRAG context tokens |

---

## Key Design Decisions

| Decision | Rationale |
| -------- | --------- |
| **Hybrid search over pure semantic** | Catches exact keyword matches that embeddings might miss |
| **Knowledge graph over pure vector DB** | Enables relationship traversal and multi-hop reasoning |
| **Configurable thresholds** | Different use cases need different precision/recall tradeoffs |
| **Multi-LLM adapter pattern** | Clients can use their existing infrastructure without code changes |
| **Full request tracing** | Production debugging requires visibility into every pipeline step |
| **Query expansion** | Improves recall for temporal and phrased queries |
| **Query decomposition** | Complex multi-entity queries get comprehensive coverage |
| **Conversation context injection** | Enables multi-turn reasoning and follow-up questions regardless of RAG state |

---

## File Structure

lib/graphrag/
├── config.ts                 # All configuration via environment variables
├── types.ts                  # TypeScript interfaces
├── service/
│   ├── graphrag-service.ts   # Main service orchestrating RAG flow
│   └── fallback-service.ts   # Cascade fallback when primary search underperforms
├── graphiti/
│   ├── client.ts             # Graphiti/Neo4j client wrapper
│   ├── search-service.ts     # Search orchestration with expansion
│   └── traversal-service.ts  # Graph path traversal for relationships
├── utils/
│   ├── query-classifier.ts   # Detects math, temporal, web search queries
│   ├── query-expansion.ts    # Transforms queries for better recall
│   ├── query-decomposer.ts   # Splits complex queries into sub-queries
│   └── temporal-classifier.ts # Detects temporal intent
└── reranking/
    ├── index.ts              # Reranker factory
    ├── heuristic.reranker.ts # Rule-based reranking
    └── cross-encoder.reranker.ts # ML-based reranking

## Environment Configuration

All settings configurable via environment variables (no hardcoded values):

```bash
# Neo4j Connection
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password
NEO4J_DATABASE=neo4j

# Search Settings
GRAPHRAG_ENABLED=true
GRAPHRAG_TOP_K=30
GRAPHRAG_SEARCH_METHOD=hybrid    # hybrid | semantic | keyword
GRAPHRAG_SEARCH_THRESHOLD=0.7

# Processing Settings
GRAPHRAG_CHUNK_SIZE=2000
GRAPHRAG_CHUNK_OVERLAP=200
GRAPHRAG_MAX_CHUNK_CHARS=4000

# Query Routing
GRAPHRAG_SKIP_MATH=true
GRAPHRAG_SKIP_DATETIME=true
GRAPHRAG_SKIP_WEBSEARCH=true

# Reranking (Optional)
GRAPHRAG_RERANKING_ENABLED=false
GRAPHRAG_RERANKING_TYPE=heuristic  # heuristic | cross-encoder

# Fallback
GRAPHRAG_FALLBACK_ENABLED=true
GRAPHRAG_FALLBACK_STRATEGY=cascade
GRAPHRAG_FALLBACK_MIN_RESULTS=3
```

---

## Questions?

Happy to walk through any component in detail, explain specific tradeoffs, or dive into the implementation of any module.

---

**Built by Juan Canfield**
Senior RAG/LLM Engineer

