/**
 * StepHeader Component Test/Demo
 * Verification that StepHeader component renders correctly with all status types
 * Date: 2025-01-31
 */

import React from 'react';
import { StepHeader } from './StepHeader';
import type { StepStatus } from './types';

/**
 * Test/Demo Component
 * Shows all possible states of StepHeader
 */
export function StepHeaderDemo() {
  const statuses: StepStatus[] = ['not_started', 'in_progress', 'completed', 'error'];

  return (
    <div className="space-y-4 p-6">
      <h2 className="text-2xl font-bold mb-6">StepHeader Component Demo</h2>

      {statuses.map((status, index) => (
        <div key={status} className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground uppercase">
            Status: {status}
          </h3>

          {/* Expanded State */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Expanded (Active)</p>
            <StepHeader
              stepId="model"
              number={index + 1}
              title="Model Selection"
              status={status}
              summary="Selected: meta-llama/Llama-2-7b-hf (7GB)"
              isActive={true}
              onEdit={status === 'completed' ? () => console.log('Edit clicked') : undefined}
            />
          </div>

          {/* Collapsed State */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Collapsed (Inactive)</p>
            <StepHeader
              stepId="model"
              number={index + 1}
              title="Model Selection"
              status={status}
              summary="Selected: meta-llama/Llama-2-7b-hf (7GB)"
              isActive={false}
              onEdit={status === 'completed' ? () => console.log('Edit clicked') : undefined}
            />
          </div>

          {/* Disabled State */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Disabled</p>
            <StepHeader
              stepId="model"
              number={index + 1}
              title="Model Selection"
              status={status}
              summary="Selected: meta-llama/Llama-2-7b-hf (7GB)"
              isActive={false}
              disabled={true}
            />
          </div>
        </div>
      ))}

      {/* No Summary Example */}
      <div className="space-y-2 pt-4 border-t">
        <h3 className="text-sm font-medium text-muted-foreground uppercase">
          No Summary (Not Started)
        </h3>
        <StepHeader
          stepId="config"
          number={2}
          title="Training Configuration"
          status="not_started"
          isActive={false}
        />
      </div>
    </div>
  );
}

console.log('[StepHeader.test] Test component loaded');
