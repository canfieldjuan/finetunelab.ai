# GraphRAG Setup Guide

## 🚀 Quick Start

### 1. Set Environment Variables

Copy `.env.example` to `.env.local` and fill in the required values:

```bash
cp .env.example .env.local
```

Required variables for GraphRAG:

```bash
# OpenAI (Required for Graphiti embeddings & LLM)
OPENAI_API_KEY=sk-your-key-here

# Neo4j
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-secure-password-here
NEO4J_URI=bolt://localhost:7687

# GraphRAG Settings
GRAPHRAG_ENABLED=true
GRAPHRAG_TOP_K=5
GRAPHRAG_SEARCH_METHOD=hybrid
```

### 2. Start Graphiti & Neo4j Services

```bash
# Start services in background
docker-compose -f docker-compose.graphrag.yml up -d

# View logs
docker-compose -f docker-compose.graphrag.yml logs -f

# Stop services
docker-compose -f docker-compose.graphrag.yml down
```

### 3. Verify Services Running

**Graphiti REST API:**

- URL: <http://localhost:8001>
- Swagger Docs: <http://localhost:8001/docs>
- ReDoc: <http://localhost:8001/redoc>

**Neo4j Browser:**

- URL: <http://localhost:7474>
- Username: `neo4j`
- Password: (from your .env.local)

### 4. Run Supabase Migrations

```bash
# Apply GraphRAG schema to Supabase
# In Supabase Dashboard: SQL Editor > New Query
# Paste contents of lib/graphrag/schema.sql
# Click "Run"
```

### 5. Create Supabase Storage Bucket

In Supabase Dashboard > Storage:

1. Click "Create bucket"
2. Name: `documents`
3. Public: OFF (private)
4. Click "Create"

## 📖 Graphiti API Endpoints

The Graphiti service provides these endpoints:

### Add Episode (Document)

```bash
POST http://localhost:8001/episodes
Content-Type: application/json

{
  "name": "Document Title",
  "episode_body": "Full text content here...",
  "source_description": "filename.pdf",
  "group_id": "user-123",
  "reference_time": "2025-10-10T00:00:00Z"
}
```

### Search

```bash
GET http://localhost:8001/search?query=your query&group_id=user-123&num_results=5
```

### Get Entity Relationships

```bash
GET http://localhost:8001/entities/{entity_name}/edges?group_id=user-123
```

### Health Check

```bash
GET http://localhost:8001/health
```

## 🔧 Troubleshooting

### Services won't start

```bash
# Check if ports are already in use
lsof -i :8001  # Graphiti
lsof -i :7474  # Neo4j HTTP
lsof -i :7687  # Neo4j Bolt

# View service logs
docker-compose -f docker-compose.graphrag.yml logs graphiti
docker-compose -f docker-compose.graphrag.yml logs neo4j
```

### Neo4j health check fails

```bash
# Restart Neo4j
docker-compose -f docker-compose.graphrag.yml restart neo4j

# Check Neo4j logs
docker logs neo4j-graphrag
```

### Graphiti can't connect to Neo4j

```bash
# Verify Neo4j is healthy
docker-compose -f docker-compose.graphrag.yml ps

# Should show:
# neo4j-graphrag      healthy
# graphiti-service    running
```

### Clear all data and restart

```bash
# Stop services
docker-compose -f docker-compose.graphrag.yml down

# Remove volumes (WARNING: Deletes all graph data!)
docker-compose -f docker-compose.graphrag.yml down -v

# Start fresh
docker-compose -f docker-compose.graphrag.yml up -d
```

## 📊 Verify Installation

### Test Graphiti API

```bash
# Health check
curl http://localhost:8001/health

# Should return: {"status": "healthy"}
```

### Test Neo4j Connection

```bash
# Open Neo4j Browser
open http://localhost:7474

# Login with credentials from .env.local
# Run test query in browser:
RETURN "Connection successful!" AS message
```

### View API Documentation

```bash
# Open Swagger UI
open http://localhost:8001/docs

# Try the interactive API explorer
```

## 🎯 Next Steps

Once services are running:

1. ✅ Graphiti service: <http://localhost:8001>
2. ✅ Neo4j browser: <http://localhost:7474>
3. ✅ Supabase migrations applied
4. ✅ Storage bucket created

You're ready to proceed to **Phase 3.2: Document Parsers**!

## 📝 Notes

- **Data Persistence**: Graph data is stored in Docker volumes (`neo4j_data`)
- **User Isolation**: Use `group_id` parameter to isolate users' data
- **Embeddings**: Graphiti uses OpenAI's `text-embedding-3-small` by default
- **Scalability**: For production, consider Neo4j Aura or managed hosting
