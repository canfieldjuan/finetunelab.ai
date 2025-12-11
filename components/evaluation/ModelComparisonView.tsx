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
}: ModelComparisonViewProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [responses, setResponses] = useState<Map<string, ModelResponse>>(new Map());
  const [ratings, setRatings] = useState<Map<string, ComparisonRating>>(new Map());
  const [isComparing, setIsComparing] = useState(false);
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string }>>([]);

  // Fetch available models
  const fetchModels = React.useCallback(async () => {
    try {
      const response = await fetch('/api/models', {
        headers: sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {},
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAvailableModels(data.models.map((m: { id: string; name: string }) => ({
            id: m.id,
            name: m.name,
          })));
        }
      }
    } catch (error) {
      console.error('[ModelComparisonView] Error fetching models:', error);
    }
  }, [sessionToken]);

  useEffect(() => {
    if (open && sessionToken) {
      fetchModels();
    }
  }, [open, sessionToken, fetchModels]);

  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

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
      
      return updated;
    });
  };

  const exportAsJSONL = () => {
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

    const jsonl = data.map(item => JSON.stringify(item)).join('\n');
    const blob = new Blob([jsonl], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `model-comparison-${Date.now()}.jsonl`;
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
                  setRatings(new Map());
                }}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Reset
              </Button>
            )}
          </div>

          <Separator />

          {/* Responses Grid */}
          {responses.size > 0 && (
            <div className={`grid gap-4 ${selectedModels.length === 2 ? 'grid-cols-2' : selectedModels.length === 3 ? 'grid-cols-3' : 'grid-cols-2 xl:grid-cols-4'}`}>
              {selectedModels.map(modelId => {
                const response = responses.get(modelId);
                const rating = ratings.get(modelId);
                if (!response) return null;

                return (
                  <div key={modelId} className="border rounded-lg p-4 space-y-4">
                    {/* Model Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-blue-500" />
                          <h3 className="font-medium">{response.modelName}</h3>
                        </div>
                        {response.status === 'complete' && response.responseTime && (
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {(response.responseTime / 1000).toFixed(2)}s
                            </span>
                            {response.tokensUsed && (
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
