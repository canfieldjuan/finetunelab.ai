"use client";

import React, { useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, Wand2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  requestSnippetRevision,
  requestSnippetRewrite,
  SnippetRevisionApiError,
  type SnippetRewriteSelection,
} from '@/lib/snippet-revision/client';
import type { ReplaceRangeRevision, SnippetRevisionResult } from '@/lib/snippet-revision';

interface SnippetRevisionDialogProps {
  open: boolean;
  messageId: string;
  content: string;
  contentTruncated?: boolean;
  modelId?: string | null;
  authToken?: string | null;
  onOpenChange: (open: boolean) => void;
  onApply: (messageId: string, revision: ReplaceRangeRevision) => void | Promise<void>;
}

type RevisionStatus = 'idle' | 'generating' | 'applying';

function getErrorMessage(error: unknown): string {
  if (error instanceof SnippetRevisionApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong while revising this text.';
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function mapNormalizedOffsetToSourceOffset(source: string, normalizedOffset: number): number {
  let normalizedIndex = 0;

  for (let sourceIndex = 0; sourceIndex < source.length; sourceIndex += 1) {
    if (normalizedIndex >= normalizedOffset) {
      return sourceIndex;
    }

    if (source[sourceIndex] === '\r') {
      if (source[sourceIndex + 1] === '\n') {
        sourceIndex += 1;
      }
      normalizedIndex += 1;
    } else {
      normalizedIndex += 1;
    }
  }

  return source.length;
}

function isSameSelection(
  left: SnippetRewriteSelection | null,
  right: SnippetRewriteSelection,
): boolean {
  return Boolean(
    left &&
    left.start === right.start &&
    left.end === right.end &&
    left.expectedText === right.expectedText,
  );
}

export function SnippetRevisionDialog({
  open,
  messageId,
  content,
  contentTruncated = false,
  modelId,
  authToken,
  onOpenChange,
  onApply,
}: SnippetRevisionDialogProps) {
  const [instruction, setInstruction] = useState('');
  const [selection, setSelection] = useState<SnippetRewriteSelection | null>(null);
  const [previewResult, setPreviewResult] = useState<SnippetRevisionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<RevisionStatus>('idle');
  const lineNumberRef = useRef<HTMLDivElement | null>(null);
  const sourceRef = useRef<HTMLTextAreaElement | null>(null);
  const latestSelectionRef = useRef<SnippetRewriteSelection | null>(null);
  const latestInstructionRef = useRef('');

  latestSelectionRef.current = selection;
  latestInstructionRef.current = instruction;

  const displayContent = useMemo(() => normalizeLineEndings(content), [content]);
  const isTruncated = contentTruncated;
  const hasRewriteAuth = Boolean(authToken);
  const hasSelectedModel = Boolean(modelId && modelId !== '__default__');
  const lineNumbers = useMemo(() => {
    const count = Math.max(1, displayContent.split('\n').length);
    return Array.from({ length: count }, (_, index) => index + 1);
  }, [displayContent]);

  const canGenerate = Boolean(
    !isTruncated &&
    hasRewriteAuth &&
    hasSelectedModel &&
    selection &&
    instruction.trim().length > 0 &&
    status === 'idle',
  );
  const canApply = Boolean(
    previewResult?.ok &&
    previewResult.applied === false &&
    status === 'idle',
  );

  const resetDraft = () => {
    setInstruction('');
    setSelection(null);
    setPreviewResult(null);
    setError(null);
    setStatus('idle');
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetDraft();
    }
    onOpenChange(nextOpen);
  };

  const handleSourceSelect = (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = event.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;

    if (start === end) {
      setSelection(null);
      setPreviewResult(null);
      return;
    }

    const sourceStart = mapNormalizedOffsetToSourceOffset(content, start);
    const sourceEnd = mapNormalizedOffsetToSourceOffset(content, end);

    setSelection({
      start: sourceStart,
      end: sourceEnd,
      expectedText: content.slice(sourceStart, sourceEnd),
    });
    setPreviewResult(null);
    setError(null);
  };

  const handleSourceScroll = (event: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumberRef.current) {
      lineNumberRef.current.scrollTop = event.currentTarget.scrollTop;
    }
  };

  const handleGeneratePreview = async () => {
    if (!selection || isTruncated || !hasRewriteAuth || !hasSelectedModel) {
      return;
    }

    setStatus('generating');
    setError(null);
    setPreviewResult(null);

    const previewSelection = selection;
    const previewInstruction = instruction.trim();
    const isCurrentPreviewRequest = () => (
      isSameSelection(latestSelectionRef.current, previewSelection) &&
      latestInstructionRef.current.trim() === previewInstruction
    );

    try {
      const rewrite = await requestSnippetRewrite({
        sourceText: content,
        selection: previewSelection,
        instruction: previewInstruction,
        modelId: modelId as string,
      }, {
        authToken,
      });

      if (!isCurrentPreviewRequest()) {
        return;
      }

      const revision = {
        mode: 'replace_range' as const,
        start: previewSelection.start,
        end: previewSelection.end,
        expectedText: previewSelection.expectedText,
        replace: rewrite.replacement,
      };

      const preview = await requestSnippetRevision({
        action: 'preview',
        sourceText: content,
        revision,
      });

      if (!isCurrentPreviewRequest()) {
        return;
      }

      setPreviewResult(preview);

      if (!preview.ok) {
        setError(preview.message);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setStatus('idle');
    }
  };

  const handleApply = async () => {
    if (!previewResult?.ok || previewResult.applied !== false) {
      return;
    }

    setStatus('applying');
    setError(null);
    const { change } = previewResult;
    const revision: ReplaceRangeRevision = {
      mode: 'replace_range',
      start: change.start,
      end: change.end,
      expectedText: change.original,
      replace: change.replacement,
    };

    try {
      const result = await requestSnippetRevision({
        action: 'apply',
        sourceText: content,
        revision,
      });

      if (!result.ok) {
        setError(result.message);
        setPreviewResult(result);
        return;
      }

      await onApply(messageId, revision);
      handleOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setStatus('idle');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0">
        <div className="flex max-h-[90vh] flex-col">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle>Revise Selected Text</DialogTitle>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 py-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
            <div className="min-w-0 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="snippet-revision-source">Source</Label>
                {selection && (
                  <span className="text-xs text-muted-foreground">
                    {selection.start}-{selection.end}
                  </span>
                )}
              </div>
              <div className="grid h-[22rem] min-h-0 grid-cols-[3.5rem_minmax(0,1fr)] overflow-hidden rounded-md border border-border bg-muted/20">
                <div
                  ref={lineNumberRef}
                  className="overflow-hidden border-r border-border bg-muted/60 py-2 text-right font-mono text-xs leading-6 text-muted-foreground"
                  aria-hidden="true"
                >
                  {lineNumbers.map((lineNumber) => (
                    <div key={lineNumber} className="px-2">
                      {lineNumber}
                    </div>
                  ))}
                </div>
                <Textarea
                  id="snippet-revision-source"
                  ref={sourceRef}
                  value={displayContent}
                  readOnly
                  onSelect={handleSourceSelect}
                  onScroll={handleSourceScroll}
                  aria-label="Assistant response source"
                  className="h-full resize-none rounded-none border-0 bg-transparent font-mono text-sm leading-6 shadow-none focus-visible:ring-0"
                />
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="snippet-revision-instruction">Instruction</Label>
                <Textarea
                  id="snippet-revision-instruction"
                  value={instruction}
                  onChange={(event) => {
                    setInstruction(event.target.value);
                    setPreviewResult(null);
                    setError(null);
                  }}
                  aria-label="Revision instruction"
                  placeholder="Rewrite this for clarity."
                  className="min-h-24 resize-y"
                  maxLength={2000}
                  disabled={isTruncated}
                />
              </div>

              {isTruncated && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This saved message is truncated locally, so the full source must be loaded before editing.
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {previewResult?.ok && (
                <div className="space-y-3 rounded-md border border-border p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-300">
                    <Check className="h-4 w-4" />
                    Preview Ready
                  </div>
                  <div className="space-y-2">
                    <Label>Original</Label>
                    <pre className="max-h-32 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
                      {previewResult.change.original}
                    </pre>
                  </div>
                  <div className="space-y-2">
                    <Label>Replacement</Label>
                    <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
                      {previewResult.change.replacement}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="border-t border-border px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={status !== 'idle'}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleGeneratePreview}
              disabled={!canGenerate}
            >
              <Wand2 className="mr-2 h-4 w-4" />
              {status === 'generating' ? 'Generating...' : 'Generate Preview'}
            </Button>
            <Button
              type="button"
              onClick={handleApply}
              disabled={!canApply}
            >
              {status === 'applying' ? 'Applying...' : 'Apply'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
