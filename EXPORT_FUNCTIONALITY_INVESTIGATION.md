# Web-UI Export Functionality Investigation

**Date:** November 14, 2025  
**Investigation Scope:** Export functions implementation and user controls

---

## Overview

The web-UI implements a comprehensive export system with multiple formats, extensive user controls, and three main export contexts:

1. **Conversation Exports** - Chat/conversation data export
2. **Analytics Exports** - Model performance and metrics export  
3. **Approval History Exports** - HITL approval workflow data export

---

## 1. Conversation Export System

### Location
- **Components:** `components/export/`
- **Services:** `lib/export/`
- **Hooks:** `hooks/useExport.ts`
- **API:** `/api/export/`

### Supported Formats

#### Available Export Formats
```typescript
type ExportFormat = 'pdf' | 'markdown' | 'json' | 'txt' | 'html' | 'jsonl';
```

**1. Markdown (.md)**
- Human-readable formatted conversations
- Includes formatting for user/assistant messages
- Best for documentation and sharing

**2. JSON (.json)**
- Structured data format
- Includes full metadata
- Machine-readable for processing

**3. Plain Text (.txt)**
- Simple text format
- Minimal formatting
- Maximum compatibility

**4. JSONL (.jsonl)**
- Line-delimited JSON format
- Optimized for LLM training
- Sub-formats available:
  - `openai` - OpenAI fine-tuning format
  - `anthropic` - Anthropic format
  - `full` - Complete data format

**5. HTML (.html)**
- Web-viewable format
- Styled presentation
- Theme support (light/dark)

**6. PDF (.pdf)**
- Printable format
- Professional appearance
- Theme support

### User Controls

#### Export Dialog Options (`components/export/ExportDialog.tsx`)

```typescript
interface ExportDialogProps {
  conversationIds: string[];  // Which conversations to export
  onClose: () => void;
  onSuccess?: () => void;
}
```

**Controls Available:**
1. **Format Selection** - Choose export format (dropdown)
2. **Title** - Optional custom title for export
3. **Include Metadata** - Toggle for timestamps, IDs, etc.
4. **Conversation Selection** - Multi-select from conversation list

#### Export Options Interface

```typescript
interface ExportOptions {
  format: ExportFormat;                    // Required: Export format
  conversationIds: string[];               // Required: IDs to export
  includeMetadata?: boolean;               // Optional: Include timestamps, IDs
  includeSystemMessages?: boolean;         // Optional: Include system prompts
  dateRange?: {                            // Optional: Filter by date
    start: Date;
    end: Date;
  };
  theme?: 'light' | 'dark';               // Optional: For PDF/HTML
  title?: string;                          // Optional: Custom title
  widgetSessionFilter?: 'all' | 'widget' | 'normal';  // Optional: Filter by type
}
```

#### Extended JSONL Options

```typescript
interface JsonlExportOptions extends ExportOptions {
  jsonlFormat?: 'openai' | 'anthropic' | 'full';  // JSONL sub-format
  includeMetrics?: boolean;                         // Include Phase 7 metrics
  includeEvaluations?: boolean;                     // Include human evaluations
}
```

### Implementation Details

#### Format Generators (`lib/export/formatters/`)
Each format has a dedicated formatter implementing the `FormatGenerator` interface:

```typescript
interface FormatGenerator {
  generate(conversations: ConversationData[], options: ExportOptions): Promise<string | Buffer>;
  getExtension(): string;
  getMimeType(): string;
}
```

**Available Formatters:**
- `jsonFormatter.ts` - JSON format
- `jsonlFormatter.ts` - JSONL format (with sub-format support)
- `markdownFormatter.ts` - Markdown format
- `txtFormatter.ts` - Plain text format

#### Export Service (`lib/export/exportService.ts`)

**Key Features:**
- Format generator registration system
- Conversation data loading from Supabase
- File generation and temporary storage
- Automatic expiration (24 hours default)
- Size limit validation
- Progress tracking for large exports

**Export Limits (configurable):**
```typescript
{
  maxConversations: 100,        // Max conversations per export
  maxFileSizeMB: 50,            // Max file size
  expirationHours: 24,          // File expiration time
  tempDirectory: './tmp/exports' // Storage location
}
```

#### API Endpoints

**1. Generate Export**
```
POST /api/export/generate
Authorization: Bearer <token>
Body: ExportOptions
Response: ExportResult
```

**2. Download Export**
```
GET /api/export/download/:exportId
Authorization: Bearer <token>
Response: File (with Content-Disposition header)
```

### Export Result

```typescript
interface ExportResult {
  id: string;                    // Unique export ID
  filePath: string;              // Server file path
  fileSize: number;              // Size in bytes
  downloadUrl: string;           // Download URL
  expiresAt?: Date;             // Expiration timestamp
  format: ExportFormat;          // Format used
  conversationCount: number;     // Number of conversations
  messageCount: number;          // Total messages exported
}
```

---

## 2. Analytics Export System

### Location
- **Component:** `components/analytics/ExportModal.tsx`
- **Library:** `lib/csv-export.ts`

### Supported Formats
- **CSV** - Spreadsheet-compatible format
- **JSON** - Structured data format

### Export Sections

#### Available Sections
```typescript
type ExportSection = 
  | 'all'                      // Complete export
  | 'overview'                 // KPIs and summary
  | 'modelPerformance'         // Model metrics
  | 'sessionMetrics'           // A/B testing data
  | 'trainingEffectiveness'    // Training comparison
  | 'ratingDistribution'       // Rating breakdown
  | 'tokenUsage'              // Token consumption
  | 'costTracking';           // Cost analysis
```

#### Export Functions

**1. Overview Metrics**
```typescript
exportOverviewToCSV(overview: {
  totalMessages: number;
  totalConversations: number;
  totalEvaluations: number;
  avgRating: number;
  successRate: number;
})
```

**2. Model Performance**
```typescript
exportModelPerformanceToCSV(models: ModelPerformanceData[])

interface ModelPerformanceData {
  modelId: string;
  modelName: string;
  provider?: string;
  baseModel?: string;
  trainingMethod?: string;
  totalMessages: number;
  totalConversations: number;
  evaluationCount: number;
  avgRating: number;
  successRate: number;
  errorRate: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  avgResponseTime: number;
  costPerMessage: number;
}
```

**3. Session Metrics**
```typescript
exportSessionMetricsToCSV(sessions: SessionMetricsData[])

interface SessionMetricsData {
  sessionId: string;
  experimentName?: string;
  totalConversations: number;
  totalMessages: number;
  evaluationCount: number;
  avgRating: number;
  successRate: number;
  errorRate: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  avgResponseTime: number;
  totalCost: number;
  firstConversation: string;
  lastConversation: string;
}
```

**4. Training Effectiveness**
```typescript
exportTrainingEffectivenessToCSV(training: TrainingEffectivenessData[])

interface TrainingEffectivenessData {
  trainingMethod: string;
  modelCount: number;
  totalMessages: number;
  evaluationCount: number;
  avgRating: number;
  successRate: number;
  errorRate: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  avgResponseTime: number;
  avgCostPerMessage: number;
}
```

**5. Rating Distribution**
```typescript
exportRatingDistributionToCSV(ratings: Array<{ rating: number; count: number }>)
```

**6. Token Usage**
```typescript
exportTokenUsageToCSV(tokenUsage: Array<{ date: string; input: number; output: number }>)
```

**7. Cost Tracking**
```typescript
exportCostTrackingToCSV(costs: Array<{ date: string; cost: number; tokens: number }>)
```

**8. Complete Analytics**
```typescript
exportAllAnalyticsToCSV(data: AnalyticsData)
// Exports all sections in a single comprehensive CSV
```

### User Controls (Analytics)

#### ExportModal Component

**Controls:**
1. **Format Selection** - CSV or JSON
2. **Section Selection** - Choose specific data to export
3. **Availability Indicators** - Shows which sections have data
4. **Section Descriptions** - Help text for each option
5. **Recommended Badge** - "All" section is recommended

**Features:**
- Disabled state for unavailable sections
- Success message after export
- Automatic filename with timestamp
- Preview of export details before download

### CSV Export Utilities

#### Core Functions (`lib/csv-export.ts`)

**1. Value Escaping**
```typescript
function escapeCSVValue(value: unknown): string
// Handles commas, quotes, newlines
// Wraps in quotes when necessary
// Escapes internal quotes
```

**2. Array to CSV Conversion**
```typescript
function arrayToCSV(data: Record<string, unknown>[], headers: string[]): string
// Converts array of objects to CSV format
// Applies proper escaping
```

**3. Download Handler**
```typescript
function downloadCSV(content: string, filename: string): void
// Creates blob
// Generates download link
// Triggers browser download
// Cleans up resources
```

**Filename Convention:**
```
analytics-{section}-{YYYY-MM-DD}.{format}

Examples:
- analytics-overview-2025-11-14.csv
- analytics-model-performance-2025-11-14.json
- analytics-complete-2025-11-14.csv
```

---

## 3. Approval History Export

### Location
- **Component:** `components/approvals/ApprovalHistoryViewer.tsx`
- **Export Function:** Lines 262-299

### Format
- **CSV only** - Spreadsheet format for reporting

### Export Fields

```typescript
const headers = [
  'ID',                    // Approval request ID
  'Title',                 // Request title
  'Workflow',             // Workflow ID
  'Job',                  // Job ID
  'Requested By',         // Requester name/ID
  'Created At',           // ISO timestamp
  'Decision',             // approved/rejected/expired/cancelled/pending
  'Decided By',           // Approver name/ID
  'Decided At',           // ISO timestamp
  'Decision Time (s)',    // Time taken in seconds
  'Comment',              // Approval comment
  'Reason',               // Rejection/cancellation reason
];
```

### User Controls

**1. Filter Before Export**
- Search by title, workflow, requester
- Filter by status, decision, workflow
- Filter by approver, requester
- Date range filter
- Sort options (8 different sorts)

**2. Export Button**
- Located in header with download icon
- Disabled when no results
- Exports filtered/sorted results (not all data)
- One-click export

**3. Export Implementation**
```typescript
const exportToCSV = () => {
  // Map filtered history to CSV rows
  const rows = filteredHistory.map((h) => [
    h.id,
    h.title,
    h.workflowId,
    h.jobId,
    h.requestedByName || h.requestedBy,
    h.createdAt.toISOString(),
    h.decision || 'pending',
    h.decidedByName || h.decidedBy || '',
    h.decidedAt?.toISOString() || '',
    h.decisionTimeMs ? (h.decisionTimeMs / 1000).toFixed(2) : '',
    h.comment || '',
    h.reason || '',
  ]);
  
  // Generate CSV with proper escaping
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  
  // Create blob and download
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `approval-history-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
```

**Filename:**
```
approval-history-{YYYY-MM-DD}.csv

Example:
approval-history-2025-11-14.csv
```

---

## 4. Archive System

### Location
- **Component:** `components/export/ArchiveManager.tsx`
- **Service:** `lib/export/archiveService.ts`
- **Hook:** `hooks/useArchive.ts`

### Functionality

**Archive Operations:**
```typescript
interface ArchiveOptions {
  conversationIds: string[];
  permanentDelete?: boolean;  // Optional: Delete after archive
}

interface RestoreOptions {
  conversationIds: string[];
}
```

**User Controls:**
1. **Select/Deselect All** - Bulk selection checkbox
2. **Individual Selection** - Click to select conversations
3. **Selection Counter** - Shows number selected
4. **Bulk Restore** - Restore multiple at once
5. **Search/Filter** - Find archived conversations

**Archive Manager Features:**
- Lists all archived conversations
- Shows message count per conversation
- Displays archive date
- Multi-select with checkboxes
- Click entire row to select
- Visual feedback for selected items
- Loading states
- Error handling

---

## 5. Security & Access Control

### Authentication
All export operations require authentication:
```typescript
const { data: { session } } = await supabase.auth.getSession();
Authorization: `Bearer ${session.access_token}`
```

### User Isolation
- Users can only export their own conversations
- Queries filtered by `user_id`
- Archive operations respect ownership

### Data Protection
- Temporary files expire automatically (24 hours)
- Files stored in protected directory
- Download URLs require authentication
- No public access to export files

---

## 6. User Experience Features

### Visual Feedback
1. **Loading States** - "Exporting..." button text
2. **Success Messages** - "Export successful!" notification
3. **Error Handling** - Detailed error messages
4. **Progress Indicators** - For large exports
5. **Disabled States** - When no data or processing

### Accessibility
1. **Keyboard Navigation** - Tab through controls
2. **ARIA Labels** - Screen reader support
3. **Focus Management** - Modal dialogs
4. **Visual Indicators** - Check marks, badges

### Convenience
1. **Auto-Download** - Automatic download after generation
2. **Smart Filenames** - Include date and section
3. **Format Preview** - Show filename before export
4. **Recommended Options** - "All" marked as recommended
5. **Data Availability** - Sections disabled when empty

---

## 7. Export Limits & Constraints

### Conversation Exports
- **Max Conversations:** 100 per export (configurable)
- **Max File Size:** 50 MB (configurable)
- **Expiration:** 24 hours (configurable)
- **Rate Limiting:** Not specified (could be added)

### Analytics Exports
- **No explicit limits** - Exports all available data
- **Browser memory limits** - Large datasets may cause issues
- **CSV size limits** - Excel max: 1,048,576 rows

### Approval History Exports
- **Filtered Results Only** - Exports what's visible
- **No pagination limit** - Exports all filtered results
- **CSV format only** - No JSON option

---

## 8. Technical Implementation

### CSV Generation Pattern

```typescript
// 1. Escape values
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

// 2. Convert to CSV
function arrayToCSV(data: Record<string, unknown>[], headers: string[]): string {
  const headerRow = headers.map(h => escapeCSVValue(h)).join(',');
  const dataRows = data.map(row => {
    return headers.map(header => escapeCSVValue(row[header])).join(',');
  });
  return [headerRow, ...dataRows].join('\n');
}

// 3. Download
function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

### JSON Export Pattern

```typescript
// Simple but effective
const jsonString = JSON.stringify(exportData, null, 2);
const blob = new Blob([jsonString], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = `filename.json`;
link.click();
URL.revokeObjectURL(url);
```

---

## 9. Future Enhancement Opportunities

### Missing Features
1. **PDF Export** - Conversation export lists PDF but not implemented
2. **HTML Export** - Listed but implementation missing
3. **Batch Exports** - No scheduled/recurring exports
4. **Email Delivery** - Export via email
5. **Cloud Storage** - Direct export to S3, GCS, etc.
6. **Compression** - ZIP for large exports
7. **Incremental Exports** - Export only new data since last export

### Potential Improvements
1. **Custom Templates** - User-defined export formats
2. **Field Selection** - Choose which fields to include
3. **Advanced Filters** - More sophisticated filtering
4. **Export History** - Track past exports
5. **Sharing** - Generate shareable links
6. **Webhooks** - Notify when export ready
7. **Bulk Operations** - Export multiple sections at once
8. **Format Conversion** - Convert between formats
9. **Data Validation** - Verify export integrity
10. **Annotation Support** - Add notes to exports

---

## Summary

The web-UI provides **three comprehensive export systems** with extensive user controls:

### Conversation Exports
- ✅ 6 formats (Markdown, JSON, TXT, JSONL, HTML*, PDF*)
- ✅ Metadata control
- ✅ Date range filtering
- ✅ Theme selection
- ✅ Custom titles
- ✅ Automatic expiration
- ⚠️ PDF & HTML formatters not yet implemented

### Analytics Exports
- ✅ CSV and JSON formats
- ✅ 8 distinct sections
- ✅ Section availability indicators
- ✅ Complete analytics export
- ✅ Multiple data types (models, sessions, training, costs)
- ✅ Professional formatting with proper escaping

### Approval History Exports
- ✅ CSV format
- ✅ Full filtering before export
- ✅ 12 data fields
- ✅ Timestamp formatting
- ✅ Proper CSV escaping
- ✅ One-click export

### Common Features
- ✅ Authentication required
- ✅ User isolation
- ✅ Error handling
- ✅ Loading states
- ✅ Success feedback
- ✅ Automatic downloads
- ✅ Smart filenames with timestamps
- ✅ Proper resource cleanup

### User Control Summary
Users have control over:
1. **Format** - Multiple format options
2. **Content** - What to include (metadata, dates, sections)
3. **Filtering** - What data to export
4. **Presentation** - Themes, titles, formatting
5. **Scope** - Single or multiple items
6. **Timing** - On-demand exports
