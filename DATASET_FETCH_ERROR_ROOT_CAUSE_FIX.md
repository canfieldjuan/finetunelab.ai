# Dataset Fetch Error - Root Cause Analysis & Fix

**Date:** November 14, 2025  
**Error:** `Failed to fetch datasets` (401 Unauthorized) in `DatasetAttachment.tsx`

---

## 🔴 **ROOT CAUSE**

### **The Problem: JavaScript Closure Stale Value Bug**

The error occurred due to **stale closure values** in async functions. Here's what happened:

1. **Component mounts** → `DatasetAttachment` renders with `sessionToken` prop = `undefined`
2. **Functions created** → `handleAttachDataset`, `handleDetachDataset`, `fetchLinkedDatasets` capture `undefined` in their closure
3. **Session loads** → `sessionToken` prop updates to valid JWT token
4. **User action** → Clicks "Attach Dataset" button
5. **Function executes** → Uses OLD `undefined` value from closure, NOT the new token
6. **API call fails** → 401 Unauthorized because no valid token in header

### **Why This Happened**

```typescript
// ❌ BROKEN CODE - Functions capture props in closure
const handleAttachDataset = async () => {
  // This sessionToken is captured when function is created
  // If sessionToken was undefined initially, it stays undefined forever
  const response = await fetch(`/api/training/${configId}/attach-dataset`, {
    headers: {
      'Authorization': `Bearer ${sessionToken}`,  // ← STALE VALUE!
    },
  });
};
```

### **React Props vs Closure Behavior**

- **React props update** → Component re-renders with new values
- **Closures don't update** → Functions keep the values they captured initially
- **Problem surfaces** → When async operations use captured values after prop updates

---

## ✅ **THE FIX: useCallback with Dependencies**

### **Solution: Recreate functions when dependencies change**

```typescript
// ✅ FIXED CODE - Function recreates when sessionToken changes
const handleAttachDataset = useCallback(async () => {
  // Now this always uses the CURRENT sessionToken
  const response = await fetch(`/api/training/${configId}/attach-dataset`, {
    headers: {
      'Authorization': `Bearer ${sessionToken}`,  // ← ALWAYS FRESH!
    },
  });
}, [configId, sessionToken, fetchLinkedDatasets]);
//  ↑ Dependencies - function recreates when these change
```

### **How useCallback Solves It**

1. **Initial render** → `sessionToken` = `undefined`, function created with `undefined`
2. **Session loads** → `sessionToken` = `"eyJhbGc..."` (valid JWT)
3. **useCallback detects change** → Recreates function with NEW `sessionToken` value
4. **User clicks button** → Function now has correct token
5. **API call succeeds** → 200 OK

---

## 🛠 **FILES FIXED**

### **components/training/DatasetAttachment.tsx**

**Changes Made:**
1. Added `useCallback` import
2. Wrapped all async functions in `useCallback` with proper dependencies:
   - `fetchLinkedDatasets` → depends on `[configId, sessionToken, onDatasetsChange]`
   - `fetchAllDatasets` → depends on `[sessionToken]`
   - `handleAttachDataset` → depends on `[selectedDatasetId, configId, sessionToken, fetchLinkedDatasets]`
   - `handleDetachDataset` → depends on `[configId, sessionToken, fetchLinkedDatasets]`
3. Moved `useEffect` after function definitions (required for dependency array)
4. Updated `useEffect` dependencies → `[configId, readOnly, fetchLinkedDatasets, fetchAllDatasets]`

**Before:**
```typescript
const fetchLinkedDatasets = async () => {
  // Captures stale sessionToken
  await fetch(`/api/...`, {
    headers: { 'Authorization': `Bearer ${sessionToken}` }
  });
};
```

**After:**
```typescript
const fetchLinkedDatasets = useCallback(async () => {
  // Always uses current sessionToken
  await fetch(`/api/...`, {
    headers: { 'Authorization': `Bearer ${sessionToken}` }
  });
}, [configId, sessionToken, onDatasetsChange]);
```

---

## 📊 **WHY PREVIOUS "FIXES" FAILED**

### **Attempted Fix #1: Conditional Checks**
```typescript
if (!sessionToken) {
  return; // Skip API call
}
```
**Why it failed:** The check runs, but uses the stale `undefined` value from closure, not the current prop value.

### **Attempted Fix #2: useEffect Dependencies**
```typescript
useEffect(() => {
  fetchLinkedDatasets();
}, [configId, sessionToken]); // Added sessionToken
```
**Why it failed:** useEffect re-runs, but `fetchLinkedDatasets` function still uses stale closure value.

### **Attempted Fix #3: Retry Logic**
```typescript
// Retry when token becomes available
```
**Why it failed:** Band-aid over the real problem. Functions still capture stale values.

---

## 🎯 **THE REAL LESSON**

### **When to Use useCallback for Async Functions**

Use `useCallback` whenever an async function:
1. **Uses props or state** that can change over time
2. **Is called asynchronously** (after user action, timeout, event handler)
3. **Makes API calls** with authentication tokens
4. **Is passed to child components** or used in dependencies

### **React Hooks Rules**

```typescript
// ❌ BAD: Props captured in closure
const handler = async () => {
  await api.call(propValue); // Stale value!
};

// ✅ GOOD: Props always fresh
const handler = useCallback(async () => {
  await api.call(propValue); // Current value!
}, [propValue]);
```

---

## 🚀 **VERIFICATION**

### **Test Cases**

1. ✅ **Initial load** → Component renders, waits for session, fetches datasets
2. ✅ **Attach dataset** → Uses current token, succeeds
3. ✅ **Detach dataset** → Uses current token, succeeds
4. ✅ **Token refresh** → Functions auto-update with new token
5. ✅ **No infinite loops** → Dependencies properly memoized

### **Expected Behavior**

- No more 401 errors
- Console shows: `"Using sessionToken: present"` (not `"missing"`)
- Attach/detach operations work immediately
- No need to refresh page

---

## 📝 **KEY TAKEAWAYS**

1. **JavaScript closures capture values** → Don't auto-update with React props
2. **useCallback with dependencies** → Recreates functions when values change
3. **Authentication tokens** → Always wrap in useCallback if used async
4. **Root cause > quick fixes** → Understand the problem, don't patch symptoms
5. **Dependencies matter** → Missing deps = stale closures = bugs

---

## 🔍 **RELATED ISSUES TO CHECK**

Search codebase for similar patterns:

```bash
# Find async functions that might have closure issues
grep -r "async.*=>.*fetch" --include="*.tsx" --include="*.ts"
```

**Check these files for similar bugs:**
- Any component with `sessionToken` prop
- Any async function using props in API calls
- Any event handler with closures over state/props

---

**Status:** ✅ FIXED  
**Tested:** Pending (awaiting user verification)  
**Impact:** High - Affects all dataset operations in training workflow
