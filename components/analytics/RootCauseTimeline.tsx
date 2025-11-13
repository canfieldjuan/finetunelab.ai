/**
 * Root Cause Timeline Component
 *
 * Visual timeline of events leading to a metric degradation.
 * Shows chronological sequence with icons and expandable details.
 *
 * Phase 3 Task 3.5: Enhanced AI Insights
 * Date: 2025-10-25
 */

"use client";

import React, { useState } from 'react';
import { Clock, AlertCircle, CheckCircle, Info } from 'lucide-react';
import type { RootCauseAnalysis } from '@/lib/services/ai-insights.service';

interface RootCauseTimelineProps {
  analysis: RootCauseAnalysis;
}

export default function RootCauseTimeline({ analysis }: RootCauseTimelineProps) {
  console.log('[RootCauseTimeline] Rendering with', analysis.timeline.length, 'events');

  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());

  const toggleEvent = (index: number) => {
    console.log('[RootCauseTimeline] Toggling event', index);
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedEvents(newExpanded);
  };

  const formatTimestamp = (date: Date): string => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEventIcon = (index: number) => {
    if (index === 0) {
      return <Info className="w-5 h-5 text-blue-600" />;
    }
    if (index === analysis.timeline.length - 1) {
      return <AlertCircle className="w-5 h-5 text-red-600" />;
    }
    return <Clock className="w-5 h-5 text-gray-600" />;
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">Timeline of Events</h3>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>

        {/* Events */}
        <div className="space-y-4">
          {analysis.timeline.map((event, index) => (
            <div key={index} className="relative pl-14">
              {/* Icon */}
              <div className="absolute left-3 top-1 bg-white border-2 border-gray-200 rounded-full p-1">
                {getEventIcon(index)}
              </div>

              {/* Content */}
              <div
                className="bg-gray-50 border border-gray-200 rounded-lg p-3 cursor-pointer hover:bg-gray-100"
                onClick={() => toggleEvent(index)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{event.event}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatTimestamp(event.timestamp)}
                    </div>
                  </div>
                  <CheckCircle
                    className={`w-4 h-4 transition-transform ${
                      expandedEvents.has(index) ? 'rotate-90' : ''
                    }`}
                  />
                </div>

                {expandedEvents.has(index) && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <p className="text-sm text-gray-700">{event.impact}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
