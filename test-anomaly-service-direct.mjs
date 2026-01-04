#!/usr/bin/env node

/**
 * Direct Test of Anomaly Detection Service
 * Tests the core anomaly detection algorithms without API layer
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tkizlemssfmrfluychsn.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraXpsZW1zc2ZtcmZsdXljaHNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA1NzQyNiwiZXhwIjoyMDcxNjMzNDI2fQ.1jCq40o2wsbHrKuinv3s4Ny9kwJ5mcvcBAggU5oKH74';

// Statistical detection functions (copied from anomaly-detection.service.ts)
function calculateStatistics(values) {
  if (values.length === 0) {
    return { mean: 0, median: 0, stdDev: 0, q1: 0, q3: 0, iqr: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const mean = values.reduce((sum, val) => sum + val, 0) / n;

  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];

  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  const q1Index = Math.floor(n * 0.25);
  const q3Index = Math.floor(n * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;

  return { mean, median, stdDev, q1, q3, iqr };
}

function detectStatisticalOutlier(value, stats, threshold = 3) {
  if (stats.stdDev === 0) {
    return { isOutlier: false, zScore: 0 };
  }

  const zScore = Math.abs((value - stats.mean) / stats.stdDev);
  return {
    isOutlier: zScore > threshold,
    zScore
  };
}

async function detectAnomalies(dataPoints, metricName, options = {}) {
  if (dataPoints.length < 10) {
    return [];
  }

  const values = dataPoints.map(dp => dp.value);
  const stats = calculateStatistics(values);
  const anomalies = [];

  const latestPoint = dataPoints[dataPoints.length - 1];
  const latestValue = latestPoint.value;

  const outlierCheck = detectStatisticalOutlier(
    latestValue,
    stats,
    options.zScoreThreshold || 3
  );

  if (outlierCheck.isOutlier) {
    const deviationPercent = ((latestValue - stats.mean) / stats.mean) * 100;

    anomalies.push({
      isAnomaly: true,
      type: 'statistical_outlier',
      severity: outlierCheck.zScore > 5 ? 'critical' : outlierCheck.zScore > 4 ? 'high' : 'medium',
      confidence: Math.min(outlierCheck.zScore / 5, 1),
      detectedValue: latestValue,
      expectedRange: {
        lower: stats.mean - 3 * stats.stdDev,
        upper: stats.mean + 3 * stats.stdDev
      },
      deviation: deviationPercent,
      description: `${metricName} is ${deviationPercent.toFixed(1)}% ${latestValue > stats.mean ? 'above' : 'below'} expected range`,
      contributingFactors: [],
      recommendedActions: ['Investigate recent changes', 'Review related metrics'],
      metadata: latestPoint.metadata
    });
  }

  return anomalies;
}

async function testAnomalyDetection() {
  console.log('🧪 Direct Test of Anomaly Detection Service\n');

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const testUserId = '38c85707-1fc5-40c6-84be-c017b3b8e750';

    // Fetch trace data
    console.log('1️⃣ Fetching synthetic trace data...');
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: traces, error: traceError } = await supabase
      .from('llm_traces')
      .select(`
        id,
        span_id,
        trace_id,
        start_time,
        duration_ms,
        ttft_ms,
        tokens_per_second,
        input_tokens,
        output_tokens,
        total_tokens,
        cache_read_input_tokens,
        cost_usd,
        retrieval_latency_ms,
        rag_relevance_score,
        context_tokens,
        queue_time_ms
      `)
      .eq('user_id', testUserId)
      .gte('start_time', oneDayAgo)
      .not('duration_ms', 'is', null)
      .order('start_time', { ascending: true });

    if (traceError) throw traceError;

    console.log(`✅ Retrieved ${traces?.length || 0} traces\n`);

    if (!traces || traces.length < 10) {
      console.log('❌ Not enough traces for testing. Run test-anomaly-detection-synthetic.mjs first.');
      process.exit(1);
    }

    // Run anomaly detection on each metric
    console.log('2️⃣ Running anomaly detection algorithms...\n');

    const results = {
      duration: { anomalies: [], points: traces.length },
      ttft: { anomalies: [], points: 0 },
      throughput: { anomalies: [], points: 0 },
      tokens: { anomalies: [], points: traces.length },
      cost: { anomalies: [], points: 0 },
    };

    // 1. Duration Analysis
    const durationPoints = traces
      .filter(t => t.duration_ms)
      .map(t => ({
        timestamp: t.start_time,
        value: t.duration_ms,
        metadata: { trace_id: t.trace_id }
      }));

    results.duration.anomalies = await detectAnomalies(durationPoints, 'duration_ms', { zScoreThreshold: 3 });
    results.duration.points = durationPoints.length;

    // 2. TTFT Analysis
    const ttftPoints = traces
      .filter(t => t.ttft_ms)
      .map(t => ({
        timestamp: t.start_time,
        value: t.ttft_ms,
        metadata: { trace_id: t.trace_id }
      }));

    results.ttft.anomalies = await detectAnomalies(ttftPoints, 'ttft_ms', { zScoreThreshold: 3 });
    results.ttft.points = ttftPoints.length;

    // 3. Throughput Analysis
    const throughputPoints = traces
      .filter(t => t.tokens_per_second)
      .map(t => ({
        timestamp: t.start_time,
        value: t.tokens_per_second,
        metadata: { trace_id: t.trace_id }
      }));

    results.throughput.anomalies = await detectAnomalies(throughputPoints, 'tokens_per_second', { zScoreThreshold: 3 });
    results.throughput.points = throughputPoints.length;

    // 4. Token Usage Analysis
    const tokenPoints = traces.map(t => ({
      timestamp: t.start_time,
      value: (t.input_tokens || 0) + (t.output_tokens || 0),
      metadata: { trace_id: t.trace_id }
    }));

    results.tokens.anomalies = await detectAnomalies(tokenPoints, 'total_tokens', { zScoreThreshold: 3 });
    results.tokens.points = tokenPoints.length;

    // 5. Cost Analysis
    const costPoints = traces
      .filter(t => t.cost_usd)
      .map(t => ({
        timestamp: t.start_time,
        value: t.cost_usd,
        metadata: { trace_id: t.trace_id }
      }));

    results.cost.anomalies = await detectAnomalies(costPoints, 'cost_usd', { zScoreThreshold: 3 });
    results.cost.points = costPoints.length;

    // Display results
    console.log('══════════════════════════════════════════════════════════');
    console.log('📊 ANOMALY DETECTION RESULTS');
    console.log('══════════════════════════════════════════════════════════\n');

    let totalAnomalies = 0;
    Object.entries(results).forEach(([metric, data]) => {
      const count = data.anomalies.length;
      totalAnomalies += count;
      const emoji = count > 0 ? '🔴' : '✅';
      const status = count > 0 ? `${count} DETECTED` : 'NONE';

      console.log(`${emoji} ${metric.toUpperCase().padEnd(15)} : ${status.padEnd(15)} (${data.points} data points)`);
    });

    console.log('\n══════════════════════════════════════════════════════════');
    console.log(`TOTAL ANOMALIES DETECTED: ${totalAnomalies}`);
    console.log('══════════════════════════════════════════════════════════\n');

    // Expected anomalies
    console.log('🎯 EXPECTED ANOMALIES (from synthetic data):');
    console.log('   • 1 duration spike (5000ms)');
    console.log('   • 1 TTFT spike (2000ms)');
    console.log('   • 1 token usage spike (8000 tokens)');
    console.log('   • 1 cost spike ($0.50)');
    console.log('   • 1 throughput drop (10 tokens/s)\n');

    // Show details of detected anomalies
    if (totalAnomalies > 0) {
      console.log('══════════════════════════════════════════════════════════');
      console.log('🔍 ANOMALY DETAILS');
      console.log('══════════════════════════════════════════════════════════\n');

      Object.entries(results).forEach(([metric, data]) => {
        if (data.anomalies.length > 0) {
          console.log(`\n📌 ${metric.toUpperCase()} ANOMALIES:\n`);
          data.anomalies.forEach((anomaly, idx) => {
            console.log(`   ${idx + 1}. [${anomaly.severity.toUpperCase()}]`);
            console.log(`      Description: ${anomaly.description}`);
            console.log(`      Detected Value: ${anomaly.detectedValue.toFixed(2)}`);
            console.log(`      Expected Range: ${anomaly.expectedRange.lower.toFixed(2)} - ${anomaly.expectedRange.upper.toFixed(2)}`);
            console.log(`      Confidence: ${(anomaly.confidence * 100).toFixed(0)}%`);
            console.log(`      Trace ID: ${anomaly.metadata?.trace_id || 'N/A'}`);
            console.log('');
          });
        }
      });
    }

    // Test verdict
    console.log('══════════════════════════════════════════════════════════');
    if (totalAnomalies >= 4) {
      console.log('✅ TEST PASSED: Anomaly detection is working correctly!');
      console.log('   Detected at least 4 out of 5 injected anomalies.');
    } else if (totalAnomalies > 0) {
      console.log('⚠️  TEST PARTIAL: Some anomalies detected.');
      console.log(`   Detected ${totalAnomalies} out of 5 expected anomalies.`);
    } else {
      console.log('❌ TEST FAILED: No anomalies detected.');
      console.log('   Expected to detect 5 anomalies from synthetic data.');
    }
    console.log('══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test
testAnomalyDetection();
