'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Copy, Check, Sparkles, AlertTriangle } from 'lucide-react';

export default function GuidesPage() {
  const { user, signOut, loading } = useAuth();
  const router = useRouter();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar currentPage="docs-guides" user={user} signOut={signOut} />
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-4xl mx-auto p-8">
          <h1 className="text-4xl font-bold mb-4">📚 Guides</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Step-by-step tutorials for common workflows
          </p>

          {/* Table of Contents */}
          <nav className="mb-12 p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
            <h2 className="text-lg font-semibold mb-4">📋 Quick Navigation</h2>
            <div className="grid gap-2 text-sm">
              <a href="#complete-workflow" className="text-blue-600 dark:text-blue-400 hover:underline">
                1. Complete Training Workflow
              </a>
              <a href="#dataset-prep" className="text-blue-600 dark:text-blue-400 hover:underline">
                2. Dataset Preparation
              </a>
              <a href="#hyperparameters" className="text-blue-600 dark:text-blue-400 hover:underline">
                3. Hyperparameter Tuning
              </a>
              <a href="#deployment" className="text-blue-600 dark:text-blue-400 hover:underline">
                4. Model Deployment
              </a>
              <a href="#monitoring" className="text-blue-600 dark:text-blue-400 hover:underline">
                5. Performance Monitoring
              </a>
            </div>
          </nav>

          {/* Guide 1: Complete Training Workflow */}
          <section id="complete-workflow" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-blue-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">1. Complete Training Workflow</h2>
              <p className="text-muted-foreground">End-to-end walkthrough from dataset to deployed model</p>
            </div>

            <div className="space-y-6">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="font-semibold mb-2">🎯 What you&apos;ll learn:</h3>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Upload and prepare training data</li>
                  <li>• Create and validate training configuration</li>
                  <li>• Start and monitor training jobs</li>
                  <li>• Download and deploy trained models</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3">Step 1: Prepare Your Dataset</h3>
                <p className="text-muted-foreground mb-4">
                  First, create a JSONL file with your training examples. Each line should be a valid JSON object.
                </p>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">Example: training_data.jsonl</h4>
                    <button
                      onClick={() => copyToClipboard(
`{"messages": [{"role": "user", "content": "What is machine learning?"}, {"role": "assistant", "content": "Machine learning is..."}]}
{"messages": [{"role": "user", "content": "Explain neural networks"}, {"role": "assistant", "content": "Neural networks are..."}]}`,
                        'dataset-example'
                      )}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                    >
                      {copiedCode === 'dataset-example' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedCode === 'dataset-example' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm text-slate-100">
                      <code>{`{"messages": [{"role": "user", "content": "What is machine learning?"}, {"role": "assistant", "content": "Machine learning is..."}]}
{"messages": [{"role": "user", "content": "Explain neural networks"}, {"role": "assistant", "content": "Neural networks are..."}]}`}</code>
                    </pre>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3">Step 2: Upload Dataset</h3>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">Upload via API:</h4>
                    <button
                      onClick={() => copyToClipboard(
`curl -X POST http://localhost:3000/api/training/datasets \\
  -H "Content-Type: multipart/form-data" \\
  -F "file=@training_data.jsonl" \\
  -F "name=My Training Dataset"`,
                        'upload-dataset'
                      )}
                      className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1"
                    >
                      {copiedCode === 'upload-dataset' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedCode === 'upload-dataset' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg">
                    <pre className="text-sm text-slate-100">
                      <code>{`curl -X POST http://localhost:3000/api/training/datasets \\
  -F "file=@training_data.jsonl" \\
  -F "name=My Training Dataset"`}</code>
                    </pre>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3">Step 3: Create Training Config</h3>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">POST /api/training</h4>
                    <button
                      onClick={() => copyToClipboard(
`curl -X POST http://localhost:3000/api/training \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "my-finetuned-model",
    "base_model": "meta-llama/Llama-3.2-1B",
    "dataset_id": "dataset-123",
    "learning_rate": 0.0001,
    "batch_size": 4,
    "epochs": 3
  }'`,
                        'create-config'
                      )}
                      className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1"
                    >
                      {copiedCode === 'create-config' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedCode === 'create-config' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg">
                    <pre className="text-sm text-slate-100">
                      <code>{`curl -X POST http://localhost:3000/api/training \\
  -d '{
    "name": "my-finetuned-model",
    "base_model": "meta-llama/Llama-3.2-1B",
    "dataset_id": "dataset-123",
    "epochs": 3
  }'`}</code>
                    </pre>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3">Step 4: Start Training</h3>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">POST /api/training/execute</h4>
                    <button
                      onClick={() => copyToClipboard('curl -X POST http://localhost:3000/api/training/execute -H "Content-Type: application/json" -d \'{"id": "config-456"}\'', 'start-training')}
                      className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1"
                    >
                      {copiedCode === 'start-training' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedCode === 'start-training' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg">
                    <pre className="text-sm text-slate-100">
                      <code>{`curl -X POST http://localhost:3000/api/training/execute \\
  -d '{"id": "config-456"}'`}</code>
                    </pre>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3">Step 5: Monitor Progress</h3>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">GET /api/training/metrics/:id</h4>
                    <button
                      onClick={() => copyToClipboard('curl http://localhost:3000/api/training/metrics/job-789', 'get-metrics')}
                      className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1"
                    >
                      {copiedCode === 'get-metrics' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedCode === 'get-metrics' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg">
                    <pre className="text-sm text-slate-100">
                      <code>{`curl http://localhost:3000/api/training/metrics/job-789`}</code>
                    </pre>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                    <p className="text-sm text-purple-800 dark:text-purple-200">
                      &quot;Walk me through fine-tuning a model on my custom dataset&quot;
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Guide 2: Dataset Preparation */}
          <section id="dataset-prep" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-green-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">2. Dataset Preparation</h2>
              <p className="text-muted-foreground">Format, validate, and optimize your training data</p>
            </div>

            <div className="space-y-6">
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold mb-2">⚠️ Dataset Quality Matters</h3>
                    <p className="text-sm text-muted-foreground">
                      Poor quality data leads to poor models. Spend time cleaning and formatting your dataset properly.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3">Required Format</h3>
                <p className="text-muted-foreground mb-4">
                  Training data must be in JSONL format (JSON Lines) with each line containing a <code className="px-1 py-0.5 bg-slate-200 dark:bg-slate-800 rounded text-sm">messages</code> array:
                </p>
                <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg mb-4">
                  <pre className="text-sm">
                    {`{
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "User question here"},
    {"role": "assistant", "content": "Model response here"}
  ]
}`}
                  </pre>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3">Best Practices</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded">
                    <h4 className="font-semibold mb-1">✓ Size Guidelines</h4>
                    <p className="text-sm text-muted-foreground">Minimum 50 examples, optimal 500-5000 examples</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded">
                    <h4 className="font-semibold mb-1">✓ Quality Over Quantity</h4>
                    <p className="text-sm text-muted-foreground">Better to have 100 high-quality examples than 1000 poor ones</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded">
                    <h4 className="font-semibold mb-1">✓ Diverse Examples</h4>
                    <p className="text-sm text-muted-foreground">Cover different scenarios and edge cases</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded">
                    <h4 className="font-semibold mb-1">✓ Consistent Format</h4>
                    <p className="text-sm text-muted-foreground">Use the same structure and tone across all examples</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3">Validation Checklist</h3>
                <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                  <ul className="space-y-2 text-sm">
                    <li>□ Valid JSON on every line</li>
                    <li>□ Each line has a <code className="px-1 py-0.5 bg-slate-200 dark:bg-slate-800 rounded">messages</code> array</li>
                    <li>□ Messages have <code className="px-1 py-0.5 bg-slate-200 dark:bg-slate-800 rounded">role</code> and <code className="px-1 py-0.5 bg-slate-200 dark:bg-slate-800 rounded">content</code> fields</li>
                    <li>□ No empty content strings</li>
                    <li>□ Reasonable token length (&lt;4000 tokens per example)</li>
                    <li>□ UTF-8 encoding</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Guide 3: Hyperparameter Tuning */}
          <section id="hyperparameters" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-purple-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">3. Hyperparameter Tuning</h2>
              <p className="text-muted-foreground">Optimize training parameters for best results</p>
            </div>

            <div className="space-y-6">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="font-semibold mb-2">🎯 Key Parameters:</h3>
                <p className="text-sm text-muted-foreground">
                  Learning rate, batch size, and epochs are the most impactful parameters to tune.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3">Learning Rate</h3>
                <div className="space-y-3">
                  <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                    <p className="text-sm mb-2">Controls how fast the model learns. Too high = unstable, too low = slow convergence.</p>
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <code className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-xs">1e-5 to 1e-4</code>
                        <span className="text-xs text-muted-foreground">Recommended for most fine-tuning tasks</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded text-xs">1e-4 to 1e-3</code>
                        <span className="text-xs text-muted-foreground">For smaller models or large datasets</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded text-xs">&gt; 1e-3</code>
                        <span className="text-xs text-muted-foreground">Usually too high, may cause training instability</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3">Batch Size</h3>
                <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                  <p className="text-sm mb-2">Number of examples processed before updating model weights.</p>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded text-xs">1-2</code>
                      <span className="text-xs text-muted-foreground">Small GPU memory (&lt;8GB VRAM)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded text-xs">4-8</code>
                      <span className="text-xs text-muted-foreground">Medium GPU (8-16GB VRAM)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded text-xs">16-32</code>
                      <span className="text-xs text-muted-foreground">Large GPU (&gt;16GB VRAM)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3">Epochs</h3>
                <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                  <p className="text-sm mb-2">Number of times the model sees the entire dataset.</p>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded text-xs">1-3</code>
                      <span className="text-xs text-muted-foreground">Large datasets (&gt;1000 examples)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded text-xs">3-5</code>
                      <span className="text-xs text-muted-foreground">Medium datasets (100-1000 examples)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded text-xs">5-10</code>
                      <span className="text-xs text-muted-foreground">Small datasets (&lt;100 examples)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3">Example Configuration</h3>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">Optimized Training Config</h4>
                    <button
                      onClick={() => copyToClipboard(
`{
  "name": "optimized-model",
  "base_model": "meta-llama/Llama-3.2-1B",
  "dataset_id": "dataset-123",
  "learning_rate": 0.0001,
  "batch_size": 4,
  "epochs": 3,
  "warmup_steps": 100,
  "eval_steps": 50,
  "save_steps": 100,
  "gradient_accumulation_steps": 2,
  "max_seq_length": 512
}`,
                        'hyperparams-example'
                      )}
                      className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1"
                    >
                      {copiedCode === 'hyperparams-example' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedCode === 'hyperparams-example' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg">
                    <pre className="text-sm text-slate-100">
                      <code>{`{
  "learning_rate": 0.0001,
  "batch_size": 4,
  "epochs": 3,
  "warmup_steps": 100,
  "eval_steps": 50,
  "save_steps": 100
}`}</code>
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Guide 4: Model Deployment */}
          <section id="deployment" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-orange-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">4. Deploy to Production Inference</h2>
              <p className="text-muted-foreground">Deploy your trained model to RunPod Serverless or local inference servers</p>
            </div>

            <div className="space-y-6">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="font-semibold mb-2">🚀 Deployment Options:</h3>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• <strong>RunPod Serverless</strong> - Auto-scaling cloud inference (A4000 to H100 GPUs)</li>
                  <li>• <strong>Local vLLM</strong> - Fast local inference with GPU acceleration</li>
                  <li>• <strong>Local Ollama</strong> - Lightweight local inference</li>
                  <li>• Budget controls, cost tracking, and auto-stop available</li>
                </ul>
              </div>

              {/* Option A: RunPod Serverless */}
              <div className="border-2 border-orange-200 dark:border-orange-800 rounded-lg p-6">
                <h3 className="text-2xl font-semibold mb-4 text-orange-600 dark:text-orange-400">Option A: RunPod Serverless (Recommended)</h3>
                <p className="text-muted-foreground mb-4">
                  Deploy to cloud with auto-scaling, pay-per-request pricing, and built-in budget controls.
                </p>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-semibold mb-2">Step 1: Configure RunPod API Key</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Go to <strong>Settings → Secrets</strong> and add your RunPod API key with name &quot;runpod&quot;.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold mb-2">Step 2: Deploy via API</h4>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-sm font-semibold">POST /api/inference/deploy</h5>
                        <button
                          onClick={() => copyToClipboard(
`curl -X POST http://localhost:8000/api/inference/deploy \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -d '{
    "provider": "runpod-serverless",
    "deployment_name": "my-model-prod",
    "training_job_id": "your-job-id",
    "checkpoint_selection": "best",
    "gpu_type": "NVIDIA RTX A4000",
    "min_workers": 0,
    "max_workers": 3,
    "budget_limit": 10.0,
    "auto_stop_on_budget": true
  }'`,
                            'deploy-runpod'
                          )}
                          className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1"
                        >
                          {copiedCode === 'deploy-runpod' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          {copiedCode === 'deploy-runpod' ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg">
                        <pre className="text-sm text-slate-100">
                          <code>{`curl -X POST http://localhost:8000/api/inference/deploy \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -d '{
    "provider": "runpod-serverless",
    "deployment_name": "my-model-prod",
    "training_job_id": "your-job-id",
    "gpu_type": "NVIDIA RTX A4000",
    "budget_limit": 10.0
  }'`}</code>
                        </pre>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold mb-2">Step 3: Monitor Deployment</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Navigate to <strong>/inference</strong> page to view deployment status, cost tracking, and manage your endpoint.
                    </p>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-sm font-semibold">GET /api/inference/deployments/:id/status</h5>
                        <button
                          onClick={() => copyToClipboard(
`curl http://localhost:8000/api/inference/deployments/dep-xyz789/status \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"`,
                            'check-status'
                          )}
                          className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1"
                        >
                          {copiedCode === 'check-status' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          {copiedCode === 'check-status' ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg">
                        <pre className="text-sm text-slate-100">
                          <code>{`curl http://localhost:8000/api/inference/deployments/dep-xyz789/status \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"`}</code>
                        </pre>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold mb-2">Step 4: Make Inference Requests</h4>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-sm font-semibold">Use the endpoint URL from deployment response:</h5>
                        <button
                          onClick={() => copyToClipboard(
`curl -X POST https://api.runpod.ai/v2/your-endpoint-id/runsync \\
  -H "Content-Type: application/json" \\
  -d '{
    "input": {
      "prompt": "Hello, how are you?",
      "max_tokens": 100
    }
  }'`,
                            'inference-request'
                          )}
                          className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1"
                        >
                          {copiedCode === 'inference-request' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          {copiedCode === 'inference-request' ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg">
                        <pre className="text-sm text-slate-100">
                          <code>{`curl -X POST https://api.runpod.ai/v2/endpoint-id/runsync \\
  -d '{
    "input": {"prompt": "Hello", "max_tokens": 100}
  }'`}</code>
                        </pre>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <h4 className="font-semibold mb-2 text-green-800 dark:text-green-200">✓ RunPod Benefits:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Auto-scaling: Scale to zero when idle, scale up automatically</li>
                      <li>• Budget controls: Set limits, get alerts, auto-stop on budget</li>
                      <li>• Cost tracking: Real-time spend monitoring per request</li>
                      <li>• GPU variety: Choose from A4000 ($0.0004/req) to H100 ($0.0035/req)</li>
                      <li>• No infrastructure: Fully managed, no server maintenance</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Option B: Local Deployment */}
              <div className="border-2 border-blue-200 dark:border-blue-800 rounded-lg p-6">
                <h3 className="text-2xl font-semibold mb-4 text-blue-600 dark:text-blue-400">Option B: Local Inference Servers</h3>
                <p className="text-muted-foreground mb-4">
                  Deploy locally using vLLM or Ollama for development and testing.
                </p>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-semibold mb-2">Local vLLM Deployment</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Fast inference with GPU acceleration. Navigate to training monitor page and click &quot;Deploy to vLLM&quot;.
                    </p>
                    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded text-sm">
                      <p>• Requires: Local GPU with CUDA</p>
                      <p>• Port range: 8002-8020 (auto-assigned)</p>
                      <p>• Best for: Development and testing</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold mb-2">Local Ollama Deployment</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Lightweight local inference. Click &quot;Deploy to Ollama&quot; from training monitor.
                    </p>
                    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded text-sm">
                      <p>• Requires: Ollama installed locally</p>
                      <p>• Supports: LoRA adapters and quantized models</p>
                      <p>• Best for: Quick local testing</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Budget & Cost Management */}
              <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <h3 className="font-semibold mb-3 text-purple-800 dark:text-purple-200">💰 Budget & Cost Management</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p><strong>Budget Limits:</strong> Set minimum budget of $1.00, recommended $10-50 for production</p>
                  <p><strong>Cost Tracking:</strong> View real-time spend, request count, and cost per request on /inference page</p>
                  <p><strong>Budget Alerts:</strong> Automatic alerts at 50%, 80%, and 100% budget utilization</p>
                  <p><strong>Auto-Stop:</strong> Deployment automatically stops when budget limit is reached (optional)</p>
                  <p><strong>GPU Pricing:</strong> A4000 ($0.0004/req) | A5000 ($0.0006/req) | A6000 ($0.0008/req) | H100 ($0.0035/req)</p>
                </div>
              </div>

              {/* Production Checklist */}
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold mb-2">Production Deployment Checklist</h3>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>□ Training completed with best checkpoint available</li>
                      <li>□ RunPod API key configured in Settings → Secrets</li>
                      <li>□ Budget limit set appropriate for expected traffic</li>
                      <li>□ Auto-stop enabled to prevent overspending</li>
                      <li>□ Test deployment with small budget first ($1-5)</li>
                      <li>□ Monitor costs on /inference page regularly</li>
                      <li>□ Set up monitoring for 50% and 80% budget alerts</li>
                      <li>□ Have plan to scale or adjust budget as needed</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Guide 5: Performance Monitoring */}
          <section id="monitoring" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-cyan-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">5. Performance Monitoring</h2>
              <p className="text-muted-foreground">Track training progress and analyze results</p>
            </div>

            <div className="space-y-6">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="font-semibold mb-2">📊 Key Metrics to Track:</h3>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Training loss (should decrease over time)</li>
                  <li>• Evaluation loss (monitors overfitting)</li>
                  <li>• Learning rate (changes with warmup/decay)</li>
                  <li>• GPU utilization (efficiency indicator)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3">Real-Time Metrics</h3>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">GET /api/training/metrics/:id</h4>
                    <button
                      onClick={() => copyToClipboard('curl http://localhost:3000/api/training/metrics/job-789', 'monitor-metrics')}
                      className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1"
                    >
                      {copiedCode === 'monitor-metrics' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedCode === 'monitor-metrics' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg">
                    <pre className="text-sm text-slate-100">
                      <code>{`curl http://localhost:3000/api/training/metrics/job-789`}</code>
                    </pre>
                  </div>
                  <div className="mt-3 bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                    <pre className="text-sm">
                      {`{
  "job_id": "job-789",
  "current_step": 150,
  "total_steps": 300,
  "train_loss": 0.234,
  "eval_loss": 0.298,
  "learning_rate": 0.00009,
  "epoch": 1.5,
  "gpu_memory_used": "12.5GB"
}`}
                    </pre>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3">Training Logs</h3>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">GET /api/training/logs/:id</h4>
                    <button
                      onClick={() => copyToClipboard('curl http://localhost:3000/api/training/logs/job-789', 'get-logs')}
                      className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1"
                    >
                      {copiedCode === 'get-logs' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedCode === 'get-logs' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg">
                    <pre className="text-sm text-slate-100">
                      <code>{`curl http://localhost:3000/api/training/logs/job-789`}</code>
                    </pre>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3">Job Analytics</h3>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">GET /api/training/analytics/:id</h4>
                    <button
                      onClick={() => copyToClipboard('curl http://localhost:3000/api/training/analytics/job-789', 'get-analytics')}
                      className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1"
                    >
                      {copiedCode === 'get-analytics' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedCode === 'get-analytics' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg">
                    <pre className="text-sm text-slate-100">
                      <code>{`curl http://localhost:3000/api/training/analytics/job-789`}</code>
                    </pre>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3">Understanding Loss Metrics</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded">
                    <h4 className="font-semibold mb-1 text-green-900 dark:text-green-100">✓ Good Training</h4>
                    <p className="text-sm text-green-800 dark:text-green-200">
                      Training loss decreases steadily, eval loss follows similar pattern
                    </p>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded">
                    <h4 className="font-semibold mb-1 text-amber-900 dark:text-amber-100">⚠️ Overfitting</h4>
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      Training loss decreases but eval loss increases or plateaus
                    </p>
                  </div>
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded">
                    <h4 className="font-semibold mb-1 text-red-900 dark:text-red-100">✗ Training Issues</h4>
                    <p className="text-sm text-red-800 dark:text-red-200">
                      Loss increases, stays flat, or shows erratic behavior
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                    <p className="text-sm text-purple-800 dark:text-purple-200">
                      &quot;Show me the training metrics and explain if my model is learning properly&quot;
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Summary */}
          <div className="p-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 border border-green-200 dark:border-green-800 rounded-lg">
            <h2 className="text-xl font-bold mb-3">🎓 Ready to Train!</h2>
            <p className="text-muted-foreground mb-4">
              You now have comprehensive guides covering the complete fine-tuning workflow. Start with a small dataset and experiment!
            </p>
            <div className="flex gap-4">
              <a href="/docs/api-reference" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                View Full API Reference →
              </a>
              <a href="/docs/examples" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                See Code Examples →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
