# GraphRAG UI Features & Buttons - Implementation Guide

## Executive Summary

Based on GraphRAG documentation review, here are the **NEW UI features and buttons** to add to your application.

---

## 📋 Current State (Already Built)

### ✅ Components Exist:
1. **DocumentUpload** - Upload PDF/DOCX/TXT files
2. **DocumentList** - View, search, filter, delete documents
3. **GraphRAGIndicator** - Show citations in chat responses

### ✅ Pages Exist:
- `/graphrag-demo` - Demo page with upload + list

### ✅ API Routes Wired:
- `POST /api/graphrag/upload` - Upload documents
- `GET /api/graphrag/documents` - List documents
- `POST /api/graphrag/search` - Search knowledge graph
- `DELETE /api/graphrag/delete/[id]` - Delete documents

---

## 🎯 NEW UI Features Needed

### **PHASE 1: Integrate into Main Chat Page** (HIGH PRIORITY)

#### 1. **Knowledge Base Toggle Button** (Chat Page)
**Location:** `/app/chat/page.tsx` - Top right of chat interface

**Visual:**
```
┌─────────────────────────────────────────┐
│  Chat                    [📚 Knowledge] │ <- NEW BUTTON
│                                         │
│  Chat messages here...                  │
└─────────────────────────────────────────┘
```

**Features:**
- Icon: Book/Database icon
- Badge showing document count (e.g., "5 docs")
- Click opens sidebar/modal with DocumentList
- Shows processing status

**Code Pattern:**
```tsx
<button className="...">
  <Database className="w-5 h-5" />
  <span>Knowledge Base</span>
  {docCount > 0 && (
    <span className="badge">{docCount}</span>
  )}
</button>
```

---

#### 2. **Quick Upload Button** (Chat Page)
**Location:** Inside chat input area or top toolbar

**Visual:**
```
┌─────────────────────────────────────────┐
│  [📎] [Type a message...]    [Send]     │ <- NEW PAPERCLIP BUTTON
└─────────────────────────────────────────┘
```

**Features:**
- Paperclip/Upload icon next to input
- Click opens mini upload dialog
- Drag-drop zone overlay
- Shows upload progress inline

**Code Pattern:**
```tsx
<button onClick={() => setShowUpload(true)}>
  <Paperclip className="w-5 h-5" />
</button>

{showUpload && (
  <div className="upload-modal">
    <DocumentUpload userId={user.id} compact />
  </div>
)}
```

---

#### 3. **GraphRAG Status Indicator** (Chat Input)
**Location:** Below chat input, shows when GraphRAG is active

**Visual:**
```
┌─────────────────────────────────────────┐
│  [Type a message...]                    │
│  ✓ GraphRAG enabled (5 docs indexed)    │ <- NEW STATUS LINE
└─────────────────────────────────────────┘
```

**Features:**
- Small badge/pill showing:
  - ✓ Enabled/Disabled
  - Document count
  - Last sync time
- Click to view details
- Warning if no documents

**Code Pattern:**
```tsx
{graphragEnabled && (
  <div className="status-line">
    <CheckCircle className="w-4 h-4 text-green-500" />
    <span>{docCount} documents indexed</span>
  </div>
)}
```

---

#### 4. **Enhanced Citation Display** (Chat Messages)
**Location:** Within AI message bubbles

**Visual:**
```
┌────────────────────────────────────────────────┐
│ AI: Based on your documents, the answer is... │
│                                                │
│ [📚 View Sources (3)]  <- NEW EXPANDABLE       │
│   └─ document1.pdf                             │
│   └─ notes.txt                                 │
│   └─ report.docx                               │
└────────────────────────────────────────────────┘
```

**Features:**
- Collapsible sources section
- Document name + confidence %
- Snippet preview
- Click to highlight in document
- "Jump to source" button

**Already exists as GraphRAGIndicator but needs:**
- Better styling integration
- Click-to-view document
- Inline snippet highlights

---

### **PHASE 2: Settings & Configuration UI** (MEDIUM PRIORITY)

#### 5. **GraphRAG Settings Panel** (NEW PAGE)
**Location:** `/app/settings/graphrag` or Settings modal

**Features:**

**Toggle Controls:**
```
[✓] Enable GraphRAG
[ ] Auto-process uploads
[✓] Show citations in chat
[ ] Use vector search
```

**Configuration Options:**
```
Search Results: [5] documents (slider 1-20)
Context Length: [1000] tokens (slider 500-4000)
Search Method: [Hybrid ▼] (dropdown: Hybrid/Vector/Graph)
Confidence Threshold: [0.7] (slider 0-1)
```

**Status Display:**
```
Neo4j Status: ● Connected
Graphiti Status: ● Running
Documents Indexed: 12
Last Sync: 2 min ago
```

**Actions:**
```
[Re-index All Documents]
[Clear Knowledge Graph]
[Test Connection]
[View Logs]
```

---

#### 6. **Document Management Page** (ENHANCED)
**Location:** `/app/documents` - Dedicated page for power users

**Features:**

**Toolbar Actions:**
```
[+ Upload] [🔄 Refresh] [⚙️ Bulk Actions ▼] [🔍 Advanced Search]
```

**Table View:**
```
┌──────────┬─────────┬────────┬─────────┬──────────┐
│ Filename │ Type    │ Status │ Indexed │ Actions  │
├──────────┼─────────┼────────┼─────────┼──────────┤
│ doc.pdf  │ PDF     │ ✓ Done │ Yes     │ [👁][✏][🗑] │
│ note.txt │ TXT     │ ⏳ Proc │ No      │ [👁][✏][🗑] │
└──────────┴─────────┴────────┴─────────┴──────────┘
```

**Bulk Actions:**
- Select multiple (checkboxes)
- Re-process selected
- Delete selected
- Export metadata
- Add tags

**Advanced Filters:**
```
Status: [All ▼]
Type: [All ▼]
Date Range: [Last 30 days ▼]
Tags: [Search tags...]
Indexed: [Yes ▼]
```

---

### **PHASE 3: Advanced Features** (LOW PRIORITY)

#### 7. **Knowledge Graph Viewer** (NEW COMPONENT)
**Location:** Modal/dedicated page

**Features:**
- Visual graph of entities & relationships
- Interactive nodes (click to expand)
- Filter by entity type
- Search within graph
- Export graph data

**Libraries to use:**
- `react-force-graph` or `vis-network`
- D3.js integration

---

#### 8. **Document Preview Modal**
**Location:** Opens from DocumentList or citations

**Features:**
- PDF viewer (pdf.js)
- Text highlighting
- Navigate by citations
- Download button
- Re-process button

---

#### 9. **Smart Suggestions Panel**
**Location:** Sidebar in chat

**Features:**
- "Ask about your documents" prompts
- Based on uploaded content
- Recent topics
- Trending entities

**Example:**
```
💡 Suggested Questions:
- "What are the main points in my report?"
- "Compare findings from doc1 and doc2"
- "Summarize my meeting notes"
```

---

#### 10. **Upload Progress Tracker**
**Location:** Floating notification/toast

**Features:**
- Multiple uploads queued
- Progress per file
- Processing stages:
  - Uploading...
  - Parsing...
  - Indexing...
  - Complete ✓
- Error handling
- Retry button

---

## 🎨 UI Components to Create

### New Components Needed:

#### 1. `KnowledgeBaseButton.tsx`
```tsx
interface Props {
  docCount: number;
  onClick: () => void;
}
// Floating action button with badge
```

#### 2. `GraphRAGSettings.tsx`
```tsx
interface Props {
  config: GraphRAGConfig;
  onSave: (config: GraphRAGConfig) => void;
}
// Settings panel with toggles/sliders
```

#### 3. `DocumentTable.tsx`
```tsx
interface Props {
  documents: Document[];
  onBulkAction: (action: string, ids: string[]) => void;
}
// Enhanced table with selection/bulk actions
```

#### 4. `KnowledgeGraphViewer.tsx`
```tsx
interface Props {
  userId: string;
  initialNode?: string;
}
// Interactive graph visualization
```

#### 5. `DocumentPreview.tsx`
```tsx
interface Props {
  documentId: string;
  highlightText?: string;
}
// Modal with PDF/text preview
```

#### 6. `SmartSuggestions.tsx`
```tsx
interface Props {
  userId: string;
  onSelect: (suggestion: string) => void;
}
// Question suggestions panel
```

#### 7. `UploadQueue.tsx`
```tsx
interface Props {
  uploads: Upload[];
  onCancel: (id: string) => void;
}
// Multi-file upload progress
```

---

## 🔧 Hooks to Create

### 1. `useGraphRAGConfig.ts`
```tsx
// Manage GraphRAG settings
const { config, updateConfig, reset } = useGraphRAGConfig();
```

### 2. `useKnowledgeGraph.ts`
```tsx
// Fetch graph data for visualization
const { nodes, edges, loading } = useKnowledgeGraph(userId);
```

### 3. `useSmartSuggestions.ts`
```tsx
// Generate question suggestions
const { suggestions, refresh } = useSmartSuggestions(userId);
```

### 4. `useUploadQueue.ts`
```tsx
// Manage multiple uploads
const { queue, add, cancel, retry } = useUploadQueue();
```

---

## 📊 Priority Roadmap

### Week 1: Core Integration
- [ ] Add Knowledge Base button to chat page
- [ ] Add quick upload button to chat input
- [ ] Integrate GraphRAGIndicator into chat messages
- [ ] Add status indicator below chat input

### Week 2: Settings & Management
- [ ] Create GraphRAG settings panel
- [ ] Enhance DocumentList with bulk actions
- [ ] Add document preview modal
- [ ] Add upload queue tracker

### Week 3: Advanced Features
- [ ] Build knowledge graph viewer
- [ ] Add smart suggestions panel
- [ ] Create document table view
- [ ] Polish UI/UX

---

## 🎯 Specific Button Locations

### Chat Page (`/app/chat/page.tsx`):
```tsx
// TOP RIGHT TOOLBAR
<div className="flex items-center gap-2">
  <KnowledgeBaseButton 
    docCount={documents.length}
    onClick={() => setShowKB(true)}
  />
  <SettingsButton />
</div>

// CHAT INPUT AREA
<div className="relative">
  <QuickUploadButton onClick={() => setShowUpload(true)} />
  <input type="text" ... />
  <SendButton />
</div>

// BELOW INPUT
<GraphRAGStatusIndicator 
  enabled={config.enabled}
  docCount={documents.length}
/>

// IN MESSAGE BUBBLES
{message.citations && (
  <GraphRAGIndicator citations={message.citations} />
)}
```

### Settings Page (`/app/settings/page.tsx`):
```tsx
<Tabs>
  <Tab label="General" />
  <Tab label="GraphRAG"> {/* NEW TAB */}
    <GraphRAGSettings 
      config={config}
      onSave={handleSave}
    />
  </Tab>
  <Tab label="Account" />
</Tabs>
```

### New Documents Page (`/app/documents/page.tsx`):
```tsx
<div className="container">
  <Toolbar>
    <UploadButton />
    <RefreshButton />
    <BulkActionsMenu />
    <SearchBar />
  </Toolbar>
  
  <DocumentTable 
    documents={documents}
    onBulkAction={handleBulk}
  />
</div>
```

---

## 🎨 Design Tokens

### Colors:
```css
--graphrag-primary: #3b82f6;    /* Blue for GraphRAG features */
--graphrag-success: #10b981;     /* Green for processed */
--graphrag-warning: #f59e0b;     /* Orange for processing */
--graphrag-error: #ef4444;       /* Red for errors */
```

### Icons (lucide-react):
- `Database` - Knowledge base
- `BookOpen` - Citations
- `Upload` / `Paperclip` - Upload
- `Settings` - Configuration
- `Search` - Search
- `Eye` - Preview
- `Trash2` - Delete
- `RefreshCw` - Re-process
- `CheckCircle` - Success
- `Clock` - Processing
- `AlertCircle` - Error

---

## 📝 Implementation Checklist

### Minimal Viable Product (MVP):
- [ ] Knowledge base button in chat (with doc count badge)
- [ ] Quick upload from chat input
- [ ] GraphRAG status indicator
- [ ] Enhanced citation display
- [ ] Basic settings toggle (enable/disable)

### Phase 2 (Enhanced):
- [ ] Full settings panel
- [ ] Bulk document management
- [ ] Advanced search/filters
- [ ] Upload queue tracker
- [ ] Document preview

### Phase 3 (Advanced):
- [ ] Knowledge graph visualization
- [ ] Smart suggestions
- [ ] Entity highlighting
- [ ] Multi-document comparison
- [ ] Export/import knowledge base

---

## 🔗 File References

**Documentation:**
- `/lib/graphrag/README.md` - GraphRAG API reference
- `/docs/GRAPHRAG_QUICKSTART.md` - Setup & usage guide
- `/docs/GRAPHRAG_INTEGRATION_PLAN.md` - Architecture details

**Existing Components:**
- `/components/graphrag/DocumentUpload.tsx` - Upload component
- `/components/graphrag/DocumentList.tsx` - List component
- `/components/graphrag/GraphRAGIndicator.tsx` - Citation display

**Hooks:**
- `/hooks/useDocuments.ts` - Document management
- `/hooks/useGraphRAG.ts` - Search functionality

**Services:**
- `/lib/graphrag/service/document-service.ts` - Upload/process
- `/lib/graphrag/service/graphrag-service.ts` - Chat enhancement
- `/lib/graphrag/graphiti/search-service.ts` - Knowledge graph search

---

## 💡 Key Insights from Docs

1. **Auto-Enhancement**: GraphRAG can automatically enhance chat prompts when enabled
2. **Citations**: Every AI response can include source citations
3. **Multi-Format**: Supports PDF, DOCX, TXT, MD files
4. **Knowledge Graph**: Neo4j stores entities/relationships
5. **Episode Tracking**: Each document creates "episodes" in the graph
6. **User Isolation**: Each user has their own knowledge graph
7. **Configurable**: Search method, chunk size, top-K all configurable
8. **Optional**: Can be disabled without breaking chat

---

## 🚀 Quick Start Implementation

**To add GraphRAG to chat page in 30 minutes:**

1. Import existing components:
```tsx
import { DocumentUpload, GraphRAGIndicator } from '@/components/graphrag';
import { useDocuments } from '@/hooks/useDocuments';
```

2. Add state:
```tsx
const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);
const { documents } = useDocuments({ userId: user.id });
```

3. Add button:
```tsx
<button onClick={() => setShowKnowledgeBase(true)}>
  <Database /> Knowledge ({documents.length})
</button>
```

4. Add modal:
```tsx
{showKnowledgeBase && (
  <Modal onClose={() => setShowKnowledgeBase(false)}>
    <DocumentUpload userId={user.id} />
    <DocumentList userId={user.id} />
  </Modal>
)}
```

Done! Users can now upload documents from chat and see citations.

---

**End of Document**
