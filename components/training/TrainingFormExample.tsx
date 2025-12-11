'use client';

import React, { useState, useEffect } from 'react';
import {
  ModelSelector,
  LoRAConfigComponent,
  DataStrategySelector,
  DatasetValidator,
  TrainingParamsComponent,
  ValidationSummary,
  PreSubmitModal,
} from '@/components/training';
import type {
  ModelInfo,
  LoRAConfig,
  DataStrategy,
  DatasetExample,
  TrainingParams,
} from '@/components/training';
import { validateTrainingConfig } from '@/lib/training/validation';
import { servicesConfig } from '@/lib/config/services';

export function TrainingFormExample() {
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null);
  const [loraConfig, setLoraConfig] = useState<LoRAConfig>({
    r: 16,
    alpha: 32,
    dropout: 0.1,
    target_modules: [],
  });
  const [strategy, setStrategy] = useState<DataStrategy>('standard');
  const [dataset, setDataset] = useState<DatasetExample[] | null>(null);
  const [trainingParams, setTrainingParams] = useState<TrainingParams>({
    method: 'sft',
    num_epochs: 3,
    batch_size: 4,
    learning_rate: 0.0001,
  });

  const [showPreSubmit, setShowPreSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (selectedModel) {
      setLoraConfig((prev) => ({
        ...prev,
        target_modules: selectedModel.loraTargets,
      }));
    }
  }, [selectedModel]);

  const validation = validateTrainingConfig({
    model: selectedModel || undefined,
    lora: loraConfig,
    data: { strategy },
    dataset: dataset || undefined,
    training: trainingParams,
  });

  const handleSubmit = () => {
    if (!validation.isValid) {
      return;
    }
    setShowPreSubmit(true);
  };

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);

    try {
      const requestBody = {
        config: {
          model: {
            name: selectedModel?.name,
          },
          lora: loraConfig,
          data: {
            strategy,
          },
          training: {
            method: trainingParams.method,
            num_epochs: trainingParams.num_epochs,
            batch_size: trainingParams.batch_size,
            learning_rate: trainingParams.learning_rate,
          },
        },
        dataset_content: dataset,
        dataset_path: '/tmp/dataset.json',
        execution_id: `exec_${Date.now()}`,
        name: `Training ${selectedModel?.displayName || 'Model'}`,
      };

      console.log('[TrainingForm] Submitting config:', requestBody);

      const response = await fetch(`${servicesConfig.training.serverUrl}/api/training/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Training submission failed');
      }

      const result = await response.json();
      console.log('[TrainingForm] Training started:', result);

      alert(`Training started successfully! Job ID: ${result.job_id}`);
      setShowPreSubmit(false);
    } catch (error) {
      console.error('[TrainingForm] Submission error:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Configure Training Job</h1>

        <div className="space-y-8">
          <ModelSelector selectedModel={selectedModel?.id} onChange={setSelectedModel} />

          <LoRAConfigComponent
            config={loraConfig}
            onChange={setLoraConfig}
            selectedModel={selectedModel || undefined}
          />

          <DataStrategySelector
            strategy={strategy}
            onChange={setStrategy}
            selectedModel={selectedModel || undefined}
          />

          <DatasetValidator
            dataset={dataset}
            onChange={setDataset}
            expectedStrategy={strategy}
          />

          <TrainingParamsComponent params={trainingParams} onChange={setTrainingParams} />

          <div className="pt-6 border-t border-gray-200">
            <ValidationSummary
              validation={validation}
              onSubmit={handleSubmit}
              submitLabel="Review & Submit"
            />
          </div>
        </div>
      </div>

      <PreSubmitModal
        isOpen={showPreSubmit}
        onClose={() => setShowPreSubmit(false)}
        onConfirm={handleConfirmSubmit}
        config={{
          model: selectedModel || undefined,
          lora: loraConfig,
          data: { strategy },
          dataset: dataset || undefined,
          training: trainingParams,
        }}
        validation={validation}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
