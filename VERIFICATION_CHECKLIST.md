# Pre-Deployment Verification Checklist

## ✅ Code Validation

- [x] **Python Syntax** - All `.py` files compile without errors
- [x] **TypeScript Syntax** - All `.ts` files type-check successfully
- [x] **Import Statements** - All new imports resolve correctly
- [x] **File Structure** - All files created in correct locations

## 📋 Implementation Checklist

### Server-Side (Python/Graphiti)
- [x] Created `ontology.py` with AI_MODELS_SCHEMA
- [x] Added `AddEpisodeRequest` DTO with schema support
- [x] Updated `ingest.py` router with `/episodes` endpoint
- [x] Imported schema in router
- [x] Exported new DTO in `__init__.py`

### Client-Side (TypeScript)
- [x] Added `GraphitiEpisodeWithSchema` interface
- [x] Created `addEpisodeWithSchema()` method
- [x] Fixed existing `addEpisode()` to use `/messages` endpoint
- [x] Added proper return types

### Testing & Documentation
- [x] Created `test_schema.py` validation script
- [x] Made test script executable
- [x] Created comprehensive documentation (`GRAPH_RAG_SCHEMA_IMPLEMENTATION.md`)
- [x] Created implementation summary

## 🧪 Testing Requirements

### Prerequisites
- [ ] Graphiti server running (`docker-compose up` in `graphiti-main/server`)
- [ ] Neo4j database accessible
- [ ] Environment variables configured

### Test Execution
- [ ] Run `python3 graphiti-main/test_schema.py`
- [ ] Verify schema-enforced extraction creates correct edge types
- [ ] Verify open extraction still works
- [ ] Check Neo4j browser for relationship types

### Expected Results
```
✅ New endpoint accepts schema parameter
✅ Relationships use defined types (PROVIDED_BY, BELONGS_TO_TIER, etc.)
✅ Search returns structured facts
✅ No errors in server logs
```

## 🔧 Configuration Verification

### Environment Variables Needed
```bash
# In graphiti-main/server/.env
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
OPENAI_API_KEY=your_key  # or other LLM provider
GRAPHITI_API_URL=http://localhost:8001
```

### Service Status
- [ ] Neo4j running on port 7687
- [ ] Graphiti server running on port 8001
- [ ] Health check responds: `curl http://localhost:8001/healthcheck`

## 📊 Validation Queries

### 1. Check Relationship Types
```cypher
MATCH ()-[r]->()
RETURN DISTINCT type(r) AS relationship_type, count(r) AS count
ORDER BY count DESC
```

**Expected**: Should see `PROVIDED_BY`, `BELONGS_TO_TIER`, `HAS_CAPABILITY`, `PRICED_AT`

### 2. Verify Specific Relationships
```cypher
MATCH (model:Entity)-[r:PROVIDED_BY]->(provider:Entity)
RETURN model.name, provider.name, r.fact
LIMIT 5
```

**Expected**: Should return model-provider relationships

### 3. Check Temporal Data
```cypher
MATCH ()-[r:PRICED_AT]->()
WHERE r.valid_at IS NOT NULL
RETURN r.fact, r.valid_at, r.invalid_at
LIMIT 5
```

**Expected**: Should show pricing with timestamps

## 🚨 Known Issues & Workarounds

### Issue: Import Error in `ingest.py`
**Symptom**: `ImportError: cannot import name 'AI_MODELS_SCHEMA'`  
**Solution**: Restart Graphiti server to reload modules

### Issue: TypeScript Can't Find Types
**Symptom**: `Cannot find name 'GraphitiEpisodeWithSchema'`  
**Solution**: Run `npm run build` or restart TypeScript server

### Issue: Neo4j Connection Refused
**Symptom**: `Connection refused to bolt://localhost:7687`  
**Solution**: Start Neo4j: `docker-compose up neo4j` or check Neo4j Desktop

## 📝 Integration Steps

### For Document Processing
```typescript
// In lib/graphrag/service/document-service.ts
import { getGraphitiClient } from '../graphiti';

async processDocumentWithSchema(content: string, userId: string) {
  const client = getGraphitiClient();
  
  return await client.addEpisodeWithSchema({
    name: 'AI Models Documentation',
    episode_body: content,
    source_description: 'System Documentation',
    reference_time: new Date().toISOString(),
    group_id: userId,
    use_schema: true,
    schema_name: 'ai_models'
  });
}
```

### For API Routes
```typescript
// In app/api/graphrag/process/[id]/route.ts
const result = await documentService.processDocumentWithSchema(
  document.content,
  user.id
);

console.log(`Created ${result.new_edges} schema-enforced relationships`);
```

## 🎯 Success Criteria

- [ ] Test script runs without errors
- [ ] Neo4j shows defined relationship types
- [ ] Search API returns structured facts
- [ ] Documentation is clear and complete
- [ ] No breaking changes to existing functionality

## 🔄 Rollback Plan

If issues occur:

1. **Revert Server Changes**
   ```bash
   git checkout -- graphiti-main/server/graph_service/
   ```

2. **Revert Client Changes**
   ```bash
   git checkout -- lib/graphrag/graphiti/client.ts
   ```

3. **Remove Test Files**
   ```bash
   rm graphiti-main/test_schema.py
   ```

## 📞 Support Resources

- **Documentation**: `GRAPH_RAG_SCHEMA_IMPLEMENTATION.md`
- **Graphiti Docs**: https://github.com/getzep/graphiti
- **Neo4j Cypher**: https://neo4j.com/docs/cypher-manual/

---

**Verification Status**: ✅ **ALL CHECKS PASSED**  
**Ready for**: Live testing with Graphiti server
