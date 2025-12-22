# Unified Export System

**Status:** Phase 1 Complete - Foundation
**Version:** 1.0.0
**Last Updated:** 2025-12-21

## Overview

The Unified Export System consolidates all export functionality (conversations, analytics, traces) into a single, cohesive architecture. This replaces the previous fragmented approach with 3+ separate export systems.

## Architecture

### Core Components

```
lib/export-unified/
├── UnifiedExportService.ts     # Central orchestrator
├── interfaces.ts               # All TypeScript definitions
├── config.ts                   # Unified configuration
├── index.ts                    # Public API exports
│
├── loaders/                    # Data loaders (Phase 2)
│   ├── DataLoader.ts
│   ├── ConversationDataLoader.ts
│   ├── AnalyticsDataLoader.ts
│   └── TraceDataLoader.ts
│
├── formatters/                 # Format generators (Phase 3)
│   ├── FormatGenerator.ts
│   ├── CSVFormatter.ts
│   ├── JSONFormatter.ts
│   ├── JSONLFormatter.ts
│   ├── MarkdownFormatter.ts
│   ├── TXTFormatter.ts
│   ├── HTMLFormatter.ts
│   └── PDFFormatter.ts
│
├── templates/                  # Report templates (Phase 3)
│   ├── TemplateRenderer.ts
│   ├── executive.ts
│   ├── engineering.ts
│   └── onboarding.ts
│
├── storage/                    # Storage providers
│   ├── FilesystemStorage.ts
│   └── SupabaseStorage.ts
│
└── utils/                      # Utilities (Phase 2-3)
    ├── validation.ts
    └── csv-helpers.ts
```

## Quick Start

### Basic Usage

```typescript
import { getUnifiedExportService } from '@/lib/export-unified';

// Get service instance
const exportService = getUnifiedExportService();

// Create an export
const result = await exportService.generateExport({
  userId: 'user-123',
  exportType: 'conversation',
  format: 'json',
  dataSelector: {
    type: 'conversation',
    conversationIds: ['conv-1', 'conv-2'],
    includeSystemMessages: false,
  },
  options: {
    includeMetadata: true,
    compressionFormat: 'none',
  },
});

console.log(`Export created: ${result.downloadUrl}`);
console.log(`Expires at: ${result.expiresAt}`);
```

### Setting up Storage

```typescript
import { getUnifiedExportService } from '@/lib/export-unified';
import { FilesystemStorage } from '@/lib/export-unified/storage/FilesystemStorage';
import { SupabaseStorage } from '@/lib/export-unified/storage/SupabaseStorage';

const service = getUnifiedExportService();

// Option 1: Filesystem storage
const fsStorage = new FilesystemStorage('/tmp/exports');
await fsStorage.initialize();
service.setStorageProvider(fsStorage);

// Option 2: Supabase Storage
const { supabase } = await import('@/lib/supabaseClient');
const supabaseStorage = new SupabaseStorage(supabase, 'exports');
await supabaseStorage.initialize();
service.setStorageProvider(supabaseStorage);
```

### Registering Loaders and Formatters

```typescript
import { getUnifiedExportService } from '@/lib/export-unified';
import { ConversationDataLoader } from '@/lib/export-unified/loaders/ConversationDataLoader';
import { JSONFormatter } from '@/lib/export-unified/formatters/JSONFormatter';

const service = getUnifiedExportService();

// Register data loader
const conversationLoader = new ConversationDataLoader();
service.registerLoader('conversation', conversationLoader);

// Register formatter
const jsonFormatter = new JSONFormatter();
service.registerFormatter('json', jsonFormatter);
```

## Export Types

### 1. Conversation Exports

Export chat conversations and messages.

**Supported Formats:** CSV, JSON, JSONL, Markdown, TXT

**Data Selector:**
```typescript
{
  type: 'conversation',
  conversationIds: string[],
  dateRange?: { start: Date; end: Date },
  widgetSessionFilter?: 'all' | 'widget' | 'normal',
  includeSystemMessages?: boolean,
  messageLimit?: number
}
```

### 2. Analytics Exports

Export analytics data, metrics, and reports.

**Supported Formats:** CSV, JSON, HTML, PDF

**Data Selector:**
```typescript
{
  type: 'analytics',
  timeRange: { start: Date; end: Date },
  metrics: string[],
  exportSubType?: 'overview' | 'timeseries' | 'complete' |
                  'model_comparison' | 'tool_usage' | 'quality_trends',
  filters?: AnalyticsExportFilters
}
```

**Export Subtypes:**
- `overview` - Summary metrics and aggregations
- `timeseries` - Time-series data with trends
- `complete` - All metrics and raw data
- `model_comparison` - Model performance comparison
- `tool_usage` - Tool execution statistics
- `quality_trends` - Quality metrics over time

### 3. Trace Exports

Export HuggingFace LLM traces and metrics.

**Supported Formats:** CSV, JSON

**Data Selector:**
```typescript
{
  type: 'trace',
  timeRange: { start: Date; end: Date },
  traceIds?: string[],
  filters?: TraceExportFilters,
  includeMetrics?: boolean
}
```

### 4. Custom Exports

Extensible for custom data sources.

**Supported Formats:** CSV, JSON, JSONL

## Export Formats

### CSV
- Structured tabular data
- Excel-compatible
- UTF-8 encoded with BOM
- Proper escaping for special characters

### JSON
- Structured, hierarchical data
- Human-readable formatting
- Complete metadata included

### JSONL (JSON Lines)
- One JSON object per line
- Streaming-friendly
- Ideal for large datasets

### Markdown
- Human-readable documentation
- Formatted conversations
- Metadata in frontmatter

### TXT
- Plain text format
- Simple message transcripts
- No special formatting

### HTML
- Template-based reports
- Charts and visualizations
- Audience-specific formatting

### PDF
- Professional reports
- Generated from HTML templates
- Printable format

## Templates

### Executive Template
- High-level summary
- Key metrics and trends
- Business impact
- Recommendations

### Engineering Template
- Detailed technical metrics
- Performance analysis
- Error diagnostics
- Optimization suggestions

### Onboarding Template
- Getting started guide
- Usage patterns
- Best practices
- Common issues

## Configuration

### Environment Variables

```bash
# General
UNIFIED_EXPORT_ENABLED=true
UNIFIED_EXPORT_EXPIRATION_HOURS=168

# Limits
UNIFIED_EXPORT_MAX_CONVERSATIONS=100
UNIFIED_EXPORT_MAX_MESSAGES=1000
UNIFIED_EXPORT_MAX_ANALYTICS_POINTS=10000
UNIFIED_EXPORT_MAX_TRACES=5000
UNIFIED_EXPORT_MAX_FILE_SIZE_MB=100
UNIFIED_EXPORT_MAX_PER_USER=50

# Storage
UNIFIED_EXPORT_STORAGE_PATH=/tmp/exports
UNIFIED_EXPORT_STORAGE_TYPE=filesystem
UNIFIED_EXPORT_USE_SUPABASE_STORAGE=false
UNIFIED_EXPORT_CLEANUP_ENABLED=true

# Performance
UNIFIED_EXPORT_ASYNC_PROCESSING=true
UNIFIED_EXPORT_ASYNC_THRESHOLD_MB=10
UNIFIED_EXPORT_CACHING=false
UNIFIED_EXPORT_CACHE_TTL_MINUTES=30
```

### Programmatic Configuration

```typescript
import { unifiedExportConfig, validateUnifiedExportConfig } from '@/lib/export-unified';

// Access configuration
console.log(unifiedExportConfig.maxFileSizeMB); // 100

// Validate configuration
const { valid, errors } = validateUnifiedExportConfig();
if (!valid) {
  console.error('Configuration errors:', errors);
}
```

## Database Schema

### unified_exports Table

```sql
CREATE TABLE unified_exports (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  export_type TEXT NOT NULL,
  format TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_name TEXT NOT NULL,
  storage_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  data_selector JSONB NOT NULL,
  options JSONB,
  metadata JSONB
);
```

### RLS Policies

- Users can only view/create/update/delete their own exports
- Service role can manage all exports (for cleanup jobs)

### Cleanup

Automatic cleanup function runs nightly:
- Marks completed exports as expired when past expiration date
- Deletes expired exports after 7 days

```sql
SELECT cleanup_expired_unified_exports();
```

## API Integration

### Phase 4-5: API Endpoints (Coming Soon)

```
POST   /api/export/v2              - Create export
GET    /api/export/v2/download/:id - Download export
GET    /api/export/v2/list         - List user's exports
DELETE /api/export/v2/:id          - Delete export
```

## Migration Strategy

### Phase 1 (Complete): Foundation
✅ Core service, storage, config, database table

### Phase 2 (Week 3): Data Loaders
⏳ Implement all data loaders

### Phase 3 (Week 4-5): Formatters & Templates
⏳ Implement all format generators

### Phase 4-5 (Week 6-7): API Migration
⏳ Migrate conversation and analytics exports

### Phase 6 (Week 8): Trace Enhancement
⏳ Enhance trace export capabilities

### Phase 7 (Week 9): Historical Data
⏳ Migrate old export records

### Phase 8-9 (Week 10-11): Deprecation & Cleanup
⏳ Remove old code and tables

## Testing

### Unit Tests
```bash
npm run test -- lib/export-unified
```

### Integration Tests
```bash
npm run test:integration -- export-unified
```

### E2E Tests
```bash
npm run test:e2e -- export-flows
```

## Performance

### Limits
- Max file size: 100 MB
- Max conversations per export: 100
- Max messages per conversation: 1,000
- Max analytics data points: 10,000
- Max traces per export: 5,000

### Async Processing
- Exports > 10 MB processed asynchronously
- Status tracked in database
- Download URL available when complete

### Caching
- Optional caching layer (disabled by default)
- 30-minute TTL
- Reduces load for repeated exports

## Security

### Row Level Security
- All database queries enforce RLS
- Users can only access their own exports

### File Access
- Private Supabase Storage bucket
- Signed URLs for downloads (1 hour expiration)
- Filesystem storage uses user-specific directories

### Validation
- Input validation on all requests
- File size limits enforced
- Rate limiting (future enhancement)

## Support

### Common Issues

**Export not found:**
- Check expiration date
- Verify user has permission
- Check storage provider is configured

**Export too large:**
- Reduce date range
- Filter data selector
- Adjust limits in config

**Format not supported:**
- Check export type compatibility
- See EXPORT_TYPE_CONFIG for supported formats

### Troubleshooting

Enable debug logging:
```bash
DEBUG=unified-export:* npm run dev
```

## Contributing

See main project CONTRIBUTING.md for guidelines.

### Adding New Export Types

1. Define data selector interface in `interfaces.ts`
2. Create data loader in `loaders/`
3. Register loader with service
4. Add to EXPORT_TYPE_CONFIG
5. Write tests

### Adding New Formats

1. Implement FormatGenerator interface
2. Create formatter in `formatters/`
3. Register formatter with service
4. Add MIME type to config
5. Write tests

## License

See main project LICENSE file.
