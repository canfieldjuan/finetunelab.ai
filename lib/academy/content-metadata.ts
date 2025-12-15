/**
 * Academy Article Metadata (Lightweight - ~10KB)
 *
 * This file contains only the metadata needed for the listing page.
 * Full article content is in content.ts and should only be imported
 * by pages that need to render the full article body.
 *
 * Generated to avoid importing the 290KB content.ts for listing.
 */

export interface AcademyArticleMetadata {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  publishedAt: string;
  author: string;
  tags: string[];
}

export const academyArticlesMetadata: AcademyArticleMetadata[] = [
  {
    "slug": "vector-databases-and-embeddings",
    "title": "Vector Databases & Embeddings: A Practical Guide for RAG, Search, and AI Apps",
    "excerpt": "Learn what embeddings are, how vector databases work, how to design chunking + indexing, and how to evaluate retrieval quality in production.",
    "category": "RAG",
    "publishedAt": "2025-12-12",
    "author": "Fine Tune Lab Team",
    "tags": [
      "Vector DB",
      "Embeddings",
      "RAG",
      "Hybrid Search",
      "pgvector",
      "Qdrant",
      "Pinecone",
      "Weaviate",
      "HNSW",
      "Evaluation"
    ]
  },
  {
    "slug": "prompt-engineering-and-optimization",
    "title": "Prompt Engineering & Optimization: Patterns, Anti-Patterns, and Proven Workflows",
    "excerpt": "Design prompts that are reliable, steerable, and measurable. Covers structure, context packing, constraints, few-shot, tool-use, evaluation, and iterative optimization with clear good vs bad examples.",
    "category": "Prompting",
    "publishedAt": "2025-12-12",
    "author": "Fine Tune Lab Team",
    "tags": [
      "Prompt Engineering",
      "System Prompts",
      "Few-shot",
      "Tool Use",
      "Guardrails",
      "RAG",
      "Evaluation",
      "Chain-of-Thought"
    ]
  },
  {
    "slug": "ai-agent-tool-integration-and-function-calling",
    "title": "AI Agent Tool Integration & Function Calling: Design, Contracts, and Safety",
    "excerpt": "How to wire tools into agents safely and reliably: function schemas, argument validation, tool routing, retries, observability, and evaluation—plus clear examples.",
    "category": "Agents",
    "publishedAt": "2025-12-12",
    "author": "Fine Tune Lab Team",
    "tags": [
      "Agents",
      "Function Calling",
      "Tool Use",
      "Schemas",
      "Validation",
      "Routing",
      "Observability",
      "Evaluation"
    ]
  },
  {
    "slug": "training-data-pipelines-and-etl",
    "title": "Training Data Pipelines & ETL: Collect, Clean, Label, and Ship",
    "excerpt": "Design reliable pipelines for LLM training data: sourcing, PII scrubbing, deduplication, normalization, labeling, quality checks, and dataset versioning.",
    "category": "Data",
    "publishedAt": "2025-12-12",
    "author": "Fine Tune Lab Team",
    "tags": [
      "ETL",
      "Training Data",
      "Labeling",
      "PII",
      "Deduplication",
      "Versioning",
      "Quality"
    ]
  },
  {
    "slug": "llm-fine-tuning-best-practices-techniques",
    "title": "LLM Fine-Tuning Best Practices & Techniques (LoRA, QLoRA, SFT, DPO)",
    "excerpt": "A practical, end-to-end guide to fine-tuning LLMs: choosing LoRA vs QLoRA vs full tuning, data formatting, evals, costs, and deployment pitfalls.",
    "category": "Fine-tuning",
    "publishedAt": "2025-12-12",
    "author": "Fine Tune Lab Team",
    "tags": [
      "Fine-tuning",
      "LoRA",
      "QLoRA",
      "PEFT",
      "SFT",
      "DPO",
      "RLHF",
      "TRL",
      "Hugging Face",
      "Evaluation"
    ]
  },
  {
    "slug": "rag-vs-fine-tuning-guide",
    "title": "RAG vs. Fine-tuning: When should I use which?",
    "excerpt": "The definitive guide to choosing between Retrieval-Augmented Generation and Fine-tuning for your LLM application.",
    "category": "Architecture",
    "publishedAt": "2025-12-08",
    "author": "Fine Tune Lab Team",
    "tags": [
      "RAG",
      "Fine-tuning",
      "LLM Architecture",
      "Production AI",
      "Decision Framework"
    ]
  },
  {
    "slug": "evaluating-rag-pipelines",
    "title": "How to evaluate and benchmark RAG pipelines effectively?",
    "excerpt": "Stop guessing. Learn how to use LLM-as-a-Judge frameworks to quantitatively measure your RAG performance.",
    "category": "Evaluation",
    "publishedAt": "2025-12-08",
    "author": "Fine Tune Lab Team",
    "tags": [
      "RAG",
      "Evaluation",
      "Benchmarks",
      "Ragas",
      "MLOps",
      "LLM-as-a-Judge"
    ]
  },
  {
    "slug": "reducing-llm-latency-costs",
    "title": "How to reduce LLM inference latency and token costs?",
    "excerpt": "The pain everyone eventually hits but nobody budgets for: LLM unit economics. Learn how to reduce costs and latency without gutting quality.",
    "category": "Ops",
    "publishedAt": "2025-12-08",
    "author": "Fine Tune Lab Team",
    "tags": [
      "Latency",
      "Cost Optimization",
      "Inference",
      "Unit Economics",
      "Production"
    ]
  },
  {
    "slug": "multi-agent-systems-best-practices",
    "title": "Best practices for building and orchestrating Multi-Agent Systems?",
    "excerpt": "Moving beyond chains: How to manage state, memory, and collaboration in agentic workflows with LangGraph and AutoGen.",
    "category": "Architecture",
    "publishedAt": "2025-12-08",
    "author": "Fine Tune Lab Team",
    "tags": [
      "Agents",
      "Multi-Agent",
      "Orchestration",
      "LangGraph",
      "AutoGen",
      "State Management"
    ]
  },
  {
    "slug": "running-llms-locally",
    "title": "How to run high-performance LLMs locally?",
    "excerpt": "Keep your data private and reduce cloud bills by hosting Llama 3, Mistral, or Gemma on your own infrastructure with Ollama, llama.cpp, and vLLM.",
    "category": "Ops",
    "publishedAt": "2025-12-08",
    "author": "Fine Tune Lab Team",
    "tags": [
      "Local LLM",
      "Ollama",
      "vLLM",
      "llama.cpp",
      "Privacy",
      "On-Prem",
      "Data Sovereignty"
    ]
  },
  {
    "slug": "securing-llms-prompt-injection",
    "title": "How to secure LLMs against prompt injection and jailbreaking?",
    "excerpt": "Protecting your GenAI application from adversarial attacks and malicious inputs.",
    "category": "Security",
    "publishedAt": "2025-12-08",
    "author": "Fine Tune Lab Team",
    "tags": [
      "Security",
      "Prompt Injection",
      "Guardrails",
      "NeMo Guardrails",
      "OWASP",
      "LLM Firewall"
    ]
  },
  {
    "slug": "vector-database-selection",
    "title": "What is the best Vector Database for scale and hybrid search?",
    "excerpt": "Navigating the crowded vector database market: Dedicated vs. Integrated solutions.",
    "category": "Infrastructure",
    "publishedAt": "2025-12-08",
    "author": "Fine Tune Lab Team",
    "tags": [
      "Vector DB",
      "RAG",
      "Infrastructure",
      "Hybrid Search",
      "pgvector",
      "Pinecone",
      "Qdrant",
      "Weaviate"
    ]
  },
  {
    "slug": "llm-observability-tracing",
    "title": "How to implement effective LLM observability and tracing?",
    "excerpt": "Opening the black box: How to debug complex chains and monitor production performance.",
    "category": "Ops",
    "publishedAt": "2025-12-08",
    "author": "Fine Tune Lab Team",
    "tags": [
      "Observability",
      "Tracing",
      "Debugging"
    ]
  },
  {
    "slug": "slm-vs-llm",
    "title": "Small Language Models (SLMs) vs. Large Language Models (LLMs)",
    "excerpt": "Do you really need 70B parameters for every task? How small and tiny models let you hit your latency and cost goals without giving up reliability.",
    "category": "Architecture",
    "publishedAt": "2025-12-08",
    "author": "Fine Tune Lab Team",
    "tags": [
      "SLM",
      "Efficiency",
      "Edge AI"
    ]
  },
  {
    "slug": "long-context-vs-rag",
    "title": "How to handle long context windows vs. retrieval strategies?",
    "excerpt": "With 1M+ token windows, is RAG dead? Understanding the 'Lost in the Middle' phenomenon.",
    "category": "Architecture",
    "publishedAt": "2025-12-08",
    "author": "Fine Tune Lab Team",
    "tags": [
      "Context Window",
      "RAG",
      "Architecture"
    ]
  },
  {
    "slug": "multi-agent-systems-agentic-ai-monitoring-analytics",
    "title": "Multi-Agent Systems & Agentic AI: From Hype to Reliable Operations",
    "excerpt": "How to monitor, analyze, and continuously fine-tune multi-agent and agentic AI systems in production using deep observability and feedback loops.",
    "category": "Ops",
    "publishedAt": "2025-12-12",
    "author": "Fine Tune Lab Team",
    "tags": [
      "Agents",
      "Agentic AI",
      "Multi-Agent Systems",
      "Observability",
      "Monitoring",
      "Analytics",
      "LLM Fine-Tuning",
      "MLOps"
    ]
  },
  {
    "slug": "data-labeling-dataset-quality",
    "title": "Data Labeling & Dataset Quality: The Foundation of Reliable LLM Fine-Tuning",
    "excerpt": "Model size matters, but your labels matter more. Learn how to design high-quality datasets and labeling workflows that make fine-tuned LLMs and production agents actually reliable.",
    "category": "Ops",
    "publishedAt": "2025-12-12",
    "author": "Fine Tune Lab Team",
    "tags": [
      "Data Labeling",
      "Dataset Quality",
      "LLM Fine-Tuning",
      "Evaluation",
      "Annotation",
      "MLOps",
      "Agentic AI"
    ]
  },
  {
    "slug": "graphrag-advanced-rag-techniques",
    "title": "GraphRAG & Advanced RAG Techniques: When Plain Vector Search Isn’t Enough",
    "excerpt": "Go beyond basic vector search: how GraphRAG, multi-hop retrieval, and graph-aware prompts unlock deeper reasoning in complex domains—and how to evaluate and operate them in production.",
    "category": "RAG",
    "publishedAt": "2025-12-12",
    "author": "Fine Tune Lab Team",
    "tags": [
      "GraphRAG",
      "RAG",
      "Knowledge Graphs",
      "Retrieval",
      "Multi-Hop Reasoning",
      "Evaluation",
      "MLOps"
    ]
  },
  {
    "slug": "flagship-llms-landscape-2025",
    "title": "Flagship LLMs in 2025: How to Choose and Operate GPT-4o, Claude, Gemini & Beyond",
    "excerpt": "Frontier models are powerful—but they’re not free. Learn when you really need GPT-4o/Claude/Gemini-class models, when smaller models are enough, and how to operate a multi-model stack with proper monitoring and evaluation.",
    "category": "Architecture",
    "publishedAt": "2025-12-13",
    "author": "Fine Tune Lab Team",
    "tags": [
      "GPT-4o",
      "Claude",
      "Gemini",
      "Model Selection",
      "Evaluation",
      "Enterprise AI",
      "MLOps"
    ]
  },
  {
    "slug": "open-source-llms-llama-mistral-qwen-gemma",
    "title": "Open-Source LLMs in 2025: Llama, Mistral, Qwen, Gemma & Friends",
    "excerpt": "Llama, Mistral, Qwen, Gemma and other open models have changed how teams think about cost, privacy, and customization. Learn when to choose open-source LLMs, how they compare, and how to fine-tune and operate them with confidence.",
    "category": "Architecture",
    "publishedAt": "2025-12-13",
    "author": "Fine Tune Lab Team",
    "tags": [
      "Open Source LLM",
      "Llama 3",
      "Mistral",
      "Qwen",
      "Gemma",
      "Self-Hosting",
      "Fine-Tuning",
      "MLOps"
    ]
  },
  {
    "slug": "llm-regression-testing-ci",
    "title": "LLM Regression Testing & CI: Shipping Model Changes Without Fear",
    "excerpt": "Models, prompts, and pipelines change constantly. Learn how to build LLM regression suites, wire them into CI/CD, and use production traces to catch regressions before they hit users.",
    "category": "Evaluation",
    "publishedAt": "2025-12-13",
    "author": "Fine Tune Lab Team",
    "tags": [
      "Evaluation",
      "Regression Testing",
      "CI/CD",
      "LLM-as-a-Judge",
      "MLOps"
    ]
  }
];
