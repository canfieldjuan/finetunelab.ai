# DocumentUpload Enhancement - Pre-Implementation Analysis

**Date:** October 23, 2025  
**Status:** 🔍 VERIFICATION PHASE - NO CHANGES MADE YET  
**Purpose:** Analyze current implementation before adding drag-and-drop batch upload

---

## 📊 Current Implementation Analysis

### File: `/components/graphrag/DocumentUpload.tsx`

**Current Capabilities:**
- ✅ Single file upload (one at a time)
- ✅ File validation (type, size)
- ✅ Click to select file
- ✅ Progress indicator
- ✅ Error handling
- ✅ Success feedback
- ❌ NO drag and drop (label says it, but not implemented)
- ❌ NO batch upload (only 1 file at a time)

**State Structure:**
```typescript
const [selectedFile, setSelectedFile] = useState<File | null>(null);  // Single file
const [uploading, setUploading] = useState(false);                   // Single upload state
const [progress, setProgress] = useState(0);                         // Single progress bar
const [error, setError] = useState<string | null>(null);             // Single error
const [success, setSuccess] = useState(false);                       // Single success
```

**Props Interface:**
```typescript
interface DocumentUploadProps {
  userId: string;
  onUploadComplete?: () => void;  // Called after upload completes
}
```

**Usage Locations:**
1. `/components/Chat.tsx` (line 1422) - Main chat component
2. `/app/graphrag-demo/page.tsx` (line 64) - Demo page

**Dependencies:**
- `lucide-react` icons: Upload, File, X, CheckCircle, AlertCircle
- `@/lib/supabaseClient` - Auth session
- `/api/graphrag/upload` - Backend endpoint

---

## 🔍 API Endpoint Analysis

### File: `/app/api/graphrag/upload/route.ts`

**Current Behavior:**
- Accepts **single file** via FormData: `formData.get('file')`
- Returns immediately after upload (processing happens in background)
- Can handle one file per request

**Key Finding:** API is designed for single file per request. For batch upload, we have two options:
1. **Sequential uploads:** Loop through files, call API multiple times (SAFER)
2. **Modify API:** Accept multiple files in one request (MORE COMPLEX)

**Recommendation:** Option 1 (Sequential) - No backend changes needed, safer

---

## 🎯 Proposed Changes - Component Level

### 1. State Changes (Breaking Change - Must Update Carefully)

**FROM (Single File):**
```typescript
const [selectedFile, setSelectedFile] = useState<File | null>(null);
const [uploading, setUploading] = useState(false);
const [progress, setProgress] = useState(0);
```

**TO (Multiple Files):**
```typescript
const [selectedFiles, setSelectedFiles] = useState<File[]>([]);  // Array of files
const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());  // Track which files uploading
const [fileProgress, setFileProgress] = useState<Record<string, number>>({});  // Progress per file
const [fileErrors, setFileErrors] = useState<Record<string, string>>({});  // Errors per file
const [fileSuccess, setFileSuccess] = useState<Set<string>>(new Set());  // Successful uploads
```

### 2. Drag and Drop Events (New Addition)

**Need to add:**
```typescript
const [isDragging, setIsDragging] = useState(false);

const handleDragEnter = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(true);
};

const handleDragLeave = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(false);
};

const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(false);
  
  const files = Array.from(e.dataTransfer.files);
  handleMultipleFiles(files);
};
```

### 3. File Selection Handler (Update)

**Current:** Takes first file only
**New:** Take all files from input

```typescript
const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files || []);
  handleMultipleFiles(files);
};

const handleMultipleFiles = (files: File[]) => {
  // Validate each file
  // Add to selectedFiles array
  // Set errors for invalid files
};
```

### 4. Upload Handler (Major Change)

**Current:** Uploads single file
**New:** Loops through files, uploads sequentially

```typescript
const handleUpload = async () => {
  for (const file of selectedFiles) {
    if (fileSuccess.has(file.name)) continue;  // Skip already uploaded
    
    // Upload single file
    await uploadSingleFile(file);
  }
  
  onUploadComplete?.();  // Call after all uploads
};

const uploadSingleFile = async (file: File) => {
  // Track this file's upload
  // Update progress for this file
  // Handle errors for this file
};
```

### 5. UI Changes (New Components)

**Need to add:**
- File list component (show all selected files)
- Individual progress bars per file
- Remove button per file
- Batch progress indicator
- Drag overlay (visual feedback when dragging)

---

## ⚠️ Risk Assessment

### Breaking Changes:
1. ❌ **State structure completely changes** (File → File[])
   - **Risk:** High
   - **Mitigation:** Careful refactoring, preserve all functionality

2. ❌ **Upload logic changes** (single → batch)
   - **Risk:** Medium
   - **Mitigation:** Keep existing API pattern, just loop

### Non-Breaking Changes:
3. ✅ **Props interface unchanged** (same inputs/outputs)
   - **Risk:** None
   - **Impact:** Existing usage in Chat.tsx and demo page won't break

4. ✅ **API unchanged** (still handles single file per request)
   - **Risk:** None
   - **Impact:** Backend stays stable

### Unknown Risks:
5. ❓ **File input `multiple` attribute** - Does it work with hidden input?
   - **Verification Needed:** Test in browser
   - **Fallback:** Keep single file selection as option

6. ❓ **Drag and drop on label** - Does label support drag events?
   - **Verification Needed:** Test implementation
   - **Fallback:** Use div instead of label

---

## 🧪 Testing Strategy

### Must Test:
1. ✅ Single file upload still works (backward compatibility)
2. ✅ Multiple file selection via click
3. ✅ Drag and drop single file
4. ✅ Drag and drop multiple files
5. ✅ File validation (type, size) for each file
6. ✅ Error handling per file (one fails, others continue)
7. ✅ Progress tracking per file
8. ✅ Remove individual files from queue
9. ✅ Cancel upload (if needed)
10. ✅ onUploadComplete callback still fires

### Edge Cases:
- Upload same file twice (should detect duplicate)
- Upload while already uploading (should queue or prevent)
- Remove file while uploading (should cancel that upload)
- Network failure during batch (should retry or show error)

---

## 📝 Implementation Plan (Step-by-Step)

### Phase 1: Add Multi-File State (No UI Changes)
1. Change `selectedFile` → `selectedFiles` array
2. Add file tracking states (progress, errors, success per file)
3. Update validation logic to handle arrays
4. Keep existing UI working with new state

### Phase 2: Add Drag and Drop Events
1. Add drag state tracking
2. Add event handlers (enter, leave, over, drop)
3. Add visual feedback (border color change)
4. Test drag and drop works

### Phase 3: Update File Selection
1. Add `multiple` attribute to input
2. Update handleFileSelect to accept multiple
3. Test file input with multiple selection

### Phase 4: Update Upload Logic
1. Create uploadSingleFile function (extract from current)
2. Update handleUpload to loop through files
3. Add progress tracking per file
4. Add error handling per file

### Phase 5: Enhance UI
1. Show list of selected files (not just one)
2. Add individual remove buttons
3. Add individual progress bars
4. Add batch progress summary
5. Add drag overlay visual

### Phase 6: Testing & Validation
1. Test all scenarios listed above
2. Verify no breaking changes in Chat.tsx usage
3. Verify no breaking changes in demo page
4. Check for TypeScript errors
5. Check for console errors

---

## 🚦 Verification Checklist (Before Implementation)

- [x] Current code read and understood
- [x] Usage locations identified (2 files)
- [x] Props interface verified (no changes needed)
- [x] API endpoint analyzed (single file per request)
- [x] State structure documented
- [x] Breaking changes identified
- [x] Risk assessment completed
- [x] Testing strategy defined
- [x] Implementation plan created
- [ ] **READY TO IMPLEMENT** - Awaiting user approval

---

## 🎯 User Approval Required

**Question 1:** Should we implement this in phases (safer, incremental) or all at once?
**Recommendation:** Phases - verify each step works before moving to next

**Question 2:** Should failed files stop the batch, or continue with remaining files?
**Recommendation:** Continue - show errors but don't stop batch

**Question 3:** Should we add a "Clear All" button to remove all files at once?
**Recommendation:** Yes - useful for starting over

**Question 4:** Maximum files per batch? (Currently no limit)
**Recommendation:** Add limit of 10 files per batch (prevents overwhelming UI)

---

**Status:** ⏸️ AWAITING APPROVAL TO PROCEED WITH IMPLEMENTATION

---

**END OF ANALYSIS**
