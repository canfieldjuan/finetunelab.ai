import { useMemo } from 'react';
import type { SessionMetrics } from '@/hooks/useAnalytics';

// Compute Wilson score interval for a binomial proportion
function wilsonCI(successes: number, trials: number, z = 1.96) {
  if (trials === 0) return { low: 0, high: 0, p: 0 };
  const p = successes / trials;
  const denom = 1 + (z * z) / trials;
  const center = (p + (z * z) / (2 * trials)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * trials)) / trials)) / denom;
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin), p };
}

// Two-proportion z-test p-value (approx)
function twoProportionPValue(s1: number, n1: number, s2: number, n2: number) {
  if (n1 === 0 || n2 === 0) return 1;
  const p1 = s1 / n1;
  const p2 = s2 / n2;
  const pPool = (s1 + s2) / (n1 + n2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
  if (se === 0) return 1;
  const z = (p1 - p2) / se;
  // two-tailed p-value from z
  const p = 2 * (1 - normalCdf(Math.abs(z)));
  return p;
}

// Standard normal CDF using erf approximation
function normalCdf(x: number) {
  return (1 + erf(x / Math.SQRT2)) / 2;
}

function erf(x: number) {
  // Abramowitz and Stegun approximation
  const sign = x >= 0 ? 1 : -1;
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * Math.abs(x));
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

export function useSignificance(sessions: SessionMetrics[]) {
  return useMemo(() => {
    // Sort sessions by success rate descending for typical A/B comparisons
    const sorted = [...sessions].sort((a, b) => (b.successRate || 0) - (a.successRate || 0));

    const enriched = sorted.map((s) => {
      const n = s.evaluationCount || 0;
      const k = s.successCount || 0;
      const ci = wilsonCI(k, n);
      return {
        sessionId: s.sessionId,
        experimentName: s.experimentName,
        successRate: s.successRate,
        evaluationCount: n,
        successCount: k,
        ciLow: ci.low * 100,
        ciHigh: ci.high * 100,
      };
    });

    // Pairwise significance results for top two if available
    let pairwise: { a: string; b: string; pValue: number } | null = null;
    if (sorted.length >= 2) {
      const a = sorted[0];
      const b = sorted[1];
      const p = twoProportionPValue(a.successCount || 0, a.evaluationCount || 0, b.successCount || 0, b.evaluationCount || 0);
      pairwise = { a: a.sessionId, b: b.sessionId, pValue: p };
    }

    return { sessions: enriched, pairwise };
  }, [sessions]);
}
