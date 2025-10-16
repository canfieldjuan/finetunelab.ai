# Phase 5: New Features Implementation Plan

**Date:** October 13, 2025
**Status:** 📋 PLANNING PHASE
**Project:** Web-UI Chat Portal - Feature Enhancements
**Objective:** Add high-value features to enhance user experience and functionality

---

## 🎯 EXECUTIVE SUMMARY

Based on verification of current implementation (90% complete) and analysis of TODOs/future enhancements mentioned in documentation, this plan outlines the next wave of features to implement.

### Current System Status
- ✅ Phase 1: Memory System (100%)
- ✅ Phase 2: Tool System (100%)
- ✅ Phase 3: GraphRAG (100%)
- ⚠️ Phase 4: UI Modernization (60% - Chat.tsx pending)

### Feature Selection Criteria
1. **User Value** - High impact on user experience
2. **Complexity** - Manageable implementation scope
3. **Dependencies** - Minimal breaking changes
4. **Time** - Realistic completion timeline

---

## 📊 FEATURE PRIORITIZATION

### Tier 1: High Priority (Weeks 1-2)
**Essential features that significantly enhance core functionality**

1. **Message Export/Archive** ⭐⭐⭐⭐⭐
   - Export conversations to PDF, Markdown, JSON
   - Archive old conversations
   - Search within archives

2. **Conversation Search** ⭐⭐⭐⭐⭐
   - Full-text search across all conversations
   - Filter by date, tags, participants
   - GraphRAG-powered semantic search

3. **Usage Analytics Dashboard** ⭐⭐⭐⭐
   - Token usage tracking
   - Cost estimation
   - Usage trends and insights

### Tier 2: Medium Priority (Weeks 3-4)
**Features that improve organization and productivity**

4. **Conversation Organization** ⭐⭐⭐⭐
   - Tags and categories
   - Folder structure
   - Favorites/pinned conversations
   - Bulk operations

5. **Custom Prompt Templates** ⭐⭐⭐⭐
   - Save frequently used prompts
   - Template variables
   - Template library/marketplace
   - Quick access from chat

6. **Enhanced Tool Suite** ⭐⭐⭐
   - File operations tool (read/write local files)
   - Code execution sandbox
   - Email tool (send emails)
   - Calendar tool (schedule events)

### Tier 3: Advanced Features (Weeks 5-6)
**Advanced capabilities for power users**

7. **Conversation Sharing** ⭐⭐⭐
   - Share conversations via link
   - Public/private/password-protected
   - Expiring links
   - Share analytics

8. **Message Reactions & Enhanced Feedback** ⭐⭐⭐
   - Emoji reactions to messages
   - Inline comments
   - Highlight important messages
   - Better feedback collection

9. **Multi-modal Support** ⭐⭐⭐
   - Image upload and analysis
   - Voice input (speech-to-text)
   - Audio output (text-to-speech)
   - Screenshot annotation

10. **Conversation Branching** ⭐⭐
    - Fork conversations at any point
    - Compare different paths
    - Merge branches
    - Branch visualization

---

## 🔧 DETAILED FEATURE SPECIFICATIONS

---

## **FEATURE 1: MESSAGE EXPORT/ARCHIVE**

### Priority: ⭐⭐⭐⭐⭐ (Tier 1)

### Estimated Time: 8-10 hours

### Objective
Allow users to export conversations to various formats and archive old conversations for better organization and data portability.

### Features
1. **Export Formats**
   - PDF with formatting
   - Markdown with code blocks
   - JSON with full metadata
   - Plain text
   - HTML with styling

2. **Export Options**
   - Single conversation
   - Multiple conversations (bulk)
   - Date range export
   - Filtered export (by tags/search)

3. **Archive System**
   - Archive old conversations
   - Restore from archive
   - Auto-archive after X days
   - Archive search

### Technical Architecture

#### Database Schema Updates

```sql
-- Add archive support to conversations table
ALTER TABLE conversations
ADD COLUMN archived BOOLEAN DEFAULT false,
ADD COLUMN archived_at TIMESTAMPTZ,
ADD COLUMN archived_by UUID REFERENCES auth.users(id);

-- Create exports tracking table
CREATE TABLE conversation_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_ids UUID[] NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('pdf', 'markdown', 'json', 'txt', 'html')),
  file_path TEXT NOT NULL,
  file_size INTEGER,
  export_options JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Optional expiration for generated files

  INDEX idx_exports_user_id ON conversation_exports(user_id),
  INDEX idx_exports_created_at ON conversation_exports(created_at DESC)
);

-- RLS policies
ALTER TABLE conversation_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own exports"
  ON conversation_exports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own exports"
  ON conversation_exports FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

#### File Structure

```
lib/
├── export/
│   ├── types.ts                    # Export interfaces
│   ├── config.ts                   # Export configuration
│   ├── exportService.ts            # Main export orchestration
│   ├── formatters/
│   │   ├── pdfFormatter.ts         # PDF generation
│   │   ├── markdownFormatter.ts    # Markdown generation
│   │   ├── jsonFormatter.ts        # JSON export
│   │   ├── txtFormatter.ts         # Plain text
│   │   └── htmlFormatter.ts        # HTML with styling
│   └── archiveService.ts           # Archive management

components/
├── export/
│   ├── ExportDialog.tsx            # Export modal
│   ├── ExportOptions.tsx           # Format & options selector
│   ├── ExportProgress.tsx          # Progress indicator
│   └── ArchiveManager.tsx          # Archive UI

hooks/
├── useExport.ts                    # Export hook
└── useArchive.ts                   # Archive hook

app/
└── api/
    └── export/
        ├── generate/route.ts       # POST /api/export/generate
        ├── download/[id]/route.ts  # GET /api/export/download/:id
        └── archive/route.ts        # POST /api/export/archive
```

### Implementation Phases

#### Phase 1.1: Core Export Service (3 hours)

**Files to Create:**
- `/lib/export/types.ts` (50 lines)
- `/lib/export/config.ts` (40 lines)
- `/lib/export/exportService.ts` (150 lines)

**Key Types:**
```typescript
interface ExportOptions {
  format: 'pdf' | 'markdown' | 'json' | 'txt' | 'html';
  conversationIds: string[];
  includeMetadata?: boolean;
  includeSystemMessages?: boolean;
  dateRange?: { start: Date; end: Date };
  theme?: 'light' | 'dark';
}

interface ExportResult {
  id: string;
  filePath: string;
  fileSize: number;
  downloadUrl: string;
  expiresAt?: Date;
}
```

**Verification:**
- [ ] TypeScript compiles
- [ ] Service can load conversations
- [ ] Basic export flow works

#### Phase 1.2: Format Generators (4 hours)

**Markdown Formatter** (1 hour)
```typescript
// lib/export/formatters/markdownFormatter.ts
export class MarkdownFormatter {
  format(conversations: Conversation[]): string {
    let markdown = '# Conversations Export\n\n';

    for (const conv of conversations) {
      markdown += `## ${conv.title}\n`;
      markdown += `*Created: ${conv.created_at}*\n\n`;

      for (const msg of conv.messages) {
        markdown += `### ${msg.role === 'user' ? 'You' : 'Assistant'}\n`;
        markdown += `${msg.content}\n\n`;
      }

      markdown += '---\n\n';
    }

    return markdown;
  }
}
```

**JSON Formatter** (30 min)
```typescript
// lib/export/formatters/jsonFormatter.ts
export class JsonFormatter {
  format(conversations: Conversation[], options: ExportOptions): string {
    const data = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      conversations: conversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        messages: conv.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          created_at: msg.created_at,
          metadata: options.includeMetadata ? msg.metadata : undefined
        }))
      }))
    };

    return JSON.stringify(data, null, 2);
  }
}
```

**PDF Formatter** (2 hours)
- Use `pdfkit` library
- Proper formatting with headers/footers
- Code syntax highlighting
- Page numbers

**Text Formatter** (30 min)
- Simple plain text output
- Conversation separators

**HTML Formatter** (1 hour)
- Styled HTML with CSS
- Responsive design
- Code highlighting
- Print-friendly

**Dependencies to Install:**
```bash
npm install pdfkit marked highlight.js
npm install --save-dev @types/pdfkit
```

**Verification:**
- [ ] All formatters produce valid output
- [ ] Large conversations handled
- [ ] Special characters escaped properly

#### Phase 1.3: API Routes (2 hours)

**Generate Export Endpoint**
```typescript
// app/api/export/generate/route.ts
import { exportService } from '@/lib/export/exportService';

export async function POST(request: Request) {
  const { userId } = await getAuth(request);
  const options: ExportOptions = await request.json();

  // Validate user owns these conversations
  await validateConversationOwnership(userId, options.conversationIds);

  // Generate export
  const result = await exportService.generate(userId, options);

  // Track in database
  await supabase.from('conversation_exports').insert({
    user_id: userId,
    conversation_ids: options.conversationIds,
    format: options.format,
    file_path: result.filePath,
    file_size: result.fileSize,
    export_options: options
  });

  return Response.json(result);
}
```

**Download Export Endpoint**
```typescript
// app/api/export/download/[id]/route.ts
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { userId } = await getAuth(request);

  // Get export record
  const { data: exportRecord } = await supabase
    .from('conversation_exports')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', userId)
    .single();

  if (!exportRecord) {
    return Response.json({ error: 'Export not found' }, { status: 404 });
  }

  // Read file and return
  const file = await fs.readFile(exportRecord.file_path);
  const contentType = getContentType(exportRecord.format);

  return new Response(file, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="export.${exportRecord.format}"`
    }
  });
}
```

**Archive Endpoint**
```typescript
// app/api/export/archive/route.ts
export async function POST(request: Request) {
  const { userId } = await getAuth(request);
  const { conversationIds, action } = await request.json(); // 'archive' or 'restore'

  if (action === 'archive') {
    await supabase
      .from('conversations')
      .update({
        archived: true,
        archived_at: new Date().toISOString(),
        archived_by: userId
      })
      .in('id', conversationIds)
      .eq('user_id', userId);
  } else {
    await supabase
      .from('conversations')
      .update({
        archived: false,
        archived_at: null,
        archived_by: null
      })
      .in('id', conversationIds)
      .eq('user_id', userId);
  }

  return Response.json({ success: true });
}
```

**Verification:**
- [ ] API routes work
- [ ] Authentication enforced
- [ ] Files downloadable
- [ ] Archive toggle works

#### Phase 1.4: UI Components (2-3 hours)

**Export Dialog Component**
```typescript
// components/export/ExportDialog.tsx
export function ExportDialog({ conversationId }: { conversationId: string }) {
  const [format, setFormat] = useState<ExportFormat>('markdown');
  const [options, setOptions] = useState<ExportOptions>({});
  const { exportConversation, loading } = useExport();

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Conversation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Label>Format</Label>
          <Select value={format} onValueChange={setFormat}>
            <SelectOption value="markdown">Markdown</SelectOption>
            <SelectOption value="pdf">PDF</SelectOption>
            <SelectOption value="json">JSON</SelectOption>
            <SelectOption value="txt">Plain Text</SelectOption>
            <SelectOption value="html">HTML</SelectOption>
          </Select>

          <ExportOptions options={options} onChange={setOptions} />

          <Button
            onClick={() => exportConversation(conversationId, format, options)}
            disabled={loading}
          >
            {loading ? 'Exporting...' : 'Export'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Archive Manager Component**
```typescript
// components/export/ArchiveManager.tsx
export function ArchiveManager() {
  const { archivedConversations, restore, deleteArchived } = useArchive();

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Archived Conversations</h2>

      {archivedConversations.map(conv => (
        <div key={conv.id} className="flex items-center justify-between p-4 border rounded">
          <div>
            <h3>{conv.title}</h3>
            <p className="text-sm text-muted-foreground">
              Archived {formatDate(conv.archived_at)}
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => restore(conv.id)}>Restore</Button>
            <Button variant="destructive" onClick={() => deleteArchived(conv.id)}>
              Delete
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Verification:**
- [ ] Export dialog opens
- [ ] Format selection works
- [ ] Export downloads file
- [ ] Archive UI functional

#### Phase 1.5: Integration with Chat (1 hour)

**Add Export Button to Chat**
```typescript
// In components/Chat.tsx
import { ExportDialog } from './export/ExportDialog';

// Add to conversation menu
<DropdownMenu>
  <DropdownMenuItem onClick={() => setShowExportDialog(true)}>
    <Download className="h-4 w-4 mr-2" />
    Export
  </DropdownMenuItem>
  <DropdownMenuItem onClick={() => archiveConversation(activeId)}>
    <Archive className="h-4 w-4 mr-2" />
    Archive
  </DropdownMenuItem>
</DropdownMenu>

{showExportDialog && (
  <ExportDialog
    conversationId={activeId}
    onClose={() => setShowExportDialog(false)}
  />
)}
```

**Verification:**
- [ ] Export button visible
- [ ] Export dialog opens
- [ ] Archive button works
- [ ] No UI regressions

### Success Criteria

- [ ] Users can export conversations to 5 formats
- [ ] Bulk export works for multiple conversations
- [ ] Archive/restore functionality works
- [ ] Downloaded files are properly formatted
- [ ] Large conversations handle correctly
- [ ] All files expire after 24 hours (cleanup job)
- [ ] UI is intuitive and responsive
- [ ] No breaking changes to existing features

### Configuration

```bash
# .env.local additions
EXPORT_STORAGE_PATH=/tmp/exports
EXPORT_MAX_SIZE_MB=50
EXPORT_EXPIRATION_HOURS=24
EXPORT_CLEANUP_ENABLED=true
```

---

## **FEATURE 2: CONVERSATION SEARCH**

### Priority: ⭐⭐⭐⭐⭐ (Tier 1)

### Estimated Time: 10-12 hours

### Objective
Implement comprehensive search functionality across all conversations with semantic search powered by GraphRAG.

### Features
1. **Full-Text Search**
   - Search message content
   - Search conversation titles
   - Search metadata/tags

2. **Advanced Filters**
   - Date range
   - Message role (user/assistant)
   - Conversation tags
   - Archived/active

3. **Semantic Search**
   - Use GraphRAG for meaning-based search
   - "Find conversations about X"
   - Related topics discovery

4. **Search UI**
   - Global search bar
   - Search results page
   - Highlight matches
   - Jump to message in conversation

### Technical Architecture

#### Database Schema Updates

```sql
-- Add full-text search to conversations
CREATE INDEX idx_conversations_title_search
ON conversations USING gin(to_tsvector('english', title));

-- Add full-text search to messages
CREATE INDEX idx_messages_content_search
ON messages USING gin(to_tsvector('english', content));

-- Create search history table
CREATE TABLE search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  filters JSONB DEFAULT '{}',
  results_count INTEGER,
  clicked_result_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  INDEX idx_search_history_user_id ON search_history(user_id),
  INDEX idx_search_history_created_at ON search_history(created_at DESC)
);

-- RLS policies
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own search history"
  ON search_history FOR ALL
  USING (auth.uid() = user_id);
```

#### File Structure

```
lib/
├── search/
│   ├── types.ts                    # Search interfaces
│   ├── config.ts                   # Search configuration
│   ├── searchService.ts            # Main search orchestration
│   ├── fullTextSearch.ts           # PostgreSQL full-text search
│   ├── semanticSearch.ts           # GraphRAG semantic search
│   ├── filterEngine.ts             # Advanced filtering
│   └── highlighter.ts              # Match highlighting

components/
├── search/
│   ├── SearchBar.tsx               # Global search input
│   ├── SearchResults.tsx           # Results display
│   ├── SearchFilters.tsx           # Filter UI
│   ├── SearchResult.tsx            # Individual result card
│   └── SearchHistory.tsx           # Recent searches

hooks/
├── useSearch.ts                    # Search hook
└── useSearchHistory.ts             # Search history hook

app/
├── search/
│   └── page.tsx                    # Search results page
└── api/
    └── search/
        ├── query/route.ts          # POST /api/search/query
        └── history/route.ts        # GET /api/search/history
```

### Implementation Phases

#### Phase 2.1: Search Service Foundation (3 hours)

**Core Types:**
```typescript
// lib/search/types.ts
interface SearchQuery {
  query: string;
  filters?: {
    dateRange?: { start: Date; end: Date };
    messageRole?: 'user' | 'assistant';
    tags?: string[];
    archived?: boolean;
    conversationIds?: string[];
  };
  searchType?: 'fulltext' | 'semantic' | 'hybrid';
  limit?: number;
  offset?: number;
}

interface SearchResult {
  type: 'conversation' | 'message';
  id: string;
  conversationId: string;
  conversationTitle: string;
  content: string;
  highlightedContent: string;
  matchScore: number;
  created_at: Date;
  context?: {
    previousMessage?: string;
    nextMessage?: string;
  };
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: SearchQuery;
  executionTime: number;
}
```

**Search Service:**
```typescript
// lib/search/searchService.ts
import { FullTextSearch } from './fullTextSearch';
import { SemanticSearch } from './semanticSearch';
import { FilterEngine } from './filterEngine';

export class SearchService {
  private fullTextSearch: FullTextSearch;
  private semanticSearch: SemanticSearch;
  private filterEngine: FilterEngine;

  async search(userId: string, query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();

    let results: SearchResult[] = [];

    // Determine search strategy
    if (query.searchType === 'semantic') {
      results = await this.semanticSearch.search(userId, query);
    } else if (query.searchType === 'fulltext') {
      results = await this.fullTextSearch.search(userId, query);
    } else {
      // Hybrid: combine both methods
      const [semanticResults, fulltextResults] = await Promise.all([
        this.semanticSearch.search(userId, query),
        this.fullTextSearch.search(userId, query)
      ]);
      results = this.mergeResults(semanticResults, fulltextResults);
    }

    // Apply filters
    results = await this.filterEngine.apply(results, query.filters);

    // Log search
    await this.logSearch(userId, query, results.length);

    return {
      results,
      total: results.length,
      query,
      executionTime: Date.now() - startTime
    };
  }

  private mergeResults(semantic: SearchResult[], fulltext: SearchResult[]): SearchResult[] {
    // Combine and deduplicate by ID
    const resultMap = new Map<string, SearchResult>();

    // Add semantic results (higher priority)
    semantic.forEach(r => resultMap.set(r.id, r));

    // Add fulltext results (if not already present)
    fulltext.forEach(r => {
      if (!resultMap.has(r.id)) {
        resultMap.set(r.id, r);
      }
    });

    // Sort by match score
    return Array.from(resultMap.values()).sort((a, b) => b.matchScore - a.matchScore);
  }
}
```

**Verification:**
- [ ] Search service structure complete
- [ ] Types defined
- [ ] Basic search flow works

#### Phase 2.2: Full-Text Search Implementation (3 hours)

```typescript
// lib/search/fullTextSearch.ts
export class FullTextSearch {
  async search(userId: string, query: SearchQuery): Promise<SearchResult[]> {
    const searchTerm = query.query.replace(/'/g, "''"); // Escape quotes

    // Search conversations by title
    const conversationResults = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .textSearch('title', searchTerm)
      .limit(query.limit || 50);

    // Search messages by content
    const messageResults = await supabase
      .from('messages')
      .select(`
        *,
        conversation:conversations!inner(id, title, user_id)
      `)
      .eq('conversation.user_id', userId)
      .textSearch('content', searchTerm)
      .limit(query.limit || 50);

    // Combine and format results
    const results: SearchResult[] = [];

    // Add conversation results
    conversationResults.data?.forEach(conv => {
      results.push({
        type: 'conversation',
        id: conv.id,
        conversationId: conv.id,
        conversationTitle: conv.title,
        content: conv.title,
        highlightedContent: this.highlight(conv.title, query.query),
        matchScore: 0.8,
        created_at: conv.created_at
      });
    });

    // Add message results
    messageResults.data?.forEach(msg => {
      results.push({
        type: 'message',
        id: msg.id,
        conversationId: msg.conversation.id,
        conversationTitle: msg.conversation.title,
        content: msg.content,
        highlightedContent: this.highlight(msg.content, query.query),
        matchScore: 0.9,
        created_at: msg.created_at,
        context: this.getContext(msg)
      });
    });

    return results.sort((a, b) => b.matchScore - a.matchScore);
  }

  private highlight(text: string, query: string): string {
    // Simple highlighting (can be enhanced)
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  private getContext(message: any) {
    // Fetch previous and next messages for context
    // Implementation depends on your message structure
    return {
      previousMessage: undefined,
      nextMessage: undefined
    };
  }
}
```

**Verification:**
- [ ] Full-text search returns results
- [ ] Highlighting works
- [ ] Performance acceptable (<500ms)

#### Phase 2.3: Semantic Search Integration (3 hours)

```typescript
// lib/search/semanticSearch.ts
import { graphragService } from '@/lib/graphrag/service/graphrag-service';

export class SemanticSearch {
  async search(userId: string, query: SearchQuery): Promise<SearchResult[]> {
    // Use GraphRAG to find semantically similar content
    const graphragResults = await graphragService.search(userId, query.query, {
      topK: query.limit || 20,
      threshold: 0.7
    });

    if (!graphragResults.contextUsed) {
      return []; // No relevant results
    }

    // Convert GraphRAG results to SearchResult format
    const results: SearchResult[] = graphragResults.sources?.map(source => ({
      type: 'message',
      id: source.id,
      conversationId: source.conversationId,
      conversationTitle: source.conversationTitle || 'Untitled',
      content: source.content,
      highlightedContent: source.content, // Can add semantic highlighting
      matchScore: source.similarity || 0,
      created_at: source.created_at,
      context: {
        previousMessage: source.context?.previous,
        nextMessage: source.context?.next
      }
    })) || [];

    return results;
  }
}
```

**Verification:**
- [ ] Semantic search returns relevant results
- [ ] GraphRAG integration works
- [ ] Results ranked by relevance

#### Phase 2.4: Filter Engine (2 hours)

```typescript
// lib/search/filterEngine.ts
export class FilterEngine {
  apply(results: SearchResult[], filters?: SearchFilters): SearchResult[] {
    if (!filters) return results;

    let filtered = results;

    // Date range filter
    if (filters.dateRange) {
      filtered = filtered.filter(r => {
        const date = new Date(r.created_at);
        return date >= filters.dateRange!.start && date <= filters.dateRange!.end;
      });
    }

    // Message role filter
    if (filters.messageRole) {
      filtered = filtered.filter(r => {
        return r.type === 'message' && r.role === filters.messageRole;
      });
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(r => {
        return r.tags?.some(tag => filters.tags!.includes(tag));
      });
    }

    // Archived filter
    if (filters.archived !== undefined) {
      filtered = filtered.filter(r => r.archived === filters.archived);
    }

    // Conversation IDs filter
    if (filters.conversationIds && filters.conversationIds.length > 0) {
      filtered = filtered.filter(r => {
        return filters.conversationIds!.includes(r.conversationId);
      });
    }

    return filtered;
  }
}
```

**Verification:**
- [ ] All filters work correctly
- [ ] Multiple filters can be combined
- [ ] Empty filters don't break results

#### Phase 2.5: API Routes (2 hours)

```typescript
// app/api/search/query/route.ts
import { searchService } from '@/lib/search/searchService';

export async function POST(request: Request) {
  const { userId } = await getAuth(request);
  const query: SearchQuery = await request.json();

  const results = await searchService.search(userId, query);

  return Response.json(results);
}
```

```typescript
// app/api/search/history/route.ts
export async function GET(request: Request) {
  const { userId } = await getAuth(request);

  const { data } = await supabase
    .from('search_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  return Response.json(data);
}
```

**Verification:**
- [ ] API endpoints work
- [ ] Authentication enforced
- [ ] Error handling complete

#### Phase 2.6: UI Components (3-4 hours)

**Global Search Bar:**
```typescript
// components/search/SearchBar.tsx
export function SearchBar() {
  const [query, setQuery] = useState('');
  const { search, loading } = useSearch();
  const router = useRouter();

  const handleSearch = () => {
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Search conversations..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSearch()}
        className="pl-10"
      />
      {loading && <Spinner className="absolute right-3 top-3" />}
    </div>
  );
}
```

**Search Results Page:**
```typescript
// app/search/page.tsx
export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const { results, loading, filters, setFilters } = useSearch(query);

  return (
    <div className="container mx-auto p-6">
      <div className="flex gap-6">
        {/* Filters Sidebar */}
        <aside className="w-64">
          <SearchFilters filters={filters} onChange={setFilters} />
        </aside>

        {/* Results */}
        <main className="flex-1">
          <h1 className="text-2xl font-semibold mb-4">
            Search Results for "{query}"
          </h1>

          {loading ? (
            <LoadingSpinner />
          ) : results.length === 0 ? (
            <EmptyState message="No results found" />
          ) : (
            <SearchResults results={results} />
          )}
        </main>
      </div>
    </div>
  );
}
```

**Search Result Card:**
```typescript
// components/search/SearchResult.tsx
export function SearchResult({ result }: { result: SearchResult }) {
  const router = useRouter();

  const handleClick = () => {
    // Navigate to conversation and highlight message
    router.push(`/chat?id=${result.conversationId}&highlight=${result.id}`);
  };

  return (
    <div
      className="p-4 border rounded-lg hover:bg-muted cursor-pointer"
      onClick={handleClick}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium">{result.conversationTitle}</h3>
        <span className="text-sm text-muted-foreground">
          {formatDate(result.created_at)}
        </span>
      </div>

      <div
        className="text-sm"
        dangerouslySetInnerHTML={{ __html: result.highlightedContent }}
      />

      {result.context && (
        <div className="mt-2 text-xs text-muted-foreground">
          {result.context.previousMessage && (
            <p>... {result.context.previousMessage.substring(0, 50)}...</p>
          )}
        </div>
      )}
    </div>
  );
}
```

**Verification:**
- [ ] Search bar functional
- [ ] Results page displays correctly
- [ ] Click navigates to conversation
- [ ] Filters update results
- [ ] UI responsive

### Success Criteria

- [ ] Full-text search across conversations and messages
- [ ] Semantic search using GraphRAG
- [ ] Hybrid search combines both methods
- [ ] Advanced filters (date, role, tags, archived)
- [ ] Search results highlight matches
- [ ] Click result navigates to message
- [ ] Search history tracked
- [ ] Performance <1 second for most queries
- [ ] Mobile-responsive UI

---

## **FEATURE 3: USAGE ANALYTICS DASHBOARD**

### Priority: ⭐⭐⭐⭐ (Tier 1)

### Estimated Time: 6-8 hours

### Objective
Provide users with insights into their usage patterns, token consumption, estimated costs, and conversation analytics.

### Features
1. **Token Tracking**
   - Input tokens per conversation
   - Output tokens per conversation
   - Total tokens per day/week/month
   - Token usage trends

2. **Cost Estimation**
   - Estimated costs by provider (OpenAI, Anthropic, etc.)
   - Cost per conversation
   - Monthly spending projections
   - Cost breakdown by model

3. **Usage Statistics**
   - Total conversations
   - Total messages
   - Average conversation length
   - Most active times
   - Tool usage statistics
   - GraphRAG usage statistics

4. **Visualizations**
   - Line charts (usage over time)
   - Pie charts (cost by provider)
   - Bar charts (messages per day)
   - Heatmaps (activity by hour/day)

### Technical Architecture

#### Database Schema Updates

```sql
-- Create usage tracking table
CREATE TABLE usage_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,

  -- Token usage
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,

  -- Cost
  estimated_cost_usd DECIMAL(10, 6),
  provider TEXT NOT NULL, -- 'openai', 'anthropic', etc.
  model TEXT NOT NULL,

  -- Context
  tool_used TEXT[], -- Array of tool names used
  graphrag_used BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  date DATE GENERATED ALWAYS AS (DATE(created_at)) STORED,
  hour INTEGER GENERATED ALWAYS AS (EXTRACT(HOUR FROM created_at)::INTEGER) STORED,

  INDEX idx_usage_user_id ON usage_analytics(user_id),
  INDEX idx_usage_date ON usage_analytics(date),
  INDEX idx_usage_created_at ON usage_analytics(created_at)
);

-- RLS policies
ALTER TABLE usage_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage"
  ON usage_analytics FOR SELECT
  USING (auth.uid() = user_id);

-- Create materialized view for fast aggregation
CREATE MATERIALIZED VIEW usage_summary AS
SELECT
  user_id,
  DATE_TRUNC('day', created_at) as day,
  provider,
  model,
  COUNT(*) as request_count,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(total_tokens) as total_tokens,
  SUM(estimated_cost_usd) as total_cost
FROM usage_analytics
GROUP BY user_id, DATE_TRUNC('day', created_at), provider, model;

CREATE UNIQUE INDEX ON usage_summary (user_id, day, provider, model);

-- Refresh schedule (can be automated with pg_cron)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY usage_summary;
```

#### File Structure

```
lib/
├── analytics/
│   ├── types.ts                    # Analytics interfaces
│   ├── config.ts                   # Pricing config per provider
│   ├── tracker.ts                  # Usage tracking service
│   ├── calculator.ts               # Cost calculation
│   ├── aggregator.ts               # Data aggregation
│   └── exporter.ts                 # Export analytics data

components/
├── analytics/
│   ├── AnalyticsDashboard.tsx      # Main dashboard
│   ├── TokenUsageChart.tsx         # Token usage visualization
│   ├── CostBreakdown.tsx           # Cost visualization
│   ├── UsageStats.tsx              # Statistics cards
│   ├── ActivityHeatmap.tsx         # Activity heatmap
│   └── ExportAnalytics.tsx         # Export button

hooks/
├── useAnalytics.ts                 # Analytics hook
└── useUsageTracking.ts             # Track usage hook

app/
├── analytics/
│   └── page.tsx                    # Analytics page
└── api/
    └── analytics/
        ├── usage/route.ts          # GET /api/analytics/usage
        ├── costs/route.ts          # GET /api/analytics/costs
        └── export/route.ts         # POST /api/analytics/export
```

### Implementation Phases

#### Phase 3.1: Usage Tracking Foundation (2 hours)

**Pricing Configuration:**
```typescript
// lib/analytics/config.ts
export const PRICING_CONFIG = {
  openai: {
    'gpt-4': {
      input: 0.00003,  // $ per token
      output: 0.00006
    },
    'gpt-3.5-turbo': {
      input: 0.0000015,
      output: 0.000002
    }
  },
  anthropic: {
    'claude-3-opus': {
      input: 0.000015,
      output: 0.000075
    },
    'claude-3-sonnet': {
      input: 0.000003,
      output: 0.000015
    }
  },
  // Add other providers...
};

export function calculateCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = PRICING_CONFIG[provider]?.[model];
  if (!pricing) return 0;

  return (inputTokens * pricing.input) + (outputTokens * pricing.output);
}
```

**Usage Tracker:**
```typescript
// lib/analytics/tracker.ts
export class UsageTracker {
  async track(data: {
    userId: string;
    conversationId?: string;
    messageId?: string;
    inputTokens: number;
    outputTokens: number;
    provider: string;
    model: string;
    toolsUsed?: string[];
    graphragUsed?: boolean;
  }) {
    const totalTokens = data.inputTokens + data.outputTokens;
    const estimatedCost = calculateCost(
      data.provider,
      data.model,
      data.inputTokens,
      data.outputTokens
    );

    await supabase.from('usage_analytics').insert({
      user_id: data.userId,
      conversation_id: data.conversationId,
      message_id: data.messageId,
      input_tokens: data.inputTokens,
      output_tokens: data.outputTokens,
      total_tokens: totalTokens,
      estimated_cost_usd: estimatedCost,
      provider: data.provider,
      model: data.model,
      tool_used: data.toolsUsed || [],
      graphrag_used: data.graphragUsed || false
    });
  }
}

export const usageTracker = new UsageTracker();
```

**Integration in Chat API:**
```typescript
// In app/api/chat/route.ts
// After receiving response from LLM
await usageTracker.track({
  userId,
  conversationId,
  messageId: newMessage.id,
  inputTokens: response.usage?.prompt_tokens || 0,
  outputTokens: response.usage?.completion_tokens || 0,
  provider: 'openai', // or current provider
  model: 'gpt-4',
  toolsUsed: toolsExecuted,
  graphragUsed: graphRAGMetadata?.sources?.length > 0
});
```

**Verification:**
- [ ] Usage tracked in database
- [ ] Costs calculated correctly
- [ ] Integration with chat works

#### Phase 3.2: Analytics Aggregation Service (2 hours)

```typescript
// lib/analytics/aggregator.ts
export class AnalyticsAggregator {
  async getUserUsageSummary(
    userId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<UsageSummary> {
    // Query aggregated data
    const { data } = await supabase
      .from('usage_summary')
      .select('*')
      .eq('user_id', userId)
      .gte('day', dateRange.start.toISOString())
      .lte('day', dateRange.end.toISOString());

    // Aggregate across days
    const summary = {
      totalTokens: 0,
      totalCost: 0,
      byProvider: {} as Record<string, ProviderUsage>,
      byDay: [] as DailyUsage[]
    };

    data?.forEach(row => {
      summary.totalTokens += row.total_tokens;
      summary.totalCost += parseFloat(row.total_cost);

      // Aggregate by provider
      if (!summary.byProvider[row.provider]) {
        summary.byProvider[row.provider] = {
          tokens: 0,
          cost: 0,
          requests: 0
        };
      }
      summary.byProvider[row.provider].tokens += row.total_tokens;
      summary.byProvider[row.provider].cost += parseFloat(row.total_cost);
      summary.byProvider[row.provider].requests += row.request_count;

      // Track daily usage
      summary.byDay.push({
        date: row.day,
        tokens: row.total_tokens,
        cost: parseFloat(row.total_cost),
        requests: row.request_count
      });
    });

    return summary;
  }

  async getActivityHeatmap(userId: string): Promise<ActivityHeatmap> {
    // Get activity by hour and day of week
    const { data } = await supabase
      .rpc('get_activity_heatmap', { p_user_id: userId });

    return data;
  }
}
```

**Database Function for Heatmap:**
```sql
-- Create function for activity heatmap
CREATE OR REPLACE FUNCTION get_activity_heatmap(p_user_id UUID)
RETURNS TABLE (
  day_of_week INTEGER,
  hour INTEGER,
  message_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    EXTRACT(DOW FROM created_at)::INTEGER as day_of_week,
    EXTRACT(HOUR FROM created_at)::INTEGER as hour,
    COUNT(*) as message_count
  FROM usage_analytics
  WHERE user_id = p_user_id
    AND created_at >= NOW() - INTERVAL '30 days'
  GROUP BY day_of_week, hour
  ORDER BY day_of_week, hour;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Verification:**
- [ ] Aggregation queries work
- [ ] Performance acceptable (<1s)
- [ ] Data accurate

#### Phase 3.3: API Routes (1 hour)

```typescript
// app/api/analytics/usage/route.ts
import { analyticsAggregator } from '@/lib/analytics/aggregator';

export async function GET(request: Request) {
  const { userId } = await getAuth(request);
  const { searchParams } = new URL(request.url);

  const start = new Date(searchParams.get('start') || Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = new Date(searchParams.get('end') || Date.now());

  const summary = await analyticsAggregator.getUserUsageSummary(userId, { start, end });

  return Response.json(summary);
}
```

```typescript
// app/api/analytics/costs/route.ts
export async function GET(request: Request) {
  const { userId } = await getAuth(request);

  const { data } = await supabase
    .from('usage_analytics')
    .select('provider, model, estimated_cost_usd, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  return Response.json(data);
}
```

**Verification:**
- [ ] API routes return data
- [ ] Date range filtering works
- [ ] Authentication enforced

#### Phase 3.4: Dashboard UI Components (3-4 hours)

**Main Dashboard:**
```typescript
// app/analytics/page.tsx
export default function AnalyticsPage() {
  const { usage, loading } = useAnalytics();

  if (loading) return <LoadingSpinner />;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Usage Analytics</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <UsageStats
          title="Total Tokens"
          value={usage.totalTokens.toLocaleString()}
          icon={<Zap />}
        />
        <UsageStats
          title="Total Cost"
          value={`$${usage.totalCost.toFixed(2)}`}
          icon={<DollarSign />}
        />
        <UsageStats
          title="Requests"
          value={usage.totalRequests.toLocaleString()}
          icon={<Activity />}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TokenUsageChart data={usage.byDay} />
        <CostBreakdown data={usage.byProvider} />
      </div>

      {/* Activity Heatmap */}
      <ActivityHeatmap data={usage.activityHeatmap} />

      {/* Export */}
      <ExportAnalytics data={usage} />
    </div>
  );
}
```

**Token Usage Chart:**
```typescript
// components/analytics/TokenUsageChart.tsx
import { Line } from 'recharts';

export function TokenUsageChart({ data }: { data: DailyUsage[] }) {
  return (
    <div className="p-6 border rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Token Usage Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="tokens" stroke="#8884d8" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**Cost Breakdown:**
```typescript
// components/analytics/CostBreakdown.tsx
import { Pie } from 'recharts';

export function CostBreakdown({ data }: { data: Record<string, ProviderUsage> }) {
  const chartData = Object.entries(data).map(([provider, usage]) => ({
    name: provider,
    value: usage.cost
  }));

  return (
    <div className="p-6 border rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Cost by Provider</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label
          />
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**Dependencies to Install:**
```bash
npm install recharts
npm install --save-dev @types/recharts
```

**Verification:**
- [ ] Dashboard displays correctly
- [ ] Charts render with data
- [ ] UI responsive
- [ ] No performance issues

### Success Criteria

- [ ] Usage tracked automatically for all messages
- [ ] Token counts accurate
- [ ] Cost estimates match provider pricing
- [ ] Dashboard displays key metrics
- [ ] Charts visualize data clearly
- [ ] Activity heatmap shows usage patterns
- [ ] Export functionality works
- [ ] Performance <2 seconds to load
- [ ] Mobile-responsive UI

---

## **FEATURES 4-10: OVERVIEW**

The remaining features (4-10) will be documented in similar detail. Here's a brief overview:

### Feature 4: Conversation Organization (Tier 2, 8-10 hours)
- Tags and categories
- Folder structure
- Bulk operations
- Favorites/pinned

### Feature 5: Custom Prompt Templates (Tier 2, 6-8 hours)
- Save frequently used prompts
- Template variables
- Template library
- Quick access

### Feature 6: Enhanced Tool Suite (Tier 2, 10-12 hours)
- File operations tool
- Code execution sandbox
- Email tool
- Calendar tool

### Feature 7: Conversation Sharing (Tier 3, 8-10 hours)
- Share via link
- Access controls
- Expiring links
- Analytics

### Feature 8: Message Reactions & Enhanced Feedback (Tier 3, 6-8 hours)
- Emoji reactions
- Inline comments
- Highlights
- Better feedback UI

### Feature 9: Multi-modal Support (Tier 3, 12-15 hours)
- Image upload and analysis
- Voice input (STT)
- Audio output (TTS)
- Screenshot annotation

### Feature 10: Conversation Branching (Tier 3, 10-12 hours)
- Fork conversations
- Compare paths
- Merge branches
- Visualization

---

## 📅 IMPLEMENTATION TIMELINE

### Week 1-2: Tier 1 Features (High Priority)
- **Days 1-2:** Feature 1 - Message Export/Archive (10 hours)
- **Days 3-4:** Feature 2 - Conversation Search (12 hours)
- **Days 5:** Feature 3 - Usage Analytics Dashboard (8 hours)

**Total Tier 1:** ~30 hours (~2 weeks)

### Week 3-4: Tier 2 Features (Medium Priority)
- **Days 8-9:** Feature 4 - Conversation Organization (10 hours)
- **Days 10-11:** Feature 5 - Custom Prompt Templates (8 hours)
- **Days 12-14:** Feature 6 - Enhanced Tool Suite (12 hours)

**Total Tier 2:** ~30 hours (~2 weeks)

### Week 5-6: Tier 3 Features (Advanced)
- **Days 15-16:** Feature 7 - Conversation Sharing (10 hours)
- **Days 17-18:** Feature 8 - Message Reactions (8 hours)
- **Days 19-21:** Feature 9 - Multi-modal Support (15 hours)
- **Days 22-24:** Feature 10 - Conversation Branching (12 hours)

**Total Tier 3:** ~45 hours (~3 weeks)

### Total Project Timeline
- **Total Hours:** ~105 hours
- **Total Weeks:** ~7 weeks (at ~15 hours/week)
- **Total Calendar Time:** ~2 months (with buffer)

---

## 🚀 PREREQUISITES

### Before Starting Implementation

1. **Complete Phase 4.4-4.6** ✅
   - Finish Chat.tsx modernization
   - Ensure UI is consistent

2. **Database Backup** ✅
   - Full Supabase backup
   - Test restore procedure

3. **Testing Environment** ✅
   - Staging environment setup
   - Test data populated

4. **Documentation Review** ✅
   - Review all existing docs
   - Verify current system status

---

## ✅ SUCCESS METRICS

### Technical Metrics
- [ ] All features TypeScript compiled without errors
- [ ] All features have API tests
- [ ] All features have unit tests
- [ ] Performance: Page load <2 seconds
- [ ] Performance: API response <1 second
- [ ] Mobile responsive (all features)
- [ ] No breaking changes to existing features

### User Experience Metrics
- [ ] Feature discoverability: Clear UI/UX
- [ ] Error handling: Graceful degradation
- [ ] Loading states: Clear feedback
- [ ] Help documentation: Complete guides
- [ ] Keyboard shortcuts: Major actions
- [ ] Accessibility: WCAG 2.1 AA compliance

### Business Metrics
- [ ] User adoption: 80%+ of users try new features
- [ ] User retention: No drop in daily active users
- [ ] Bug reports: <5 critical bugs per feature
- [ ] Support tickets: <10% increase
- [ ] Performance: No degradation of existing features

---

## 🔄 MAINTENANCE PLAN

### Ongoing Tasks

1. **Weekly Reviews**
   - Monitor analytics
   - Review error logs
   - Check performance metrics
   - User feedback analysis

2. **Monthly Updates**
   - Security patches
   - Dependency updates
   - Performance optimization
   - Feature refinements

3. **Quarterly Planning**
   - Roadmap review
   - Feature prioritization
   - Tech debt assessment
   - Architecture review

---

## 📝 NOTES

### Implementation Philosophy
1. **Incremental:** Build features one at a time
2. **Verified:** Test each phase before proceeding
3. **Documented:** Maintain comprehensive docs
4. **Reversible:** Always have rollback plans
5. **User-Centric:** Focus on user value

### Risk Mitigation
- Feature flags for gradual rollout
- Canary deployments for testing
- Database migrations with rollback
- Monitoring and alerting setup
- Incident response procedures

---

**Plan Status:** 📋 AWAITING APPROVAL
**Next Step:** User review and prioritization
**Questions:** Which tier should we start with? Any features to add/remove?
