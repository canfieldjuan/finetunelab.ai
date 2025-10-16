# Phase 5: UI Components Implementation Plan
**Status:** In Progress
**Started:** 2025-10-14

## Overview
Create UI components for dynamic model management, integrated with existing Chat.tsx component and new Model Management dashboard.

---

## Existing UI Patterns (Analyzed)

### Component Library
- **UI Components**: Radix UI (`@radix-ui/react-select`, etc.)
- **Icons**: Lucide React
- **Styling**: TailwindCSS with `cn()` utility for className merging
- **Client Components**: Use `"use client"` directive

### Styling Patterns
- Dark/light mode support: `bg-background`, `text-foreground`, `bg-card`, `text-card-foreground`
- Borders: `border` class with theme-aware colors
- Modals: Fixed overlay with `z-50`, `bg-black/50` backdrop
- Dropdowns: Absolute positioning with shadow-lg
- Buttons: Radix UI Button with variants (`ghost`, `default`)

### File Structure
```
/components/
  /ui/          - Reusable UI primitives (button, select, input, etc.)
  /graphrag/    - Feature-specific components
  /analytics/   - Analytics dashboards
  Chat.tsx      - Main chat component
```

---

## Phase 5 Components (To Build)

### 1. **ModelSelector Dropdown** ✅ PRIORITY
**File**: `/components/models/ModelSelector.tsx`
**Purpose**: Dropdown for selecting LLM model in chat interface
**Location**: Chat.tsx input area, next to "Send" button

**Features**:
- Fetch models from `/api/models`
- Group by provider (OpenAI, Anthropic, Ollama, etc.)
- Show model capabilities (streaming, tools, vision icons)
- Display selected model name
- Persist selection in conversation

**Props**:
```typescript
interface ModelSelectorProps {
  value?: string;           // Selected model ID
  onChange: (modelId: string) => void;
  userId?: string;          // For fetching user's personal models
  disabled?: boolean;
}
```

---

### 2. **Model Management Page**
**File**: `/app/models/page.tsx`
**Purpose**: Full-page dashboard for viewing and managing models
**Route**: `/models`

**Features**:
- Table/card view of all models (global + personal)
- Filters: By provider, by ownership (my models/global)
- Actions per model:
  - Edit
  - Delete (if user owns it)
  - Test connection
  - Copy model ID
  - Enable/disable
- "Add New Model" button → Opens AddModelDialog

**Sections**:
1. Header with "Add Model" button
2. Filter bar (provider dropdown, search)
3. Model cards/table with actions
4. Empty state if no models

---

### 3. **AddModelDialog (Modal)**
**File**: `/components/models/AddModelDialog.tsx`
**Purpose**: Modal for adding or editing models

**Features**:
- Template selection (dropdown with popular models)
- Form fields:
  - Name (text)
  - Description (textarea)
  - Provider (select from templates or custom)
  - Base URL (text, pre-filled from template)
  - Model ID (text, pre-filled from template)
  - Auth Type (select: bearer, api_key, none)
  - API Key (password input, encrypted on save)
  - Advanced options (collapsed):
    - Supports streaming (checkbox)
    - Supports functions (checkbox)
    - Supports vision (checkbox)
    - Context length (number)
    - Max output tokens (number)
    - Temperature (slider 0-2)
    - Top P (slider 0-1)
- "Test Connection" button (before saving)
- Save/Cancel buttons

**Props**:
```typescript
interface AddModelDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editModelId?: string;     // If editing existing model
}
```

---

### 4. **TestConnection Component**
**File**: `/components/models/TestConnection.tsx`
**Purpose**: Test model configuration before saving

**Features**:
- Calls `/api/models/test-connection`
- Shows loading spinner
- Displays results:
  - Success: Green checkmark + latency
  - Failure: Red X + error message
- Inline in AddModelDialog

---

### 5. **ModelCard Component**
**File**: `/components/models/ModelCard.tsx`
**Purpose**: Display individual model in management page

**Features**:
- Provider badge (OpenAI/Anthropic/etc.)
- Model name + description
- Capability icons (streaming, tools, vision)
- API key preview (masked: `sk-...abc`)
- Last used timestamp
- Action dropdown (edit, delete, test, enable/disable)

---

## Implementation Order

### Step 1: ModelSelector ✅ NEXT
1. Create `/components/models/ModelSelector.tsx`
2. Integrate into `/components/Chat.tsx`
3. Update `handleSend()` to pass `modelId` to API

### Step 2: Model Management Page
1. Create `/app/models/page.tsx`
2. Create `/components/models/ModelCard.tsx`
3. Add navigation link in Chat.tsx sidebar

### Step 3: Add/Edit Dialog
1. Create `/components/models/AddModelDialog.tsx`
2. Create `/components/models/TestConnection.tsx`
3. Integrate with Management Page

### Step 4: Testing
1. Test model selection in chat
2. Test adding new model
3. Test editing existing model
4. Test connection testing
5. Test full flow end-to-end

---

## Integration Points

### Chat.tsx Changes
**Line ~278**: Add `modelId` to API request body
```typescript
body: JSON.stringify({
  messages: conversationMessages,
  tools: getToolsForOpenAI(),
  memory: { userId: user.id, graphragEnabled },
  modelId: selectedModelId,  // ← NEW
}),
```

**Line ~1070**: Add ModelSelector before Send button
```tsx
<ModelSelector
  value={selectedModelId}
  onChange={setSelectedModelId}
  userId={user?.id}
  disabled={loading}
/>
```

---

## Success Criteria

- ✅ User can select model from dropdown in chat
- ✅ Selected model persists across page reload (via conversation)
- ✅ User can view all available models
- ✅ User can add custom models (Ollama, vLLM, HuggingFace)
- ✅ User can test connection before saving
- ✅ User can edit/delete their own models
- ✅ Global models cannot be deleted
- ✅ API key is masked in UI (shows `sk-...abc`)
- ✅ Full backward compatibility (works without model selection)

---

## Files to Create

1. `/components/models/ModelSelector.tsx` ← START HERE
2. `/components/models/ModelCard.tsx`
3. `/components/models/AddModelDialog.tsx`
4. `/components/models/TestConnection.tsx`
5. `/app/models/page.tsx`

## Files to Modify

1. `/components/Chat.tsx` - Lines ~278, ~1070
2. Add navigation link to `/models` page

---

**Next Step**: Create ModelSelector.tsx
