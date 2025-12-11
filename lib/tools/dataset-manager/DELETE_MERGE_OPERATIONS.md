# Dataset Manager - Delete & Merge Operations

**Date:** October 21, 2025  
**Version:** 2.0.0

## New Operations

The `dataset-manager` tool now supports two advanced operations for dataset lifecycle management:

### 1. Delete Operation

Removes one or more conversations and all associated messages and evaluations.

**Parameters:**

- `operation`: `'delete'`
- `user_id`: User ID (for testing)
- `conversation_ids`: Comma-separated conversation IDs
- `confirm_delete`: **Must be `true`** (safety check)

**Example:**

```typescript
const result = await datasetManagerTool.execute({
  operation: 'delete',
  user_id: 'your-user-id',
  conversation_ids: 'conv-id-1,conv-id-2',
  confirm_delete: true,
});

// Returns:
// {
//   operation: 'delete',
//   deleted_count: 2,
//   conversation_ids: ['conv-id-1', 'conv-id-2']
// }
```

**Safety Features:**

- Requires explicit `confirm_delete: true` flag
- Verifies user ownership before deletion
- Cascade deletes: evaluations → messages → conversations
- Detailed debug logging at each step

### 2. Merge Operation

Combines multiple conversations into a single target conversation by moving all messages.

**Parameters:**

- `operation`: `'merge'`
- `user_id`: User ID (for testing)
- `conversation_ids`: Comma-separated source conversation IDs
- `target_conversation_id`: Target conversation ID

**Example:**

```typescript
const result = await datasetManagerTool.execute({
  operation: 'merge',
  user_id: 'your-user-id',
  conversation_ids: 'conv-id-1,conv-id-2',
  target_conversation_id: 'target-conv-id',
});

// Returns:
// {
//   operation: 'merge',
//   target_conversation_id: 'target-conv-id',
//   merged_count: 2,
//   messages_moved: 15
// }
```

**Features:**

- Verifies user ownership of all conversations
- Moves messages to target conversation
- Deletes source conversations after successful merge
- Preserves message order and metadata
- Detailed debug logging

## Implementation Details

### Service Layer Methods

#### `deleteConversations(userId, conversationIds)`

1. **Verification:** Checks that user owns all specified conversations
2. **Cascade Delete:**
   - Step 1: Delete all message evaluations
   - Step 2: Delete all messages
   - Step 3: Delete conversations
3. **Returns:** `{ deleted_count: number }`

#### `mergeConversations(userId, sourceIds, targetId)`

1. **Verification:** Checks that user owns all conversations (sources + target)
2. **Message Migration:** Updates all messages to reference target conversation
3. **Cleanup:** Deletes source conversations
4. **Returns:** `{ merged_count: number, messages_moved: number }`

### Debug Logging

Both operations include comprehensive debug logging:

```
[DatasetService] Delete requested for user <user_id>, conversations: [...]
[DatasetService] Step 1: Deleting message evaluations...
[DatasetService] Step 2: Deleting messages...
[DatasetService] Step 3: Deleting conversations...
[DatasetService] Successfully deleted N conversations
```

```
[DatasetService] Merge requested: N conversations into <target_id>
[DatasetService] Moving messages to target conversation...
[DatasetService] Deleting source conversations...
[DatasetService] Successfully merged N conversations, moved M messages
```

## Use Cases

### Delete Operation

- Remove low-quality or test conversations
- Clean up conversations with low ratings
- Delete old or irrelevant data
- Curate datasets by removing outliers

### Merge Operation

- Combine related conversations into larger training sets
- Consolidate fragmented conversations
- Create topic-specific datasets
- Build comprehensive training examples

## Testing

Due to RLS policies, these operations require either:

1. A valid authenticated user session
2. Service role key with proper permissions
3. Test-specific RLS policies for the test user ID

Manual testing workflow:

1. Create test conversations in your Supabase dashboard
2. Note the conversation IDs
3. Test delete operation with `confirm_delete: true`
4. Verify conversations and messages are removed
5. Create more test conversations
6. Test merge operation
7. Verify messages moved and source conversations deleted

## Security Considerations

- **Ownership Verification:** All operations verify user ownership before execution
- **Confirmation Required:** Delete operation requires explicit confirmation flag
- **Transaction Safety:** Operations use Supabase's built-in transaction support
- **Audit Trail:** Comprehensive debug logging for all operations
- **RLS Compliance:** Respects row-level security policies

## Error Handling

Both operations include robust error handling:

```typescript
try {
  const result = await datasetManagerTool.execute({
    operation: 'delete',
    // ...params
  });
} catch (error) {
  // Errors are prefixed with [DatasetManager] or [DatasetService]
  console.error(error.message);
}
```

Common errors:

- `Delete operation requires confirm_delete=true`
- `Unauthorized: User does not own conversations: [...]`
- `Target conversation not found or not owned by user`
- `Failed to delete/merge conversations: <reason>`
