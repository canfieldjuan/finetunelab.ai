# BYOM Demo Export System - Full Integration Guide

**Status:** ✅ Enhanced with Unified Export V2
**Date:** 2026-01-03
**Purpose:** Bring full persona-based export capabilities to BYOM demo test page

---

## 🎯 **What's New**

The BYOM demo now supports **full persona-based exports** using the unified export v2 system:

### Before (Old Implementation)
- ❌ Only CSV and JSON formats
- ❌ No persona selection
- ❌ Basic metrics only
- ❌ Same export for everyone

### After (New Implementation)
- ✅ 4 formats: CSV, JSON, HTML, PDF
- ✅ 3 personas: CEO, Senior Dev, New Team Member
- ✅ Full analytics integration
- ✅ Audience-specific reports

---

## 📁 **Files Created**

### 1. `DemoExportModal.tsx`
**Enhanced export modal component**

**Features:**
- Format selector (CSV, JSON, HTML, PDF)
- Persona selector (Executive, Engineering, Onboarding)
- Real-time export preview
- Error handling
- Success feedback

**Usage:**
```tsx
import { DemoExportModal } from '@/BYOM-Demo-Test-Page/DemoExportModal';

// In your demo page component:
const [showExportModal, setShowExportModal] = useState(false);

<DemoExportModal
  isOpen={showExportModal}
  onClose={() => setShowExportModal(false)}
  sessionId={sessionConfig.session_id}
  modelName={sessionConfig.model_name}
/>
```

### 2. `demo-export-handler.ts`
**Backend transformation layer**

**Features:**
- Transform demo results → analytics dataset
- Persona-specific export configs
- Type-safe interfaces
- Usage examples

**Key Functions:**
```typescript
// Transform demo data to analytics format
transformDemoToAnalyticsDataset(sessionId, modelName, metrics, results, audience);

// Get persona configuration
getPersonaExportConfig('executive' | 'engineering' | 'onboarding');
```

### 3. `README.md` (this file)
**Complete documentation**

---

## 🎨 **Persona Templates**

### 👔 **Executive (CEO/Leadership)**

**Target Audience:** CEO, stakeholders, business leadership

**Report Includes:**
- High-level overview (1 page)
- Key performance indicators (max 6)
- Cost trend chart
- Recommended business actions
- **NO** technical jargon
- Business-friendly language

**Use Cases:**
- Board presentations
- Investor updates
- Quarterly reviews
- Budget justifications

---

### 💻 **Engineering (Senior Developer)**

**Target Audience:** Senior developers, DevOps, technical leads

**Report Includes:**
- Detailed performance metrics
- Error stack traces
- Latency breakdowns (P50, P95, P99)
- Performance bottlenecks
- Optimization suggestions
- **YES** technical language
- Unlimited pages

**Use Cases:**
- Debugging sessions
- Performance optimization
- Code reviews
- Technical documentation

---

### 🎓 **Onboarding (New Team Member)**

**Target Audience:** New developers, junior engineers, interns

**Report Includes:**
- System overview (~5 pages)
- Model capabilities explanation
- Usage patterns
- Best practices
- Common issues and solutions
- Minimal technical jargon
- Getting started guide

**Use Cases:**
- New hire onboarding
- Team training
- Documentation for non-technical stakeholders
- FAQ reference

---

## 🚀 **Integration Steps**

### Step 1: Update Demo Page

Replace the old export button in `/app/demo/test-model/page.tsx`:

```tsx
// OLD CODE (lines 393-411):
<div className="grid grid-cols-2 gap-4">
  <Button
    variant="outline"
    onClick={() => handleExport('csv')}
    disabled={isExporting}
    className="h-20 flex-col"
  >
    <FileText className="h-6 w-6 mb-2" />
    Export CSV
  </Button>
  <Button
    variant="outline"
    onClick={() => handleExport('json')}
    disabled={isExporting}
    className="h-20 flex-col"
  >
    <FileText className="h-6 w-6 mb-2" />
    Export JSON
  </Button>
</div>

// NEW CODE:
import { DemoExportModal } from '@/BYOM-Demo-Test-Page/DemoExportModal';

const [showExportModal, setShowExportModal] = useState(false);

<Button
  onClick={() => setShowExportModal(true)}
  className="w-full bg-orange-500 hover:bg-orange-600 text-white h-16"
  size="lg"
>
  <Download className="mr-2 h-5 w-5" />
  Export Results (3 Personas Available)
</Button>

<DemoExportModal
  isOpen={showExportModal}
  onClose={() => setShowExportModal(false)}
  sessionId={sessionConfig.session_id}
  modelName={sessionConfig.model_name}
/>
```

---

### Step 2: Create Advanced Export API Route

Create `/app/api/demo/v2/export/advanced/route.ts`:

```typescript
/**
 * Advanced Demo Export API with Persona Support
 * GET /api/demo/v2/export/advanced
 *
 * Query params:
 * - session_id: Demo session ID (required)
 * - format: csv | json | html | pdf (required)
 * - audience: executive | engineering | onboarding (required for html/pdf)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getDemoSessionMetrics,
  getDemoPromptResults,
  getDemoTestRunSummary,
} from '@/lib/demo/demo-analytics.service';
import {
  transformDemoToAnalyticsDataset,
  getPersonaExportConfig,
} from '@/BYOM-Demo-Test-Page/demo-export-handler';
import { renderTemplate } from '@/lib/analytics/export/templates';
import { renderReportToHtml } from '@/lib/analytics/export/renderers/html';
import { renderReportToPdf } from '@/lib/analytics/export/renderers/pdf';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    const format = searchParams.get('format') as 'csv' | 'json' | 'html' | 'pdf';
    const audience = searchParams.get('audience') as 'executive' | 'engineering' | 'onboarding';

    // Validation
    if (!sessionId) {
      return NextResponse.json(
        { error: 'session_id is required' },
        { status: 400 }
      );
    }

    if (!format) {
      return NextResponse.json(
        { error: 'format is required' },
        { status: 400 }
      );
    }

    // For CSV/JSON, redirect to basic demo export
    if (format === 'csv' || format === 'json') {
      const redirectUrl = `/api/demo/v2/export?session_id=${sessionId}&format=${format}`;
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }

    // For HTML/PDF, require audience
    if (!audience || !['executive', 'engineering', 'onboarding'].includes(audience)) {
      return NextResponse.json(
        { error: 'audience is required for HTML/PDF exports (executive, engineering, or onboarding)' },
        { status: 400 }
      );
    }

    // Fetch demo data
    const metrics = await getDemoSessionMetrics(sessionId);
    const results = await getDemoPromptResults(sessionId);
    const summary = await getDemoTestRunSummary(sessionId);
    const modelName = summary.model_name || 'Unknown Model';

    // Transform to analytics dataset
    const dataset = transformDemoToAnalyticsDataset(
      sessionId,
      modelName,
      metrics,
      results,
      audience
    );

    // Render using persona template
    const renderedReport = renderTemplate(audience, dataset);

    // Generate output based on format
    if (format === 'html') {
      const html = renderReportToHtml(renderedReport);
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${sessionId.slice(0, 8)}_${audience}_report_${timestamp}.html`;

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } else if (format === 'pdf') {
      const pdfBuffer = await renderReportToPdf(renderedReport);
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${sessionId.slice(0, 8)}_${audience}_report_${timestamp}.pdf`;

      return new Response(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json(
      { error: 'Unsupported format' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Advanced Demo Export] Error:', error);
    return NextResponse.json(
      { error: 'Export failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

---

## 🧪 **Testing Checklist**

### Frontend Testing

- [ ] Modal opens when "Export Results" clicked
- [ ] All 4 format buttons selectable
- [ ] Persona selector appears for HTML/PDF
- [ ] Export summary updates correctly
- [ ] Error messages display properly
- [ ] Success message shows after export
- [ ] Modal closes after successful export
- [ ] Cancel button works

### Backend Testing

- [ ] CSV export downloads correctly
- [ ] JSON export downloads correctly
- [ ] HTML export with executive persona works
- [ ] HTML export with engineering persona works
- [ ] HTML export with onboarding persona works
- [ ] PDF export with executive persona works
- [ ] PDF export with engineering persona works
- [ ] PDF export with onboarding persona works
- [ ] Error handling for missing session_id
- [ ] Error handling for invalid audience

### Persona Validation

#### Executive Report
- [ ] 1-page summary
- [ ] No technical jargon
- [ ] Cost trends visible
- [ ] Business-friendly language
- [ ] Recommended actions included

#### Engineering Report
- [ ] Detailed metrics
- [ ] Error stack traces
- [ ] Latency breakdowns (P50, P95, P99)
- [ ] Technical language used
- [ ] Optimization suggestions

#### Onboarding Report
- [ ] System overview clear
- [ ] Usage patterns explained
- [ ] Best practices listed
- [ ] Minimal technical jargon
- [ ] Getting started guide included

---

## 📊 **Example Outputs**

### Executive Export (PDF)
```
┌─────────────────────────────────────────┐
│  AI Operations Executive Summary        │
├─────────────────────────────────────────┤
│                                         │
│  Model: gpt-4-turbo                    │
│  Period: Jan 3, 2026                   │
│                                         │
│  KEY METRICS                           │
│  • Success Rate: 95%                   │
│  • Average Latency: 1.2s               │
│  • Total Cost: $2.45                   │
│  • Tests Completed: 10/10              │
│                                         │
│  COST TREND                            │
│  [Chart showing cost over time]        │
│                                         │
│  RECOMMENDED ACTIONS                   │
│  1. Maintain current performance       │
│  2. Budget allocation sufficient       │
│  3. Consider scaling for production    │
│                                         │
└─────────────────────────────────────────┘
```

### Engineering Export (HTML)
```html
<h1>Technical Performance Report</h1>

<h2>Latency Analysis</h2>
<table>
  <tr><td>P50</td><td>980ms</td></tr>
  <tr><td>P95</td><td>1,450ms</td></tr>
  <tr><td>P99</td><td>2,100ms</td></tr>
</table>

<h2>Error Stack Traces</h2>
<pre>
Error: Rate limit exceeded
  at OpenAI.request (openai.ts:245)
  at ChatCompletion.create (chat.ts:89)
</pre>

<h2>Optimization Suggestions</h2>
<ul>
  <li>Implement request batching</li>
  <li>Add caching layer for common prompts</li>
  <li>Consider async processing for non-realtime requests</li>
</ul>
```

---

## 🔧 **Environment Variables**

No additional environment variables needed! The unified export system uses existing config.

---

## 🚦 **Next Steps**

1. ✅ Create `DemoExportModal.tsx` component
2. ✅ Create `demo-export-handler.ts` transformer
3. ✅ Document integration guide (this README)
4. ⏳ Implement `/api/demo/v2/export/advanced/route.ts`
5. ⏳ Update demo page to use new modal
6. ⏳ Test all 3 personas × 2 formats (HTML, PDF) = 6 combinations
7. ⏳ Verify CSV/JSON still work via fallback
8. ⏳ User acceptance testing

---

## 📚 **Related Documentation**

- `/lib/export-unified/README.md` - Unified Export V2 system
- `/lib/analytics/export/templates/` - Persona templates
- `/components/analytics/types.ts` - Export type definitions
- `/app/api/export/v2/route.ts` - Unified export API v2

---

## 💡 **Future Enhancements**

- [ ] Add "Custom" persona with section selector
- [ ] Email export directly from modal
- [ ] Schedule recurring exports
- [ ] Compare multiple sessions side-by-side
- [ ] Export to Google Sheets / Excel Online
- [ ] Export history in user account

---

## 🤝 **Contributing**

When adding new features to BYOM export:

1. Follow persona patterns (CEO, Senior Dev, New Team Member)
2. Use unified export v2 APIs
3. Update this README
4. Add tests for all personas
5. Verify mobile responsiveness

---

## 📄 **License**

See main project LICENSE file.

---

**Built with ❤️ for FineTuneLab**
_Making AI model testing accessible for everyone_
