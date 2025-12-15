/**
 * Generate sample export files for visual verification
 * Run with: npx tsx scripts/generate-sample-exports.ts
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { renderTemplate } from '../lib/analytics/export/templates';
import { renderReportToHtml } from '../lib/analytics/export/renderers/html';
import { renderReportToPdf } from '../lib/analytics/export/renderers/pdf';
import type { AnalyticsDataset } from '../lib/analytics/types';

// Realistic mock dataset
const mockDataset: AnalyticsDataset = {
  userId: 'demo-user',
  timeRange: {
    start: new Date('2025-12-01'),
    end: new Date('2025-12-15'),
    period: 'all',
  },
  metrics: {
    tokenUsage: [
      { timestamp: new Date('2025-12-01'), modelId: 'gpt-4', inputTokens: 5000, outputTokens: 8000, totalTokens: 13000, estimatedCost: 0.65 },
      { timestamp: new Date('2025-12-05'), modelId: 'gpt-4', inputTokens: 6000, outputTokens: 9000, totalTokens: 15000, estimatedCost: 0.75 },
      { timestamp: new Date('2025-12-10'), modelId: 'claude-3-sonnet', inputTokens: 4000, outputTokens: 7000, totalTokens: 11000, estimatedCost: 0.44 },
      { timestamp: new Date('2025-12-15'), modelId: 'gpt-4', inputTokens: 5500, outputTokens: 8500, totalTokens: 14000, estimatedCost: 0.70 },
    ],
    quality: [
      { timestamp: new Date('2025-12-01'), rating: 4.5, feedback: 'Very helpful', conversationId: 'conv-1' },
      { timestamp: new Date('2025-12-05'), rating: 4.0, feedback: 'Good response', conversationId: 'conv-2' },
      { timestamp: new Date('2025-12-10'), rating: 3.5, feedback: 'Could be better', conversationId: 'conv-3' },
      { timestamp: new Date('2025-12-15'), rating: 5.0, feedback: 'Excellent!', conversationId: 'conv-4' },
    ],
    tools: [
      { timestamp: new Date('2025-12-01'), toolName: 'web_search', success: true, executionTimeMs: 450 },
      { timestamp: new Date('2025-12-02'), toolName: 'web_search', success: true, executionTimeMs: 380 },
      { timestamp: new Date('2025-12-03'), toolName: 'dataset_manager', success: true, executionTimeMs: 1200 },
      { timestamp: new Date('2025-12-05'), toolName: 'analytics_export', success: true, executionTimeMs: 2500 },
      { timestamp: new Date('2025-12-08'), toolName: 'web_search', success: false, executionTimeMs: 5000 },
      { timestamp: new Date('2025-12-10'), toolName: 'training_control', success: true, executionTimeMs: 800 },
      { timestamp: new Date('2025-12-12'), toolName: 'dataset_manager', success: false, executionTimeMs: 3000 },
      { timestamp: new Date('2025-12-15'), toolName: 'token_analyzer', success: true, executionTimeMs: 600 },
    ],
    conversations: [
      { timestamp: new Date('2025-12-01'), conversationId: 'conv-1', messageCount: 12, duration: 45000 },
      { timestamp: new Date('2025-12-05'), conversationId: 'conv-2', messageCount: 8, duration: 30000 },
      { timestamp: new Date('2025-12-10'), conversationId: 'conv-3', messageCount: 15, duration: 60000 },
      { timestamp: new Date('2025-12-15'), conversationId: 'conv-4', messageCount: 6, duration: 20000 },
    ],
    errors: [
      { timestamp: new Date('2025-12-08'), errorType: 'rate_limit', message: 'Rate limit exceeded for OpenAI API', conversationId: 'conv-5' },
      { timestamp: new Date('2025-12-12'), errorType: 'timeout', message: 'Request timed out after 30s', conversationId: 'conv-6' },
      { timestamp: new Date('2025-12-14'), errorType: 'rate_limit', message: 'Rate limit exceeded', conversationId: 'conv-7' },
    ],
    latency: [
      { timestamp: new Date('2025-12-01'), latencyMs: 2100, tokensPerSecond: 62, modelId: 'gpt-4' },
      { timestamp: new Date('2025-12-05'), latencyMs: 2500, tokensPerSecond: 54, modelId: 'gpt-4' },
      { timestamp: new Date('2025-12-10'), latencyMs: 1800, tokensPerSecond: 72, modelId: 'claude-3-sonnet' },
      { timestamp: new Date('2025-12-15'), latencyMs: 2300, tokensPerSecond: 58, modelId: 'gpt-4' },
    ],
  },
  aggregations: {
    totals: {
      messages: 487,
      conversations: 82,
      tokens: 156000,
      cost: 42.75,
      evaluations: 65,
      errors: 12,
    },
    averages: {
      tokensPerMessage: 320,
      costPerMessage: 0.088,
      rating: 4.25,
      successRate: 0.975,
      errorRate: 0.025,
      latencyMs: 2175,
    },
    trends: {
      tokenUsage: { direction: 'up', changePercent: 8.5, dataPoints: 14, confidence: 'high' },
      quality: { direction: 'stable', changePercent: 1.2, dataPoints: 14, confidence: 'medium' },
      latency: { direction: 'down', changePercent: -12, dataPoints: 14, confidence: 'high' },
      errorRate: { direction: 'down', changePercent: -18, dataPoints: 14, confidence: 'high' },
    },
  },
  generatedAt: new Date(),
};

async function generateSamples() {
  const outputDir = join(process.cwd(), 'storage', 'sample-exports');
  mkdirSync(outputDir, { recursive: true });

  const audiences = ['executive', 'engineering', 'onboarding'] as const;

  console.log('Generating sample exports...\n');

  for (const audience of audiences) {
    console.log(`Generating ${audience} reports...`);
    const report = renderTemplate(audience, mockDataset);

    // JSON
    const jsonPath = join(outputDir, `${audience}-report.json`);
    writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`  - JSON: ${jsonPath}`);

    // HTML
    const html = renderReportToHtml(report);
    const htmlPath = join(outputDir, `${audience}-report.html`);
    writeFileSync(htmlPath, html);
    console.log(`  - HTML: ${htmlPath}`);

    // PDF
    const pdf = await renderReportToPdf(report);
    const pdfPath = join(outputDir, `${audience}-report.pdf`);
    writeFileSync(pdfPath, pdf);
    console.log(`  - PDF:  ${pdfPath}`);

    console.log();
  }

  console.log('Done! Sample files generated in:', outputDir);
  console.log('\nOpen the HTML files in a browser to verify styling.');
  console.log('Open the PDF files in a PDF viewer to verify layout.');
}

generateSamples().catch(console.error);
