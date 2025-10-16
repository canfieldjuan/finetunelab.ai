# GraphRAG UI - Visual Mockups & Button Specifications

## Chat Page Layout - Before & After

### BEFORE (Current):
```
┌───────────────────────────────────────────────────────┐
│  Chat                                    [Settings]   │
├───────────────────────────────────────────────────────┤
│                                                       │
│  User: Hello                                          │
│  AI: Hi! How can I help?                              │
│                                                       │
│                                                       │
│                                                       │
│                                                       │
├───────────────────────────────────────────────────────┤
│  [Type a message...]                         [Send]   │
└───────────────────────────────────────────────────────┘
```

### AFTER (With GraphRAG):
```
┌───────────────────────────────────────────────────────┐
│  Chat          [📚 Knowledge (5)] [Settings]  <- NEW  │
├───────────────────────────────────────────────────────┤
│                                                       │
│  User: What's in my reports?                          │
│  ┌─────────────────────────────────────────────────┐ │
│  │ AI: Based on your documents...                  │ │
│  │                                                 │ │
│  │ [📚 View Sources (3)]  <- NEW EXPANDABLE       │ │
│  │   ├─ 📄 Q1_Report.pdf (85%)                    │ │
│  │   ├─ 📄 Notes.txt (72%)                        │ │
│  │   └─ 📄 Meeting_Minutes.docx (68%)             │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
├───────────────────────────────────────────────────────┤
│  [📎]  [Type a message...]              [Send]  <- NEW│
│  ✓ GraphRAG enabled • 5 docs indexed    <- NEW       │
└───────────────────────────────────────────────────────┘
```

---

## Button Specifications

### 1. Knowledge Base Button
**Location:** Top right toolbar, next to Settings

**HTML/JSX:**
```tsx
<button className="
  flex items-center gap-2 px-4 py-2 
  bg-blue-600 hover:bg-blue-700 
  text-white rounded-lg 
  transition-colors
">
  <Database className="w-5 h-5" />
  <span>Knowledge</span>
  {docCount > 0 && (
    <span className="
      ml-1 px-2 py-0.5 
      bg-blue-500 rounded-full 
      text-xs font-semibold
    ">
      {docCount}
    </span>
  )}
</button>
```

**States:**
- Default: Blue background, white text
- Hover: Darker blue
- Active: Even darker, slight scale
- Badge: Shows document count
- Empty state: Gray background, "0" or hidden badge

**Behavior:**
- Click opens sidebar/modal with DocumentList + DocumentUpload
- Badge updates in real-time as docs are added/removed
- Tooltip on hover: "View knowledge base ({count} documents)"

---

### 2. Quick Upload Button
**Location:** Left side of chat input, before text field

**HTML/JSX:**
```tsx
<button className="
  p-2 rounded-lg 
  text-gray-500 hover:text-gray-700 
  hover:bg-gray-100 
  transition-colors
">
  <Paperclip className="w-5 h-5" />
</button>
```

**States:**
- Default: Gray icon
- Hover: Darker gray + light background
- Active: Blue icon + blue background
- Uploading: Spinner animation

**Behavior:**
- Click opens upload modal/dialog
- Drag files over button to highlight
- Shows upload progress inline
- Tooltip: "Upload document (PDF, DOCX, TXT)"

---

### 3. GraphRAG Status Indicator
**Location:** Below chat input, small status line

**HTML/JSX:**
```tsx
<div className="
  flex items-center gap-2 px-3 py-1 
  text-xs text-gray-600 dark:text-gray-400
">
  {enabled ? (
    <>
      <CheckCircle className="w-3 h-3 text-green-500" />
      <span>GraphRAG enabled</span>
      <span className="text-gray-400">•</span>
      <span>{docCount} docs indexed</span>
    </>
  ) : (
    <>
      <XCircle className="w-3 h-3 text-gray-400" />
      <span>GraphRAG disabled</span>
    </>
  )}
</div>
```

**States:**
- Enabled: Green checkmark
- Disabled: Gray X
- Processing: Yellow clock icon + "Processing..."
- Error: Red alert icon + error message

**Behavior:**
- Click to view details/settings
- Shows last sync time on hover
- Warning if enabled but no documents

---

### 4. Citation Source Item
**Location:** Inside GraphRAGIndicator component

**HTML/JSX:**
```tsx
<div className="
  p-3 bg-white dark:bg-gray-800 
  rounded-lg border border-blue-100 
  hover:border-blue-300 cursor-pointer
  transition-colors
">
  <div className="flex items-start gap-3">
    <File className="w-5 h-5 text-blue-500 flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-900 truncate">
        {citation.source}
      </p>
      <p className="mt-1 text-xs text-gray-600 line-clamp-2">
        "{citation.content}"
      </p>
      {/* Confidence Bar */}
      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
          <div 
            className="bg-blue-600 h-1.5 rounded-full"
            style={{ width: `${citation.confidence * 100}%` }}
          />
        </div>
        <span className="text-xs text-gray-500">
          {Math.round(citation.confidence * 100)}%
        </span>
      </div>
    </div>
  </div>
</div>
```

**States:**
- Default: White background, light border
- Hover: Blue border
- Click: Opens document preview

**Behavior:**
- Shows document name
- Snippet preview (2 lines max)
- Confidence score as progress bar
- Click to view full document

---

## Knowledge Base Modal/Sidebar

### Option A: Slide-out Sidebar (Recommended)
```
┌─────────────────────────────────────────────────────────┐
│  Chat                                                   │
├─────────────────────────────────────┬───────────────────┤
│                                     │ Knowledge Base    │
│  Chat messages here...              │ [X Close]         │
│                                     │                   │
│                                     │ [+ Upload Doc]    │
│                                     │                   │
│                                     │ My Documents (5)  │
│                                     │ ┌───────────────┐ │
│                                     │ │ 📄 report.pdf │ │
│                                     │ │ ✓ Processed   │ │
│                                     │ │ [👁] [🗑]     │ │
│                                     │ └───────────────┘ │
│                                     │ ┌───────────────┐ │
│                                     │ │ 📄 notes.txt  │ │
│                                     │ │ ⏳ Processing │ │
│                                     │ │ [👁] [🗑]     │ │
│                                     │ └───────────────┘ │
│                                     │                   │
└─────────────────────────────────────┴───────────────────┘
```

### Option B: Full-width Modal
```
┌─────────────────────────────────────────────────────────┐
│  Knowledge Base                                [X Close]│
├─────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────┐  │
│  │  [Drag & Drop or Click to Upload]                │  │
│  │  PDF, DOCX, TXT, MD (max 10MB)                   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  My Documents (5)        [🔍 Search] [Filter ▼]         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 📄 Q1_Report.pdf        ✓ Processed     [👁][🗑] │   │
│  │ 📄 Notes.txt            ⏳ Processing    [👁][🗑] │   │
│  │ 📄 Meeting.docx         ✓ Processed     [👁][🗑] │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Settings Panel Layout

### GraphRAG Settings Tab
```
┌─────────────────────────────────────────────────────────┐
│  Settings                                               │
├─────────────────────────────────────────────────────────┤
│  [General] [GraphRAG] [Account]    <- Tabs             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  GraphRAG Configuration                                 │
│  ────────────────────────────                           │
│                                                         │
│  Basic Settings                                         │
│  ┌───────────────────────────────────────────────┐     │
│  │ [✓] Enable GraphRAG                          │     │
│  │ [✓] Auto-process uploaded documents          │     │
│  │ [✓] Show citations in chat                   │     │
│  │ [ ] Show confidence scores                   │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
│  Search Configuration                                   │
│  ┌───────────────────────────────────────────────┐     │
│  │ Max Search Results: [━━━━━○────] 5            │     │
│  │                                                │     │
│  │ Context Length:     [━━━━○──────] 1000 tokens │     │
│  │                                                │     │
│  │ Search Method:      [Hybrid       ▼]          │     │
│  │                                                │     │
│  │ Min Confidence:     [━━━━━━○────] 0.7         │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
│  System Status                                          │
│  ┌───────────────────────────────────────────────┐     │
│  │ Neo4j:     ● Connected                        │     │
│  │ Graphiti:  ● Running                          │     │
│  │ Documents: 12 indexed                         │     │
│  │ Last Sync: 2 minutes ago                      │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
│  Actions                                                │
│  [Re-index All] [Clear Graph] [Test Connection]        │
│                                                         │
│                                   [Cancel] [Save]       │
└─────────────────────────────────────────────────────────┘
```

---

## Upload Progress Tracker

### Floating Toast Notification
```
                                    ┌────────────────────┐
                                    │ Uploading (2/3)    │
                                    ├────────────────────┤
                                    │ ✓ report.pdf       │
                                    │ ⏳ notes.txt 45%   │
                                    │   [████░░░░░░]     │
                                    │ ⏱ meeting.docx     │
                                    │   [In queue...]    │
                                    │                    │
                                    │ [Cancel All] [×]   │
                                    └────────────────────┘
```

**Features:**
- Shows multiple uploads
- Progress bar per file
- Can cancel individual or all
- Auto-dismisses on complete
- Click to expand details

---

## Document Preview Modal

### PDF/Document Viewer
```
┌─────────────────────────────────────────────────────────┐
│  Q1_Report.pdf                                [Download]│
│                                                 [Close]│
├─────────────────────────────────────────────────────────┤
│  [<] Page 1 of 12 [>]        [Zoom] [Search] [Print]   │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────┐ │
│  │                                                   │ │
│  │  Q1 Sales Report                                 │ │
│  │  ════════════════                                │ │
│  │                                                   │ │
│  │  Total Revenue: $1.2M                            │ │
│  │  ~~~~~~~~~~~~~~~~~~~ <- Highlighted citation    │ │
│  │                                                   │ │
│  │  Key Findings:                                   │ │
│  │  - Sales increased 15%                           │ │
│  │  - New customers: 234                            │ │
│  │                                                   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Metadata                                               │
│  Uploaded: Jan 15, 2025                                 │
│  Status: ✓ Indexed                                      │
│  Episodes: 3                                            │
│                                                         │
│  [Re-process] [Delete]                                  │
└─────────────────────────────────────────────────────────┘
```

---

## Smart Suggestions Panel

### Sidebar Widget
```
┌────────────────────────────────┐
│ 💡 Ask About Your Documents    │
├────────────────────────────────┤
│                                │
│ Based on your uploads:         │
│                                │
│ • "Summarize Q1 report"        │
│ • "Compare sales data"         │
│ • "What were action items?"    │
│ • "Show key metrics"           │
│                                │
│ [Refresh Suggestions]          │
└────────────────────────────────┘
```

---

## Color Palette

### GraphRAG Feature Colors
```css
/* Primary */
--graphrag-primary: #3b82f6;      /* Blue - main actions */
--graphrag-primary-hover: #2563eb;
--graphrag-primary-light: #dbeafe;

/* Status Colors */
--graphrag-success: #10b981;       /* Green - processed */
--graphrag-warning: #f59e0b;       /* Orange - processing */
--graphrag-error: #ef4444;         /* Red - errors */
--graphrag-info: #06b6d4;          /* Cyan - info */

/* Neutral */
--graphrag-gray-50: #f9fafb;
--graphrag-gray-100: #f3f4f6;
--graphrag-gray-500: #6b7280;
--graphrag-gray-900: #111827;

/* Confidence Levels */
--confidence-high: #10b981;        /* >80% - Green */
--confidence-medium: #f59e0b;      /* 50-80% - Orange */
--confidence-low: #6b7280;         /* <50% - Gray */
```

---

## Responsive Breakpoints

### Desktop (>1024px)
- Sidebar: 400px wide
- Full features visible
- Side-by-side layout

### Tablet (768-1024px)
- Sidebar: 350px wide
- Modal overlays
- Compact buttons

### Mobile (<768px)
- Full-screen modals
- Bottom sheets
- Icon-only buttons
- Stacked layout

---

## Animation Guidelines

### Transitions
```css
/* Button hover */
transition: all 0.2s ease;

/* Modal/Sidebar slide-in */
transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);

/* Badge pulse */
animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;

/* Progress bar */
transition: width 0.5s ease-out;
```

### Loading States
- Skeleton screens for lists
- Spinner for actions
- Progress bars for uploads
- Shimmer effect for placeholders

---

## Accessibility

### ARIA Labels
```tsx
<button 
  aria-label={`Knowledge base with ${docCount} documents`}
  aria-expanded={isOpen}
>
  <Database aria-hidden="true" />
  Knowledge
</button>
```

### Keyboard Navigation
- Tab through all interactive elements
- Enter/Space to activate
- Escape to close modals
- Arrow keys for lists

### Screen Reader Support
- Announce upload progress
- Describe confidence scores
- Read citation sources
- Status updates

---

## Implementation Priority

### Phase 1 (Week 1) - Essential:
1. ✅ Knowledge Base button (top right)
2. ✅ Quick upload button (chat input)
3. ✅ GraphRAG status indicator (below input)
4. ✅ Citation display (in messages)

### Phase 2 (Week 2) - Enhanced:
5. Settings panel
6. Upload progress tracker
7. Document preview modal
8. Improved filters/search

### Phase 3 (Week 3) - Advanced:
9. Smart suggestions
10. Knowledge graph viewer
11. Bulk actions
12. Export/import

---

**End of Visual Specifications**
