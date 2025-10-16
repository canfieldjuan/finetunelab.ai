# Phase 9: Evaluation UI Implementation

**Feature:** Add rating/tagging interface for human evaluations
**Estimated Time:** 1-2 hours
**Priority:** HIGH - Enables human-in-the-loop training
**Status:** Planning Complete - Ready for Implementation

---

## Table of Contents
1. [Overview](#overview)
2. [Current State Analysis](#current-state-analysis)
3. [Implementation Plan](#implementation-plan)
4. [UI Design](#ui-design)
5. [Verification Checklist](#verification-checklist)

---

## Overview

### Objective
Add a comprehensive evaluation UI to the existing chat interface, allowing users to rate responses with 1-5 stars, mark success/failure, tag failure types, and provide detailed notes. This data feeds into the training pipeline via the Phase 7 evaluation API.

### Success Criteria
- Evaluation modal opens from message actions
- 1-5 star rating system
- Success/failure toggle
- Failure tag checkboxes
- Notes text area
- Saves to message_evaluations table via /api/evaluate
- No breaking changes to existing thumbs up/down
- Mobile responsive

### Key Principle
**Never assume - always verify before implementing**

---

## Current State Analysis

### Existing Feedback System (Verified)

**File:** `components/Chat.tsx`

**Current Features:**
- Line 54: `const [feedback, setFeedback] = useState<{[key: string]: number}>({});`
- Line 177-198: `handleFeedback()` - Saves to old `feedback` table
- Lines 977-1010: Thumbs up/down buttons below assistant messages
- Uses simple 1/-1 values
- Stored in `feedback` table (old schema)

**Message Display:**
- Lines 932-1016: Message rendering with role-based styling
- Lines 960-1013: Assistant message actions (Copy, Thumbs up, Thumbs down)
- Actions displayed below message bubble

**Current Action Layout:**
```
[Message Bubble]
[Copy] [👍 Like] [👎 Dislike]
```

### Evaluation API (Phase 7)

**Endpoint:** POST `/api/evaluate`
**File:** `app/api/evaluate/route.ts`

**Request Body:**
```typescript
{
  messageId: string;
  rating: number;        // 1-5
  success: boolean;
  failureTags: string[];
  notes: string;
  expectedBehavior?: string;
  actualBehavior?: string;
}
```

**Database Table:** `message_evaluations`
```sql
id UUID
message_id UUID
evaluator_id UUID
rating INTEGER (1-5)
success BOOLEAN
failure_tags TEXT[]
notes TEXT
expected_behavior TEXT
actual_behavior TEXT
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

---

## UI Design

### Evaluation Modal

**Visual Design:**
```
┌─────────────────────────────────────────────┐
│  Evaluate Response                    [×]   │
├─────────────────────────────────────────────┤
│                                             │
│  Rating *                                   │
│  ☆ ☆ ☆ ☆ ☆  (hover to preview)            │
│  ★ ★ ★ ★ ☆  (selected: 4 stars)           │
│                                             │
│  ┌─────────────────────────────────────┐  │
│  │ ☑ Successful Response                │  │
│  │ ☐ Failed Response                    │  │
│  └─────────────────────────────────────┘  │
│                                             │
│  Failure Tags (select all that apply)      │
│  ┌─────────────────────────────────────┐  │
│  │ ☐ Hallucination                      │  │
│  │ ☐ Wrong Tool Used                    │  │
│  │ ☐ Incomplete Answer                  │  │
│  │ ☐ Incorrect Information              │  │
│  │ ☐ Off-Topic                          │  │
│  │ ☐ Tone Issues                        │  │
│  └─────────────────────────────────────┘  │
│                                             │
│  Notes (optional)                           │
│  ┌─────────────────────────────────────┐  │
│  │                                      │  │
│  │  [Multi-line text area]              │  │
│  │                                      │  │
│  └─────────────────────────────────────┘  │
│                                             │
│  Expected Behavior (optional)               │
│  ┌─────────────────────────────────────┐  │
│  │ What should have happened?           │  │
│  └─────────────────────────────────────┘  │
│                                             │
│            [Cancel]  [Submit Rating]        │
└─────────────────────────────────────────────┘
```

### Updated Message Actions

**New Layout:**
```
[Message Bubble]
[Copy] [👍] [👎] [⭐ Rate]  ← Add new "Rate" button
```

**Behavior:**
- Thumbs up/down: Quick feedback (existing)
- Rate button: Opens detailed evaluation modal (new)
- Modal can be opened even after thumbs up/down given
- Submitting evaluation updates existing thumbs feedback if any

---

## Implementation Plan

### Phase 9.1: Create EvaluationModal Component

**File:** `components/evaluation/EvaluationModal.tsx` (NEW FILE)

**Implementation:**
```typescript
"use client";
import React, { useState } from "react";
import { Button } from "../ui/button";
import { Star, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface EvaluationModalProps {
  messageId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const FAILURE_TAGS = [
  'hallucination',
  'wrong_tool',
  'incomplete',
  'incorrect_info',
  'off_topic',
  'tone_issues',
];

export function EvaluationModal({ messageId, onClose, onSuccess }: EvaluationModalProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [success, setSuccess] = useState<boolean>(true);
  const [failureTags, setFailureTags] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [expectedBehavior, setExpectedBehavior] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    // Validation
    if (rating === 0) {
      setError("Please select a rating");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      // Call evaluation API
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messageId,
          rating,
          success,
          failureTags,
          notes: notes.trim() || undefined,
          expectedBehavior: expectedBehavior.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit evaluation");
      }

      console.log("[Evaluation] Successfully submitted rating:", rating);
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("[Evaluation] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFailureTag = (tag: string) => {
    setFailureTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl max-w-md w-full m-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-bold">Evaluate Response</h3>
          <Button onClick={onClose} variant="ghost" size="sm">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Star Rating */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Rating <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= (hoverRating || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {rating} star{rating !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Success Toggle */}
          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSuccess(true)}
                className={`flex-1 p-2 rounded border text-sm font-medium ${
                  success
                    ? "bg-green-50 border-green-500 text-green-700"
                    : "border-gray-300 text-gray-700"
                }`}
              >
                ✓ Successful
              </button>
              <button
                type="button"
                onClick={() => setSuccess(false)}
                className={`flex-1 p-2 rounded border text-sm font-medium ${
                  !success
                    ? "bg-red-50 border-red-500 text-red-700"
                    : "border-gray-300 text-gray-700"
                }`}
              >
                ✗ Failed
              </button>
            </div>
          </div>

          {/* Failure Tags */}
          {!success && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Failure Tags
              </label>
              <div className="space-y-2">
                {FAILURE_TAGS.map((tag) => (
                  <label
                    key={tag}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={failureTags.includes(tag)}
                      onChange={() => toggleFailureTag(tag)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">
                      {tag.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional feedback..."
              rows={3}
              className="w-full p-2 border rounded text-sm"
            />
          </div>

          {/* Expected Behavior */}
          {!success && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Expected Behavior (optional)
              </label>
              <textarea
                value={expectedBehavior}
                onChange={(e) => setExpectedBehavior(e.target.value)}
                placeholder="What should have happened?"
                rows={2}
                className="w-full p-2 border rounded text-sm"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t">
          <Button onClick={onClose} variant="outline" className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
            className="flex-1"
          >
            {submitting ? "Submitting..." : "Submit Rating"}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

**Features:**
- ✅ Star rating with hover preview
- ✅ Success/failure toggle
- ✅ Failure tags (only shown if failed)
- ✅ Notes text area
- ✅ Expected behavior (only for failures)
- ✅ Validation (rating required)
- ✅ Loading states
- ✅ Error handling
- ✅ Responsive design

---

### Phase 9.2: Update Chat.tsx

**File:** `components/Chat.tsx`

**Change 1: Add imports (top of file)**
```typescript
import { Star } from 'lucide-react';  // Add to existing lucide imports
import { EvaluationModal } from './evaluation/EvaluationModal';
```

**Change 2: Add state for evaluation modal (around line 63)**
```typescript
const [showUserSettings, setShowUserSettings] = useState(false);
const [showEvaluationModal, setShowEvaluationModal] = useState<string | null>(null);  // NEW
const messagesContainerRef = useRef<HTMLDivElement>(null);
```

**Change 3: Add "Rate" button (around line 1004, after thumbs down)**
```typescript
                      {/* Thumbs down button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleFeedback(msg.id, -1)}
                        className={`h-7 w-7 p-0 hover:bg-red-50 ${
                          feedback[msg.id] === -1
                            ? "bg-red-100 text-red-600"
                            : "hover:bg-gray-100"
                        }`}
                        aria-label="Thumbs down"
                      >
                        <span className="text-xs">👎</span>
                      </Button>
                      {/* NEW: Rate button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowEvaluationModal(msg.id)}
                        className="h-7 w-7 p-0 hover:bg-yellow-50"
                        aria-label="Rate response"
                        title="Detailed rating"
                      >
                        <Star className="w-4 h-4 text-yellow-500" />
                      </Button>
                      {/* Feedback status */}
```

**Change 4: Add modal at end of component (around line 1163, before final closing tag)**
```typescript
      {/* Evaluation Modal */}
      {showEvaluationModal && (
        <EvaluationModal
          messageId={showEvaluationModal}
          onClose={() => setShowEvaluationModal(null)}
          onSuccess={() => {
            console.log('[Chat] Evaluation submitted successfully');
            setShowEvaluationModal(null);
          }}
        />
      )}
    </div>
  );
}
```

---

### Phase 9.3: Create Component Index

**File:** `components/evaluation/index.ts` (NEW FILE)

```typescript
export { EvaluationModal } from './EvaluationModal';
```

---

## Verification Checklist

### Code Changes
- [ ] Create EvaluationModal.tsx component
- [ ] Create components/evaluation/index.ts
- [ ] Update Chat.tsx imports
- [ ] Add showEvaluationModal state
- [ ] Add Star button to message actions
- [ ] Add EvaluationModal render at end
- [ ] TypeScript compilation succeeds
- [ ] Dev server runs without errors

### Functional Testing
- [ ] Click star button opens modal
- [ ] Can select 1-5 stars
- [ ] Hover preview works on stars
- [ ] Success/failure toggle works
- [ ] Failure tags only show when failed
- [ ] Expected behavior only shows when failed
- [ ] Can type in notes
- [ ] Cancel closes modal
- [ ] Submit requires rating
- [ ] Submit saves to database
- [ ] Success callback fires
- [ ] Modal closes after submit
- [ ] Can rate same message multiple times (upsert)
- [ ] Error messages display correctly

### UI/UX Testing
- [ ] Modal is centered on screen
- [ ] Modal is responsive on mobile
- [ ] Star button visible on hover/tap
- [ ] Star icons render correctly
- [ ] Hover states work on all buttons
- [ ] Focus states work with keyboard
- [ ] Text areas are resizable
- [ ] Form is keyboard accessible
- [ ] Loading state shows during submit

### Database Verification
- [ ] Evaluation saved to message_evaluations table
- [ ] evaluator_id matches current user
- [ ] message_id is correct
- [ ] rating is 1-5
- [ ] success boolean is correct
- [ ] failure_tags array is correct
- [ ] notes saved correctly
- [ ] expected_behavior saved correctly
- [ ] updated_at updates on re-submit

---

## Testing Strategy

### Manual Testing

1. **Basic Flow:**
   - Send a message
   - Click star button on response
   - Rate 5 stars, mark successful
   - Add notes
   - Submit
   - Verify saved in database

2. **Failure Flow:**
   - Click star on another response
   - Rate 2 stars, mark failed
   - Select failure tags
   - Add expected behavior
   - Submit
   - Verify tags saved

3. **Update Flow:**
   - Rate same message again
   - Change rating to 4 stars
   - Submit
   - Verify updated in database (upsert)

4. **Validation:**
   - Try to submit without rating
   - Verify error message shows
   - Cannot submit

5. **Cancel:**
   - Open modal
   - Fill form
   - Click cancel
   - Modal closes, nothing saved

### Database Queries

**Verify evaluation saved:**
```sql
SELECT * FROM message_evaluations
WHERE message_id = 'your-message-id'
ORDER BY created_at DESC LIMIT 1;
```

**Check upsert behavior:**
```sql
-- Submit evaluation
-- Submit again with different rating
-- Should only have 1 row (updated)
SELECT COUNT(*) FROM message_evaluations
WHERE message_id = 'your-message-id';
-- Expected: 1
```

---

## Rollback Plan

### If Implementation Fails
1. Remove EvaluationModal.tsx
2. Remove components/evaluation/ directory
3. Revert Chat.tsx changes
4. Clear .next cache
5. Restart dev server

### Backward Compatibility
- Old thumbs up/down still works
- No changes to feedback table
- message_evaluations table is separate
- Can deploy incrementally

---

## Next Steps After Phase 9

1. **Phase 10: Analytics Dashboard** - Visualize metrics and evaluations
2. **Phase 11: Automated Training** - CI/CD pipeline for model fine-tuning
3. **Phase 12: A/B Testing** - Compare model versions

---

**Document Version:** 1.0
**Created:** 2025-10-13
**Last Updated:** 2025-10-13
**Status:** Ready for Implementation
