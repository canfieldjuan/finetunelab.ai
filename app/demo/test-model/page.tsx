'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Trash2,
  CheckCircle,
  Loader2,
  Beaker,
  MessageSquare,
  FileText,
  Sparkles,
  Zap,
} from 'lucide-react';
import { ModelConfigForm } from '@/components/demo/ModelConfigForm';
import { BatchTestProgress } from '@/components/demo/BatchTestProgress';
import { DemoAtlasChat } from '@/components/demo/DemoAtlasChat';
import { DemoBatchAnalytics } from '@/components/demo/DemoBatchAnalytics';
import type { DemoTestSuite, TaskDomain, ConfigureModelResponse } from '@/lib/demo/types';

type DemoStep = 'welcome' | 'task_selection' | 'model_config' | 'batch_test' | 'atlas_chat' | 'analytics' | 'export';

const TASK_DOMAINS: { domain: TaskDomain; label: string; description: string; icon: React.ElementType }[] = [
  { domain: 'customer_support', label: 'Customer Support', description: 'Help desk and support queries', icon: MessageSquare },
  { domain: 'code_generation', label: 'Code Generation', description: 'Programming and technical tasks', icon: FileText },
  { domain: 'qa', label: 'Q&A / Reasoning', description: 'Question answering and logic', icon: Sparkles },
  { domain: 'creative', label: 'Creative Writing', description: 'Stories, content, and creativity', icon: Zap },
];

export default function DemoTestModelPage() {
  // Wizard state
  const [step, setStep] = useState<DemoStep>('welcome');
  const [selectedDomain, setSelectedDomain] = useState<TaskDomain | null>(null);
  const [testSuites, setTestSuites] = useState<DemoTestSuite[]>([]);
  const [selectedSuite, setSelectedSuite] = useState<DemoTestSuite | null>(null);
  const [sessionConfig, setSessionConfig] = useState<ConfigureModelResponse | null>(null);
  const [testRunId, setTestRunId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupComplete, setCleanupComplete] = useState(false);

  // Fetch test suites when domain is selected
  useEffect(() => {
    if (selectedDomain) {
      fetchTestSuites(selectedDomain);
    }
  }, [selectedDomain]);

  const fetchTestSuites = async (domain: TaskDomain) => {
    try {
      const response = await fetch(`/api/demo/test-suites?task_domain=${domain}`);
      if (response.ok) {
        const data = await response.json();
        setTestSuites(data.test_suites || []);
        // Auto-select first suite
        if (data.test_suites?.length > 0) {
          setSelectedSuite(data.test_suites[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch test suites:', err);
    }
  };

  // Handle model configuration complete
  const handleModelConfigured = (config: ConfigureModelResponse) => {
    setSessionConfig(config);
    setStep('batch_test');
    startBatchTest(config.session_id);
  };

  // Start batch test
  const startBatchTest = async (sessionId: string) => {
    if (!selectedSuite) return;

    try {
      const response = await fetch('/api/demo/v2/batch-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          test_suite_id: selectedSuite.id,
          prompt_limit: 10, // Limit for demo
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTestRunId(data.test_run_id);
      }
    } catch (err) {
      console.error('Failed to start batch test:', err);
    }
  };

  // Handle batch test complete
  const handleTestComplete = useCallback(() => {
    setStep('atlas_chat');
  }, []);

  // Handle export
  const handleExport = async (format: 'csv' | 'json') => {
    if (!sessionConfig) return;

    setIsExporting(true);
    try {
      const url = `/api/demo/v2/export?session_id=${sessionConfig.session_id}&format=${format}`;
      window.open(url, '_blank');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle cleanup
  const handleCleanup = async () => {
    if (!sessionConfig) return;

    setIsCleaning(true);
    try {
      const response = await fetch('/api/demo/v2/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionConfig.session_id }),
      });

      if (response.ok) {
        setCleanupComplete(true);
      }
    } catch (err) {
      console.error('Cleanup failed:', err);
    } finally {
      setIsCleaning(false);
    }
  };

  // Navigation helpers
  const canGoBack = step !== 'welcome' && step !== 'analytics' && step !== 'export';
  const goBack = () => {
    switch (step) {
      case 'task_selection':
        setStep('welcome');
        break;
      case 'model_config':
        setStep('task_selection');
        break;
      case 'batch_test':
        setStep('model_config');
        break;
      case 'atlas_chat':
        setStep('batch_test');
        break;
      case 'analytics':
        setStep('atlas_chat');
        break;
    }
  };

  // Render step content
  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return (
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-purple-100 dark:bg-purple-900 rounded-full">
                  <Beaker className="h-12 w-12 text-purple-600" />
                </div>
              </div>
              <CardTitle className="text-2xl">Test Your Fine-Tuned Model</CardTitle>
              <CardDescription className="text-base mt-2">
                Connect your model, run batch tests, and analyze results with your own AI
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <Badge className="mt-0.5">1</Badge>
                  <div>
                    <p className="font-medium">Select Test Domain</p>
                    <p className="text-sm text-muted-foreground">Choose from coding, reasoning, creative, or general tasks</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <Badge className="mt-0.5">2</Badge>
                  <div>
                    <p className="font-medium">Connect Your Model</p>
                    <p className="text-sm text-muted-foreground">Enter your OpenAI-compatible endpoint and API key</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <Badge className="mt-0.5">3</Badge>
                  <div>
                    <p className="font-medium">Run Batch Test</p>
                    <p className="text-sm text-muted-foreground">Test against 10 curated prompts and track performance</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <Badge className="mt-0.5">4</Badge>
                  <div>
                    <p className="font-medium">Analyze Results</p>
                    <p className="text-sm text-muted-foreground">Chat with your model to analyze test results</p>
                  </div>
                </div>
              </div>

              <Button onClick={() => setStep('task_selection')} className="w-full" size="lg">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        );

      case 'task_selection':
        return (
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Select Test Domain</CardTitle>
              <CardDescription>Choose the type of prompts to test your model with</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {TASK_DOMAINS.map(({ domain, label, description, icon: Icon }) => (
                  <button
                    key={domain}
                    onClick={() => setSelectedDomain(domain)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      selectedDomain === domain
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/50'
                    }`}
                  >
                    <Icon className={`h-6 w-6 mb-2 ${selectedDomain === domain ? 'text-primary' : 'text-muted-foreground'}`} />
                    <p className="font-medium">{label}</p>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </button>
                ))}
              </div>

              {selectedSuite && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium">Selected Test Suite</p>
                  <p className="text-sm text-muted-foreground">{selectedSuite.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedSuite.prompts?.length || 0} prompts available
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={goBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={() => setStep('model_config')}
                  disabled={!selectedDomain || !selectedSuite}
                  className="flex-1"
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 'model_config':
        return (
          <div className="space-y-4">
            <Button variant="ghost" onClick={goBack} className="mb-2">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Domain Selection
            </Button>
            <ModelConfigForm
              onConfigured={handleModelConfigured}
              onCancel={goBack}
            />
          </div>
        );

      case 'batch_test':
        return (
          <div className="space-y-4">
            {testRunId && sessionConfig && (
              <BatchTestProgress
                testRunId={testRunId}
                onComplete={handleTestComplete}
                onError={(error: string) => console.error('Test error:', error)}
              />
            )}
          </div>
        );

      case 'atlas_chat':
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center max-w-3xl mx-auto">
              <p className="text-sm text-muted-foreground">
                Chat with Atlas to analyze batch test results
              </p>
              <Button variant="outline" size="sm" onClick={() => setStep('analytics')}>
                View Full Analysis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            {sessionConfig && (
              <DemoAtlasChat
                sessionId={sessionConfig.session_id}
                modelName={sessionConfig.model_name}
                onExportRequest={() => setStep('analytics')}
              />
            )}
          </div>
        );

      case 'analytics':
        return (
          <div className="space-y-6">
            {sessionConfig && (
              <DemoBatchAnalytics
                sessionId={sessionConfig.session_id}
                modelName={sessionConfig.model_name}
                onExportClick={() => setStep('export')}
              />
            )}
          </div>
        );

      case 'export':
        return (
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {cleanupComplete ? (
                  <>
                    <CheckCircle className="h-6 w-6 text-green-500" />
                    Session Complete
                  </>
                ) : (
                  <>
                    <Download className="h-6 w-6" />
                    Export Results
                  </>
                )}
              </CardTitle>
              <CardDescription>
                {cleanupComplete
                  ? 'Your session has been cleaned up. Thank you for trying FineTuneLab!'
                  : 'Download your batch test results and clean up your session'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!cleanupComplete && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      onClick={() => handleExport('csv')}
                      disabled={isExporting}
                      className="h-20 flex-col"
                    >
                      <FileText className="h-6 w-6 mb-2" />
                      Export CSV
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleExport('json')}
                      disabled={isExporting}
                      className="h-20 flex-col"
                    >
                      <FileText className="h-6 w-6 mb-2" />
                      Export JSON
                    </Button>
                  </div>

                  <div className="border-t pt-6">
                    <p className="text-sm text-muted-foreground mb-4">
                      Ready to finish? Clean up your session to delete your API key and test data.
                    </p>
                    <Button
                      variant="destructive"
                      onClick={handleCleanup}
                      disabled={isCleaning}
                      className="w-full"
                    >
                      {isCleaning ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Cleaning Up...
                        </>
                      ) : (
                        <>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Clean Up Session
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}

              {cleanupComplete && (
                <div className="text-center space-y-4">
                  <p className="text-muted-foreground">
                    Your API key and test data have been securely deleted.
                  </p>
                  <Button onClick={() => window.location.reload()} className="w-full">
                    Start New Test
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
    }
  };

  // Step indicator
  const steps = [
    { key: 'welcome', label: 'Welcome' },
    { key: 'task_selection', label: 'Domain' },
    { key: 'model_config', label: 'Connect' },
    { key: 'batch_test', label: 'Test' },
    { key: 'atlas_chat', label: 'Chat' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'export', label: 'Export' },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">FineTuneLab Demo</h1>
          <p className="text-muted-foreground">Bring Your Own Model - Batch Testing & AI Analysis</p>
        </div>

        {/* Step indicator */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <React.Fragment key={s.key}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    i < currentStepIndex
                      ? 'bg-primary text-primary-foreground'
                      : i === currentStepIndex
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {i < currentStepIndex ? <CheckCircle className="h-4 w-4" /> : i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-8 h-0.5 ${i < currentStepIndex ? 'bg-primary' : 'bg-muted'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step content */}
        {renderStep()}
      </div>
    </div>
  );
}
