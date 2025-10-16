# Phase 3.7: GraphRAG API Routes - EXECUTION PLAN

## VERIFICATION COMPLETE ✅

### Files to CREATE (All New)

1. ❌ `app/api/graphrag/upload/route.ts` - POST file upload
2. ❌ `app/api/graphrag/documents/route.ts` - GET list documents
3. ❌ `app/api/graphrag/search/route.ts` - POST search
4. ❌ `app/api/graphrag/delete/[id]/route.ts` - DELETE document

### Existing Services Ready

- ✅ `documentService` - uploadAndProcess(), deleteDocument()
- ✅ `documentStorage` - getUserDocuments(), getDocument()
- ✅ `searchService` - search()
- ✅ `graphragConfig` - Configuration available

---

## IMPLEMENTATION PLAN

### ROUTE 1: Upload Endpoint (~80 lines, 4 blocks)

**File**: `app/api/graphrag/upload/route.ts`

#### Block 1: Imports & Auth Helper (20 lines)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { documentService } from '@/lib/graphrag';
import { graphragConfig } from '@/lib/graphrag/config';

/**
 * POST /api/graphrag/upload
 * Upload and process a document for GraphRAG
 */

// Helper to get user from request (simplified - adjust based on auth)
async function getUserId(req: NextRequest): Promise<string | null> {
  // TODO: Implement actual auth check
  // For now, get from header or query param
  const userId = req.headers.get('x-user-id') || null;
  return userId;
}
```

#### Block 2: POST Handler - Validation (25 lines)

```typescript
export async function POST(req: NextRequest) {
  try {
    // Check if GraphRAG is enabled
    if (!graphragConfig.enabled) {
      return NextResponse.json(
        { error: 'GraphRAG is not enabled' },
        { status: 503 }
      );
    }

    // Authenticate user
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
```

#### Block 3: File Validation (20 lines)

```typescript
    // Validate file size
    const maxSize = graphragConfig.processing.maxFileSize;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File size exceeds limit of ${maxSize} bytes` },
        { status: 400 }
      );
    }

    // Validate file type
    const supportedTypes = graphragConfig.processing.supportedTypes;
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !supportedTypes.includes(fileExt as any)) {
      return NextResponse.json(
        { error: `Unsupported file type. Supported: ${supportedTypes.join(', ')}` },
        { status: 400 }
      );
    }
```

#### Block 4: Upload & Process (25 lines)

```typescript
    // Extract metadata from form data
    const tagsStr = formData.get('tags') as string;
    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()) : [];

    // Upload and process
    const result = await documentService.uploadAndProcess({
      userId,
      file,
      metadata: {
        uploadedAt: new Date().toISOString(),
        tags,
      },
    });

    return NextResponse.json({
      success: true,
      document: result.document,
      message: result.message,
    });
  } catch (error) {
    console.error('[API] Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
```

**Verification After Each Block**:

- Run `get_errors` on the file
- Check all imports resolve
- Verify response types

---

### ROUTE 2: List Documents (~60 lines, 3 blocks)

**File**: `app/api/graphrag/documents/route.ts`

#### Block 1: Imports & GET Handler Setup (20 lines)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { documentStorage } from '@/lib/graphrag';
import type { DocumentFileType } from '@/lib/graphrag/types';

/**
 * GET /api/graphrag/documents
 * List user's documents with optional filtering
 */

async function getUserId(req: NextRequest): Promise<string | null> {
  const userId = req.headers.get('x-user-id') || null;
  return userId;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
```

#### Block 2: Query Params & Filtering (25 lines)

```typescript
    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const fileType = searchParams.get('type') as DocumentFileType | null;
    const processedParam = searchParams.get('processed');
    const searchQuery = searchParams.get('search');

    // Get all user documents
    let documents = await documentStorage.getUserDocuments(userId);

    // Filter by type if specified
    if (fileType) {
      documents = documents.filter(doc => doc.fileType === fileType);
    }

    // Filter by processed status if specified
    if (processedParam !== null) {
      const processed = processedParam === 'true';
      documents = documents.filter(doc => doc.processed === processed);
    }

    // Search by filename if specified
    if (searchQuery) {
      documents = documents.filter(doc => 
        doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
```

#### Block 3: Pagination & Response (20 lines)

```typescript
    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    const paginatedDocs = documents.slice(startIndex, endIndex);

    return NextResponse.json({
      documents: paginatedDocs,
      total: documents.length,
      page,
      limit,
      hasMore: endIndex < documents.length,
    });
  } catch (error) {
    console.error('[API] List documents error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
```

---

### ROUTE 3: Search Endpoint (~70 lines, 3 blocks)

**File**: `app/api/graphrag/search/route.ts`

#### Block 1: Imports & POST Handler (20 lines)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { searchService } from '@/lib/graphrag';
import { graphragConfig } from '@/lib/graphrag/config';

/**
 * POST /api/graphrag/search
 * Search documents in knowledge graph
 */

async function getUserId(req: NextRequest): Promise<string | null> {
  const userId = req.headers.get('x-user-id') || null;
  return userId;
}

export async function POST(req: NextRequest) {
  try {
    if (!graphragConfig.enabled) {
      return NextResponse.json(
        { error: 'GraphRAG is not enabled' },
        { status: 503 }
      );
    }
```

#### Block 2: Validation & Parse Request (20 lines)

```typescript
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { query, options } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    if (query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query cannot be empty' },
        { status: 400 }
      );
    }
```

#### Block 3: Execute Search & Return (30 lines)

```typescript
    // Execute search
    console.log('[API] Searching documents for user:', userId, 'query:', query.slice(0, 50));
    const searchResult = await searchService.search(query, userId);

    // Format response
    return NextResponse.json({
      success: true,
      results: {
        context: searchResult.context,
        sources: searchResult.sources,
        metadata: {
          ...searchResult.metadata,
          query,
          userId,
        },
      },
    });
  } catch (error) {
    console.error('[API] Search error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Search failed',
        success: false 
      },
      { status: 500 }
    );
  }
}
```

---

### ROUTE 4: Delete Endpoint (~50 lines, 3 blocks)

**File**: `app/api/graphrag/delete/[id]/route.ts`

#### Block 1: Imports & Type (15 lines)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { documentService, documentStorage } from '@/lib/graphrag';

/**
 * DELETE /api/graphrag/delete/[id]
 * Delete a document
 */

async function getUserId(req: NextRequest): Promise<string | null> {
  const userId = req.headers.get('x-user-id') || null;
  return userId;
}

interface RouteParams {
  params: { id: string };
}
```

#### Block 2: DELETE Handler - Validation (20 lines)

```typescript
export async function DELETE(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const documentId = params.id;

    // Verify document exists and user owns it
    const document = await documentStorage.getDocument(documentId);
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (document.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
```

#### Block 3: Delete & Response (20 lines)

```typescript
    // Parse query params for cleanup options
    const { searchParams } = new URL(req.url);
    const deleteFromStorage = searchParams.get('storage') === 'true';
    const deleteFromNeo4j = searchParams.get('neo4j') === 'true';

    // Delete document
    await documentService.deleteDocument(documentId, {
      deleteFromStorage,
      deleteFromNeo4j,
    });

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    console.error('[API] Delete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Delete failed' },
      { status: 500 }
    );
  }
}
```

---

## EXECUTION SEQUENCE

Execute routes in order:

1. **Upload Route** (4 blocks)
   - Block 1 → Block 2 → Block 3 → Block 4
   - Verify after each block

2. **Documents Route** (3 blocks)
   - Block 1 → Block 2 → Block 3
   - Verify after each block

3. **Search Route** (3 blocks)
   - Block 1 → Block 2 → Block 3
   - Verify after each block

4. **Delete Route** (3 blocks)
   - Block 1 → Block 2 → Block 3
   - Verify after each block

**After each route completed**:

- Run `get_errors` on the file
- Verify 0 compilation errors
- Move to next route

---

## SUCCESS CRITERIA

### Code Quality

- ✅ 0 TypeScript errors across all routes
- ✅ Proper error handling in each route
- ✅ Consistent response formats
- ✅ Proper HTTP status codes

### Functionality

- ✅ Upload endpoint accepts files
- ✅ List endpoint returns documents
- ✅ Search endpoint queries graph
- ✅ Delete endpoint removes documents

### Security

- ✅ User authentication on all routes
- ✅ Ownership verification for delete
- ✅ Input validation
- ✅ Error messages don't leak info

---

**READY TO EXECUTE - Starting with Upload Route, Block 1**
