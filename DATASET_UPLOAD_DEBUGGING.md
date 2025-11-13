# Dataset Upload Error - Debugging Improvements

## Issue

You were getting a generic 500 error when uploading datasets:

```
POST http://localhost:3000/api/training/dataset 500 (Internal Server Error)
[DatasetManager] Upload failed: {error: 'Upload failed'}
```

## Problem

The error handling in the dataset upload API was too generic - it was catching all errors and returning a simple "Upload failed" message without details about what actually went wrong.

## Fixes Applied

### 1. Enhanced Error Logging

**File:** `app/api/training/dataset/route.ts`

Added detailed error logging to identify the root cause:

```typescript
// Before
catch (error) {
  console.error('[DatasetAPI] Error:', error);
  return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
}

// After
catch (error) {
  console.error('[DatasetAPI] Error:', error);
  const errorMessage = error instanceof Error ? error.message : 'Upload failed';
  const errorStack = error instanceof Error ? error.stack : undefined;
  console.error('[DatasetAPI] Error details:', {
    message: errorMessage,
    stack: errorStack,
    type: typeof error,
    error: error
  });
  return NextResponse.json({ 
    error: errorMessage,
    details: process.env.NODE_ENV === 'development' ? errorStack : undefined
  }, { status: 500 });
}
```

### 2. Validation Error Handling

Added try-catch around validation step:

```typescript
let validation;
try {
  validation = await datasetValidator.validateWithNormalization(file);
} catch (validationError) {
  console.error('[DatasetAPI] Validation threw error:', validationError);
  return NextResponse.json(
    { 
      error: 'Validation failed',
      details: validationError instanceof Error ? validationError.message : 'Unknown validation error'
    },
    { status: 400 }
  );
}
```

### 3. JSONL Conversion Error Handling

Added try-catch around JSONL conversion:

```typescript
let normalizedJsonl;
try {
  normalizedJsonl = normalizedToJsonl(validation.normalized!.data);
  console.log('[DatasetAPI] JSONL conversion successful, length:', normalizedJsonl.length);
} catch (jsonlError) {
  console.error('[DatasetAPI] JSONL conversion failed:', jsonlError);
  return NextResponse.json(
    { 
      error: 'Failed to convert to JSONL',
      details: jsonlError instanceof Error ? jsonlError.message : 'Unknown conversion error'
    },
    { status: 500 }
  );
}
```

## Now You'll See

When you try to upload a dataset again, you'll get:

1. **Specific error messages** instead of generic "Upload failed"
2. **Console logs** showing exactly where the error occurred:
   - Validation stage
   - JSONL conversion stage
   - Storage upload stage
   - Database insert stage

3. **Stack traces** in development mode for easier debugging

## Next Steps

1. **Try uploading the dataset again**
2. **Check the browser console** for detailed error logs
3. **Check the terminal** running the Next.js dev server for server-side logs

The error message will now tell you exactly what's wrong, such as:

- "Validation failed: Invalid JSON format"
- "Failed to convert to JSONL: Missing required field 'messages'"
- "Upload failed: Storage bucket not accessible"
- etc.

## Common Issues & Solutions

### Issue: "Validation failed"

**Cause:** Dataset format is not recognized or has invalid structure  
**Solution:** Check that your dataset follows one of the supported formats (ChatML, ShareGPT, JSONL, DPO, RLHF)

### Issue: "Failed to convert to JSONL"

**Cause:** Normalized data structure is invalid  
**Solution:** Check validation logs to see what format was detected

### Issue: "Upload failed" (Supabase storage)

**Cause:** Supabase storage bucket not configured or permissions issue  
**Solution:**

- Check Supabase storage bucket 'training-datasets' exists
- Verify RLS policies allow authenticated uploads

### Issue: "Database error"

**Cause:** Database insert failed (schema mismatch, constraint violation)  
**Solution:**

- Check database table 'training_datasets' schema
- Verify all required columns exist
- Check for unique constraint violations

## Testing

After these changes, try uploading a dataset and share the error message. It will now be much more specific and actionable!
