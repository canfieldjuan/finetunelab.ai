# Drag & Drop Batch Upload - Implementation Guide

## 📋 PRE-FLIGHT CHECKLIST

**Analysis Complete:** ✅  
**Risks Identified:** ✅  
**Breaking Changes Documented:** ✅  
**Test Strategy Defined:** ✅  
**Backward Compatibility Plan:** ✅  

---

## 🎯 Implementation Summary

**Goal:** Add drag-and-drop batch upload to DocumentUpload component

**Approach:** Sequential uploads (safer, no backend changes needed)

**Key Changes:**
1. State: Single file → Array of files
2. Events: Add drag & drop handlers
3. Upload: Loop through files sequentially
4. UI: Show list of files with individual progress

**Props:** NO CHANGES (backward compatible)

---

## 🔧 Exact Code Changes Required

### Change 1: Update Imports
**File:** `/components/graphrag/DocumentUpload.tsx`  
**Line:** 4

**Current:**
```typescript
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react';
```

**New (Add Loader2 for individual file spinners):**
```typescript
import { Upload, File, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
```

---

### Change 2: Update State (BREAKING - Core Change)
**File:** `/components/graphrag/DocumentUpload.tsx`  
**Lines:** 20-25

**Current:**
```typescript
const [selectedFile, setSelectedFile] = useState<File | null>(null);
const [uploading, setUploading] = useState(false);
const [progress, setProgress] = useState(0);
const [error, setError] = useState<string | null>(null);
const [success, setSuccess] = useState(false);
```

**New:**
```typescript
// Multi-file state
const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
const [isDragging, setIsDragging] = useState(false);

// Per-file tracking
const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
const [fileProgress, setFileProgress] = useState<Record<string, number>>({});
const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
const [fileSuccess, setFileSuccess] = useState<Set<string>>(new Set());

// Global state
const [isUploading, setIsUploading] = useState(false);
```

---

### Change 3: Add File Validation Helper
**File:** `/components/graphrag/DocumentUpload.tsx`  
**Location:** After state, before handleFileSelect

**New Function:**
```typescript
const validateFile = (file: File): string | null => {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Invalid file type. Please upload PDF, TXT, MD, or DOCX files.';
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`;
  }
  return null;
};
```

---

### Change 4: Add Drag & Drop Handlers
**File:** `/components/graphrag/DocumentUpload.tsx`  
**Location:** After validateFile, before handleFileSelect

**New Functions:**
```typescript
const handleDragEnter = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(true);
};

const handleDragLeave = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  // Only set false if leaving the drop zone entirely
  if (e.currentTarget === e.target) {
    setIsDragging(false);
  }
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
  handleAddFiles(files);
};
```

---

### Change 5: Update File Selection Handler
**File:** `/components/graphrag/DocumentUpload.tsx`  
**Replace:** handleFileSelect function (lines 27-49)

**New:**
```typescript
const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files || []);
  handleAddFiles(files);
};

const handleAddFiles = (files: File[]) => {
  const newErrors: Record<string, string> = {};
  const validFiles: File[] = [];

  files.forEach(file => {
    // Skip if already added
    if (selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
      newErrors[file.name] = 'File already in queue';
      return;
    }

    // Validate file
    const error = validateFile(file);
    if (error) {
      newErrors[file.name] = error;
    } else {
      validFiles.push(file);
    }
  });

  // Update states
  setFileErrors(prev => ({ ...prev, ...newErrors }));
  setSelectedFiles(prev => [...prev, ...validFiles]);
  
  // Clear input
  if (fileInputRef.current) {
    fileInputRef.current.value = '';
  }
};
```

---

### Change 6: Update Upload Handler
**File:** `/components/graphrag/DocumentUpload.tsx`  
**Replace:** handleUpload function (lines 51-95)

**New:**
```typescript
const uploadSingleFile = async (file: File): Promise<void> => {
  const fileName = file.name;
  
  try {
    // Mark as uploading
    setUploadingFiles(prev => new Set(prev).add(fileName));
    setFileProgress(prev => ({ ...prev, [fileName]: 0 }));

    // Get session token
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/graphrag/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Upload failed');
    }

    // Success
    setFileProgress(prev => ({ ...prev, [fileName]: 100 }));
    setFileSuccess(prev => new Set(prev).add(fileName));
    
  } catch (err) {
    setFileErrors(prev => ({
      ...prev,
      [fileName]: err instanceof Error ? err.message : 'Upload failed'
    }));
  } finally {
    setUploadingFiles(prev => {
      const next = new Set(prev);
      next.delete(fileName);
      return next;
    });
  }
};

const handleUpload = async () => {
  if (selectedFiles.length === 0) return;
  
  setIsUploading(true);

  try {
    // Upload files sequentially
    for (const file of selectedFiles) {
      // Skip already uploaded files
      if (fileSuccess.has(file.name)) continue;
      
      await uploadSingleFile(file);
    }

    // Call callback after all uploads
    onUploadComplete?.();

    // Auto-clear successful files after 3 seconds
    setTimeout(() => {
      setSelectedFiles(prev => prev.filter(f => !fileSuccess.has(f.name)));
      setFileSuccess(new Set());
      setFileErrors({});
      setFileProgress({});
    }, 3000);
    
  } finally {
    setIsUploading(false);
  }
};
```

---

### Change 7: Add Remove File Handlers
**File:** `/components/graphrag/DocumentUpload.tsx`  
**Location:** After handleUpload

**New Functions:**
```typescript
const handleRemoveFile = (fileName: string) => {
  setSelectedFiles(prev => prev.filter(f => f.name !== fileName));
  setFileErrors(prev => {
    const next = { ...prev };
    delete next[fileName];
    return next;
  });
  setFileSuccess(prev => {
    const next = new Set(prev);
    next.delete(fileName);
    return next;
  });
};

const handleClearAll = () => {
  setSelectedFiles([]);
  setFileErrors({});
  setFileSuccess(new Set());
  setFileProgress({});
  if (fileInputRef.current) {
    fileInputRef.current.value = '';
  }
};
```

---

### Change 8: Update UI - Drop Zone
**File:** `/components/graphrag/DocumentUpload.tsx`  
**Replace:** Drop zone div (lines 113-136)

**New:**
```tsx
<div className="mb-4">
  <label
    htmlFor="file-upload"
    onDragEnter={handleDragEnter}
    onDragOver={handleDragOver}
    onDragLeave={handleDragLeave}
    onDrop={handleDrop}
    className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
      isDragging
        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
    }`}
  >
    <div className="flex flex-col items-center justify-center pt-5 pb-6">
      <Upload className={`w-10 h-10 mb-2 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
      <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
        <span className="font-semibold">Click to upload</span> or drag and drop
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        PDF, TXT, MD, or DOCX (max 10MB per file)
      </p>
    </div>
    <input
      ref={fileInputRef}
      id="file-upload"
      type="file"
      className="hidden"
      accept=".pdf,.txt,.md,.docx"
      onChange={handleFileSelect}
      disabled={isUploading}
      multiple
    />
  </label>
</div>
```

---

### Change 9: Update UI - File List
**File:** `/components/graphrag/DocumentUpload.tsx`  
**Replace:** Selected file section (lines 138-180)

**New:**
```tsx
{/* Selected Files List */}
{selectedFiles.length > 0 && (
  <div className="mb-4 space-y-2">
    <div className="flex items-center justify-between mb-2">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
      </p>
      <button
        onClick={handleClearAll}
        disabled={isUploading}
        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
      >
        Clear All
      </button>
    </div>
    
    {selectedFiles.map((file) => {
      const isUploading = uploadingFiles.has(file.name);
      const isSuccess = fileSuccess.has(file.name);
      const error = fileErrors[file.name];
      const progress = fileProgress[file.name] || 0;

      return (
        <div
          key={`${file.name}-${file.size}`}
          className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-1">
              {isUploading && <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />}
              {isSuccess && <CheckCircle className="w-5 h-5 text-green-500" />}
              {error && <AlertCircle className="w-5 h-5 text-red-500" />}
              {!isUploading && !isSuccess && !error && (
                <File className="w-5 h-5 text-gray-500" />
              )}
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {file.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                  {isSuccess && ' - Uploaded'}
                  {error && ` - ${error}`}
                </p>
              </div>
            </div>
            
            <button
              onClick={() => handleRemoveFile(file.name)}
              className="text-red-500 hover:text-red-700 ml-2"
              disabled={isUploading}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Bar */}
          {isUploading && (
            <div className="mt-3">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      );
    })}
  </div>
)}
```

---

### Change 10: Update UI - Upload Button
**File:** `/components/graphrag/DocumentUpload.tsx`  
**Replace:** Upload button (lines 201-206)

**New:**
```tsx
{/* Upload Button */}
<button
  onClick={handleUpload}
  disabled={selectedFiles.length === 0 || isUploading}
  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
>
  {isUploading
    ? `Uploading ${uploadingFiles.size} of ${selectedFiles.length}...`
    : `Upload ${selectedFiles.length} Document${selectedFiles.length > 1 ? 's' : ''}`}
</button>
```

---

## ✅ Validation Steps

After implementation:

1. **No TypeScript errors:**
   ```bash
   npx tsc --noEmit
   ```

2. **Check usage sites still work:**
   - `/components/Chat.tsx` line 1422
   - `/app/graphrag-demo/page.tsx` line 64

3. **Test scenarios:**
   - [ ] Single file click upload
   - [ ] Multiple file click upload  
   - [ ] Single file drag & drop
   - [ ] Multiple file drag & drop
   - [ ] Remove individual file
   - [ ] Clear all files
   - [ ] Upload with errors (invalid file)
   - [ ] Upload duplicate file

---

## 🚨 CRITICAL NOTES

1. **NO API CHANGES** - Backend stays exactly the same
2. **Props unchanged** - Backward compatible
3. **Sequential uploads** - Files upload one at a time (safer)
4. **State names changed** - This is the main breaking change internally
5. **Drag events added to label** - Should work, but test in browser

---

**Status:** 📋 READY FOR IMPLEMENTATION

**Approval needed to proceed:** YES / NO

---

**END OF GUIDE**
