# Dataset Management Tool - Quick Reference

**Tool Name:** `dataset_manager`  
**Version:** 1.0.0  
**Status:** ✅ Production Ready  

---

## Operations

### 1. List Datasets

```json
{
  "operation": "list"
}
```

Returns all conversation datasets with statistics.

### 2. Get Statistics

```json
{
  "operation": "stats",
  "dataset_filter": {
    "date_from": "2025-01-01",
    "date_to": "2025-12-31"
  }
}
```

Returns aggregated dataset metrics.

### 3. Export Dataset

```json
{
  "operation": "export",
  "export_format": "jsonl",
  "limit": 1000,
  "dataset_filter": {
    "min_rating": 4,
    "success_only": true
  }
}
```

Exports training data in specified format.

### 4. Validate Dataset

```json
{
  "operation": "validate",
  "dataset_filter": {
    "conversation_ids": ["abc123", "def456"]
  }
}
```

Checks dataset quality and provides recommendations.

---

## Filters

All operations support optional `dataset_filter`:

```typescript
{
  min_rating?: number;        // 1-5
  success_only?: boolean;     // true/false
  date_from?: string;         // ISO date
  date_to?: string;           // ISO date
  conversation_ids?: string[];// specific IDs
}
```

---

## Export Formats

- `jsonl` - Training-ready format (one JSON per line)
- `json` - Standard JSON array
- `csv` - Spreadsheet format

---

## Configuration

```typescript
// lib/tools/dataset-manager/dataset.config.ts
{
  enabled: true,
  maxExportSize: 10000,
  defaultFormat: 'jsonl'
}
```

---

## Error Messages

All errors follow format:

```
[DatasetManager] Category: Detailed message
```

Examples:

- `[DatasetManager] Parameter validation failed: operation is required`
- `[DatasetManager] Invalid operation: invalid_op`
- `[DatasetManager] Execution failed: Database connection error`

---

## Database Schema

### Tables Used

- `conversations` - Dataset grouping
- `messages` - Training data
- `message_evaluations` - Quality labels

### Security

- Row Level Security (RLS) enforced
- Users only see own data
- Size limits prevent abuse

---

## Files

```
lib/tools/dataset-manager/
├── index.ts              # Tool definition
├── dataset.service.ts    # Database operations
├── dataset.config.ts     # Configuration
├── types.ts              # TypeScript types
└── test.ts               # Unit tests
```

---

## Testing

```bash
# Run tests
cd web-ui
npx tsx lib/tools/dataset-manager/test.ts

# Verify registration
node scripts/verify-dataset-tool.js
```

---

## Common Use Cases

**1. Check what data is available:**

```
User: "Show me my datasets"
Tool: { "operation": "list" }
```

**2. Export high-quality data:**

```
User: "Export top-rated conversations"
Tool: { 
  "operation": "export",
  "dataset_filter": { "min_rating": 4 }
}
```

**3. Validate before training:**

```
User: "Is my data ready for training?"
Tool: { "operation": "validate" }
```

---

## Integration

### Chat API

Tool is automatically available in `/api/chat` endpoint.

### Tool Registry

Auto-registered on module load in `lib/tools/registry.ts`.

### Authentication

Uses existing Supabase auth - user context automatic.

---

## Next Tools

**Planned:**

1. Token Analysis Tool
2. Evaluation Metrics Tool
3. Prompt Testing Tool

---

**Last Updated:** October 13, 2025  
**Docs:** See `DATASET_MANAGEMENT_TOOL_COMPLETE.md`
