'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Sparkles,
  Send,
  ThumbsUp,
  ThumbsDown,
  Download,
  RefreshCw,
  X,
  Zap,
  Clock,
  CheckCircle,
  Loader2,
} from 'lucide-react';

export interface ModelResponse {
  modelId: string;
  modelName: string;
  response: string;
  tokensUsed?: number;
  responseTime?: number;
  status: 'pending' | 'loading' | 'complete' | 'error';
  error?: string;
  timestamp?: Date;
}

export interface ComparisonRating {
  modelId: string;
  clarity: number; // 1-5
  accuracy: number; // 1-5
  conciseness: number; // 1-5
  overall: number; // 1-5
  preference?: 'preferred' | 'rejected' | 'neutral';
  notes?: string;
}

export interface ModelComparisonViewProps {
  /** Session token for API calls */
  sessionToken?: string;
  /** Whether the view is open */
  open: boolean;
  /** Callback when closed */
  onClose: () => void;
  /** Initial prompt (optional) */
  initialPrompt?: string;
  /** Demo mode - enables blind comparison and demo data storage */
  demoMode?: boolean;
  /** Pre-selected models for demo mode */
  demoModels?: { modelA: { id: string; name: string }; modelB: { id: string; name: string } };
  /** Callback when comparison is submitted in demo mode */
  onDemoSubmit?: (data: {
    prompt: string;
    preferredModel: 'a' | 'b' | 'tie' | null;
    modelARating: ComparisonRating;
    modelBRating: ComparisonRating;
    displayOrder: 'ab' | 'ba';
  }) => void;
}

/**
 * ModelComparisonView - A/B test models side-by-side
 * 
 * Features:
 * - Send same prompt to multiple models
 * - Side-by-side response comparison
 * - Multi-axis rating (Clarity, Accuracy, Conciseness, Overall)
 * - Export as JSONL preference dataset
 * - Response time tracking
 */
export function ModelComparisonView({
  sessionToken,
  open,
  onClose,
  initialPrompt = '',
  demoMode = false,
  demoModels,
  onDemoSubmit,
}: ModelComparisonViewProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [responses, setResponses] = useState<Map<string, ModelResponse>>(new Map());
  const [ratings, setRatings] = useState<Map<string, ComparisonRating>>(new Map());
  const [isComparing, setIsComparing] = useState(false);
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string }>>([]);

  // Demo mode state
  const [displayOrder, setDisplayOrder] = useState<'ab' | 'ba'>('ab');
  const [revealed, setRevealed] = useState(false);
  const [bothRated, setBothRated] = useState(false);

  // Demo mode allowed models
  const DEMO_ALLOWED_MODELS = [
    'gpt-4o-mini',
    'gpt-4o',
    'claude-3-5-sonnet-20241022',
    'claude-3-haiku-20240307',
  ];

  // Fetch available models
  const fetchModels = React.useCallback(async () => {
    try {
      const response = await fetch('/api/models', {
        headers: sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {},
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          let models = data.models.map((m: { id: string; name: string }) => ({
            id: m.id,
            name: m.name,
          }));

          // Filter to demo-allowed models in demo mode
          if (demoMode) {
            models = models.filter((m: { id: string }) => DEMO_ALLOWED_MODELS.includes(m.id));
          }

          setAvailableModels(models);
        }
      }
    } catch (error) {
      console.error('[ModelComparisonView] Error fetching models:', error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken, demoMode]);

  // Setup demo mode models and randomize display order
  useEffect(() => {
    if (demoMode && demoModels && open) {
      // Set pre-selected models for demo
      setSelectedModels([demoModels.modelA.id, demoModels.modelB.id]);
      setAvailableModels([demoModels.modelA, demoModels.modelB]);

      // Randomize display order for blind comparison
      const order = Math.random() > 0.5 ? 'ab' : 'ba';
      setDisplayOrder(order);
      setRevealed(false);
      setBothRated(false);

      console.log('[ModelComparisonView] Demo mode setup:', {
        modelA: demoModels.modelA.name,
        modelB: demoModels.modelB.name,
        displayOrder: order,
      });
    }
  }, [demoMode, demoModels, open]);

  // Check if both models have been rated (for reveal button)
  useEffect(() => {
    if (demoMode && selectedModels.length === 2) {
      const modelARating = ratings.get(selectedModels[0]);
      const modelBRating = ratings.get(selectedModels[1]);

      const aRated = modelARating && modelARating.overall > 0;
      const bRated = modelBRating && modelBRating.overall > 0;

      setBothRated(Boolean(aRated && bRated));
    }
  }, [demoMode, ratings, selectedModels]);

  useEffect(() => {
    if (open && sessionToken && !demoMode) {
      fetchModels();
    }
  }, [open, sessionToken, fetchModels, demoMode]);

  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  // Get display label for blind comparison
  const getBlindLabel = (index: number): string => {
    if (!demoMode || revealed) {
      return '';
    }
    // In blind mode, show "Response A" or "Response B" based on display order
    const labels = displayOrder === 'ab' ? ['Response A', 'Response B'] : ['Response B', 'Response A'];
    return labels[index];
  };

  // Get the actual model display order for blind comparison
  const getDisplayOrderedModels = (): string[] => {
    if (!demoMode || selectedModels.length !== 2) {
      return selectedModels;
    }
    // Reorder based on display order
    return displayOrder === 'ab' ? selectedModels : [selectedModels[1], selectedModels[0]];
  };

  // Handle reveal in demo mode
  const handleReveal = () => {
    setRevealed(true);

    // Determine winner based on ratings
    if (onDemoSubmit && selectedModels.length === 2) {
      const modelARating = ratings.get(selectedModels[0]);
      const modelBRating = ratings.get(selectedModels[1]);

      let preferredModel: 'a' | 'b' | 'tie' | null = null;

      if (modelARating?.preference === 'preferred') {
        preferredModel = 'a';
      } else if (modelBRating?.preference === 'preferred') {
        preferredModel = 'b';
      } else if (modelARating && modelBRating) {
        if (modelARating.overall > modelBRating.overall) {
          preferredModel = 'a';
        } else if (modelBRating.overall > modelARating.overall) {
          preferredModel = 'b';
        } else {
          preferredModel = 'tie';
        }
      }

      onDemoSubmit({
        prompt,
        preferredModel,
        modelARating: modelARating || { modelId: selectedModels[0], clarity: 0, accuracy: 0, conciseness: 0, overall: 0 },
        modelBRating: modelBRating || { modelId: selectedModels[1], clarity: 0, accuracy: 0, conciseness: 0, overall: 0 },
        displayOrder,
      });
    }
  };

  const toggleModelSelection = (modelId: string) => {
    setSelectedModels(prev => {
      if (prev.includes(modelId)) {
        return prev.filter(id => id !== modelId);
      } else if (prev.length < 4) { // Max 4 models for layout reasons
        return [...prev, modelId];
      }
      return prev;
    });
  };

  const handleCompare = async () => {
    if (!prompt.trim() || selectedModels.length < 2) return;

    setIsComparing(true);
    const newResponses = new Map<string, ModelResponse>();

    // Initialize all responses as pending
    selectedModels.forEach(modelId => {
      const model = availableModels.find(m => m.id === modelId);
      newResponses.set(modelId, {
        modelId,
        modelName: model?.name || 'Unknown',
        response: '',
        status: 'pending',
      });
    });
    setResponses(newResponses);

    // Call all models in parallel
    const promises = selectedModels.map(async (modelId) => {
      const model = availableModels.find(m => m.id === modelId);
      const startTime = Date.now();

      // Update to loading
      setResponses(prev => {
        const updated = new Map(prev);
        const current = updated.get(modelId)!;
        updated.set(modelId, { ...current, status: 'loading' });
        return updated;
      });

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {}),
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
            model_id: modelId,
            stream: false,
          }),
        });

        const data = await response.json();
        const responseTime = Date.now() - startTime;

        if (response.ok && data.response) {
          setResponses(prev => {
            const updated = new Map(prev);
            updated.set(modelId, {
              modelId,
              modelName: model?.name || 'Unknown',
              response: data.response,
              tokensUsed: data.usage?.total_tokens,
              responseTime,
              status: 'complete',
              timestamp: new Date(),
            });
            return updated;
          });
        } else {
          throw new Error(data.error || 'Failed to get response');
        }
      } catch (error) {
        setResponses(prev => {
          const updated = new Map(prev);
          const current = updated.get(modelId)!;
          updated.set(modelId, {
            ...current,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          return updated;
        });
      }
    });

    await Promise.all(promises);
    setIsComparing(false);
  };

  const handleRating = (modelId: string, dimension: keyof Omit<ComparisonRating, 'modelId' | 'preference' | 'notes'>, value: number) => {
    setRatings(prev => {
      const updated = new Map(prev);
      const current = updated.get(modelId) || {
        modelId,
        clarity: 0,
        accuracy: 0,
        conciseness: 0,
        overall: 0,
      };
      updated.set(modelId, { ...current, [dimension]: value });
      return updated;
    });
  };

  const handlePreference = (modelId: string, preference: 'preferred' | 'rejected') => {
    setRatings(prev => {
      const updated = new Map(prev);
      
      // Clear all preferences first
      updated.forEach((rating, id) => {
        if (rating.preference === preference) {
          updated.set(id, { ...rating, preference: 'neutral' });
        }
      });
      
      // Set new preference
      const current = updated.get(modelId) || {
        modelId,
        clarity: 0,
        accuracy: 0,
        conciseness: 0,
        overall: 0,
      };
      updated.set(modelId, { ...current, preference });
      
      // eslint-disable-next-line react-hooks/exhaustive-deps
      return updated;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    });
  };
 // eslint-disable-next-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const exportAsJSONL = () => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const data = selectedModels.map(modelId => {
      const response = responses.get(modelId);
      const rating = ratings.get(modelId);
      
      return {
        prompt,
        model: response?.modelName,
        response: response?.response,
        rating: rating ? {
          clarity: rating.clarity,
          accuracy: rating.accuracy,
          conciseness: rating.conciseness,
          overall: rating.overall,
          preference: rating.preference,
        } : null,
        metadata: {
          timestamp: response?.timestamp?.toISOString(),
          responseTime: response?.responseTime,
          tokensUsed: response?.tokensUsed,
        },
      };
    });
 // eslint-disable-next-line react-hooks/exhaustive-deps

    const jsonl = data.map(item => JSON.stringify(item)).join('\n');
    const blob = new Blob([jsonl], { type: 'application/jsonl' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    a.href = url;
    a.download = `model-comparison-${Date.now()}.jsonl`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasResponses = Array.from(responses.values()).some(r => r.status === 'complete');
  const allComplete = Array.from(responses.values()).every(r => r.status === 'complete' || r.status === 'error');

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Model Comparison Lab
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Prompt Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Prompt</label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter a prompt to test across models..."
              className="min-h-24"
              disabled={isComparing}
            />
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Select Models to Compare ({selectedModels.length}/4)
            </label>
            <div className="flex flex-wrap gap-2">
              {availableModels.map(model => (
                <Badge
                  key={model.id}
                  variant={selectedModels.includes(model.id) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleModelSelection(model.id)}
                >
                  {model.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleCompare}
              disabled={!prompt.trim() || selectedModels.length < 2 || isComparing}
              className="gap-2"
            >
              {isComparing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Comparing...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Compare Models
                </>
              )}
            </Button>
            
            {hasResponses && (
              <Button
                variant="outline"
                onClick={exportAsJSONL}
                disabled={!allComplete}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export JSONL
              </Button>
            )}
            
            {hasResponses && (
              <Button
                variant="ghost"
                onClick={() => {
                  setResponses(new Map());
                  // eslint-disable-next-line react-hooks/exhaustive-deps
                  setRatings(new Map());
                }}
                className="gap-2"
              >
                // eslint-disable-next-line react-hooks/exhaustive-deps
                <RefreshCw className="h-4 w-4" />
                Reset
              </Button>
            // eslint-disable-next-line react-hooks/exhaustive-deps
            )}
          </div>

          // eslint-disable-next-line react-hooks/exhaustive-deps
          <Separator />

          {/* Demo Mode: Reveal Button */}
          {demoMode && bothRated && !revealed && (
            <div className="flex justify-center">
              <Button
                onClick={handleReveal}
                className="gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                <Sparkles className="h-4 w-4" />
                Reveal Model Identities
              </Button>
            </div>
          )}

          {/* Demo Mode: Revealed Summary */}
          {demoMode && revealed && selectedModels.length === 2 && (
            <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
              <div className="text-center mb-3">
                <h4 className="font-semibold text-purple-900">Models Revealed!</h4>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center">
                  <Badge variant="outline" className="mb-1">Response A</Badge>
                  <p className="font-medium">{displayOrder === 'ab' ? responses.get(selectedModels[0])?.modelName : responses.get(selectedModels[1])?.modelName}</p>
                </div>
                <div className="text-center">
                  <Badge variant="outline" className="mb-1">Response B</Badge>
                  <p className="font-medium">{displayOrder === 'ab' ? responses.get(selectedModels[1])?.modelName : responses.get(selectedModels[0])?.modelName}</p>
                </div>
              </div>
            </div>
          )}

          {/* Responses Grid */}
          {responses.size > 0 && (
            <div className={`grid gap-4 ${selectedModels.length === 2 ? 'grid-cols-2' : selectedModels.length === 3 ? 'grid-cols-3' : 'grid-cols-2 xl:grid-cols-4'}`}>
              {(demoMode ? getDisplayOrderedModels() : selectedModels).map((modelId, index) => {
                const response = responses.get(modelId);
                const rating = ratings.get(modelId);
                if (!response) return null;

                // Determine display name: blind label or actual model name
                const displayName = demoMode && !revealed
                  ? getBlindLabel(index)
                  : response.modelName;

                return (
                  <div key={modelId} className="border rounded-lg p-4 space-y-4">
                    {/* Model Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-blue-500" />
                          <h3 className="font-medium">
                            {displayName}
                            {demoMode && revealed && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                (was {getBlindLabel(index)})
                              </span>
                            )}
                          </h3>
                        </div>
                        {response.status === 'complete' && response.responseTime && (
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {(response.responseTime / 1000).toFixed(2)}s
                            </span>
                            {response.tokensUsed && !demoMode && (
                              <span className="flex items-center gap-1">
                                <Zap className="h-3 w-3" />
                                {response.tokensUsed} tokens
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {response.status === 'complete' && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                      {response.status === 'loading' && (
                        <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                      )}
                    </div>

                    {/* Response Content */}
                    <div className="min-h-32 max-h-64 overflow-y-auto">
                      {response.status === 'loading' && (
                        <div className="text-sm text-muted-foreground">Loading...</div>
                      )}
                      {response.status === 'error' && (
                        <div className="text-sm text-red-500">Error: {response.error}</div>
                      )}
                      {response.status === 'complete' && (
                        <div className="text-sm whitespace-pre-wrap">{response.response}</div>
                      )}
                    </div>

                    {/* Rating Section */}
                    {response.status === 'complete' && (
                      <div className="space-y-3 pt-3 border-t">
                        <div className="text-xs font-medium text-muted-foreground">Rate Response</div>
                        
                        {(['clarity', 'accuracy', 'conciseness', 'overall'] as const).map(dimension => (
                          <div key={dimension} className="flex items-center justify-between">
                            <span className="text-xs capitalize">{dimension}</span>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map(value => (
                                <button
                                  key={value}
                                  onClick={() => handleRating(modelId, dimension, value)}
                                  className={`w-6 h-6 rounded text-xs ${
                                    rating?.[dimension] === value
                                      ? 'bg-blue-500 text-white'
                                      : 'bg-gray-100 hover:bg-gray-200'
                                  }`}
                                >
                                  {value}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}

                        {/* Preference Buttons */}
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant={rating?.preference === 'preferred' ? 'default' : 'outline'}
                            onClick={() => handlePreference(modelId, 'preferred')}
                            className="flex-1 gap-1"
                          >
                            <ThumbsUp className="h-3 w-3" />
                            Prefer
                          </Button>
                          <Button
                            size="sm"
                            variant={rating?.preference === 'rejected' ? 'destructive' : 'outline'}
                            onClick={() => handlePreference(modelId, 'rejected')}
                            className="flex-1 gap-1"
                          >
                            <ThumbsDown className="h-3 w-3" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {responses.size === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-sm">Select 2-4 models and enter a prompt to start comparing</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
