'use client';

/**
 * Terminal Metrics Component
 * 
 * Displays training metrics (loss, LR) with sparklines
 * Phase 3: Layout Assembly
 * 
 * Date: 2025-11-01
 */

import React from 'react';
import type { TerminalMetrics } from '@/lib/training/terminal-monitor.types';
import { MetricDisplay } from './MetricDisplay';
import { ASCIISparkline } from './ASCIISparkline';
import { ASCIIBox } from './ASCIIBox';

export interface TerminalMetricsProps {
  metrics: TerminalMetrics;
  className?: string;
}

export function TerminalMetrics({ metrics, className = '' }: TerminalMetricsProps) {
  const currentLoss = metrics.train_loss || metrics.eval_loss || 0;
  const previousLoss = metrics.best_eval_loss;
  
  return (
    <ASCIIBox title="TRAINING METRICS" borderStyle="single" className={className}>
      <div className="space-y-4">
        {/* Loss metrics */}
        <div>
          <div className="mb-2">
            <MetricDisplay
              label="Loss"
              value={currentLoss}
              previousValue={previousLoss}
              decimals={4}
              showTrend
              variant="default"
            />
          </div>
          
          {/* Loss chart */}
          {metrics.loss_history && metrics.loss_history.length > 0 && (
            <ASCIISparkline
              data={metrics.loss_history}
              height={8}
              width={60}
              label="Loss History"
              showLabels
              variant="default"
            />
          )}
        </div>
        
        {/* Learning rate */}
        <div className="pt-3 border-t border-gray-700">
          <div className="mb-2">
            <MetricDisplay
              label="Learning Rate"
              value={metrics.learning_rate || 0}
              decimals={6}
              showTrend={false}
              variant="default"
            />
          </div>
          
          {/* LR chart */}
          {metrics.lr_history && metrics.lr_history.length > 0 && (
            <ASCIISparkline
              data={metrics.lr_history}
              height={6}
              width={60}
              label="LR Schedule"
              showLabels
              variant="default"
            />
          )}
        </div>
      </div>
    </ASCIIBox>
  );
}

export default TerminalMetrics;
