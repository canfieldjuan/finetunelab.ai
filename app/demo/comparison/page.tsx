'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Play,
  Loader2,
  CheckCircle,
  BarChart3,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Zap,
  RefreshCw,
} from 'lucide-react';
import type {
  DemoTestSuite,
  TaskDomain,
  DemoComparison,
  ComparisonRating,
} from '@/lib/demo/types';

// ============================================================================
// Types
// ============================================================================

type DemoStep = 'welcome' | 'task' | 'models' | 'running' | 'rating' | 'results';

interface ModelOption {
  id: string;
  name: string;
  provider: string;
  type: 'base' | 'tuned';
}

interface ComparisonData {
  prompt: string;
  responseA: string;
  responseB: string;
  latencyA: number;
  latencyB: number;
  displayOrder: 'ab' | 'ba';
  ratingA?: ComparisonRating;
  ratingB?: ComparisonRating;
  preferred?: 'a' | 'b' | 'tie';
  revealed: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const TASK_DOMAINS: Array<{
  domain: TaskDomain;
  name: string;
  description: string;
  icon: string;
}> = [
  {
    domain: 'customer_support',
    name: 'Customer Support',
    description: 'Handle support tickets and resolve customer issues',
    icon: '💬',
  },
  {
    domain: 'code_generation',
    name: 'Code Generation',
    description: 'Write code, debug issues, and explain algorithms',
    icon: '💻',
  },
  {
    domain: 'qa',
    name: 'Q&A / Knowledge',
    description: 'Answer factual questions and explain concepts',
    icon: '📚',
  },
  {
    domain: 'creative',
    name: 'Creative Writing',
    description: 'Write stories, marketing copy, and creative content',
    icon: '✨',
  },
];

const MODEL_OPTIONS: ModelOption[] = [
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', type: 'base' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'OpenAI', type: 'base' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI', type: 'base' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', type: 'base' },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'Anthropic', type: 'base' },
];

// ============================================================================
// Demo Comparison Page
// ============================================================================

export default function DemoComparisonPage() {
  // Step state
  const [step, setStep] = useState<DemoStep>('welcome');

  // Selection state
  const [selectedDomain, setSelectedDomain] = useState<TaskDomain | null>(null);
  const [testSuites, setTestSuites] = useState<DemoTestSuite[]>([]);
  const [selectedSuite, setSelectedSuite] = useState<DemoTestSuite | null>(null);
  const [modelA, setModelA] = useState<ModelOption | null>(null);
  const [modelB, setModelB] = useState<ModelOption | null>(null);

  // Test state
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [comparisons, setComparisons] = useState<ComparisonData[]>([]);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const fetchTestSuites = useCallback(async (domain: TaskDomain) => {
    try {
      const response = await fetch(`/api/demo/test-suites?domain=${domain}`);
      if (response.ok) {
        const data = await response.json();
        setTestSuites(data.testSuites || []);
        if (data.testSuites?.length > 0) {
          setSelectedSuite(data.testSuites[0]);
        }
      }
    } catch (err) {
      console.error('[DemoComparison] Error fetching test suites:', err);
      // Use mock data for now
      setTestSuites([]);
    }
  }, []);

  useEffect(() => {
    if (selectedDomain) {
      fetchTestSuites(selectedDomain);
    }
  }, [selectedDomain, fetchTestSuites]);

  // ============================================================================
  // Test Execution
  // ============================================================================

  const runComparison = async () => {
    if (!selectedSuite || !modelA || !modelB) return;

    setIsRunning(true);
    setProgress(0);
    setComparisons([]);
    setError(null);

    // Get prompts (limit to 5 for demo)
    const prompts = selectedSuite.prompts.slice(0, 5);
    const totalPrompts = prompts.length;
    const newComparisons: ComparisonData[] = [];

    for (let i = 0; i < prompts.length; i++) {
      const promptObj = prompts[i];

      try {
        // Call both models in parallel
        const [responseA, responseB] = await Promise.all([
          callModel(modelA.id, promptObj.prompt),
          callModel(modelB.id, promptObj.prompt),
        ]);

        // Randomize display order for blind comparison
        const displayOrder: 'ab' | 'ba' = Math.random() > 0.5 ? 'ab' : 'ba';

        newComparisons.push({
          prompt: promptObj.prompt,
          responseA: responseA.response,
          responseB: responseB.response,
          latencyA: responseA.latency,
          latencyB: responseB.latency,
          displayOrder,
          revealed: false,
        });

        setComparisons([...newComparisons]);
        setProgress(((i + 1) / totalPrompts) * 100);
      } catch (err) {
        console.error(`[DemoComparison] Error on prompt ${i + 1}:`, err);
        setError(`Error processing prompt ${i + 1}. Please try again.`);
        break;
      }
    }

    setIsRunning(false);

    if (newComparisons.length > 0) {
      setStep('rating');
      setCurrentPromptIndex(0);
    }
  };

  const callModel = async (
    modelId: string,
    prompt: string
  ): Promise<{ response: string; latency: number }> => {
    const response = await fetch('/api/demo/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        model_id: modelId,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.response) {
      throw new Error(data.error || 'Failed to get response');
    }

    return { response: data.response, latency: data.latency };
  };

  // ============================================================================
  // Rating Handlers
  // ============================================================================

  const handleRate = (
    comparisonIndex: number,
    model: 'a' | 'b',
    dimension: 'clarity' | 'accuracy' | 'conciseness' | 'overall',
    value: number
  ) => {
    setComparisons((prev) => {
      const updated = [...prev];
      const comp = updated[comparisonIndex];

      if (model === 'a') {
        comp.ratingA = { ...(comp.ratingA || { modelId: '', clarity: 0, accuracy: 0, conciseness: 0, overall: 0 }), [dimension]: value };
      } else {
        comp.ratingB = { ...(comp.ratingB || { modelId: '', clarity: 0, accuracy: 0, conciseness: 0, overall: 0 }), [dimension]: value };
      }

      return updated;
    });
  };

  const handlePrefer = (comparisonIndex: number, preferred: 'a' | 'b' | 'tie') => {
    setComparisons((prev) => {
      const updated = [...prev];
      updated[comparisonIndex].preferred = preferred;
      return updated;
    });
  };

  const handleReveal = (comparisonIndex: number) => {
    setComparisons((prev) => {
      const updated = [...prev];
      updated[comparisonIndex].revealed = true;
      return updated;
    });
  };

  const canProceedToNext = (): boolean => {
    const current = comparisons[currentPromptIndex];
    return Boolean(
      current?.ratingA?.overall &&
      current?.ratingB?.overall &&
      current?.preferred
    );
  };

  const handleNext = () => {
    if (currentPromptIndex < comparisons.length - 1) {
      setCurrentPromptIndex((prev) => prev + 1);
    } else {
      // All rated, go to results
      setStep('results');
    }
  };

  // ============================================================================
  // Results Calculation
  // ============================================================================

  const calculateResults = () => {
    let aWins = 0;
    let bWins = 0;
    let ties = 0;
    let totalARating = 0;
    let totalBRating = 0;
    let totalALatency = 0;
    let totalBLatency = 0;

    comparisons.forEach((comp) => {
      if (comp.preferred === 'a') aWins++;
      else if (comp.preferred === 'b') bWins++;
      else ties++;

      totalARating += comp.ratingA?.overall || 0;
      totalBRating += comp.ratingB?.overall || 0;
      totalALatency += comp.latencyA;
      totalBLatency += comp.latencyB;
    });

    const count = comparisons.length;

    return {
      aWins,
      bWins,
      ties,
      avgARating: count > 0 ? totalARating / count : 0,
      avgBRating: count > 0 ? totalBRating / count : 0,
      avgALatency: count > 0 ? totalALatency / count : 0,
      avgBLatency: count > 0 ? totalBLatency / count : 0,
    };
  };

  // ============================================================================
  // Render Functions
  // ============================================================================

  const renderWelcome = () => (
    <div className="max-w-2xl mx-auto text-center py-12">
      <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mb-6">
        <Sparkles className="h-10 w-10 text-white" />
      </div>
      <h1 className="text-3xl font-bold mb-4">Model Comparison Demo</h1>
      <p className="text-lg text-muted-foreground mb-8">
        Experience blind A/B testing between AI models. Rate responses without knowing
        which model generated them, then see the results.
      </p>
      <div className="bg-muted/50 rounded-lg p-6 mb-8 text-left">
        <h3 className="font-semibold mb-3">How it works:</h3>
        <ol className="space-y-2 text-sm">
          <li className="flex gap-3">
            <span className="font-bold text-purple-600">1.</span>
            Choose a task domain (Customer Support, Code, Q&A, Creative)
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-purple-600">2.</span>
            Select two models to compare
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-purple-600">3.</span>
            Rate responses without knowing which model made them
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-purple-600">4.</span>
            See the reveal and compare performance
          </li>
        </ol>
      </div>
      <Button
        size="lg"
        onClick={() => setStep('task')}
        className="gap-2"
      >
        Start Demo
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );

  const renderTaskSelection = () => (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <Button variant="ghost" onClick={() => setStep('welcome')} className="gap-2 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h2 className="text-2xl font-bold">Choose a Task Domain</h2>
        <p className="text-muted-foreground">Select the type of task you want to test</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TASK_DOMAINS.map((domain) => (
          <Card
            key={domain.domain}
            className={`cursor-pointer transition-all hover:border-purple-500 ${
              selectedDomain === domain.domain ? 'border-purple-500 ring-2 ring-purple-200' : ''
            }`}
            onClick={() => setSelectedDomain(domain.domain)}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{domain.icon}</span>
                <div>
                  <CardTitle className="text-lg">{domain.name}</CardTitle>
                  <CardDescription>{domain.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="flex justify-end mt-8">
        <Button
          onClick={() => setStep('models')}
          disabled={!selectedDomain}
          className="gap-2"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderModelSelection = () => (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <Button variant="ghost" onClick={() => setStep('task')} className="gap-2 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h2 className="text-2xl font-bold">Select Models to Compare</h2>
        <p className="text-muted-foreground">Choose two different models for blind comparison</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Model A Selection */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Badge variant="outline">Model A</Badge>
          </h3>
          <div className="space-y-2">
            {MODEL_OPTIONS.map((model) => (
              <Card
                key={`a-${model.id}`}
                className={`cursor-pointer transition-all ${
                  modelA?.id === model.id ? 'border-blue-500 ring-2 ring-blue-200' : ''
                } ${modelB?.id === model.id ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-300'}`}
                onClick={() => modelB?.id !== model.id && setModelA(model)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{model.name}</p>
                      <p className="text-xs text-muted-foreground">{model.provider}</p>
                    </div>
                    {modelA?.id === model.id && (
                      <CheckCircle className="h-5 w-5 text-blue-500" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Model B Selection */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Badge variant="outline">Model B</Badge>
          </h3>
          <div className="space-y-2">
            {MODEL_OPTIONS.map((model) => (
              <Card
                key={`b-${model.id}`}
                className={`cursor-pointer transition-all ${
                  modelB?.id === model.id ? 'border-green-500 ring-2 ring-green-200' : ''
                } ${modelA?.id === model.id ? 'opacity-50 cursor-not-allowed' : 'hover:border-green-300'}`}
                onClick={() => modelA?.id !== model.id && setModelB(model)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{model.name}</p>
                      <p className="text-xs text-muted-foreground">{model.provider}</p>
                    </div>
                    {modelB?.id === model.id && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-8">
        <Button
          onClick={() => {
            setStep('running');
            runComparison();
          }}
          disabled={!modelA || !modelB}
          className="gap-2"
        >
          <Play className="h-4 w-4" />
          Start Comparison
        </Button>
      </div>
    </div>
  );

  const renderRunning = () => (
    <div className="max-w-xl mx-auto text-center py-12">
      <Loader2 className="h-16 w-16 animate-spin mx-auto mb-6 text-purple-500" />
      <h2 className="text-2xl font-bold mb-2">Running Comparison</h2>
      <p className="text-muted-foreground mb-6">
        Sending prompts to both models...
      </p>
      <Progress value={progress} className="mb-4" />
      <p className="text-sm text-muted-foreground">
        {Math.round(progress)}% complete
      </p>
      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
    </div>
  );

  const renderRating = () => {
    const current = comparisons[currentPromptIndex];
    if (!current) return null;

    // Get displayed responses based on display order
    const leftResponse = current.displayOrder === 'ab' ? current.responseA : current.responseB;
    const rightResponse = current.displayOrder === 'ab' ? current.responseB : current.responseA;
    const leftLabel = 'Response A';
    const rightLabel = 'Response B';

    // Get rating references based on display order
    const leftRating = current.displayOrder === 'ab' ? current.ratingA : current.ratingB;
    const rightRating = current.displayOrder === 'ab' ? current.ratingB : current.ratingA;

    const handleLeftRate = (dim: 'clarity' | 'accuracy' | 'conciseness' | 'overall', val: number) => {
      handleRate(currentPromptIndex, current.displayOrder === 'ab' ? 'a' : 'b', dim, val);
    };

    const handleRightRate = (dim: 'clarity' | 'accuracy' | 'conciseness' | 'overall', val: number) => {
      handleRate(currentPromptIndex, current.displayOrder === 'ab' ? 'b' : 'a', dim, val);
    };

    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Rate the Responses</h2>
            <p className="text-muted-foreground">
              Prompt {currentPromptIndex + 1} of {comparisons.length}
            </p>
          </div>
          <Progress value={((currentPromptIndex + 1) / comparisons.length) * 100} className="w-48" />
        </div>

        {/* Prompt */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{current.prompt}</p>
          </CardContent>
        </Card>

        {/* Responses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Left Response */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="outline">{leftLabel}</Badge>
                {current.revealed && (
                  <span className="text-xs text-muted-foreground">
                    ({current.displayOrder === 'ab' ? modelA?.name : modelB?.name})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-48 overflow-y-auto text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded">
                {leftResponse}
              </div>

              {/* Rating */}
              <div className="space-y-3">
                {(['clarity', 'accuracy', 'conciseness', 'overall'] as const).map((dim) => (
                  <div key={dim} className="flex items-center justify-between">
                    <span className="text-xs capitalize">{dim}</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((val) => (
                        <button
                          key={val}
                          onClick={() => handleLeftRate(dim, val)}
                          className={`w-6 h-6 rounded text-xs transition-colors ${
                            leftRating?.[dim] === val
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Right Response */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="outline">{rightLabel}</Badge>
                {current.revealed && (
                  <span className="text-xs text-muted-foreground">
                    ({current.displayOrder === 'ab' ? modelB?.name : modelA?.name})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-48 overflow-y-auto text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded">
                {rightResponse}
              </div>

              {/* Rating */}
              <div className="space-y-3">
                {(['clarity', 'accuracy', 'conciseness', 'overall'] as const).map((dim) => (
                  <div key={dim} className="flex items-center justify-between">
                    <span className="text-xs capitalize">{dim}</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((val) => (
                        <button
                          key={val}
                          onClick={() => handleRightRate(dim, val)}
                          className={`w-6 h-6 rounded text-xs transition-colors ${
                            rightRating?.[dim] === val
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preference Selection */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-3 text-center">Which response do you prefer?</p>
            <div className="flex justify-center gap-4">
              <Button
                variant={current.preferred === 'a' ? 'default' : 'outline'}
                onClick={() => handlePrefer(currentPromptIndex, 'a')}
                className="gap-2"
              >
                <ThumbsUp className="h-4 w-4" />
                Response A
              </Button>
              <Button
                variant={current.preferred === 'tie' ? 'default' : 'outline'}
                onClick={() => handlePrefer(currentPromptIndex, 'tie')}
              >
                Tie
              </Button>
              <Button
                variant={current.preferred === 'b' ? 'default' : 'outline'}
                onClick={() => handlePrefer(currentPromptIndex, 'b')}
                className="gap-2"
              >
                <ThumbsUp className="h-4 w-4" />
                Response B
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="ghost"
            onClick={() => handleReveal(currentPromptIndex)}
            disabled={current.revealed}
          >
            {current.revealed ? 'Models Revealed' : 'Reveal Models (Peek)'}
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canProceedToNext()}
            className="gap-2"
          >
            {currentPromptIndex < comparisons.length - 1 ? (
              <>
                Next
                <ArrowRight className="h-4 w-4" />
              </>
            ) : (
              <>
                See Results
                <BarChart3 className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  const renderResults = () => {
    const results = calculateResults();

    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">Comparison Results</h2>
          <p className="text-muted-foreground">
            Here&apos;s how the models performed in your blind comparison
          </p>
        </div>

        {/* Winner Banner */}
        <Card className="mb-8 bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-purple-600 mb-2">Winner</p>
            <h3 className="text-2xl font-bold text-purple-900">
              {results.aWins > results.bWins
                ? modelA?.name
                : results.bWins > results.aWins
                ? modelB?.name
                : "It's a Tie!"}
            </h3>
            <p className="text-sm text-purple-700 mt-2">
              {results.aWins} - {results.bWins} - {results.ties} (W-L-T)
            </p>
          </CardContent>
        </Card>

        {/* Model Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className={results.aWins > results.bWins ? 'ring-2 ring-green-500' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge>Model A</Badge>
                {modelA?.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Wins</span>
                <span className="font-semibold">{results.aWins}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Avg Rating</span>
                <span className="font-semibold">{results.avgARating.toFixed(1)} / 5</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Avg Latency
                </span>
                <span className="font-semibold">{(results.avgALatency / 1000).toFixed(2)}s</span>
              </div>
            </CardContent>
          </Card>

          <Card className={results.bWins > results.aWins ? 'ring-2 ring-green-500' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge>Model B</Badge>
                {modelB?.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Wins</span>
                <span className="font-semibold">{results.bWins}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Avg Rating</span>
                <span className="font-semibold">{results.avgBRating.toFixed(1)} / 5</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Avg Latency
                </span>
                <span className="font-semibold">{(results.avgBLatency / 1000).toFixed(2)}s</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Individual Results */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Detailed Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {comparisons.map((comp, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Prompt {i + 1}</p>
                    <p className="text-xs text-muted-foreground truncate">{comp.prompt.slice(0, 60)}...</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">{modelA?.name}</p>
                      <p className="font-semibold">{comp.ratingA?.overall || '-'}/5</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">{modelB?.name}</p>
                      <p className="font-semibold">{comp.ratingB?.overall || '-'}/5</p>
                    </div>
                    <Badge variant={
                      comp.preferred === 'a' ? 'default' :
                      comp.preferred === 'b' ? 'secondary' : 'outline'
                    }>
                      {comp.preferred === 'a' ? modelA?.name :
                       comp.preferred === 'b' ? modelB?.name : 'Tie'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-center gap-4">
          <Button
            variant="outline"
            onClick={() => {
              setStep('welcome');
              setSelectedDomain(null);
              setModelA(null);
              setModelB(null);
              setComparisons([]);
            }}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Start New Comparison
          </Button>
          <Button
            onClick={() => window.location.href = '/analytics/chat'}
            className="gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Try Analytics Assistant
          </Button>
        </div>
      </div>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-purple-500" />
              <h1 className="text-xl font-semibold">FineTuneLab Demo</h1>
            </div>
            <Button variant="ghost" onClick={() => window.location.href = '/demo'}>
              Back to Demo Home
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {step === 'welcome' && renderWelcome()}
        {step === 'task' && renderTaskSelection()}
        {step === 'models' && renderModelSelection()}
        {step === 'running' && renderRunning()}
        {step === 'rating' && renderRating()}
        {step === 'results' && renderResults()}
      </div>
    </div>
  );
}
