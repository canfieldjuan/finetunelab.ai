# Phase 3.5: Document Service - DETAILED IMPLEMENTATION PLAN

**Status**: 🔧 In Progress  
**Estimated Duration**: 45 minutes  
**Files to Create/Update**: 2 files  
**Estimated Lines**: ~250 lines

---

## CURRENT STATE VERIFICATION ✅

### Existing Files Analysis

1. **lib/graphrag/service/document-service.ts** - EXISTS (407 lines)
   - Status: Has 8 TypeScript compilation errors
   - Needs: Type corrections and interface fixes

2. **lib/graphrag/storage/index.ts** - EXISTS (9 lines)
   - Status: Clean, no errors
   - Exports: DocumentStorage, documentStorage

3. **lib/graphrag/parsers/index.ts** - EXISTS (174 lines)
   - Status: Clean, no errors
   - Exports: ParseResult interface, parseDocument function
   - ParseResult structure:

     ```typescript
     interface ParseResult {
       text: string;
       metadata: Record<string, unknown>;
       fileType: DocumentFileType;
     }
     ```

   - NO success/error properties (this is the issue!)

4. **lib/graphrag/graphiti/episode-service.ts** - EXISTS (198 lines)
   - Status: Clean, no errors
   - AddDocumentOptions interface:

     ```typescript
     interface AddDocumentOptions {
       chunkSize?: number;
       metadata?: DocumentMetadata;
     }
     ```

   - addDocumentChunked returns: `Promise<string[]>` (array of episode IDs)

### Identified Issues

#### Error 1: ParseResult Type Mismatch

**Location**: Lines 94-95, 164-165
**Problem**: Code expects `ParseResult` to have `success` and `error` properties, but it doesn't
**Root Cause**: parseDocument() throws errors instead of returning error status
**Solution**: Use try-catch blocks, parseDocument throws on error

#### Error 2: ArrayBuffer vs Buffer

**Location**: Lines 92, 162
**Problem**: `file.arrayBuffer()` returns `ArrayBuffer`, but parseDocument expects `Buffer | File`
**Solution**: Pass File directly to parseDocument, it handles conversion internally

#### Error 3: Wrong Parameter Type for addDocumentChunked

**Location**: Line 335
**Problem**: Passing `chunkSize` number directly, but expects `AddDocumentOptions` object
**Solution**: Pass `{ chunkSize }` object

#### Error 4: Property Access Error

**Location**: Line 338
**Problem**: `result.episodeIds` doesn't exist, `result` IS the array
**Solution**: Return `result` directly, it's already `string[]`

---

## IMPLEMENTATION PHASES

### Phase A: Fix Type Errors in document-service.ts (15 minutes)

#### Sub-task A1: Fix parseDocument calls (Lines 85-95)

**File**: lib/graphrag/service/document-service.ts
**Exact Location**: Line 85-100 (uploadAndProcess method)
**Current Code**:

```typescript
// Download file from Supabase Storage
const { data: fileData, error: downloadError } = await supabase.storage
  .from(this.STORAGE_BUCKET)
  .download(uploadPath);

if (downloadError || !fileData) {
  throw new Error(`Failed to download file: ${downloadError?.message}`);
}

const buffer = await fileData.arrayBuffer();
const parseResult = await parseDocument(buffer, file.name);

if (!parseResult.success || !parseResult.text) {
  throw new Error(parseResult.error || 'Failed to parse document');
}
```

**Fix Required**:

```typescript
// Download file from Supabase Storage
const { data: fileData, error: downloadError } = await supabase.storage
  .from(this.STORAGE_BUCKET)
  .download(uploadPath);

if (downloadError || !fileData) {
  throw new Error(`Failed to download file: ${downloadError?.message}`);
}

// Parse document - parseDocument throws on error
let parseResult;
try {
  parseResult = await parseDocument(fileData, file.name);
} catch (parseError) {
  throw new Error(`Failed to parse document: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
}

if (!parseResult.text) {
  throw new Error('Parsed document has no text content');
}
```

**Verification**:

- Check parseDocument signature accepts File (Blob)
- Confirm try-catch handles thrown errors
- Verify parseResult.text access is valid

---

#### Sub-task A2: Fix processExistingDocument parseDocument call (Lines 155-170)

**File**: lib/graphrag/service/document-service.ts
**Exact Location**: Line 155-170 (processExistingDocument method)
**Current Code**:

```typescript
const { data: fileData, error: downloadError } = await supabase.storage
  .from(this.STORAGE_BUCKET)
  .download(document.uploadPath);

if (downloadError || !fileData) {
  throw new Error(`Failed to download file: ${downloadError?.message}`);
}

const buffer = await fileData.arrayBuffer();
const parseResult = await parseDocument(buffer, document.filename);

if (!parseResult.success || !parseResult.text) {
  throw new Error(parseResult.error || 'Failed to parse document');
}
```

**Fix Required**:

```typescript
const { data: fileData, error: downloadError } = await supabase.storage
  .from(this.STORAGE_BUCKET)
  .download(document.uploadPath);

if (downloadError || !fileData) {
  throw new Error(`Failed to download file: ${downloadError?.message}`);
}

// Parse document - parseDocument throws on error
let parseResult;
try {
  parseResult = await parseDocument(fileData, document.filename);
} catch (parseError) {
  throw new Error(`Failed to parse document: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
}

if (!parseResult.text) {
  throw new Error('Parsed document has no text content');
}
```

**Verification**:

- Same pattern as A1
- Consistent error handling

---

#### Sub-task A3: Fix sendToGraphiti parameter (Lines 330-340)

**File**: lib/graphrag/service/document-service.ts
**Exact Location**: Line 330-340 (sendToGraphiti method)
**Current Code**:

```typescript
const result = await episodeService.addDocumentChunked(
  text,
  userId,
  documentName,
  chunkSize
);

return result.episodeIds;
```

**Fix Required**:

```typescript
const episodeIds = await episodeService.addDocumentChunked(
  text,
  userId,
  documentName,
  { chunkSize }
);

return episodeIds;
```

**Verification**:

- Confirm AddDocumentOptions interface structure
- Verify return type is string[] directly

---

### Phase B: Verify All Imports and Dependencies (10 minutes)

#### Sub-task B1: Check storage/index.ts exports

**File**: lib/graphrag/storage/index.ts
**Verification Needed**:

- ✅ Exports DocumentStorage class
- ✅ Exports documentStorage singleton
- ❓ Should export CreateDocumentData, UpdateDocumentData types?

**Action**: Update exports if needed

---

#### Sub-task B2: Verify type imports in document-service.ts

**File**: lib/graphrag/service/document-service.ts
**Current Imports** (Lines 1-17):

```typescript
import { supabase } from '@/lib/supabaseClient';
import { documentStorage } from '../storage';
import { parseDocument } from '../parsers';
import { episodeService } from '../graphiti';
import { graphragConfig } from '../config';
import type {
  Document,
  DocumentFileType,
  UploadResponse,
  ProcessingStatus,
} from '../types';
```

**Verification**:

- ✅ All imports resolve correctly
- ✅ Types exist in ../types
- ✅ Services properly exported

---

### Phase C: Create Service Module Exports (5 minutes)

#### Sub-task C1: Create lib/graphrag/service/index.ts

**File**: lib/graphrag/service/index.ts (NEW)
**Content**:

```typescript
/**
 * Service Module Exports
 */

export {
  DocumentService,
  documentService,
} from './document-service';

export type {
  UploadOptions,
  ProcessingOptions,
  DeleteOptions,
} from './document-service';
```

**Verification**:

- File created successfully
- No TypeScript errors
- Exports accessible

---

### Phase D: Update Main GraphRAG Index (5 minutes)

#### Sub-task D1: Update lib/graphrag/index.ts

**File**: lib/graphrag/index.ts
**Exact Location**: After storage exports (around line 38)
**Current Code** (ends with):

```typescript
// Storage
export {
  documentStorage,
  type CreateDocumentData,
  type UpdateDocumentData,
} from './storage';
```

**Add After**:

```typescript
// Services
export {
  documentService,
  type UploadOptions,
  type ProcessingOptions,
  type DeleteOptions,
} from './service';
```

**Verification**:

- No circular dependency
- All types resolve
- No compilation errors

---

### Phase E: Final Validation (10 minutes)

#### Sub-task E1: TypeScript Compilation Check

**Command**: Run TypeScript compiler on all modified files
**Files to Check**:

1. lib/graphrag/service/document-service.ts
2. lib/graphrag/service/index.ts
3. lib/graphrag/index.ts
4. lib/graphrag/storage/index.ts

**Expected Result**: 0 errors

---

#### Sub-task E2: Import Chain Verification

**Test**: Verify full import chain works

```typescript
// Should work from root
import { documentService } from '@/lib/graphrag';
import type { UploadOptions } from '@/lib/graphrag';

// Should work from service
import { documentService } from '@/lib/graphrag/service';
```

**Expected Result**: All imports resolve

---

#### Sub-task E3: Dependency Graph Check

**Verify**:

- documentService → documentStorage (✓)
- documentService → parseDocument (✓)
- documentService → episodeService (✓)
- documentService → graphragConfig (✓)
- No circular dependencies

---

## DETAILED FILE CHANGES CHECKLIST

### File 1: lib/graphrag/service/document-service.ts

- [ ] Line 85-100: Fix parseDocument call #1 (uploadAndProcess)
- [ ] Line 155-170: Fix parseDocument call #2 (processExistingDocument)
- [ ] Line 330-340: Fix addDocumentChunked parameters
- [ ] Verify all type imports
- [ ] Run TypeScript compilation check
- [ ] Confirm 0 errors

### File 2: lib/graphrag/service/index.ts (NEW)

- [ ] Create file
- [ ] Add module exports
- [ ] Export DocumentService class
- [ ] Export documentService singleton
- [ ] Export type definitions
- [ ] Run TypeScript compilation check

### File 3: lib/graphrag/index.ts (UPDATE)

- [ ] Add service module exports
- [ ] Export documentService
- [ ] Export UploadOptions type
- [ ] Export ProcessingOptions type
- [ ] Export DeleteOptions type
- [ ] Run TypeScript compilation check

### File 4: lib/graphrag/storage/index.ts (VERIFY)

- [ ] Check current exports
- [ ] Add missing type exports if needed
- [ ] Verify no errors

---

## EXECUTION ORDER

1. **First**: Fix document-service.ts errors (Phase A)
   - Sub-task A1 → A2 → A3
   - Verify each fix with get_errors tool

2. **Second**: Verify dependencies (Phase B)
   - Check all imports resolve
   - Update storage/index.ts if needed

3. **Third**: Create service exports (Phase C)
   - Create service/index.ts
   - Verify exports

4. **Fourth**: Update main index (Phase D)
   - Add service exports to main graphrag index
   - Verify no circular deps

5. **Fifth**: Final validation (Phase E)
   - Run full TypeScript check
   - Test import chains
   - Verify dependency graph

---

## SUCCESS CRITERIA

✅ **All TypeScript errors resolved (0 errors)**
✅ **All imports resolve correctly**
✅ **No circular dependencies**
✅ **Full export chain works: graphrag → service → document-service**
✅ **ParseResult type usage fixed**
✅ **ArrayBuffer/Buffer conversion fixed**
✅ **AddDocumentOptions parameter fixed**
✅ **Episode IDs return type fixed**

---

## ROLLBACK PLAN

If issues occur:

1. Document service already exists, just fixing errors
2. Can revert specific line changes
3. New files (service/index.ts) can be deleted
4. Main index update can be reverted

---

## NEXT PHASE PREVIEW

After Phase 3.5 completion:

- **Phase 3.6**: GraphRAG Service (~30 min) - Chat integration
- **Phase 3.7**: API Routes (~45 min) - REST endpoints
- **Phase 3.8**: React Components (~2 hrs) - UI implementation

---

**Ready to execute? Starting with Phase A: Fix Type Errors**
