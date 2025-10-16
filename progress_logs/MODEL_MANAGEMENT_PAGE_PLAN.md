# Model Management Page - Implementation Plan
**Status:** 📋 Planning Complete - Ready for Implementation
**Date:** 2025-10-15
**Phase:** 5.2 - Model Management UI

---

## 🎯 Overview

Build a comprehensive Model Management page that allows users to:
- View all available models (global + user's own)
- Add custom models from templates or manual configuration
- Edit existing user models
- Delete user models
- Test model connections before saving
- Filter and search models by provider, ownership

---

## 📐 Architecture Analysis

### Current State
✅ Backend complete:
- `/app/api/models` - GET (list), POST (create)
- `/app/api/models/[id]` - GET, PATCH (update), DELETE
- `/app/api/models/test-connection` - POST
- 19 model templates in `lib/models/model-templates.ts`
- Encryption service ready

✅ Basic UI exists:
- `ModelSelector.tsx` - Dropdown in chat interface
- Authentication context available
- UI components (Card, Button, Input, Select)

### Required Components

```
/app/models/page.tsx (Main Page)
├── ModelList (Table/Grid View)
│   ├── ModelCard (Individual Model Display)
│   ├── FilterBar (Provider, Ownership filters)
│   └── SearchInput (Search by name)
├── AddModelButton (Opens dialog)
└── AddModelDialog (Modal)
    ├── TemplateSelector (Choose from 19 templates)
    ├── ManualForm (Custom configuration)
    └── TestConnection (Verify before save)
```

---

## 🔧 Implementation Phases

### Phase 5.2.1: Main Page Structure ✅ Ready
**Files to Create:**
- `/app/models/page.tsx` (120 lines est.)

**Key Features:**
- Auth check (pattern from analytics/page.tsx)
- Layout with header, filters, model grid
- Loading and error states
- Integration with existing AuthContext

**Dependencies:**
- None (uses existing auth patterns)

**Verification:**
- Navigate to /models
- Redirects to login if not authenticated
- Shows loading spinner initially
- Layout renders correctly

---

### Phase 5.2.2: Model Card Component ✅ Ready
**Files to Create:**
- `/components/models/ModelCard.tsx` (150 lines est.)

**Key Features:**
- Display model information (name, provider, capabilities)
- Show capability icons (streaming, tools, vision)
- Edit/Delete buttons for user models
- "Global" badge for system models
- Visual distinction between user/global models

**Pattern Reference:**
- Similar to InsightCard.tsx
- Uses Card, CardHeader, CardTitle, CardContent

**Verification:**
- Renders 4 seeded models correctly
- Shows correct icons for capabilities
- Global models show badge, no edit/delete
- User models show edit/delete buttons

---

### Phase 5.2.3: Add Model Dialog - Template Path ✅ Ready
**Files to Create:**
- `/components/models/AddModelDialog.tsx` (250 lines est.)

**Key Features:**
- Two-step wizard: 1) Select template, 2) Fill API key
- Display all 19 templates grouped by provider
- Form for API key and optional customization
- Test connection before save
- Success/error feedback

**Pattern Reference:**
- Similar to ExportDialog.tsx (overlay + modal)
- Fixed inset-0 z-50 overlay
- Centered modal with click-outside-to-close

**Templates to Support:**
- OpenAI: GPT-4o Mini, GPT-4 Turbo, GPT-3.5 Turbo
- Anthropic: Claude 3.5 Sonnet, Opus, Haiku
- HuggingFace: Mistral 7B, Llama 3.1 8B, Zephyr 7B
- Ollama: Llama 3.1, Mistral, Phi-3 Mini
- vLLM: Custom endpoint, Mistral 7B
- Azure: GPT-4o, GPT-3.5 Turbo

**Verification:**
- Dialog opens with template selection
- Templates grouped by provider
- Selecting template shows pre-filled form
- API key field required
- Test connection works before save
- Model appears in list after creation

---

### Phase 5.2.4: Add Model Dialog - Manual Path ✅ Ready
**Update File:**
- `/components/models/AddModelDialog.tsx` (add ~100 lines)

**Key Features:**
- "Custom" tab alongside "Templates" tab
- Full manual form for all model fields
- Validation for required fields
- Base URL, model ID, auth type selectors
- Advanced options (context length, tokens, pricing)

**Form Fields:**
```typescript
Required:
- name (text)
- provider (select: openai, anthropic, ollama, etc.)
- base_url (text)
- model_id (text)
- auth_type (select: bearer, api_key, custom_header, none)

Optional:
- description (textarea)
- api_key (password)
- auth_headers (json textarea)
- supports_streaming (checkbox)
- supports_functions (checkbox)
- supports_vision (checkbox)
- context_length (number)
- max_output_tokens (number)
- price_per_input_token (number)
- price_per_output_token (number)
- default_temperature (slider 0-2)
- default_top_p (slider 0-1)
```

**Verification:**
- Manual tab shows all fields
- Validation prevents submission with missing required fields
- Can create custom endpoint model
- Model saves correctly with all fields

---

### Phase 5.2.5: Edit Model Dialog ✅ Ready
**Files to Create:**
- `/components/models/EditModelDialog.tsx` (200 lines est.)

**Key Features:**
- Pre-populated form with existing model data
- Only allow editing user's own models
- Show API key preview (sk-proj...abc)
- Option to change API key or keep existing
- Test connection before update
- Cannot edit provider or model_id (immutable)

**Security:**
- Verify ownership before allowing edit
- API key encrypted when saved
- Show only preview, never full key

**Verification:**
- Edit button only appears for user models
- Form pre-populated with model data
- API key shows preview only
- "Keep existing key" checkbox works
- Update saves correctly
- Model list reflects changes

---

### Phase 5.2.6: Delete Model Confirmation ✅ Ready
**Component:**
- Inline confirmation in ModelCard.tsx (add ~40 lines)

**Key Features:**
- Delete button shows confirmation dialog
- Double-check with model name
- Only user models can be deleted
- Success feedback
- Remove from list after deletion

**Pattern:**
- Simple inline confirm (not separate dialog)
- "Are you sure?" with model name display
- Cancel/Confirm buttons

**Verification:**
- Delete button only on user models
- Confirmation shows model name
- Cancel preserves model
- Confirm deletes and removes from list
- Global models cannot be deleted

---

### Phase 5.2.7: Test Connection Component ✅ Ready
**Files to Create:**
- `/components/models/TestConnection.tsx` (120 lines est.)

**Key Features:**
- "Test Connection" button in add/edit dialogs
- Loading spinner during test
- Success/failure feedback with latency
- Error message display
- Re-test capability

**API Integration:**
- POST /api/models/test-connection
- Send model config (not saved yet)
- Display response (success, latency, error)

**Verification:**
- Test button disabled during test
- Shows spinner while testing
- Success shows green message with latency
- Failure shows red message with error details
- Can re-test after failure

---

### Phase 5.2.8: Filters and Search ✅ Ready
**Update File:**
- `/app/models/page.tsx` (add ~80 lines)

**Key Features:**
- Search by model name (client-side filter)
- Filter by provider (OpenAI, Anthropic, etc.)
- Filter by ownership (All, Global, Mine)
- Filter count display
- Clear filters button

**UI Layout:**
```
┌──────────────────────────────────────┐
│ [Search box]                         │
│ Provider: [All ▾]  Ownership: [All ▾]│
│ Showing X of Y models                │
└──────────────────────────────────────┘
```

**Verification:**
- Search filters models by name
- Provider filter works
- Ownership filter shows correct models
- Count updates correctly
- Clear filters resets all

---

### Phase 5.2.9: Integration and Navigation ✅ Ready
**Files to Modify:**
- `/components/Chat.tsx` (add navigation link ~10 lines)
- OR `/app/home/page.tsx` (if sidebar exists there)

**Key Features:**
- Add "Manage Models" link to sidebar/navigation
- Icon for models section
- Active state when on /models page
- Consistent with existing navigation

**Verification:**
- Link appears in navigation
- Clicking navigates to /models
- Active state shows when on page
- Back to chat works correctly

---

### Phase 5.2.10: Polish and Error Handling ✅ Ready
**All Files:**
- Add comprehensive error handling
- Loading states for all async operations
- Empty states (no models, no results)
- Responsive design (mobile-friendly)
- Accessibility (ARIA labels, keyboard nav)

**Empty States:**
- No models: "No models found. Add your first model!"
- No search results: "No models match your search."
- No user models: "You haven't added any custom models yet."

**Verification:**
- All error cases handled gracefully
- Loading spinners during fetches
- Empty states display correctly
- Works on mobile viewport
- Keyboard navigation works

---

## 📋 File Structure Summary

```
New Files (7):
├── app/models/page.tsx                    (~200 lines)
├── components/models/ModelCard.tsx        (~150 lines)
├── components/models/AddModelDialog.tsx   (~350 lines)
├── components/models/EditModelDialog.tsx  (~200 lines)
├── components/models/TestConnection.tsx   (~120 lines)
└── docs/progress_logs/MODEL_MANAGEMENT_PAGE_PLAN.md (this file)

Modified Files (1):
└── components/Chat.tsx                    (+10 lines for navigation)

Total New Code: ~1,030 lines
```

---

## 🧪 Verification Checklist

### Functional Tests
- [ ] Page loads for authenticated users
- [ ] Redirects to login for unauthenticated users
- [ ] Shows all global models
- [ ] Shows user's custom models
- [ ] Add model from template works
- [ ] Add model manually works
- [ ] Edit user model works
- [ ] Delete user model works (with confirmation)
- [ ] Cannot edit/delete global models
- [ ] Test connection works for all 6 providers
- [ ] Search filters models correctly
- [ ] Provider filter works
- [ ] Ownership filter works
- [ ] Navigation link works
- [ ] Model appears in chat dropdown after creation

### Security Tests
- [ ] Only user's models can be edited/deleted
- [ ] API keys encrypted before save
- [ ] API key preview works (never shows full key)
- [ ] RLS policies enforced on backend
- [ ] Unauthorized access returns 401
- [ ] Cannot delete global models

### UI/UX Tests
- [ ] Loading states show during operations
- [ ] Error messages display clearly
- [ ] Success feedback after actions
- [ ] Empty states display correctly
- [ ] Responsive on mobile
- [ ] Keyboard navigation works
- [ ] Icons and badges display correctly
- [ ] Color coding clear for model types

---

## 🔐 Security Considerations

### Authentication
- All operations require authenticated user
- Use AuthContext for user ID
- Include Authorization header in API calls

### Authorization
- Backend RLS enforces ownership
- Frontend hides edit/delete for global models
- Double-check ownership before mutations

### Data Protection
- API keys encrypted with AES-256-GCM
- Never display full API keys
- Use previews (sk-proj...abc)
- HTTPS enforced for all connections

---

## 🎨 Design Patterns

### Component Patterns
```typescript
// Page Pattern (from analytics/page.tsx)
'use client';
- Auth check with loading state
- Redirect if not authenticated
- Render main component after auth

// Dialog Pattern (from ExportDialog.tsx)
- Fixed overlay (fixed inset-0 z-50)
- Centered modal (max-w-2xl)
- Click outside to close
- Form with validation
- Action buttons (Cancel/Submit)

// Card Pattern (from InsightCard.tsx)
- Card container with border
- Icon + content layout
- Color coding based on data
- Hover effects
```

### State Management
```typescript
// Local state for UI
const [models, setModels] = useState<LLMModelDisplay[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

// Dialog state
const [showAddDialog, setShowAddDialog] = useState(false);
const [editingModel, setEditingModel] = useState<LLMModelDisplay | null>(null);

// Filter state
const [searchQuery, setSearchQuery] = useState('');
const [providerFilter, setProviderFilter] = useState<string>('all');
const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'global' | 'mine'>('all');
```

### Error Handling
```typescript
// Try-catch with user feedback
try {
  const response = await fetch('/api/models', { method: 'POST', body });
  if (!response.ok) {
    const { error } = await response.json();
    setError(error || 'Failed to create model');
    return;
  }
  // Success handling
  setSuccess(true);
} catch (err) {
  setError(err instanceof Error ? err.message : 'Network error');
}
```

---

## 📊 Integration Points

### Existing APIs (No Changes Needed)
- `GET /api/models` - List models
- `POST /api/models` - Create model
- `GET /api/models/[id]` - Get model
- `PATCH /api/models/[id]` - Update model
- `DELETE /api/models/[id]` - Delete model
- `POST /api/models/test-connection` - Test config

### Existing Services
- `ModelManager` - Service layer (no changes)
- `Encryption` - AES-256-GCM (no changes)
- Model templates (19 templates ready to use)

### Existing Components
- `ModelSelector` - Will show new models after creation
- `Chat` - Add navigation link only
- UI components (Button, Input, Select, Card)

---

## 🚀 Implementation Order

### Session 1: Core Structure (Phases 5.2.1-5.2.2)
1. Create main page (`app/models/page.tsx`)
2. Create ModelCard component
3. Test: Navigate to /models, see seeded models

### Session 2: Add Model Flow (Phases 5.2.3-5.2.4)
1. Create AddModelDialog with templates
2. Add manual configuration tab
3. Test: Add model from template, add custom model

### Session 3: Edit/Delete (Phases 5.2.5-5.2.6)
1. Create EditModelDialog
2. Add delete confirmation to ModelCard
3. Test: Edit user model, delete user model

### Session 4: Testing & Filters (Phases 5.2.7-5.2.8)
1. Create TestConnection component
2. Add filters and search to main page
3. Test: Test connection, filter models

### Session 5: Polish (Phases 5.2.9-5.2.10)
1. Add navigation integration
2. Error handling and empty states
3. Responsive design
4. Final testing

---

## 📝 Development Rules Compliance

✅ **Verify before changing:**
- Read existing files before modifying
- Check current state of codebase
- Verify patterns match existing code

✅ **No assumptions:**
- Test after each phase
- Verify API responses
- Confirm UI renders correctly

✅ **Progress logs:**
- Update this document as we progress
- Mark phases as completed
- Document any issues encountered

✅ **Small blocks:**
- Max 30 lines per code block
- Complete logical units
- Incremental changes only

✅ **No stubs:**
- All code production-ready
- No TODOs or mocks
- Full implementations only

✅ **Robust logging:**
- Console logs at key points
- Error logging with context
- Debug statements for troubleshooting

---

## 🎯 Success Criteria

### Phase 5.2 Complete When:
- [ ] User can navigate to /models page
- [ ] User can view all available models
- [ ] User can add model from template
- [ ] User can add custom model manually
- [ ] User can edit their own models
- [ ] User can delete their own models
- [ ] User can test connections before saving
- [ ] User can search and filter models
- [ ] Global models are read-only (no edit/delete)
- [ ] New models appear in chat dropdown
- [ ] All operations have loading states
- [ ] All errors handled gracefully
- [ ] Zero TypeScript errors
- [ ] Responsive design works on mobile

---

**End of Plan - Ready for Implementation**
**Next Step:** Begin Phase 5.2.1 - Main Page Structure
