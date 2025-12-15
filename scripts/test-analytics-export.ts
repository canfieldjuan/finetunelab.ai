/**
 * Test script for Analytics Export API
 * Tests all format and audience combinations
 * Run with: npx ts-node scripts/test-analytics-export.ts
 */

import { renderTemplate, isValidTemplate } from '../lib/analytics/export/templates';
import { renderReportToHtml } from '../lib/analytics/export/renderers/html';
import { renderReportToPdf } from '../lib/analytics/export/renderers/pdf';
import type { AnalyticsDataset } from '../lib/analytics/types';

// Mock dataset for testing
const mockDataset: AnalyticsDataset = {
  userId: 'test-user-123',
  timeRange: {
    start: new Date('2025-12-01'),
    end: new Date('2025-12-15'),
    period: 'all',
  },
  metrics: {
    tokenUsage: [
      { timestamp: new Date(), modelId: 'gpt-4', inputTokens: 100, outputTokens: 200, totalTokens: 300, estimatedCost: 0.05 },
    ],
    quality: [
      { timestamp: new Date(), rating: 4.5, feedback: 'Good', conversationId: 'conv-1' },
    ],
    tools: [
      { timestamp: new Date(), toolName: 'web_search', success: true, executionTimeMs: 500 },
      { timestamp: new Date(), toolName: 'dataset_manager', success: false, executionTimeMs: 1000 },
    ],
    conversations: [
      { timestamp: new Date(), conversationId: 'conv-1', messageCount: 10, duration: 5000 },
    ],
    errors: [
      { timestamp: new Date(), errorType: 'rate_limit', message: 'Rate limit exceeded', conversationId: 'conv-1' },
    ],
    latency: [
      { timestamp: new Date(), latencyMs: 2500, tokensPerSecond: 50, modelId: 'gpt-4' },
      { timestamp: new Date(), latencyMs: 3500, tokensPerSecond: 40, modelId: 'gpt-4' },
    ],
  },
  aggregations: {
    totals: {
      messages: 150,
      conversations: 25,
      tokens: 45000,
      cost: 12.50,
      evaluations: 20,
      errors: 5,
    },
    averages: {
      tokensPerMessage: 300,
      costPerMessage: 0.083,
      rating: 4.2,
      successRate: 0.95,
      errorRate: 0.033,
      latencyMs: 2800,
    },
    trends: {
      tokenUsage: { direction: 'up', changePercent: 10, dataPoints: 7, confidence: 'high' },
      quality: { direction: 'stable', changePercent: 2, dataPoints: 7, confidence: 'medium' },
      latency: { direction: 'down', changePercent: -5, dataPoints: 7, confidence: 'high' },
      errorRate: { direction: 'down', changePercent: -15, dataPoints: 7, confidence: 'high' },
    },
  },
  generatedAt: new Date(),
};

async function runTests() {
  console.log('=== Analytics Export Tests ===\n');

  const audiences = ['executive', 'engineering', 'onboarding'] as const;
  let passed = 0;
  let failed = 0;

  // Test 1: Template Validation
  console.log('1. Testing template validation...');
  for (const audience of audiences) {
    const valid = isValidTemplate(audience);
    if (valid) {
      console.log(`   [PASS] ${audience} is valid`);
      passed++;
    } else {
      console.log(`   [FAIL] ${audience} should be valid`);
      failed++;
    }
  }

  const invalidCheck = !isValidTemplate('invalid');
  if (invalidCheck) {
    console.log('   [PASS] "invalid" correctly rejected');
    passed++;
  } else {
    console.log('   [FAIL] "invalid" should be rejected');
    failed++;
  }
  console.log();

  // Test 2: Template Rendering
  console.log('2. Testing template rendering...');
  for (const audience of audiences) {
    try {
      const report = renderTemplate(audience, mockDataset);
      const hasSections = report.sections.length > 0;
      const hasMetadata = !!report.metadata.templateId;

      if (hasSections && hasMetadata) {
        console.log(`   [PASS] ${audience}: ${report.sections.length} sections rendered`);
        passed++;
      } else {
        console.log(`   [FAIL] ${audience}: missing sections or metadata`);
        failed++;
      }
    } catch (error) {
      console.log(`   [FAIL] ${audience}: ${error}`);
      failed++;
    }
  }
  console.log();

  // Test 3: HTML Rendering
  console.log('3. Testing HTML rendering...');
  for (const audience of audiences) {
    try {
      const report = renderTemplate(audience, mockDataset);
      const html = renderReportToHtml(report);
      const hasDoctype = html.includes('<!DOCTYPE html>');
      const hasTitle = html.includes('<title>');
      const hasStyles = html.includes('<style>');

      if (hasDoctype && hasTitle && hasStyles) {
        console.log(`   [PASS] ${audience}: ${html.length} bytes, valid HTML structure`);
        passed++;
      } else {
        console.log(`   [FAIL] ${audience}: invalid HTML structure`);
        failed++;
      }
    } catch (error) {
      console.log(`   [FAIL] ${audience}: ${error}`);
      failed++;
    }
  }
  console.log();

  // Test 4: PDF Rendering
  console.log('4. Testing PDF rendering...');
  for (const audience of audiences) {
    try {
      const report = renderTemplate(audience, mockDataset);
      const pdfBuffer = await renderReportToPdf(report);

      // Check PDF magic bytes: %PDF
      const isPDF = pdfBuffer[0] === 0x25 && pdfBuffer[1] === 0x50 && pdfBuffer[2] === 0x44 && pdfBuffer[3] === 0x46;

      if (isPDF && pdfBuffer.length > 1000) {
        console.log(`   [PASS] ${audience}: ${pdfBuffer.length} bytes, valid PDF`);
        passed++;
      } else {
        console.log(`   [FAIL] ${audience}: invalid PDF output`);
        failed++;
      }
    } catch (error) {
      console.log(`   [FAIL] ${audience}: ${error}`);
      failed++;
    }
  }
  console.log();

  // Summary
  console.log('=== Test Summary ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('Test error:', error);
  process.exit(1);
});
