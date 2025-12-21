"use client";

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Play, Plus, Trash2 } from 'lucide-react';

interface ModelConfig {
  modelName: string;
  provider: string;
  temperature: number;
  maxTokens: number;
}

export function ModelComparisonPanel() {
  const [models, setModels] = useState<ModelConfig[]>([
    { modelName: 'gpt-4o', provider: 'openai', temperature: 0.7, maxTokens: 1000 },
    { modelName: 'claude-3-5-sonnet-20241022', provider: 'anthropic', temperature: 0.7, maxTokens: 1000 },
  ]);
  const [experimentName, setExperimentName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [testCases, setTestCases] = useState<string[]>(['']);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const addModel = () => {
    setModels([...models, { modelName: '', provider: '', temperature: 0.7, maxTokens: 1000 }]);
  };

  const removeModel = (index: number) => {
    if (models.length > 2) {
      setModels(models.filter((_, i) => i !== index));
    }
  };

  const updateModel = (index: number, field: keyof ModelConfig, value: any) => {
    const updated = [...models];
    updated[index] = { ...updated[index], [field]: value };
    setModels(updated);
  };

  const addTestCase = () => {
    setTestCases([...testCases, '']);
  };

  const updateTestCase = (index: number, value: string) => {
    const updated = [...testCases];
    updated[index] = value;
    setTestCases(updated);
  };

  const runComparison = async () => {
    setError(null);
    setSuccess(false);
    setRunning(true);

    try {
      const validModels = models.filter(m => m.modelName && m.provider);
      if (validModels.length < 2) {
        setError('Please configure at least 2 models');
        return;
      }

      const res = await fetch('/api/analytics/model-comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: experimentName || `Model Comparison ${new Date().toLocaleDateString()}`,
          models: validModels,
          systemPrompt,
          testCases: testCases.filter(tc => tc.trim()),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create comparison');
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create comparison');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Model A/B Comparison</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="experiment-name">Experiment Name (Optional)</Label>
          <Input
            id="experiment-name"
            value={experimentName}
            onChange={(e) => setExperimentName(e.target.value)}
            placeholder="My Model Comparison"
            className="mt-1"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Models to Compare</Label>
            <Button size="sm" variant="outline" onClick={addModel}>
              <Plus className="h-4 w-4 mr-1" />
              Add Model
            </Button>
          </div>
          <div className="space-y-3">
            {models.map((model, index) => (
              <div key={index} className="grid grid-cols-6 gap-2 p-3 bg-muted/30 rounded-lg">
                <div className="col-span-2">
                  <Label className="text-xs">Model Name</Label>
                  <Input
                    value={model.modelName}
                    onChange={(e) => updateModel(index, 'modelName', e.target.value)}
                    placeholder="gpt-4o"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Provider</Label>
                  <Input
                    value={model.provider}
                    onChange={(e) => updateModel(index, 'provider', e.target.value)}
                    placeholder="openai"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Temperature</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={model.temperature}
                    onChange={(e) => updateModel(index, 'temperature', parseFloat(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Max Tokens</Label>
                  <Input
                    type="number"
                    value={model.maxTokens}
                    onChange={(e) => updateModel(index, 'maxTokens', parseInt(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeModel(index)}
                    disabled={models.length <= 2}
                    className="w-full"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="system-prompt">System Prompt (Optional)</Label>
          <textarea
            id="system-prompt"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={3}
            className="w-full mt-1 px-3 py-2 border rounded-md"
            placeholder="You are a helpful assistant..."
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Test Cases (Optional)</Label>
            <Button size="sm" variant="outline" onClick={addTestCase}>
              <Plus className="h-4 w-4 mr-1" />
              Add Test Case
            </Button>
          </div>
          <div className="space-y-2">
            {testCases.map((testCase, index) => (
              <Input
                key={index}
                value={testCase}
                onChange={(e) => updateTestCase(index, e.target.value)}
                placeholder="Enter test message..."
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-600">
              Experiment created successfully! View it in the Experiments tab.
            </p>
          </div>
        )}

        <Button onClick={runComparison} disabled={running} className="w-full">
          <Play className="h-4 w-4 mr-2" />
          {running ? 'Creating...' : 'Create Model Comparison'}
        </Button>
      </CardContent>
    </Card>
  );
}
