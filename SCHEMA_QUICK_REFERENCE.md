# Graph RAG Schema - Quick Reference

## 🚀 Quick Start

### 1. Start Services
```bash
cd graphiti-main/server
docker-compose up
```

### 2. Test Implementation
```bash
python3 graphiti-main/test_schema.py
```

### 3. Use in Code
```typescript
import { getGraphitiClient } from '@/lib/graphrag/graphiti';

await getGraphitiClient().addEpisodeWithSchema({
  name: 'Document Title',
  episode_body: content,
  source_description: 'Source',
  reference_time: new Date().toISOString(),
  group_id: userId,
  use_schema: true,
  schema_name: 'ai_models'
});
```

## 📊 Available Schemas

### `ai_models`
| Relationship | Usage |
|:------------|:------|
| `PROVIDED_BY` | Model → Provider |
| `BELONGS_TO_TIER` | Model → Tier |
| `HAS_CAPABILITY` | Model → Feature |
| `PRICED_AT` | Model → Price |

## 🔍 Neo4j Queries

### View All Relationships
```cypher
MATCH ()-[r]->() RETURN DISTINCT type(r), count(r)
```

### Find Model Info
```cypher
MATCH (m:Entity {name: "GPT-5"})-[r]->(n)
RETURN type(r), n.name, r.fact
```

### Price History
```cypher
MATCH (m)-[r:PRICED_AT]->()
RETURN m.name, r.fact, r.valid_at
ORDER BY r.valid_at DESC
```

## 🛠️ Common Tasks

### Add New Schema
1. Edit `graphiti-main/server/graph_service/ontology.py`
2. Add to endpoint in `routers/ingest.py`
3. Update TypeScript types in `lib/graphrag/graphiti/client.ts`

### Check Server Health
```bash
curl http://localhost:8001/healthcheck
```

### View Logs
```bash
docker-compose logs -f graphiti-server
```

## 📁 Key Files

```
graphiti-main/server/graph_service/
├── ontology.py          ← Define schemas here
└── routers/ingest.py    ← Add endpoint logic

lib/graphrag/graphiti/
└── client.ts            ← TypeScript client

graphiti-main/
└── test_schema.py       ← Test script
```

## 🐛 Troubleshooting

| Issue | Fix |
|:------|:----|
| Import error | Restart server |
| Connection refused | Check Neo4j running |
| No relationships | Verify schema name |
| Timeout | Reduce chunk size |

## 📖 Full Docs

- Implementation: `GRAPH_RAG_SCHEMA_IMPLEMENTATION.md`
- Verification: `VERIFICATION_CHECKLIST.md`
- Summary: `IMPLEMENTATION_SUMMARY.md`
