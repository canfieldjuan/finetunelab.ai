---
title: Web UI – Knowledge-Driven LLM Operations Platform
---

# Web UI – Knowledge-Driven LLM Operations Platform

This project combines a Next.js 15 application, Supabase backend, and GraphRAG stack to deliver end-to-end LLM operations: multi-provider chat, knowledge graph enrichment, provider/model management, training dataset pipelines, batch benchmarking, analytics, and monitoring.

## Highlights

- **LLM Workspace** – Chat with tool orchestration, provider switching, conversation promotion to GraphRAG, document upload modals.  
  See `docs/ui/chat.md`.
- **Graph Retrieval-Augmented Generation** – Upload, process, and search documents via Graphiti + Neo4j, with ingestion status and citations wired into chat.  
  See `docs/services/graphrag.md`.
- **Model & Secret Management** – Register custom LLM endpoints, run connection tests, and encrypt provider API keys through dedicated surfaces.  
  See `docs/ui/models.md`, `docs/ui/secrets.md`.
- **Training Platform** – Upload datasets, attach to configs, generate finetune packages (cloud + local), and manage public sharing.  
  See `docs/ui/training.md`, `docs/services/training-api.md`.
- **Batch Testing** – Extract prompts, schedule batch runs, monitor progress, and capture metrics/errors for benchmarking.  
  See `docs/services/batch-testing-api.md`.
- **Analytics & Insights** – Dashboards for quality, cost, latency, and training effectiveness with on-demand AI insights.  
  See `docs/ui/analytics.md`.
- **Monitoring** – System monitor tool for health, resource usage, log analysis, and alerting.  
  See `docs/infra/monitoring.md`.

## Architecture Overview

| Layer | Description |
|-------|-------------|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind UI components. |
| Backend | Supabase (Postgres, Auth, Storage), Next.js API routes, service-role operations. |
| Knowledge Graph | Graphiti service + Neo4j (Docker) for document extraction and relationship mapping. |
| Tooling | Modular tool registry (`lib/tools`) including calculator, web search, dataset manager, system monitor. |
| Analytics | Supabase queries + `useAnalytics` hook render charts, tables, AI insights. |

See `docs/overview/README.md` (draft) and subsystem guides below for deeper exploration.

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```
2. **Configure Environment**
   - Duplicate `.env.example` (or create `.env.local`) with Supabase keys, provider API keys, and GraphRAG settings.  
   - Reference `docs/infra/env-vars.md` for the full variable map (includes Supabase buckets `training-datasets` and `documents`).
3. **Prep External Services**
   - Supabase: run migrations under `docs/migrations/` or `supabase/migrations/`.  
   - GraphRAG: launch Neo4j + Graphiti via `docker-compose -f docker-compose.graphrag.yml up` or `./start-graphiti.sh`.
4. **Run Locally**
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000`.

Additional local development tips live in `docs/infra/local-dev.md`.

## Production Deployment

- Build & serve with `npm run build` → `npm start`.  
- Provide the environment variables listed in `docs/infra/env-vars.md`.  
- Confirm Supabase buckets (`training-datasets`, `documents`) and RPCs (`make_config_public`, `increment_config_access`) exist before go-live.  
- Use the health checks outlined in `docs/infra/deployment.md`:  
  - Web app: `/` or `/chat`  
  - Graphiti wrapper: `http://<graphiti-host>:8001/health`  
  - Supabase queries via `/api/models`, `/api/training`  
- Monitoring & observability practices are documented in `docs/infra/monitoring.md`.

## Documentation Map

| Area | Key Docs |
|------|----------|
| UI Surfaces | `docs/ui/chat.md`, `docs/ui/analytics.md`, `docs/ui/training.md`, `docs/ui/models.md`, `docs/ui/secrets.md`, `docs/ui/graphrag-demo.md`, `docs/ui/auth.md` |
| APIs & Services | `docs/services/chat-api.md`, `docs/services/graphrag.md`, `docs/services/training-api.md`, `docs/services/batch-testing-api.md`, `docs/services/models-api.md`, `docs/services/secrets-api.md`, `docs/services/export.md`, `docs/services/tools.md` |
| Data Models | `docs/data/training.md`, `docs/data/conversations.md`, `docs/data/documents.md`, `docs/data/analytics.md`, `docs/data/tools.md` |
| Infra & Ops | `docs/infra/local-dev.md`, `docs/infra/env-vars.md`, `docs/infra/deployment.md`, `docs/infra/monitoring.md`, `docs/ops/release.md`, `docs/ops/migrations.md`, `docs/ops/testing.md` |
| Knowledge Packs | `docs/system-knowledge/` – optimized for GraphRAG ingestion. |

## Key Workflows

- **Chat & Knowledge Upload** – Upload documents from the chat sidebar; monitor processing and citations (`docs/ui/chat.md`).  
- **GraphRAG Demo** – `/graphrag-demo` provides a standalone upload + indicator experience (`docs/ui/graphrag-demo.md`).  
- **Training Dataset Pipeline** – Upload JSONL datasets, attach to configs, generate finetune packages (cloud/local), and manage public IDs (`docs/ui/training.md`, `docs/services/training-api.md`).  
- **Batch Benchmarking** – Extract prompts, start batch tests, monitor status, cancel runs, and review analytics (`docs/services/batch-testing-api.md`).  
- **Monitoring** – Run `system_monitor` tool operations, review analytics dashboards, inspect batch test error logs (`docs/infra/monitoring.md`).

## Roadmap & Follow-Ups

- Verify Supabase RPC definitions and bucket ACLs in deployment environments, then mark relevant docs `graph_rag_ready`.  
- Finalize `docs/overview/README.md` with an architectural narrative and publish knowledge packs for client onboarding.  
- Integrate deployment scripts/CI workflows and capture rollback procedures in `docs/ops/release.md`.

## License

MIT
