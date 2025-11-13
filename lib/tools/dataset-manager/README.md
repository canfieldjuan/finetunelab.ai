# Dataset Manager Tool - Documentation

**Version:** 2.0.0
**Date:** October 22, 2025
**Location:** `/lib/tools/dataset-manager`

## Table of Contents

- [Overview](#overview)
- [What It Does](#what-it-does)
- [Architecture](#architecture)
- [Operations](#operations)
- [How to Use](#how-to-use)
- [When to Use](#when-to-use)
- [When NOT to Use](#when-not-to-use)
- [Configuration](#configuration)
- [Security](#security)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Overview

The **Dataset Manager** is a comprehensive tool for managing conversation datasets in FineTune Lab. It provides operations for listing, analyzing, exporting, validating, deleting, and merging conversation data for machine learning training workflows.

### Key Features

- **Optimized Performance**: Uses Supabase RPC for efficient queries (eliminates N+1 query problems)
- **Advanced Filtering**: Filter by rating, success status, date range, and specific conversations
- **Multiple Export Formats**: JSONL, JSON, and CSV export support
- **Dataset Validation**: Checks quality metrics before training
- **Lifecycle Management**: Delete and merge operations for dataset curation
- **Security First**: User ownership verification on all operations
- **Comprehensive Logging**: Detailed debug output for troubleshooting

---

## What It Does

The Dataset Manager tool enables you to:

1. **List Datasets** - View all conversation datasets with statistics
2. **Get Statistics** - Analyze dataset composition and quality metrics
3. **Export Data** - Generate training files in JSONL/JSON/CSV formats
4. **Validate Quality** - Check dataset health before training
5. **Delete Conversations** - Remove low-quality or test data
6. **Merge Conversations** - Consolidate related conversations into unified datasets

### Data Flow

```
Conversations (Supabase)
    ↓
Messages with Evaluations
    ↓
Dataset Manager Operations
    ↓
Training-Ready Exports (JSONL/JSON/CSV)
```

---

## Architecture

### File Structure

```
lib/tools/dataset-manager/
├── index.ts                    # Tool definition and operation router
├── dataset.service.ts          # Core business logic and database operations
├── dataset.config.ts           # Configuration constants
├── types.ts                    # TypeScript interfaces
├── test.ts                     # Basic functionality tests
├── test-logic.ts               # Advanced filter tests
├── test-delete-merge.ts        # Delete/merge operation tests
├── TESTING_GUIDE.md            # Testing instructions
├── DELETE_MERGE_OPERATIONS.md  # Delete/merge documentation
└── README.md                   # This file
```

### Component Responsibilities

**`index.ts`** - Tool Definition
- Defines tool interface for LLM consumption
- Routes operations to service methods
- Validates parameters
- Formats responses

**`dataset.service.ts`** - Service Layer
- Implements all database operations
- Handles Supabase queries and RPC calls
- Performs ownership verification
- Manages error handling

**`dataset.config.ts`** - Configuration
- Max export size (10,000 records)
- Default format (JSONL)
- Cache timeout (5 minutes)
- Rating thresholds (1-5)

**`types.ts`** - Type Definitions
- `DatasetFilter`: Filtering options
- `DatasetStats`: Aggregated statistics
- `DatasetItem`: Conversation summary
- `DatasetExportRecord`: Export record with evaluations
- `ValidationResult`: Quality validation results

---

## Operations

### 1. List Operation

Lists all conversation datasets with statistics.

**Parameters:**
```typescript
{
  operation: 'list',
  user_id: string
}
```

**Returns:**
```typescript
{
  operation: 'list',
  total_datasets: number,
  datasets: DatasetItem[]
}
```

**Example Response:**
```json
{
  "operation": "list",
  "total_datasets": 5,
  "datasets": [
    {
      "id": "conv-123",
      "title": "Customer Support Training",
      "created_at": "2025-10-20T10:00:00Z",
      "message_count": 24,
      "assistant_count": 12,
      "evaluation_count": 10,
      "avg_rating": 4.2
    }
  ]
}
```

**Use Case:** Quick overview of available datasets before export or training.

**Performance:** Optimized with RPC call `get_conversation_stats` - single database query.

---

### 2. Stats Operation

Aggregates statistics across all or filtered conversations.

**Parameters:**
```typescript
{
  operation: 'stats',
  user_id: string,
  dataset_filter?: {
    min_rating?: number,
    success_only?: boolean,
    date_from?: string,
    date_to?: string,
    conversation_ids?: string[]
  }
}
```

**Returns:**
```typescript
{
  operation: 'stats',
  stats: {
    total_conversations: number,
    total_messages: number,
    user_messages: number,
    assistant_messages: number,
    evaluated_messages: number,
    evaluation_coverage: number,  // Percentage
    avg_rating: number | null,
    successful_interactions: number,
    failed_interactions: number
  }
}
```

**Example Response:**
```json
{
  "operation": "stats",
  "stats": {
    "total_conversations": 10,
    "total_messages": 240,
    "user_messages": 120,
    "assistant_messages": 120,
    "evaluated_messages": 180,
    "evaluation_coverage": 75,
    "avg_rating": 4.1
  }
}
```

**Use Case:** Understand dataset composition before training, identify gaps in evaluations.

---

### 3. Export Operation

Exports conversation data in training-ready formats.

**Parameters:**
```typescript
{
  operation: 'export',
  user_id: string,
  export_format?: 'jsonl' | 'json' | 'csv',  // Default: 'jsonl'
  dataset_filter?: {
    min_rating?: number,           // Filter messages with rating >= value
    success_only?: boolean,        // Only export successful interactions
    date_from?: string,            // ISO date string
    date_to?: string,              // ISO date string
    conversation_ids?: string[]    // Specific conversations
  },
  limit?: number                   // Max 10,000
}
```

**Returns:**
```typescript
{
  operation: 'export',
  format: 'jsonl' | 'json' | 'csv',
  total_records: number,
  data: DatasetExportRecord[],
  generated_at: string
}
```

**Export Record Structure:**
```typescript
{
  id: string,
  conversation_id: string,
  role: 'user' | 'assistant',
  content: string,
  created_at: string,
  token_count: number | null,
  model: string | null,
  temperature: number | null,
  rating: number | null,        // From message_evaluations
  success: boolean | null,      // From message_evaluations
  failure_tags: string[] | null, // From message_evaluations
  notes: string | null          // From message_evaluations
}
```

**Example JSONL Export:**
```jsonl
{"id":"msg-1","conversation_id":"conv-1","role":"user","content":"How do I reset my password?","rating":5,"success":true}
{"id":"msg-2","conversation_id":"conv-1","role":"assistant","content":"Click the 'Forgot Password' link...","rating":5,"success":true}
```

**Use Cases:**
- Generate training data for fine-tuning
- Export high-quality interactions (min_rating >= 4)
- Extract successful interactions for positive examples
- Create evaluation datasets for model testing

**Performance Notes:**
- Max export size: 10,000 records (configurable in `dataset.config.ts`)
- Filters applied at query level for date and conversation_ids
- Filters applied in-memory for min_rating and success_only
- Records ordered by created_at (ascending)

---

### 4. Validate Operation

Checks dataset quality before training.

**Parameters:**
```typescript
{
  operation: 'validate',
  user_id: string,
  dataset_filter?: DatasetFilter
}
```

**Returns:**
```typescript
{
  operation: 'validate',
  result: {
    is_valid: boolean,
    total_messages: number,
    user_assistant_ratio: number,      // Ideal: ~1.0
    evaluation_coverage: number,       // Percentage
    rating_distribution: {},
    issues: string[],
    recommendations: string[]
  }
}
```

**Validation Checks:**

1. **Message Count**: Ensures dataset is not empty
2. **User/Assistant Ratio**: Checks balance (ideal: 0.8-1.2)
3. **Evaluation Coverage**: Warns if < 50%

**Example Response:**
```json
{
  "operation": "validate",
  "result": {
    "is_valid": false,
    "total_messages": 100,
    "user_assistant_ratio": 0.45,
    "evaluation_coverage": 35,
    "issues": [
      "Imbalanced user/assistant ratio: 0.45",
      "Low evaluation coverage: 35%"
    ],
    "recommendations": [
      "Aim for 1:1 ratio of user to assistant messages",
      "Evaluate more messages to improve training quality"
    ]
  }
}
```

**Use Case:** Pre-flight check before exporting or training to catch quality issues early.

---

### 5. Delete Operation

Removes conversations and all associated data.

**Parameters:**
```typescript
{
  operation: 'delete',
  user_id: string,
  conversation_ids: string[],  // Comma-separated in tool interface
  confirm_delete: true         // REQUIRED - safety check
}
```

**Returns:**
```typescript
{
  operation: 'delete',
  deleted_count: number,
  conversation_ids: string[]
}
```

**Example Usage:**
```typescript
const result = await datasetManagerTool.execute({
  operation: 'delete',
  user_id: 'user-uuid',
  conversation_ids: 'conv-1,conv-2,conv-3',
  confirm_delete: true
});
// Returns: { deleted_count: 3, conversation_ids: ['conv-1', 'conv-2', 'conv-3'] }
```

**Cascade Delete Process:**
1. Verify user ownership of all conversations
2. Delete message evaluations for all messages
3. Delete all messages in conversations
4. Delete conversations

**Safety Features:**
- Requires explicit `confirm_delete: true` flag
- Ownership verification before deletion
- Comprehensive logging at each step
- Atomic operation (all or nothing)

**Use Cases:**
- Remove low-quality conversations
- Clean up test data
- Delete conversations with low ratings
- Curate datasets by removing outliers

---

### 6. Merge Operation

Combines multiple conversations into a single conversation.

**Parameters:**
```typescript
{
  operation: 'merge',
  user_id: string,
  conversation_ids: string[],      // Source conversations (comma-separated)
  target_conversation_id: string   // Target conversation
}
```

**Returns:**
```typescript
{
  operation: 'merge',
  target_conversation_id: string,
  merged_count: number,
  messages_moved: number
}
```

**Example Usage:**
```typescript
const result = await datasetManagerTool.execute({
  operation: 'merge',
  user_id: 'user-uuid',
  conversation_ids: 'conv-1,conv-2',
  target_conversation_id: 'conv-target'
});
// Returns: { merged_count: 2, messages_moved: 48, target_conversation_id: 'conv-target' }
```

**Merge Process:**
1. Verify user ownership of all conversations (sources + target)
2. Move all messages from source conversations to target
3. Delete source conversations
4. Preserve message metadata and evaluations

**Use Cases:**
- Combine related conversations into comprehensive training examples
- Consolidate fragmented conversations
- Build topic-specific datasets
- Create larger context windows for training

---

## How to Use

### Installation

The tool is already integrated into FineTune Lab. No additional installation required.

### Basic Usage

```typescript
import datasetManagerTool from '@/lib/tools/dataset-manager';

// List datasets
const listResult = await datasetManagerTool.execute({
  operation: 'list',
  user_id: 'your-user-id'
});

// Export high-quality data
const exportResult = await datasetManagerTool.execute({
  operation: 'export',
  user_id: 'your-user-id',
  export_format: 'jsonl',
  dataset_filter: {
    min_rating: 4,
    success_only: true
  }
});

// Validate before training
const validationResult = await datasetManagerTool.execute({
  operation: 'validate',
  user_id: 'your-user-id'
});
```

### Common Workflows

**Workflow 1: Export Training Data**
```typescript
// Step 1: Check dataset quality
const validation = await datasetManagerTool.execute({
  operation: 'validate',
  user_id: userId
});

if (!validation.result.is_valid) {
  console.warn('Dataset quality issues:', validation.result.issues);
  console.log('Recommendations:', validation.result.recommendations);
}

// Step 2: Export high-quality data
const export = await datasetManagerTool.execute({
  operation: 'export',
  user_id: userId,
  export_format: 'jsonl',
  dataset_filter: { min_rating: 4 }
});

console.log(`Exported ${export.total_records} records`);
```

**Workflow 2: Dataset Cleanup**
```typescript
// Step 1: List datasets
const list = await datasetManagerTool.execute({
  operation: 'list',
  user_id: userId
});

// Step 2: Identify low-quality conversations
const lowQuality = list.datasets.filter(d =>
  d.avg_rating < 3 || d.evaluation_count === 0
);

// Step 3: Delete low-quality data
await datasetManagerTool.execute({
  operation: 'delete',
  user_id: userId,
  conversation_ids: lowQuality.map(d => d.id).join(','),
  confirm_delete: true
});
```

**Workflow 3: Consolidate Related Conversations**
```typescript
// Step 1: List datasets
const list = await datasetManagerTool.execute({
  operation: 'list',
  user_id: userId
});

// Step 2: Identify related conversations (e.g., same topic)
const supportConvs = list.datasets.filter(d =>
  d.title.toLowerCase().includes('support')
);

// Step 3: Merge into first conversation
const [target, ...sources] = supportConvs;
await datasetManagerTool.execute({
  operation: 'merge',
  user_id: userId,
  conversation_ids: sources.map(s => s.id).join(','),
  target_conversation_id: target.id
});
```

---

## When to Use

### ✅ Use Dataset Manager When:

1. **Preparing Training Data**
   - Exporting conversations for fine-tuning
   - Filtering high-quality interactions
   - Creating evaluation datasets

2. **Quality Assurance**
   - Checking dataset balance before training
   - Validating evaluation coverage
   - Identifying data quality issues

3. **Dataset Curation**
   - Removing low-quality conversations
   - Consolidating related discussions
   - Building topic-specific datasets

4. **Analytics & Reporting**
   - Understanding dataset composition
   - Tracking evaluation progress
   - Monitoring conversation quality

5. **Data Management**
   - Cleaning up test conversations
   - Organizing conversations by topic
   - Managing dataset lifecycle

---

## When NOT to Use

### ❌ Do NOT Use Dataset Manager When:

1. **Exporting > 10,000 Records**
   - **Limitation:** Max export size is 10,000 records
   - **Alternative:** Implement custom pagination or batch export
   - **Why:** Memory and performance constraints

2. **Real-Time Data Requirements**
   - **Limitation:** RPC calls may have 5-minute cache
   - **Alternative:** Direct Supabase queries for real-time needs
   - **Why:** Optimization trades freshness for speed

3. **Cross-User Operations**
   - **Limitation:** Security enforces user ownership
   - **Alternative:** Use service role for admin operations
   - **Why:** Prevents unauthorized data access

4. **Without Authentication**
   - **Requirement:** Valid `user_id` is mandatory
   - **Alternative:** Authenticate first, then use tool
   - **Why:** Row-level security (RLS) policies

5. **Bulk Delete Without Confirmation**
   - **Requirement:** Delete requires `confirm_delete: true`
   - **Alternative:** Explicitly set confirmation flag
   - **Why:** Prevents accidental data loss

6. **Complex Aggregations**
   - **Limitation:** Tool provides basic stats only
   - **Alternative:** Custom SQL queries for complex analytics
   - **Why:** Tool optimized for common use cases

7. **Streaming Large Exports**
   - **Limitation:** Returns all data in memory
   - **Alternative:** Implement streaming export for very large datasets
   - **Why:** Memory constraints on large datasets

---

## Configuration

### Default Configuration

Location: `dataset.config.ts`

```typescript
export const datasetConfig = {
  enabled: true,              // Tool enabled/disabled
  maxExportSize: 10000,       // Maximum records per export
  defaultFormat: 'jsonl',     // Default export format
  cacheTimeout: 300000,       // 5 minutes (milliseconds)
  minRatingThreshold: 1,      // Minimum valid rating
  maxRatingThreshold: 5,      // Maximum valid rating
};
```

### Customizing Configuration

To change configuration:

1. Edit `/lib/tools/dataset-manager/dataset.config.ts`
2. Update desired values
3. Restart application

**Example: Increase Export Limit**
```typescript
export const datasetConfig = {
  // ... other settings
  maxExportSize: 50000,  // Changed from 10,000
};
```

**Note:** Increasing export limit may impact performance and memory usage.

---

## Security

### Security Features

1. **User Ownership Verification**
   - All operations verify user owns the data
   - Prevents cross-user data access
   - Implemented at service layer

2. **Row-Level Security (RLS)**
   - Respects Supabase RLS policies
   - Database-level security enforcement
   - Automatic with authenticated requests

3. **Delete Confirmation**
   - Requires explicit `confirm_delete: true`
   - Prevents accidental deletions
   - Additional safety layer

4. **Comprehensive Audit Logging**
   - All operations logged with debug output
   - User ID, operation, and affected records tracked
   - Useful for security audits

5. **No Default User Fallback**
   - Version 2.0.0 removed dummy user IDs
   - Forces explicit authentication
   - Security-first design

### Best Practices

**1. Always Authenticate**
```typescript
// ❌ BAD: No user_id
const result = await datasetManagerTool.execute({
  operation: 'list'
});

// ✅ GOOD: Authenticated
const result = await datasetManagerTool.execute({
  operation: 'list',
  user_id: authenticatedUserId
});
```

**2. Confirm Destructive Operations**
```typescript
// ❌ BAD: Will fail
const result = await datasetManagerTool.execute({
  operation: 'delete',
  conversation_ids: 'conv-1,conv-2'
});

// ✅ GOOD: Explicit confirmation
const result = await datasetManagerTool.execute({
  operation: 'delete',
  conversation_ids: 'conv-1,conv-2',
  confirm_delete: true
});
```

**3. Validate Ownership**
```typescript
// Get user's conversations first
const list = await datasetManagerTool.execute({
  operation: 'list',
  user_id: userId
});

// Only operate on owned conversations
const ownedIds = list.datasets.map(d => d.id);
```

---

## Testing

### Test Requirements

**Environment Variables:**
```bash
# .env file
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
TEST_USER_ID=your-actual-user-uuid
```

**Why TEST_USER_ID?**
- v2.0.0 requires real user IDs (no dummy fallbacks)
- Tests run against production RLS policies
- More realistic testing scenarios

### Running Tests

**Basic Functionality Tests:**
```bash
npx tsx lib/tools/dataset-manager/test.ts
```

**Advanced Filter Tests:**
```bash
npx tsx lib/tools/dataset-manager/test-logic.ts
```

**Delete/Merge Tests:**
```bash
npx tsx lib/tools/dataset-manager/test-delete-merge.ts
```

### Test Coverage

**Tested Operations:**
- ✅ List datasets
- ✅ Get statistics
- ✅ Export with filters (min_rating, success_only)
- ✅ Validate dataset quality
- ✅ Delete conversations with confirmation
- ✅ Merge conversations

**Test Data Cleanup:**
All tests automatically clean up created data after completion.

### Manual Testing

For custom testing scenarios:

```typescript
import datasetManagerTool from './index';

const userId = 'your-user-id'; // From Supabase auth

// Create test conversation
const conv = await supabase.from('conversations').insert({
  user_id: userId,
  title: 'Test Conversation'
}).select().single();

// Test operations
const result = await datasetManagerTool.execute({
  operation: 'list',
  user_id: userId
});

console.log('Test result:', result);

// Cleanup
await supabase.from('conversations').delete().eq('id', conv.data.id);
```

---

## Troubleshooting

### Common Errors

**Error: "Unauthorized: User does not own conversations"**

**Cause:** Attempting to operate on conversations owned by different user

**Solution:**
```typescript
// Verify ownership first
const list = await datasetManagerTool.execute({
  operation: 'list',
  user_id: userId
});

// Only use owned conversation IDs
const ownedIds = list.datasets.map(d => d.id);
```

---

**Error: "Delete operation requires confirm_delete=true"**

**Cause:** Missing or false confirmation flag

**Solution:**
```typescript
await datasetManagerTool.execute({
  operation: 'delete',
  user_id: userId,
  conversation_ids: 'conv-1',
  confirm_delete: true  // Required
});
```

---

**Error: "No messages found in dataset"**

**Cause:** Attempting to validate/export empty dataset

**Solution:**
1. Check if user has any conversations
2. Verify date filters aren't excluding all data
3. Ensure conversations have messages

---

**Error: "Failed to list datasets via RPC"**

**Cause:** Missing or incorrect Supabase RPC function

**Solution:**
1. Verify `get_conversation_stats` RPC exists in database
2. Check RPC function permissions
3. Review Supabase connection settings

---

**Error: "TEST_USER_ID environment variable is required"**

**Cause:** Running tests without TEST_USER_ID set

**Solution:**
```bash
# Add to .env file
TEST_USER_ID=your-user-uuid-here
```

---

### Performance Issues

**Slow Export Operations**

**Possible Causes:**
- Large dataset (approaching 10,000 record limit)
- Complex filters requiring in-memory processing
- Network latency to Supabase

**Solutions:**
1. Reduce export size with more specific filters
2. Export in smaller batches
3. Use date range filters to limit scope

---

**High Memory Usage**

**Possible Causes:**
- Exporting maximum records (10,000)
- Multiple concurrent exports

**Solutions:**
1. Lower export limit in configuration
2. Implement pagination for very large datasets
3. Export during off-peak hours

---

### Debug Logging

Enable comprehensive debug output:

```typescript
// All service methods include console.debug statements
// Example output:
[DatasetService] Calling get_conversation_stats for user: abc123
[DatasetService] Received 10 records.
[DatasetService] Fetched 240 messages before filtering
[DatasetService] Applying min_rating filter: 4
[DatasetService] Returning 180 records after filtering
```

**View Logs:**
- Browser console (for client-side usage)
- Server logs (for API usage)
- Test output (for testing)

---

## Version History

### Version 2.0.0 (Current)
- **Breaking Change:** Removed default user_id fallback (security enhancement)
- Added delete and merge operations
- Implemented ownership verification on all operations
- Optimized list operation with RPC
- Enhanced filtering (min_rating, success_only)
- Comprehensive test suite

### Version 1.0.0
- Initial release
- Basic list, stats, export, validate operations
- Simple filtering support

---

## Support

For issues, questions, or contributions:

1. **Documentation:** This README and related .md files in `/lib/tools/dataset-manager`
2. **Code:** Review `index.ts` and `dataset.service.ts` for implementation details
3. **Tests:** Run existing tests or create new ones for specific scenarios
4. **Logs:** Check debug output for detailed operation flow

---

## References

- **Main Tool Definition:** `/lib/tools/dataset-manager/index.ts`
- **Service Implementation:** `/lib/tools/dataset-manager/dataset.service.ts`
- **Type Definitions:** `/lib/tools/dataset-manager/types.ts`
- **Configuration:** `/lib/tools/dataset-manager/dataset.config.ts`
- **Testing Guide:** `/lib/tools/dataset-manager/TESTING_GUIDE.md`
- **Delete/Merge Docs:** `/lib/tools/dataset-manager/DELETE_MERGE_OPERATIONS.md`

---

**Last Updated:** October 22, 2025
**Maintained By:** FineTune Lab Development Team
