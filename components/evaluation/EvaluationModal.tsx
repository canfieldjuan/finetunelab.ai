"use client";
import React, { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Star, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { judgmentsService } from "@/lib/evaluation/judgments.service";

interface EvaluationModalProps {
  messageId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const FAILURE_TAGS = [
  'hallucination',
  'wrong_tool',
  'incomplete',
  'incorrect_info',
  'off_topic',
  'tone_issues',
];

export function EvaluationModal({ messageId, onClose, onSuccess }: EvaluationModalProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [success, setSuccess] = useState<boolean>(true);
  const [failureTags, setFailureTags] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [expectedBehavior, setExpectedBehavior] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // Phase 6: Citation validation and groundedness
  const [citationCorrectness, setCitationCorrectness] = useState<Record<string, boolean>>({});
  const [groundedness, setGroundedness] = useState<number>(50);
  const [message, setMessage] = useState<Record<string, unknown> | null>(null);

  // Fetch message with content_json for citation validation
  useEffect(() => {
    if (!messageId) {
      console.warn('[EvaluationModal] No messageId provided');
      return;
    }

    console.log('[EvaluationModal] Fetching message:', messageId);

    const fetchMessage = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('id, content, content_json')
          .eq('id', messageId)
          .single();

        if (error) {
          console.error('[EvaluationModal] Error fetching message:', error);
          return;
        }
        if (data) {
          console.log('[EvaluationModal] Message fetched successfully, citations:',
            data.content_json?.citations?.length || 0);
          setMessage(data);
        }
      } catch (err) {
        console.error('[EvaluationModal] Unexpected error:', err);
      }
    };

    fetchMessage();
  }, [messageId]);

  const handleSubmit = async () => {
    // Validation
    if (rating === 0) {
      setError("Please select a rating");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      // Call evaluation API
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messageId,
          rating,
          success,
          failureTags,
          notes: notes.trim() || undefined,
          expectedBehavior: expectedBehavior.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit evaluation");
      }

      console.log("[Evaluation] Successfully submitted rating:", rating);

      // Save groundedness as human judgment (if changed from default)
      if (groundedness !== 50) {
        console.log('[Evaluation] Saving groundedness judgment:', groundedness);
        judgmentsService.saveHumanJudgment(
          messageId,
          'groundedness',
          groundedness / 100,
          groundedness >= 70,
          `Human-rated groundedness: ${groundedness}%`
        ).catch(err => {
          console.error('[Evaluation] Error saving groundedness:', err);
        });
      }

      // Save citation correctness (if any citations were validated)
      const correctCitations = Object.keys(citationCorrectness).filter(
        docId => citationCorrectness[docId]
      ).length;
      const totalCitations = Object.keys(citationCorrectness).length;

      if (totalCitations > 0) {
        console.log('[Evaluation] Saving citation correctness:',
          correctCitations, '/', totalCitations);
        judgmentsService.saveHumanJudgment(
          messageId,
          'citation_correctness',
          correctCitations / totalCitations,
          correctCitations === totalCitations,
          `${correctCitations}/${totalCitations} citations verified`
        ).catch(err => {
          console.error('[Evaluation] Error saving citation correctness:', err);
        });
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("[Evaluation] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFailureTag = (tag: string) => {
    setFailureTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl max-w-md w-full m-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-bold">Evaluate Response</h3>
          <Button onClick={onClose} variant="ghost" size="sm">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Star Rating */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Rating <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= (hoverRating || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {rating} star{rating !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Success Toggle */}
          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSuccess(true)}
                className={`flex-1 p-2 rounded border text-sm font-medium ${
                  success
                    ? "bg-green-50 border-green-500 text-green-700"
                    : "border-gray-300 text-gray-700"
                }`}
              >
                ✓ Successful
              </button>
              <button
                type="button"
                onClick={() => setSuccess(false)}
                className={`flex-1 p-2 rounded border text-sm font-medium ${
                  !success
                    ? "bg-red-50 border-red-500 text-red-700"
                    : "border-gray-300 text-gray-700"
                }`}
              >
                ✗ Failed
              </button>
            </div>
          </div>

          {/* Failure Tags */}
          {!success && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Failure Tags
              </label>
              <div className="space-y-2">
                {FAILURE_TAGS.map((tag) => (
                  <label
                    key={tag}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={failureTags.includes(tag)}
                      onChange={() => toggleFailureTag(tag)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">
                      {tag.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Citation Validation */}
          {(() => {
            const contentJson = message?.content_json as { citations?: Array<Record<string, unknown>> } | undefined;
            const citations = contentJson?.citations;
            if (!citations || citations.length === 0) return null;
            return (
            <div className="space-y-2">
              <label className="block text-sm font-medium">Citation Correctness</label>
              <p className="text-sm text-muted-foreground mb-2">
                Verify that each citation accurately supports the answer
              </p>
              {citations.map((citation: Record<string, unknown>, index: number) => {
                const docId = String(citation.doc_id || '');
                const quote = citation.quote as string | undefined;
                return (
                <div key={index} className="flex items-start space-x-3 p-2 border rounded">
                  <input
                    type="checkbox"
                    checked={citationCorrectness[docId] || false}
                    onChange={(e) => {
                      console.log('[EvaluationModal] Citation toggled:',
                        docId, e.target.checked);
                      setCitationCorrectness({
                        ...citationCorrectness,
                        [docId]: e.target.checked
                      });
                    }}
                    className="w-4 h-4 mt-1"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-mono break-all">{docId}</p>
                    {quote ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        &quot;{quote}&quot;
                      </p>
                    ) : null}
                  </div>
                </div>
              )})}
            </div>
            );
          })()}

          {/* Groundedness Slider */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Groundedness (0-100%)
            </label>
            <p className="text-sm text-muted-foreground mb-2">
              How well is the answer grounded in the retrieved documents?
            </p>
            <input
              type="range"
              min="0"
              max="100"
              value={groundedness}
              onChange={(e) => {
                const newValue = parseInt(e.target.value);
                console.log('[EvaluationModal] Groundedness changed:', newValue);
                setGroundedness(newValue);
              }}
              className="w-full"
            />
            <div className="text-center text-sm font-semibold">{groundedness}%</div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional feedback..."
              rows={3}
              className="w-full p-2 border rounded text-sm"
            />
          </div>

          {/* Expected Behavior */}
          {!success && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Expected Behavior (optional)
              </label>
              <textarea
                value={expectedBehavior}
                onChange={(e) => setExpectedBehavior(e.target.value)}
                placeholder="What should have happened?"
                rows={2}
                className="w-full p-2 border rounded text-sm"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t">
          <Button onClick={onClose} variant="outline" className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
            className="flex-1"
          >
            {submitting ? "Submitting..." : "Submit Rating"}
          </Button>
        </div>
      </div>
    </div>
  );
}
