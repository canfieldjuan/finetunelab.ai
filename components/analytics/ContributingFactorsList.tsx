/**
 * Contributing Factors List Component
 *
 * Displays list of factors that contributed to a metric degradation
 * with confidence percentages, evidence, and correlation indicators.
 *
 * Phase 3 Task 3.5: Enhanced AI Insights
 * Date: 2025-10-25
 */

"use client";

import React from 'react';
import { AlertTriangle, TrendingDown, BarChart2 } from 'lucide-react';
import type { PrimaryCause } from '@/lib/services/ai-insights.service';

interface ContributingFactorsListProps {
  factors: PrimaryCause[];
}

export default function ContributingFactorsList({ factors }: ContributingFactorsListProps) {
  console.log('[ContributingFactorsList] Rendering', factors.length, 'factors');

  if (factors.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500 text-sm">
        No contributing factors identified
      </div>
    );
  }

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'text-red-600';
    if (confidence >= 0.6) return 'text-orange-600';
    if (confidence >= 0.4) return 'text-yellow-600';
    return 'text-blue-600';
  };

  const getConfidenceLabel = (confidence: number): string => {
    if (confidence >= 0.8) return 'Very High';
    if (confidence >= 0.6) return 'High';
    if (confidence >= 0.4) return 'Medium';
    return 'Low';
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">Primary Causes</h3>

      <div className="space-y-3">
        {factors.map((factor, index) => (
          <div
            key={index}
            className="border border-gray-200 rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="mt-0.5">
                {index === 0 ? (
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-orange-600" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-sm text-gray-900">{factor.factor}</h4>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold ${getConfidenceColor(factor.confidence)}`}
                    >
                      {getConfidenceLabel(factor.confidence)} Confidence
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-white">
                      {(factor.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Contribution Percentage */}
                <div className="mb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart2 className="w-3 h-3 text-gray-500" />
                    <span className="text-xs text-gray-600">Contribution to Degradation</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-orange-500 h-2 rounded-full"
                      style={{ width: `${Math.min(100, factor.contribution_percentage)}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-600 mt-1 block">
                    {factor.contribution_percentage.toFixed(1)}%
                  </span>
                </div>

                {/* Evidence */}
                {factor.evidence && factor.evidence.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-medium text-gray-700 mb-1">Evidence:</div>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {factor.evidence.map((evidence, evidenceIndex) => (
                        <li key={evidenceIndex} className="flex items-start gap-2">
                          <span className="text-gray-400 mt-0.5">•</span>
                          <span>{evidence}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
