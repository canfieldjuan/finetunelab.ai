/**
 * Advanced Demo Export API with Persona Support
 * GET /api/demo/v2/export/advanced
 *
 * Enables persona-based HTML/PDF exports for BYOM demo test page
 * Supports: Executive, Engineering, Onboarding templates
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
  validateDemoSession,
} from '@/lib/demo/demo-analytics.service';
import { transformDemoToAnalyticsDataset } from '@/BYOM-Demo-Test-Page/demo-export-handler';
import { renderTemplate } from '@/lib/analytics/export/templates';
import { renderReportToHtml } from '@/lib/analytics/export/renderers/html';
import { renderReportToPdf } from '@/lib/analytics/export/renderers/pdf';

export const runtime = 'nodejs';

type ExportFormat = 'csv' | 'json' | 'html' | 'pdf';
type AudiencePersona = 'executive' | 'engineering' | 'onboarding';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');
    const format = searchParams.get('format') as ExportFormat;
    const audience = searchParams.get('audience') as AudiencePersona;

    // Validate required params
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session_id parameter' }, { status: 400 });
    }

    if (!format || !['csv', 'json', 'html', 'pdf'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Use csv, json, html, or pdf' },
        { status: 400 }
      );
    }

    // For CSV/JSON, redirect to basic export API
    if (format === 'csv' || format === 'json') {
      const redirectUrl = `/api/demo/v2/export?session_id=${sessionId}&format=${format}`;
      return NextResponse.redirect(new URL(redirectUrl, req.url));
    }

    // HTML/PDF require audience parameter
    if (!audience || !['executive', 'engineering', 'onboarding'].includes(audience)) {
      return NextResponse.json(
        { error: 'Invalid audience. Use executive, engineering, or onboarding for html/pdf exports' },
        { status: 400 }
      );
    }

    console.log('[DemoAdvancedExport] Processing request:', {
      sessionId,
      format,
      audience,
    });

    // Validate session
    const validation = await validateDemoSession(sessionId);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'Invalid session' },
        { status: validation.error === 'Session expired' ? 410 : 404 }
      );
    }

    const modelName = validation.modelName || 'Unknown Model';

    // Fetch demo data
    console.log('[DemoAdvancedExport] Fetching session data...');
    const [metrics, results] = await Promise.all([
      getDemoSessionMetrics(sessionId),
      getDemoPromptResults(sessionId, { limit: 1000 }),
    ]);

    if (!metrics) {
      return NextResponse.json({ error: 'No test results found' }, { status: 404 });
    }

    // Add totalCost to metrics (demo mode = $0)
    const metricsWithCost = {
      ...metrics,
      totalCost: 0,
    };

    console.log('[DemoAdvancedExport] Transforming to analytics dataset...');
    // Transform demo data to analytics dataset format
    const analyticsDataset = transformDemoToAnalyticsDataset(
      sessionId,
      modelName,
      metricsWithCost,
      results,
      audience
    );

    console.log('[DemoAdvancedExport] Rendering template:', audience);
    // Render using persona-specific template
    const renderedReport = renderTemplate(audience, analyticsDataset);

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `finetunelab-${audience}-report-${timestamp}`;

    // Generate HTML or PDF output
    if (format === 'html') {
      console.log('[DemoAdvancedExport] Generating HTML...');
      const htmlContent = renderReportToHtml(renderedReport);

      return new Response(htmlContent, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="${filename}.html"`,
        },
      });
    }

    // PDF format
    console.log('[DemoAdvancedExport] Generating PDF...');
    const pdfBuffer = await renderReportToPdf(renderedReport);

    return new Response(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}.pdf"`,
      },
    });
  } catch (error) {
    console.error('[DemoAdvancedExport] Error:', error);

    // Log more details for debugging
    if (error instanceof Error) {
      console.error('[DemoAdvancedExport] Error details:', {
        message: error.message,
        stack: error.stack,
      });
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
