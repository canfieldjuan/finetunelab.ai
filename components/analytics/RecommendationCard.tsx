/**
 * Recommendation Card Component
 *
 * Displays individual recommendation with priority, impact estimate,
 * implementation steps, and action buttons.
 *
 * Phase 3 Task 3.5: Enhanced AI Insights
 * Date: 2025-10-25
 */

"use client";

import React, { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { ChevronDown, ChevronUp, CheckCircle, X, AlertCircle, Clock, Zap } from 'lucide-react';
import type { Recommendation } from '@/lib/services/ai-insights.service';

interface RecommendationCardProps {
  recommendation: Recommendation;
  onAccept?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

export default function RecommendationCard({
  recommendation,
  onAccept,
  onDismiss
}: RecommendationCardProps) {
  console.log('[RecommendationCard] Rendering recommendation:', recommendation.id);

  const [isExpanded, setIsExpanded] = useState(false);

  const getPriorityStyles = (): string => {
    switch (recommendation.priority) {
      case 'critical':
        return 'bg-red-50 border-red-300 text-red-900';
      case 'high':
        return 'bg-orange-50 border-orange-300 text-orange-900';
      case 'medium':
        return 'bg-yellow-50 border-yellow-300 text-yellow-900';
      case 'low':
        return 'bg-blue-50 border-blue-300 text-blue-900';
      default:
        return 'bg-gray-50 border-gray-300 text-gray-900';
    }
  };

  const getPriorityIcon = () => {
    switch (recommendation.priority) {
      case 'critical':
      case 'high':
        return <AlertCircle className="w-5 h-5" />;
      case 'medium':
        return <Clock className="w-5 h-5" />;
      case 'low':
        return <Zap className="w-5 h-5" />;
      default:
        return <CheckCircle className="w-5 h-5" />;
    }
  };

  const getActionTypeLabel = (): string => {
    switch (recommendation.action_type) {
      case 'immediate':
        return 'Immediate Action';
      case 'short_term':
        return 'Short Term';
      case 'long_term':
        return 'Long Term';
      default:
        return 'Action Required';
    }
  };

  return (
    <Card className={`border ${getPriorityStyles()}`}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5">{getPriorityIcon()}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-sm">{recommendation.title}</h4>
                <span className="text-xs px-2 py-0.5 rounded bg-white/50 capitalize">
                  {recommendation.priority}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-white/50">
                  {getActionTypeLabel()}
                </span>
              </div>
              <p className="text-sm">{recommendation.description}</p>
            </div>
          </div>

          {/* Impact Estimate */}
          <div className="bg-white/50 rounded p-2">
            <div className="text-xs font-medium mb-1">Estimated Impact</div>
            <div className="flex items-center gap-4 text-xs">
              <span>
                Metric: <strong>{recommendation.estimated_impact.metric}</strong>
              </span>
              <span>
                Improvement: <strong className="text-green-700">
                  +{recommendation.estimated_impact.improvement_percentage.toFixed(1)}%
                </strong>
              </span>
              <span>
                Confidence: <strong>
                  {(recommendation.estimated_impact.confidence * 100).toFixed(0)}%
                </strong>
              </span>
            </div>
          </div>

          {/* Effort */}
          <div className="flex items-center gap-2 text-xs">
            <Clock className="w-3 h-3" />
            <span>Estimated Effort: <strong>{recommendation.effort_estimate}</strong></span>
          </div>

          {/* Expandable Implementation Steps */}
          <div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 text-xs font-medium hover:underline"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Hide Implementation Steps
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Show Implementation Steps ({recommendation.implementation_steps.length})
                </>
              )}
            </button>

            {isExpanded && (
              <ol className="mt-2 space-y-1 text-xs list-decimal list-inside">
                {recommendation.implementation_steps.map((step, index) => (
                  <li key={index} className="text-sm">{step}</li>
                ))}
              </ol>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t border-current/20">
            <Button
              onClick={() => onAccept?.(recommendation.id)}
              size="sm"
              variant="default"
              className="flex-1"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Accept
            </Button>
            <Button
              onClick={() => onDismiss?.(recommendation.id)}
              size="sm"
              variant="outline"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
