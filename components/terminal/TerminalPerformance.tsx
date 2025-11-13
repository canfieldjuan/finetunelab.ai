'use client';

/**
 * Terminal Performance Component
 * 
 * Displays throughput and timing metrics
 * Phase 3: Layout Assembly
 * 
 * Date: 2025-11-01
 */

import React from 'react';
import type { TerminalMetrics } from '@/lib/training/terminal-monitor.types';
import { MetricDisplay } from './MetricDisplay';
import { ASCIIBox } from './ASCIIBox';

export interface TerminalPerformanceProps {
  metrics: TerminalMetrics;
  className?: string;
}

export function TerminalPerformance({ metrics, className = '' }: TerminalPerformanceProps) {
  return (
    <ASCIIBox title="PERFORMANCE" borderStyle="single" className={className}>
      <div className="space-y-3">
        {/* Samples per second */}
        {metrics.samples_per_second !== undefined && (
          <MetricDisplay
            label="Samples/sec"
            value={metrics.samples_per_second}
            decimals={2}
            showTrend={false}
            variant="default"
          />
        )}
        
        {/* Tokens per second */}
        {metrics.tokens_per_second !== undefined && (
          <MetricDisplay
            label="Tokens/sec"
            value={metrics.tokens_per_second}
            decimals={0}
            showTrend={false}
            variant="default"
          />
        )}
        
        {/* Average step time */}
        {metrics.step_time_avg_seconds !== undefined && (
          <MetricDisplay
            label="Step Time"
            value={metrics.step_time_avg_seconds}
            decimals={3}
            showTrend={false}
            variant="default"
          />
        )}
      </div>
    </ASCIIBox>
  );
}

export default TerminalPerformance;
