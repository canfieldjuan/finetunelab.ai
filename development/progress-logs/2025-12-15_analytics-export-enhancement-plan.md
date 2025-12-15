# Analytics Export Enhancement Plan
**Date:** 2025-12-15
**Status:** ALL PHASES COMPLETE
**Priority:** High - Core Feature Enhancement

## Overview
Enhancing the analytics export system to support audience-specific reports and advanced filtering. Current exports are data dumps - need structured, readable reports for different stakeholders (CEO, senior devs, new team members).

## Problem Statement
1. **No audience customization** - Same data format for everyone
2. **Limited filtering** - Cannot filter by model, success/failure, training type
3. **Reports not human-readable** - JSON output, not formatted documents
4. **Recommendations are generic** - Hardcoded rules, not contextual

## Goals
- Create audience-specific report templates (Executive, Engineering, Onboarding)
- Add filtering by model, success/failure, training job
- Generate human-readable PDF/HTML reports
- Make data accessible to all stakeholders

## Current State Analysis

### Existing Files (Verified)
- `lib/analytics/export/types.ts` - Type definitions
- `lib/analytics/export/reportGenerator.ts` - Report generation logic
- `lib/analytics/export/csvGenerator.ts` - CSV generation
- `lib/analytics/export/jsonGenerator.ts` - JSON generation
- `lib/analytics/export/storage.ts` - File storage
- `app/api/analytics/export/route.ts` - API endpoint

### Current Options Available
- **Formats:** csv, json, report
- **Export Types:** overview, timeseries, complete, model_comparison, tool_usage, quality_trends
- **Metrics:** tokens, quality, tools, conversations, errors, latency
- **Date Range:** start/end dates

### Missing Capabilities
- [ ] Filter by specific model
- [ ] Filter by success vs failure
- [ ] Filter by training job/type
- [ ] Audience templates (Executive, Engineering, Onboarding)
- [ ] PDF/HTML output formats
- [ ] Customizable report sections

## Proposed Implementation

### Phase 1: Enhanced Filtering (Foundation)
Add new filter parameters to the export system:
- `modelFilter`: string[] - Filter by model IDs
- `statusFilter`: 'all' | 'success' | 'failure'
- `trainingJobFilter`: string - Filter by training job ID
- `conversationTags`: string[] - Filter by tags

**Files to modify:**
- `lib/analytics/export/types.ts` - Add filter types
- `lib/analytics/dataAggregator.ts` - Apply filters in aggregation
- `app/api/analytics/export/route.ts` - Accept filter params

### Phase 2: Audience Templates
Create pre-configured report templates:

**Executive Template:**
- 1-page summary
- Cost/ROI metrics
- Trend indicators (up/down arrows)
- Top 3 action items
- No technical details

**Engineering Template:**
- Error breakdown by type
- P95 latency analysis
- Tool failure details
- Model performance comparison
- Debugging recommendations

**Onboarding Template:**
- System overview
- Key metrics explained
- Historical baselines
- "What good looks like" benchmarks

**Files to create:**
- `lib/analytics/export/templates/` - Template directory
- `lib/analytics/export/templates/executive.ts`
- `lib/analytics/export/templates/engineering.ts`
- `lib/analytics/export/templates/onboarding.ts`
- `lib/analytics/export/templates/types.ts`

### Phase 3: Report Rendering
Add PDF/HTML generation:
- Use existing chart configs to render actual visualizations
- Generate formatted documents
- Support branded headers/footers

**Files to create/modify:**
- `lib/analytics/export/renderers/pdf.ts`
- `lib/analytics/export/renderers/html.ts`

### Phase 4: API & Tool Updates
Update API and LLM tool to support new options:
- Add `audience` parameter
- Add `filters` object parameter
- Add `outputFormat` for PDF/HTML

## Dependencies
- PDF generation library (e.g., @react-pdf/renderer or pdfkit)
- Chart rendering for static images (e.g., chart.js with canvas)

## Risk Assessment
- **Low Risk:** Adding filter types and template types
- **Medium Risk:** Modifying dataAggregator (existing queries)
- **High Risk:** PDF generation (new dependency, complexity)

## Session Context
- Earlier in session: Fixed RLS bypass issue - tools now use authenticated client
- Analytics export tool (`analytics_export`) is LLM-callable
- Export API supports server-to-server auth via userId in body

## Detailed Implementation Plan

### Phase 1: Enhanced Filter Types (Foundation)
**Estimated Changes: 3 files**

#### 1.1 Create new filter types
**File:** `lib/analytics/export/types.ts`
**Action:** Add new interface after line 21

```typescript
// New filter interface
export interface AnalyticsExportFilters {
  models?: string[];           // Filter by specific model IDs
  status?: 'all' | 'success' | 'failure';  // Filter by success/failure
  trainingJobId?: string;      // Filter by training job
  conversationIds?: string[];  // Filter specific conversations
  minRating?: number;          // Minimum quality rating (1-5)
  toolNames?: string[];        // Filter by specific tools
}
```

#### 1.2 Update AnalyticsExportOptions
**File:** `lib/analytics/export/types.ts`
**Action:** Add `filters` property to `AnalyticsExportOptions` interface

```typescript
export interface AnalyticsExportOptions {
  // ... existing properties
  filters?: AnalyticsExportFilters;  // NEW
}
```

#### 1.3 Update dataAggregator functions
**File:** `lib/analytics/dataAggregator.ts`
**Action:** Add optional `filters` parameter to each aggregation function

**Insertion points:**
- Line 58: `aggregateTokenUsageData` - add model filter to query
- Line 162: `aggregateQualityMetrics` - add model + status filter
- Line 262: `aggregateToolUsageData` - add tool name filter
- Line 351: `aggregateConversationMetrics` - add model filter
- Line 421: `aggregateErrorData` - add model filter
- Line 502: `aggregateLatencyData` - add model filter

---

### Phase 2: Audience Templates
**Estimated Changes: 5 new files, 2 modified files**

#### 2.1 Create template types
**New File:** `lib/analytics/export/templates/types.ts`

```typescript
export type AudienceType = 'executive' | 'engineering' | 'onboarding' | 'custom';

export interface ReportTemplate {
  id: AudienceType;
  name: string;
  description: string;
  sections: ReportSection[];
  maxPages?: number;
  includeRawData: boolean;
  includeCharts: boolean;
  includeRecommendations: boolean;
}

export interface ReportSection {
  id: string;
  title: string;
  type: 'summary' | 'metrics' | 'chart' | 'table' | 'recommendations';
  priority: number;
  dataSource: string;
  formatting: SectionFormatting;
}

export interface SectionFormatting {
  showTrends: boolean;
  showComparisons: boolean;
  detailLevel: 'high' | 'medium' | 'low';
  visualStyle: 'numbers' | 'charts' | 'both';
}
```

#### 2.2 Executive Template
**New File:** `lib/analytics/export/templates/executive.ts`

Key sections:
- Cost Summary (total spend, trend, ROI indicators)
- Quality Overview (success rate arrow, avg rating)
- Top 3 Concerns (prioritized, business impact)
- Key Action Items (max 3, clear next steps)
- 1-page limit, no technical jargon

#### 2.3 Engineering Template
**New File:** `lib/analytics/export/templates/engineering.ts`

Key sections:
- Error Breakdown (by type, frequency, severity)
- Latency Analysis (P50/P95/P99, by model, trends)
- Tool Performance (success rates, execution times)
- Model Comparison (tokens, cost, quality per model)
- Debugging Recommendations (specific, actionable)

#### 2.4 Onboarding Template
**New File:** `lib/analytics/export/templates/onboarding.ts`

Key sections:
- System Overview (what the system does)
- Key Metrics Explained (definitions, why they matter)
- Historical Baselines (normal ranges)
- "Healthy System" indicators (what good looks like)
- Common Issues (FAQ-style)

#### 2.5 Template Registry
**New File:** `lib/analytics/export/templates/index.ts`

```typescript
export const templates: Record<AudienceType, ReportTemplate> = {
  executive: executiveTemplate,
  engineering: engineeringTemplate,
  onboarding: onboardingTemplate,
  custom: customTemplate,
};

export function getTemplate(audience: AudienceType): ReportTemplate;
export function renderTemplate(template: ReportTemplate, data: AnalyticsDataset): StructuredReport;
```

---

### Phase 3: Report Rendering (HTML First)
**Estimated Changes: 3 new files, 1 modified file**

#### 3.1 HTML Renderer
**New File:** `lib/analytics/export/renderers/html.ts`

- Generate styled HTML report from StructuredReport
- Include inline CSS for portability
- Support charts via embedded SVG or base64 images
- Print-friendly styling

#### 3.2 Update storage to handle HTML
**File:** `lib/analytics/export/storage.ts`
**Action:** Add HTML file type support

#### 3.3 Update API route
**File:** `app/api/analytics/export/route.ts`
**Action:**
- Add `audience` parameter
- Add `filters` parameter
- Add HTML format support

---

### Phase 4: PDF Rendering (Optional - Requires New Dependency)
**Estimated Changes: 2 new files, 1 package addition**

#### 4.1 Add PDF library
Options:
- `@react-pdf/renderer` (React-based, good for styled docs)
- `pdfkit` (Node.js native, more control)
- `puppeteer` (HTML-to-PDF, uses Chrome)

#### 4.2 PDF Renderer
**New File:** `lib/analytics/export/renderers/pdf.ts`

---

## Files Affected Summary

### New Files (Phase 1-3):
1. `lib/analytics/export/templates/types.ts`
2. `lib/analytics/export/templates/executive.ts`
3. `lib/analytics/export/templates/engineering.ts`
4. `lib/analytics/export/templates/onboarding.ts`
5. `lib/analytics/export/templates/index.ts`
6. `lib/analytics/export/renderers/html.ts`

### Modified Files (Phase 1-3):
1. `lib/analytics/export/types.ts` - Add filter types
2. `lib/analytics/dataAggregator.ts` - Add filter support to 6 functions
3. `lib/analytics/export/storage.ts` - Add HTML support
4. `app/api/analytics/export/route.ts` - Add audience, filters, HTML format
5. `lib/tools/analytics-export/index.ts` - Add audience, filters params

### Dependencies Check:
- No new dependencies for Phase 1-3 (HTML)
- Phase 4 (PDF) requires new package

## Risk Mitigation

1. **Backward Compatibility:** All new parameters are optional - existing API calls continue to work
2. **Incremental Rollout:** Each phase can be deployed independently
3. **Testing Strategy:** Add unit tests for each template before deployment
4. **Rollback Plan:** Feature flags can disable new functionality if issues arise

## Success Criteria

1. CEO can export 1-page executive summary with cost/quality trends
2. Engineers can export detailed error analysis with debugging info
3. New team members can export onboarding report explaining the system
4. All users can filter exports by model, success/failure, date range
5. HTML exports render correctly in browsers and print cleanly

## Implementation Progress

### Phase 1: COMPLETE (2025-12-15)

**Files Modified:**
1. `lib/analytics/export/types.ts` - Added `AnalyticsExportFilters` interface
2. `lib/analytics/dataAggregator.ts` - Added filter support to all 6 aggregation functions
3. `app/api/analytics/export/route.ts` - Updated to accept filters and audience params

**New Filter Options Available:**
```typescript
interface AnalyticsExportFilters {
  models?: string[];           // Filter by model IDs
  status?: 'all' | 'success' | 'failure';
  trainingJobId?: string;
  conversationIds?: string[];
  minRating?: number;          // 1-5
  toolNames?: string[];
  tags?: string[];
}
```

**API Usage Example:**
```json
POST /api/analytics/export
{
  "startDate": "2025-12-01",
  "endDate": "2025-12-15",
  "format": "json",
  "exportType": "complete",
  "filters": {
    "models": ["gpt-4", "claude-3-sonnet"],
    "status": "success",
    "minRating": 4
  }
}
```

## Next Steps
1. [x] Get user approval on plan
2. [x] Phase 1: Implement enhanced filtering
3. [x] Phase 2: Create audience templates
4. [x] Phase 3: Add HTML rendering
5. [x] Phase 4: Add PDF rendering

**ALL PHASES COMPLETE** - Analytics export system now supports:
- Filtering by model, success/failure, rating, tools, etc.
- Audience-specific templates (Executive, Engineering, Onboarding)
- HTML reports (styled, browser-viewable)
- PDF reports (professional, downloadable)

---

### Phase 2: COMPLETE (2025-12-15)

**New Files Created:**
1. `lib/analytics/export/templates/types.ts` - Comprehensive type definitions
2. `lib/analytics/export/templates/executive.ts` - Executive template (1-page summary)
3. `lib/analytics/export/templates/engineering.ts` - Engineering template (detailed technical)
4. `lib/analytics/export/templates/onboarding.ts` - Onboarding template (educational)
5. `lib/analytics/export/templates/index.ts` - Template registry with render functions

**Files Modified:**
1. `app/api/analytics/export/route.ts` - Integrated template rendering

**Template Features:**

| Template | Target Audience | Key Sections |
|----------|-----------------|--------------|
| Executive | CEO, stakeholders | KPIs, Cost Trend, Top 3 Recommendations |
| Engineering | Senior devs, SRE | Alerts, P50/P95/P99, Error Analysis, Tool Performance |
| Onboarding | New team members | System Overview, Metrics Glossary, Baselines, FAQ |

**API Usage Example:**
```json
POST /api/analytics/export
{
  "startDate": "2025-12-01",
  "endDate": "2025-12-15",
  "format": "report",
  "exportType": "complete",
  "audience": "executive",
  "filters": {
    "models": ["gpt-4"]
  }
}
```

**TypeScript Verification:** PASSED (no new errors in modified files)

---

### Phase 3: COMPLETE (2025-12-15)

**New Files Created:**
1. `lib/analytics/export/renderers/html.ts` - Complete HTML renderer with inline CSS

**Files Modified:**
1. `app/api/analytics/export/route.ts` - Added HTML renderer import and integration
2. `app/api/analytics/download/[id]/route.ts` - Added 'html' MIME type to contentTypeMap

**HTML Renderer Features:**
- Renders all section types: summary, metrics, chart, table, recommendations, breakdown, alert
- Professional styling with inline CSS (no external dependencies)
- Print-friendly with @media print styles
- Responsive layout with CSS Grid
- Status-based color coding (good/warning/critical)
- Trend indicators (up/down/stable arrows)
- Proper HTML escaping for security

**API Usage Example (HTML):**
```json
POST /api/analytics/export
{
  "startDate": "2025-12-01",
  "endDate": "2025-12-15",
  "format": "html",
  "exportType": "complete",
  "audience": "executive"
}
```

**Response:** Downloads styled HTML file viewable in any browser

**TypeScript Verification:** PASSED (no new errors in modified files)

---

### Phase 4: COMPLETE (2025-12-15)

**Dependency Added:**
- `pdfkit` (v0.16.0) - Pure Node.js PDF generation library
- `@types/pdfkit` - TypeScript definitions

**New Files Created:**
1. `lib/analytics/export/renderers/pdf.ts` - Complete PDF renderer using pdfkit

**Files Modified:**
1. `lib/analytics/export/storage.ts` - Added `writeBinaryExportFile` for PDF buffer storage
2. `app/api/analytics/export/route.ts` - Added PDF import, format validation, and binary handling
3. `app/api/analytics/download/[id]/route.ts` - Added 'pdf' MIME type

**PDF Renderer Features:**
- Professional layout with header bar and footer
- All section types: summary, metrics, chart (as table), table, recommendations, breakdown, alert
- Color-coded status indicators (green/yellow/red)
- Page breaks handled automatically
- Page numbers on all pages
- Generation timestamp in footer

**API Usage Example (PDF):**
```json
POST /api/analytics/export
{
  "startDate": "2025-12-01",
  "endDate": "2025-12-15",
  "format": "pdf",
  "exportType": "complete",
  "audience": "executive"
}
```

**Response:** Downloads professional PDF report

**TypeScript Verification:** PASSED (no new errors in modified files)

---
*Log created: 2025-12-15*
*Last updated: 2025-12-15 - Phase 4 Complete (ALL PHASES DONE)*
