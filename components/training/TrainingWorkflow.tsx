// Training Workflow Component
// Purpose: Unified workflow for config selection/creation + dataset attachment + package generation
// Date: 2025-10-30
// Updated: 2025-10-31 - Added ModelSelectionCard

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';
import type { TrainingConfigRecord } from '@/lib/training/training-config.types';
import type { TrainingDatasetRecord } from '@/lib/training/dataset.types';
import { ALL_TEMPLATES } from '@/lib/training/training-templates';
import { ConfigEditor } from './ConfigEditor';
import { UnifiedPackageGenerator } from './UnifiedPackageGenerator';
import { ConfigSearchCombobox } from './ConfigSearchCombobox';
import { ModelSelectionCard, type SelectedModel } from './ModelSelectionCard';
import { Input } from '@/components/ui/input';

console.log('[TrainingWorkflow] Component loaded');

interface TrainingWorkflowProps {
  sessionToken?: string;
  allConfigs: TrainingConfigRecord[];
  allDatasets: TrainingDatasetRecord[];
  onConfigCreated: () => void;
  onPackageGenerated?: (configId: string) => void;
  preSelectedConfigId?: string | null;
}

type WorkflowStep = 'select' | 'create' | 'edit';

export function TrainingWorkflow({
  sessionToken,
  allConfigs,
  allDatasets,
  onConfigCreated,
  preSelectedConfigId,
}: TrainingWorkflowProps) {
  console.log('[TrainingWorkflow] Rendered with', allConfigs.length, 'configs');

  // Step 0: Model selection
  const [selectedModel, setSelectedModel] = useState<SelectedModel | null>(null);

  // Step 1: Config selection/creation
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>('select');
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [configName, setConfigName] = useState<string>('');
  const [creating, setCreating] = useState(false);

  // Collapse state for each section
  const [modelSectionCollapsed, setModelSectionCollapsed] = useState(false);
  const [configSectionCollapsed, setConfigSectionCollapsed] = useState(false);
  const [datasetSectionCollapsed, setDatasetSectionCollapsed] = useState(false);

  // Handle pre-selected config from parent
  useEffect(() => {
    if (preSelectedConfigId) {
      console.log('[TrainingWorkflow] Pre-selecting config:', preSelectedConfigId);
      setSelectedConfigId(preSelectedConfigId);
      setWorkflowStep('select');
    }
  }, [preSelectedConfigId]);

  console.log('[TrainingWorkflow] Current step:', workflowStep, 'Selected config:', selectedConfigId);

  // Handler for config selection
  const handleConfigSelect = (configId: string) => {
    console.log('[TrainingWorkflow] Config selected:', configId);
    setSelectedConfigId(configId);
    setWorkflowStep('select');
  };

  // Format template name for display
  const formatTemplateName = (templateKey: string): string => {
    const formatted = templateKey
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return formatted;
  };

  // Handler for creating new config from template with custom name
  const handleCreateConfig = async () => {
    if (!selectedTemplate || !configName.trim() || !sessionToken || creating) return;

    console.log('[TrainingWorkflow] Creating config:', configName, 'from template:', selectedTemplate);
    setCreating(true);

    try {
      const template = ALL_TEMPLATES[selectedTemplate];
      
      // CRITICAL: Update model name if user selected a model
      const configWithModel = selectedModel ? {
        ...template,
        model: {
          ...template.model,
          name: selectedModel.name
        },
        tokenizer: {
          ...template.tokenizer,
          name: selectedModel.name
        }
      } : template;
      
      const response = await fetch('/api/training', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          name: configName.trim(),
          template_type: selectedTemplate,
          config_json: configWithModel
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[TrainingWorkflow] Create failed:', response.status, errorData);
        throw new Error(errorData.error || 'Failed to create config');
      }

      const data = await response.json();
      console.log('[TrainingWorkflow] Created config:', data.config.id);

      // Reset and select the newly created config
      setSelectedTemplate('');
      setConfigName('');
      setSelectedConfigId(data.config.id);
      setWorkflowStep('select');

      // Notify parent to refresh configs
      onConfigCreated();
    } catch (err) {
      console.error('[TrainingWorkflow] Create error:', err);
      alert(err instanceof Error ? err.message : 'Failed to create config');
    } finally {
      setCreating(false);
    }
  };

  // Handler for saving edited config
  const handleSaveConfig = () => {
    console.log('[TrainingWorkflow] Config saved');
    setWorkflowStep('select');
    onConfigCreated();
  };

  // Handler for canceling config edit or creation
  const handleCancelEdit = () => {
    console.log('[TrainingWorkflow] Edit/Create cancelled');
    setSelectedTemplate('');
    setConfigName('');
    setWorkflowStep('select');
  };

  // Get selected config object
  const selectedConfig = selectedConfigId
    ? allConfigs.find(c => c.id === selectedConfigId)
    : null;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Model Selection */}
      <div>
        {modelSectionCollapsed ? (
          <Card
            className="shadow-none border border-gray-300 dark:border-gray-600 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setModelSectionCollapsed(false)}
          >
            <CardContent className="flex items-center justify-between py-4">
              <h2 className="text-xl font-semibold">Choose Model</h2>
              <ChevronRight className="h-5 w-5" />
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-none border-2 border-gray-400 dark:border-gray-700">
            <CardContent className="pt-6">
              <div
                className="flex items-center justify-between mb-2 cursor-pointer hover:opacity-70 transition-opacity"
                onClick={() => setModelSectionCollapsed(true)}
              >
                <h2 className="text-xl font-semibold">Choose Model</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <ChevronDown className="h-5 w-5" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Choose a base model for training</p>
                <ModelSelectionCard
                  onModelSelect={setSelectedModel}
                />
              </CardContent>
            </Card>
        )}
      </div>

      {/* Training Configuration */}
      <div>
        {configSectionCollapsed ? (
          <Card 
            className="shadow-none border border-gray-300 dark:border-gray-600 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setConfigSectionCollapsed(false)}
          >
            <CardContent className="flex items-center justify-between py-4">
              <h2 className="text-xl font-semibold">Training Configuration</h2>
              <ChevronRight className="h-5 w-5" />
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-none border border-gray-300 dark:border-gray-600">
            <CardContent className="space-y-4 pt-6">
              <div
                className="flex items-center justify-between mb-2 cursor-pointer hover:opacity-70 transition-opacity"
                onClick={() => setConfigSectionCollapsed(true)}
              >
                <h2 className="text-xl font-semibold">Training Configuration</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <ChevronDown className="h-5 w-5" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Create or select a training configuration</p>

          {workflowStep === 'select' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <ConfigSearchCombobox
                  configs={allConfigs}
                  datasets={allDatasets}
                  value={selectedConfigId}
                  onChange={handleConfigSelect}
                  placeholder="Search or select config..."
                />

                {selectedConfigId && (
                  <Button
                    onClick={() => {
                      console.log('[TrainingWorkflow] Edit config clicked');
                      setWorkflowStep('edit');
                    }}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    Edit Configuration
                  </Button>
                )}
              </div>

              <Button
                onClick={() => {
                  console.log('[TrainingWorkflow] Create new config clicked');
                  setSelectedConfigId(null);
                  setWorkflowStep('create');
                }}
                variant="outline"
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Config
              </Button>
            </div>
          )}

          {workflowStep === 'create' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Create New Configuration</Label>
                <Button
                  onClick={handleCancelEdit}
                  variant="ghost"
                  size="sm"
                >
                  ← Back
                </Button>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="template-select" className="text-sm">
                    Template
                  </Label>
                  <select
                    id="template-select"
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring mt-1.5"
                  >
                    <option value="">Choose a template...</option>
                    {Object.keys(ALL_TEMPLATES).map(key => (
                      <option key={key} value={key}>
                        {formatTemplateName(key)}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedTemplate && (
                  <>
                    <div>
                      <Label htmlFor="config-name" className="text-sm">
                        Configuration Name
                      </Label>
                      <Input
                        id="config-name"
                        type="text"
                        value={configName}
                        onChange={(e) => setConfigName(e.target.value)}
                        placeholder="e.g., Fine-tune Llama for Code"
                        className="mt-1.5"
                      />
                    </div>

                    <Button
                      onClick={handleCreateConfig}
                      disabled={creating || !configName.trim()}
                      className="w-full"
                    >
                      {creating ? 'Creating...' : 'Create Configuration'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {workflowStep === 'edit' && selectedConfig && (
            <ConfigEditor
              configId={selectedConfig.id}
              configName={selectedConfig.name.replace(/_/g, ' ')}
              initialConfig={selectedConfig.config_json}
              onSave={handleSaveConfig}
              onCancel={handleCancelEdit}
              prefilledModel={selectedModel?.name || null}
            />
          )}
        </CardContent>
      </Card>
        )}
      </div>

      {/* Dataset + Package - Only show when config is selected and not being edited */}
      {workflowStep === 'select' && (
        <div>
          {datasetSectionCollapsed ? (
            <Card 
              className="shadow-none border border-gray-300 dark:border-gray-600 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setDatasetSectionCollapsed(false)}
            >
              <CardContent className="flex items-center justify-between py-4">
                <h2 className="text-xl font-semibold">Add Dataset & Generate Package</h2>
                <ChevronRight className="h-5 w-5" />
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-none border border-gray-300 dark:border-gray-600">
              <CardContent className="pt-6">
                <div
                  className="flex items-center justify-between mb-2 cursor-pointer hover:opacity-70 transition-opacity"
                  onClick={() => setDatasetSectionCollapsed(true)}
                >
                  <h2 className="text-xl font-semibold">Add Dataset & Generate Package</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <ChevronDown className="h-5 w-5" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-4">Attach training data and deploy your configuration</p>
                {selectedConfigId && selectedConfig ? (
                  <UnifiedPackageGenerator
                    configId={selectedConfig.id}
                    configName={selectedConfig.name.replace(/_/g, ' ')}
                    sessionToken={sessionToken}
                    config={selectedConfig.config_json}
                    datasetSize={selectedConfig.config_json.data?.max_samples}
                  />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">Select a training configuration above to continue</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

console.log('[TrainingWorkflow] Component defined');
