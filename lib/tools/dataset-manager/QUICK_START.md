# Dataset Manager - Quick Start Guide

**For developers who need to use the tool immediately.**

## What It Does

Manages conversation datasets for ML training: list, export, validate, delete, and merge conversations.

## Import

```typescript
import datasetManagerTool from '@/lib/tools/dataset-manager';
```

## 6 Operations

### 1. List Datasets

```typescript
const result = await datasetManagerTool.execute({
  operation: 'list',
  user_id: 'your-user-id'
});
// Returns: { total_datasets: 10, datasets: [...] }
```

### 2. Get Statistics

```typescript
const result = await datasetManagerTool.execute({
  operation: 'stats',
  user_id: 'your-user-id'
});
// Returns: { total_messages: 500, evaluation_coverage: 75, ... }
```

### 3. Export Data

```typescript
const result = await datasetManagerTool.execute({
  operation: 'export',
  user_id: 'your-user-id',
  export_format: 'jsonl',  // or 'json', 'csv'
  dataset_filter: {
    min_rating: 4,         // Optional: Filter by rating
    success_only: true,    // Optional: Only successful interactions
    date_from: '2025-01-01T00:00:00Z',  // Optional
    date_to: '2025-12-31T23:59:59Z'     // Optional
  },
  limit: 1000  // Optional: Max 10,000
});
// Returns: { format: 'jsonl', total_records: 1000, data: [...] }
```

### 4. Validate Dataset

```typescript
const result = await datasetManagerTool.execute({
  operation: 'validate',
  user_id: 'your-user-id'
});
// Returns: { is_valid: true, issues: [], recommendations: [] }
```

### 5. Delete Conversations

```typescript
const result = await datasetManagerTool.execute({
  operation: 'delete',
  user_id: 'your-user-id',
  conversation_ids: 'conv-1,conv-2,conv-3',
  confirm_delete: true  // REQUIRED
});
// Returns: { deleted_count: 3 }
```

### 6. Merge Conversations

```typescript
const result = await datasetManagerTool.execute({
  operation: 'merge',
  user_id: 'your-user-id',
  conversation_ids: 'conv-1,conv-2',  // Source conversations
  target_conversation_id: 'conv-3'     // Target conversation
});
// Returns: { merged_count: 2, messages_moved: 48 }
```

## Common Patterns

### Export High-Quality Training Data

```typescript
// Step 1: Validate
const validation = await datasetManagerTool.execute({
  operation: 'validate',
  user_id: userId
});

if (!validation.result.is_valid) {
  console.warn('Issues:', validation.result.issues);
}

// Step 2: Export
const export = await datasetManagerTool.execute({
  operation: 'export',
  user_id: userId,
  export_format: 'jsonl',
  dataset_filter: {
    min_rating: 4,
    success_only: true
  }
});

console.log(`Exported ${export.total_records} high-quality records`);
```

### Clean Up Low-Quality Data

```typescript
// Step 1: List datasets
const list = await datasetManagerTool.execute({
  operation: 'list',
  user_id: userId
});

// Step 2: Find low-quality conversations
const lowQuality = list.datasets
  .filter(d => d.avg_rating < 3)
  .map(d => d.id)
  .join(',');

// Step 3: Delete
if (lowQuality) {
  await datasetManagerTool.execute({
    operation: 'delete',
    user_id: userId,
    conversation_ids: lowQuality,
    confirm_delete: true
  });
}
```

## Key Limits

- **Max Export:** 10,000 records per export
- **Rating Range:** 1-5
- **Cache Timeout:** 5 minutes for list operation

## Security Notes

- **User ID Required:** All operations require valid `user_id`
- **Ownership Verified:** Can only operate on your own conversations
- **Delete Confirmation:** Must set `confirm_delete: true` for delete operation

## Error Handling

```typescript
try {
  const result = await datasetManagerTool.execute({
    operation: 'export',
    user_id: userId
  });
} catch (error) {
  console.error('Export failed:', error.message);
  // Common errors:
  // - "Unauthorized: User does not own conversations"
  // - "Delete operation requires confirm_delete=true"
  // - "No messages found in dataset"
}
```

## Need More Details?

See full documentation: `/lib/tools/dataset-manager/README.md`
