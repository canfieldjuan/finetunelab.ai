/**
 * Budget Monitoring Utility
 *
 * Provides helper functions for monitoring deployment budgets
 * - Check budget status
 * - Generate budget alerts
 * - Calculate budget utilization
 * - Determine if auto-stop should trigger
 *
 * Phase: Phase 6 - Budget Controls & Testing
 * Date: 2025-11-12
 */

export interface BudgetStatus {
  currentSpend: number;
  budgetLimit: number;
  utilizationPercent: number;
  isOverBudget: boolean;
  alerts: {
    threshold50: boolean;
    threshold80: boolean;
    budgetExceeded: boolean;
  };
  shouldAutoStop: boolean;
  requestCount: number;
  costPerRequest: number;
  estimatedRequestsRemaining: number;
}

export interface BudgetAlert {
  level: 'warning' | 'critical' | 'exceeded';
  message: string;
  utilizationPercent: number;
  currentSpend: number;
  budgetLimit: number;
}

/**
 * Calculate comprehensive budget status for a deployment
 */
export function calculateBudgetStatus(
  currentSpend: number,
  budgetLimit: number,
  requestCount: number,
  costPerRequest: number
): BudgetStatus {
  const utilizationPercent = budgetLimit > 0
    ? (currentSpend / budgetLimit) * 100
    : 0;

  const isOverBudget = currentSpend >= budgetLimit;

  const remainingBudget = Math.max(0, budgetLimit - currentSpend);
  const estimatedRequestsRemaining = costPerRequest > 0
    ? Math.floor(remainingBudget / costPerRequest)
    : 0;

  return {
    currentSpend,
    budgetLimit,
    utilizationPercent,
    isOverBudget,
    alerts: {
      threshold50: utilizationPercent >= 50,
      threshold80: utilizationPercent >= 80,
      budgetExceeded: utilizationPercent >= 100,
    },
    shouldAutoStop: isOverBudget,
    requestCount,
    costPerRequest,
    estimatedRequestsRemaining,
  };
}

/**
 * Get budget alert if any threshold is crossed
 * Returns null if no alert needed
 */
export function getBudgetAlert(
  currentSpend: number,
  budgetLimit: number
): BudgetAlert | null {
  if (budgetLimit <= 0) return null;

  const utilizationPercent = (currentSpend / budgetLimit) * 100;

  if (utilizationPercent >= 100) {
    return {
      level: 'exceeded',
      message: 'Budget limit exceeded! Deployment should be auto-stopped.',
      utilizationPercent,
      currentSpend,
      budgetLimit,
    };
  }

  if (utilizationPercent >= 80) {
    return {
      level: 'critical',
      message: `Budget 80% used (${utilizationPercent.toFixed(1)}%). Consider stopping deployment soon.`,
      utilizationPercent,
      currentSpend,
      budgetLimit,
    };
  }

  if (utilizationPercent >= 50) {
    return {
      level: 'warning',
      message: `Budget 50% used (${utilizationPercent.toFixed(1)}%). Monitor spending carefully.`,
      utilizationPercent,
      currentSpend,
      budgetLimit,
    };
  }

  return null;
}

/**
 * Check if deployment should be auto-stopped based on budget
 */
export function shouldAutoStop(
  currentSpend: number,
  budgetLimit: number,
  autoStopEnabled: boolean
): boolean {
  if (!autoStopEnabled) return false;
  if (budgetLimit <= 0) return false;

  return currentSpend >= budgetLimit;
}

/**
 * Calculate estimated daily cost based on current usage
 */
export function estimateDailyCost(
  currentSpend: number,
  elapsedHours: number
): number {
  if (elapsedHours <= 0) return 0;

  const hourlyRate = currentSpend / elapsedHours;
  return hourlyRate * 24;
}

/**
 * Calculate estimated cost to complete deployment
 */
export function estimateCostToComplete(
  totalSteps: number,
  completedSteps: number,
  currentSpend: number
): number {
  if (completedSteps <= 0 || totalSteps <= completedSteps) return 0;

  const costPerStep = currentSpend / completedSteps;
  const remainingSteps = totalSteps - completedSteps;

  return costPerStep * remainingSteps;
}

/**
 * Get budget utilization color for UI display
 */
export function getBudgetUtilizationColor(utilizationPercent: number): string {
  if (utilizationPercent >= 100) return 'red';
  if (utilizationPercent >= 80) return 'orange';
  if (utilizationPercent >= 50) return 'yellow';
  return 'green';
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

/**
 * Calculate time until budget exhausted at current rate
 */
export function estimateTimeUntilBudgetExhausted(
  currentSpend: number,
  budgetLimit: number,
  elapsedHours: number
): number | null {
  if (elapsedHours <= 0 || currentSpend <= 0) return null;
  if (currentSpend >= budgetLimit) return 0;

  const hourlyRate = currentSpend / elapsedHours;
  const remainingBudget = budgetLimit - currentSpend;

  return remainingBudget / hourlyRate;
}

/**
 * Generate budget report summary
 */
export function generateBudgetReport(status: BudgetStatus): string {
  const lines: string[] = [];

  lines.push(`Budget Utilization: ${status.utilizationPercent.toFixed(1)}%`);
  lines.push(`Current Spend: ${formatCurrency(status.currentSpend)}`);
  lines.push(`Budget Limit: ${formatCurrency(status.budgetLimit)}`);
  lines.push(`Requests: ${status.requestCount.toLocaleString()}`);
  lines.push(`Cost/Request: ${formatCurrency(status.costPerRequest)}`);
  lines.push(`Est. Requests Remaining: ${status.estimatedRequestsRemaining.toLocaleString()}`);

  if (status.alerts.budgetExceeded) {
    lines.push('\n⛔ ALERT: Budget exceeded!');
  } else if (status.alerts.threshold80) {
    lines.push('\n⚠️ WARNING: 80% budget used');
  } else if (status.alerts.threshold50) {
    lines.push('\n⚡ INFO: 50% budget used');
  }

  return lines.join('\n');
}
