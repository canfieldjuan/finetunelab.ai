# Web-UI Backend Architecture

**Date:** November 14, 2025

---

## Backend Overview

This application uses a **hybrid backend architecture** with multiple layers:

### 1. **Next.js API Routes (Primary Backend)** 📍 PRIMARY
**Location:** `/app/api/`

This is the **MAIN BACKEND** - a serverless backend built with Next.js App Router API routes.

#### Structure:
```
/app/api/
├── analytics/          # Analytics and metrics APIs
├── approvals/          # HITL approval system APIs
│   ├── route.ts        # List pending/history
│   ├── [id]/           # Individual approval operations
│   │   ├── route.ts    # GET/POST generic actions
│   │   ├── approve/    # Approve endpoint
│   │   ├── reject/     # Reject endpoint
│   │   └── cancel/     # Cancel endpoint
│   └── stats/          # Statistics endpoint
├── batch-testing/      # Batch model testing
├── benchmarks/         # Performance benchmarks
├── chat/               # Chat/conversation APIs
│   └── route.ts        # Main chat endpoint
├── conversations/      # Conversation management
├── distributed/        # Distributed workflow execution
│   └── workers/        # Worker node management
├── evaluate/           # Model evaluation
├── evaluation/         # Evaluation management
├── export/             # Data export APIs
│   ├── generate/       # Generate exports
│   └── download/       # Download exports
├── feedback/           # User feedback
├── graphrag/           # GraphRAG integration
├── inference/          # Model inference
│   └── deploy/         # Deployment management
├── models/             # Model management
├── research/           # Research mode
├── search-summaries/   # Web search summaries
├── secrets/            # Secret management
├── servers/            # Server configurations
├── settings/           # User settings
├── stripe/             # Payment integration
├── subscriptions/      # Subscription management
├── telemetry/          # Usage telemetry
├── tools/              # Tool integrations
├── training/           # Training management
│   ├── route.ts        # Main training endpoint
│   ├── deploy/         # Training deployment
│   └── local/          # Local training
├── usage/              # Usage tracking
├── user/               # User management
├── v1/                 # API v1 routes
├── web-search/         # Web search
├── widget-apps/        # Widget applications
└── workspaces/         # Workspace management
```

#### Key API Routes:
- **Chat:** `/api/chat` - Main chat interface
- **Training:** `/api/training` - Training job management
- **Approvals:** `/api/approvals` - HITL approval workflows
- **Export:** `/api/export` - Data export functionality
- **Distributed:** `/api/distributed` - Distributed execution
- **Analytics:** `/api/analytics` - Analytics and metrics

#### Technology:
- **Runtime:** Node.js (Next.js serverless functions)
- **Framework:** Next.js 14+ App Router
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Deployment:** Vercel/Self-hosted

---

### 2. **Python Training Server (Specialized Service)** 📍 SECONDARY
**Location:** `/lib/training/training_server.py`

A **FastAPI-based Python service** specifically for handling ML training jobs.

#### Purpose:
- Manages local training job execution
- Coordinates with `standalone_trainer.py` for actual training
- Provides WebSocket connections for real-time training updates
- Handles training metrics and progress tracking

#### Key Features:
```python
# FastAPI application
app = FastAPI()

# Endpoints:
- POST /train          # Start training job
- GET /jobs            # List training jobs
- GET /jobs/{job_id}   # Get job status
- WS /ws/{job_id}      # WebSocket for live updates
- POST /cancel/{job_id} # Cancel training job
```

#### Configuration:
- **URL:** `http://localhost:8000` (default)
- **Database:** Supabase (PostgreSQL) via supabase-py
- **Next.js Integration:** Calls Next.js APIs at `http://localhost:3000`
- **Lines of Code:** 3,810 lines

#### Technology Stack:
- **Framework:** FastAPI (Python async web framework)
- **WebSocket:** Real-time training updates
- **Database Client:** supabase-py
- **Validation:** Custom config_validator
- **Environment:** Python virtual env at `/lib/training/trainer_venv/`

#### Communication Flow:
```
Next.js API (/api/training)
    ↓ HTTP Request
Python Training Server (training_server.py)
    ↓ Spawns Process
Standalone Trainer (standalone_trainer.py)
    ↓ Updates
Supabase Database
    ↑ Reads
Next.js Frontend
```

---

### 3. **Supabase Backend (Database + Auth + Realtime)** 📍 INFRASTRUCTURE
**Location:** Remote Supabase instance + `/supabase/` local config

#### Components:

**A. PostgreSQL Database**
- Tables for conversations, messages, training jobs, evaluations, etc.
- Row Level Security (RLS) policies for access control
- Database functions and triggers
- Located in Supabase cloud

**B. Supabase Auth**
- User authentication and authorization
- JWT token management
- OAuth integrations
- Session management

**C. Supabase Realtime**
- WebSocket-based real-time updates
- Database change subscriptions
- Broadcast channels
- Used for live training updates, chat updates

**D. Supabase Storage**
- File storage for uploads
- Model file storage
- Dataset storage

#### Configuration Files:
```
/supabase/
├── migrations/       # Database migrations
├── functions/        # Edge functions
└── config.toml       # Supabase configuration
```

---

### 4. **Service Layer (Business Logic)** 📍 LIBRARY
**Location:** `/lib/`

Business logic and service modules that power the API routes.

#### Key Services:

```
/lib/
├── training/
│   ├── training_server.py        # Python training server
│   ├── standalone_trainer.py     # Actual training execution
│   ├── approval-manager.ts       # HITL approval management
│   ├── approval-handler.ts       # DAG approval integration
│   ├── dag-orchestrator.ts       # Workflow orchestration
│   ├── worker-manager.ts         # Distributed workers
│   ├── job-queue.ts             # Job queue management
│   └── config-validator.ts       # Training config validation
├── export/
│   ├── exportService.ts         # Export orchestration
│   ├── archiveService.ts        # Archive management
│   └── formatters/              # Export formatters
├── llm/
│   ├── openai.ts                # OpenAI integration
│   ├── anthropic.ts             # Anthropic integration
│   └── [other providers]        # Other LLM providers
├── tools/
│   ├── [various tools]          # Tool integrations
│   └── analytics-export.ts      # Analytics tools
├── evaluation/
│   └── retriever-logs.service.ts # Evaluation services
├── supabaseClient.ts            # Supabase client setup
├── csv-export.ts                # CSV export utilities
└── [other services]             # Various utilities
```

---

### 5. **External Services Integration**

#### A. LLM Providers
- **OpenAI:** GPT models
- **Anthropic:** Claude models
- **Google:** Gemini models
- **OpenRouter:** Multi-provider gateway
- **Local Models:** vLLM, ollama

#### B. Infrastructure Services
- **RunPod:** GPU training infrastructure
- **Stripe:** Payment processing
- **Redis:** Job queue and caching (BullMQ)
- **GraphRAG:** Knowledge graph system

#### C. Tools & APIs
- **Web Search:** Brave Search, Tavily
- **GraphRAG:** Neo4j-based knowledge graphs
- **Monitoring:** Custom telemetry

---

## Backend Communication Patterns

### 1. **Client → Next.js API (Primary Flow)**
```
Browser/Client
    ↓ HTTPS/WSS
Next.js API Routes (/app/api)
    ↓ SQL/REST
Supabase (PostgreSQL + Auth + Realtime)
```

### 2. **Training Flow**
```
Next.js API (/api/training)
    ↓ HTTP
Python Training Server (:8000)
    ↓ Subprocess
Standalone Trainer (Python)
    ↓ WebSocket/HTTP
Training Updates → Next.js → Client
```

### 3. **Distributed Workflow**
```
Next.js API (/api/distributed)
    ↓ Job Queue (Redis/BullMQ)
Worker Nodes
    ↓ HTTP Heartbeat
Worker Manager
    ↓ Status Updates
Supabase Database
```

### 4. **Real-time Updates**
```
Client
    ↓ WebSocket
Supabase Realtime
    ↓ Database Triggers
PostgreSQL Changes
    ↑ Broadcast
Supabase Realtime
    ↑ WebSocket
Client
```

---

## Authentication & Authorization

### Flow:
```
1. User Login
   ↓
2. Supabase Auth (JWT)
   ↓
3. Client receives access_token
   ↓
4. API requests include: Authorization: Bearer <token>
   ↓
5. Next.js verifies token with Supabase
   ↓
6. Database queries use RLS (Row Level Security)
```

### Token Types:
- **ANON_KEY:** Public client key (limited access)
- **SERVICE_ROLE_KEY:** Backend service key (bypasses RLS)
- **User JWT:** Temporary access token (per user)

---

## Database Schema (Partial)

### Core Tables:
```sql
-- Users (via Supabase Auth)
auth.users

-- Conversations
public.conversations
public.messages

-- Training
public.training_jobs
public.training_metrics
public.training_results

-- Approvals (HITL)
public.approval_requests
public.approval_notifications
public.approval_audit_log

-- Workflows
public.workflow_definitions
public.workflow_executions
public.workflow_checkpoints

-- Distributed
public.distributed_workers
public.distributed_tasks

-- Analytics
public.evaluations
public.feedback
public.usage_metrics
```

---

## Environment Variables

### Required for Backend:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # For Python server

# LLM Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Infrastructure
REDIS_URL=redis://localhost:6379
RUNPOD_API_KEY=...
STRIPE_SECRET_KEY=sk_...

# Training Server
TRAINING_SERVER_URL=http://localhost:8000
```

---

## How to Run the Backend

### 1. **Start Next.js Backend (Main)**
```bash
npm run dev
# Runs on http://localhost:3000
```

### 2. **Start Python Training Server (Optional)**
```bash
cd lib/training
source trainer_venv/bin/activate  # Linux/Mac
# or: trainer_venv\Scripts\activate  # Windows

python training_server.py
# Runs on http://localhost:8000
```

### 3. **Start Supabase (Local Development)**
```bash
cd supabase
supabase start
# Provides local PostgreSQL + Auth + Realtime
```

### 4. **Start Redis (For Job Queue)**
```bash
redis-server
# Runs on localhost:6379
```

---

## API Endpoint Examples

### Chat API
```bash
POST /api/chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "Hello",
  "conversationId": "uuid",
  "model": "gpt-4"
}
```

### Training API
```bash
POST /api/training
Authorization: Bearer <token>
Content-Type: application/json

{
  "dataset": "file-id",
  "config": { "model": "gpt-3.5-turbo", "epochs": 3 }
}
```

### Approval API
```bash
GET /api/approvals?type=pending
Authorization: Bearer <token>

# Response:
[
  {
    "id": "approval-uuid",
    "title": "Production Deploy Approval",
    "status": "pending",
    "expiresAt": "2025-11-15T10:00:00Z"
  }
]
```

---

## Key Backend Files

### Critical Backend Files:
```
1. app/api/chat/route.ts              # Main chat endpoint (1,200+ lines)
2. app/api/training/route.ts          # Training management
3. lib/training/training_server.py    # Python training server (3,810 lines)
4. lib/training/dag-orchestrator.ts   # Workflow orchestration (900+ lines)
5. lib/training/approval-manager.ts   # Approval management (666 lines)
6. lib/supabaseClient.ts              # Supabase client setup
7. app/api/approvals/*/route.ts       # HITL approval APIs (7 files)
8. lib/export/exportService.ts        # Export orchestration
```

### Configuration Files:
```
1. next.config.ts                     # Next.js configuration
2. supabase/config.toml               # Supabase configuration
3. .env.local                         # Environment variables
4. package.json                       # Dependencies & scripts
5. tsconfig.json                      # TypeScript configuration
```

---

## Summary

### **PRIMARY BACKEND:** Next.js API Routes (`/app/api/`)
- **Language:** TypeScript
- **Framework:** Next.js 14+ App Router
- **Runtime:** Node.js serverless functions
- **Database:** Supabase (PostgreSQL)
- **Location:** `/app/api/` directory
- **Lines:** 10,000+ lines across all API routes

### **SECONDARY BACKEND:** Python Training Server
- **Language:** Python
- **Framework:** FastAPI
- **Purpose:** ML training job management
- **Location:** `/lib/training/training_server.py`
- **Lines:** 3,810 lines

### **INFRASTRUCTURE:**
- **Database:** Supabase (PostgreSQL + Auth + Realtime + Storage)
- **Job Queue:** Redis + BullMQ
- **Real-time:** Supabase Realtime (WebSocket)

### **SERVICE LAYER:**
- **Location:** `/lib/` directory
- **Purpose:** Business logic, integrations, utilities
- **Lines:** 50,000+ lines total

---

## Quick Answer

**The backend is primarily located in:**
1. **`/app/api/`** - Next.js API routes (TypeScript) - **MAIN BACKEND**
2. **`/lib/training/training_server.py`** - Python FastAPI server (training-specific)
3. **`/lib/`** - Service layer (business logic)
4. **Supabase** - Remote database, auth, storage (infrastructure)

**To start the backend:**
```bash
npm run dev  # Starts Next.js backend on port 3000
```

**Training server (optional):**
```bash
cd lib/training && python training_server.py  # Port 8000
```
