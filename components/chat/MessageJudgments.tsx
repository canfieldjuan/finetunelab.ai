'use client';

import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface Judgment {
  id: string;
  message_id: string;
  judge_type: 'rule' | 'human' | 'llm';
  judge_name: string;
  criterion: string;
  score: number;
  passed: boolean;
  evidence_json?: Record<string, unknown> | null;
  notes?: string | null;
  created_at: string;
}

interface MessageJudgmentsProps {
  messageId: string;
  judgments?: Judgment[];
  onFetch?: (judgments: Judgment[]) => void;
}

/**
 * MessageJudgments Component
 * Displays validator judgments for a message with expandable details
 */
export function MessageJudgments({ messageId, judgments: initialJudgments, onFetch }: MessageJudgmentsProps) {
  const [judgments, setJudgments] = useState<Judgment[]>(initialJudgments || []);
  const [loading, setLoading] = useState(!initialJudgments);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!initialJudgments) {
      fetchJudgments();
    }
  }, [messageId, initialJudgments]);

  const fetchJudgments = async () => {
    try {
      setLoading(true);
      setError(null);

      // Skip fetching for temporary message IDs
      if (messageId.startsWith('temp-')) {
        setLoading(false);
        return;
      }

      // Get auth token from Supabase
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/judgments/${messageId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      if (!text) {
        throw new Error('Empty response from server');
      }

      const data = JSON.parse(text);
      setJudgments(data.judgments || []);

      if (onFetch) {
        onFetch(data.judgments || []);
      }
    } catch (err) {
      console.error('[MessageJudgments] Error fetching judgments:', err);
      setError(err instanceof Error ? err.message : 'Failed to load judgments');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-xs text-muted-foreground mt-2">
        Loading validations...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-red-500 mt-2 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        {error}
      </div>
    );
  }

  if (judgments.length === 0) {
    return null;
  }

  const passedCount = judgments.filter(j => j.passed).length;
  const failedCount = judgments.length - passedCount;
  const allPassed = failedCount === 0;

  return (
    <div className="mt-2 space-y-2">
      {/* Summary Badge */}
      <div className="flex items-center gap-2">
        <Badge
          variant={allPassed ? "default" : "destructive"}
          className="flex items-center gap-1 text-xs"
        >
          {allPassed ? (
            <>
              <CheckCircle className="w-3 h-3" />
              All {passedCount} validations passed
            </>
          ) : (
            <>
              <XCircle className="w-3 h-3" />
              {failedCount} validation{failedCount !== 1 ? 's' : ''} failed
            </>
          )}
        </Badge>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="h-6 px-2 text-xs hover:bg-muted"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3 mr-1" />
              Hide details
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3 mr-1" />
              Show details
            </>
          )}
        </Button>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="space-y-2 pl-2 border-l-2 border-muted">
          {judgments.map((judgment) => (
            <div
              key={judgment.id}
              className="text-xs space-y-1"
            >
              <div className="flex items-start gap-2">
                {judgment.passed ? (
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground">
                    {judgment.judge_name || judgment.criterion}
                  </div>
                  {judgment.notes && (
                    <div className="text-muted-foreground mt-0.5">
                      {judgment.notes}
                    </div>
                  )}
                  {judgment.score !== undefined && (
                    <div className="text-muted-foreground mt-0.5">
                      Score: {(judgment.score * 100).toFixed(1)}%
                    </div>
                  )}
                  {judgment.evidence_json && Object.keys(judgment.evidence_json).length > 0 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        View evidence
                      </summary>
                      <pre className="mt-1 p-2 bg-muted rounded text-[10px] overflow-x-auto">
                        {JSON.stringify(judgment.evidence_json, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
