'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Copy, Check, Sparkles } from 'lucide-react';

export default function QuickStartPage() {
  const { user, signOut, loading } = useAuth();
  const router = useRouter();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Public page - no auth required
  // if (loading) {
  //   return (
  //     <div className="flex items-center justify-center min-h-screen">
  //       <div className="text-center">
  //         <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
  //         <p className="text-gray-600">Loading...</p>
  //       </div>
  //     </div>
  //   );
  // }

  const copyToClipboard = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar currentPage="docs-quickstart" user={user} signOut={signOut} />
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-4xl mx-auto p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-4">⚡ Quick Start</h1>
            <p className="text-xl text-muted-foreground">
              Get started in under 5 minutes with working examples
            </p>
          </div>

          {/* Step 1: First API Call */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4">1. Make Your First API Call</h2>
            <p className="text-muted-foreground mb-4">
              Let&apos;s start by listing available models. This confirms your API is working.
            </p>

            {/* What it does */}
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Retrieves a list of all available models you can use for training and inference.
              </p>
            </div>

            {/* Code block with copy button */}
            <div className="relative mb-4">
              <div className="absolute top-3 right-3 z-10">
                <button
                  onClick={() => copyToClipboard('curl https://finetunelab.ai/api/models', 'models')}
                  className="p-2 bg-gray-800 hover:bg-gray-700 rounded-md text-white transition-colors"
                  title="Copy code"
                >
                  {copiedCode === 'models' ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                <code className="text-sm font-mono">
                  curl https://finetunelab.ai/api/models
                </code>
              </pre>
            </div>

            {/* LLM Prompt Box */}
            <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-2 text-purple-900 dark:text-purple-100">
                    💬 Ask Your AI Assistant:
                  </h3>
                  <p className="text-sm font-mono bg-white dark:bg-gray-900 p-2 rounded border">
                    &quot;Call the models API endpoint and show me the available models&quot;
                  </p>
                </div>
              </div>
            </div>

            {/* Expected Response */}
            <div className="mb-4">
              <h3 className="font-semibold mb-2">✅ Response you&apos;ll get:</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                <code className="font-mono">
{`{
  "models": [
    {
      "id": "llama-3-8b",
      "name": "LLaMA 3 8B",
      "status": "available"
    },
    {
      "id": "mistral-7b",
      "name": "Mistral 7B",
      "status": "available"
    }
  ]
}`}
                </code>
              </pre>
            </div>
          </section>

          {/* Step 2: Start a Training Job */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4">2. Start a Training Job</h2>
            <p className="text-muted-foreground mb-4">
              Now let&apos;s start training a model with your dataset.
            </p>

            {/* What it does */}
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Starts a new fine-tuning job with your specified model and dataset.
              </p>
            </div>

            {/* Code block */}
            <div className="relative mb-4">
              <div className="absolute top-3 right-3 z-10">
                <button
                  onClick={() => copyToClipboard(
`curl -X POST https://finetunelab.ai/api/training/start \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama-3-8b",
    "dataset": "my-dataset-id",
    "config": "default"
  }'`,
                    'training'
                  )}
                  className="p-2 bg-gray-800 hover:bg-gray-700 rounded-md text-white transition-colors"
                  title="Copy code"
                >
                  {copiedCode === 'training' ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                <code className="text-sm font-mono">
{`curl -X POST https://finetunelab.ai/api/training/start \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama-3-8b",
    "dataset": "my-dataset-id",
    "config": "default"
  }'`}
                </code>
              </pre>
            </div>

            {/* LLM Prompt */}
            <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-2 text-purple-900 dark:text-purple-100">
                    💬 Ask Your AI Assistant:
                  </h3>
                  <p className="text-sm font-mono bg-white dark:bg-gray-900 p-2 rounded border">
                    &quot;Start a training job using llama-3-8b with my dataset ID abc123&quot;
                  </p>
                </div>
              </div>
            </div>

            {/* Expected Response */}
            <div className="mb-4">
              <h3 className="font-semibold mb-2">✅ Response you&apos;ll get:</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                <code className="font-mono">
{`{
  "job_id": "job-12345",
  "status": "queued",
  "message": "Training job started successfully"
}`}
                </code>
              </pre>
            </div>
          </section>

          {/* Step 3: Monitor Progress */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4">3. Monitor Training Progress</h2>
            <p className="text-muted-foreground mb-4">
              Check the status of your training job using the job ID from step 2.
            </p>

            {/* Code block */}
            <div className="relative mb-4">
              <div className="absolute top-3 right-3 z-10">
                <button
                  onClick={() => copyToClipboard('curl https://finetunelab.ai/api/training/status/job-12345', 'status')}
                  className="p-2 bg-gray-800 hover:bg-gray-700 rounded-md text-white transition-colors"
                  title="Copy code"
                >
                  {copiedCode === 'status' ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                <code className="text-sm font-mono">
                  curl https://finetunelab.ai/api/training/status/job-12345
                </code>
              </pre>
            </div>

            {/* Expected Response */}
            <div className="mb-4">
              <h3 className="font-semibold mb-2">✅ Response you&apos;ll get:</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                <code className="font-mono">
{`{
  "job_id": "job-12345",
  "status": "running",
  "progress": 45,
  "current_epoch": 2,
  "total_epochs": 5,
  "loss": 0.234
}`}
                </code>
              </pre>
            </div>
          </section>

          {/* Step 4: Deploy Model */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4">4. Deploy Your Model</h2>
            <p className="text-muted-foreground mb-4">
              Once training completes, deploy your model to production with RunPod Serverless cloud inference.
            </p>

            {/* What it does */}
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Deploys your trained model to a serverless GPU endpoint with auto-scaling and budget controls.
                The deployment takes 2-5 minutes and gives you an API endpoint for inference.
              </p>
            </div>

            {/* Code block */}
            <div className="relative mb-4">
              <div className="absolute top-3 right-3 z-10">
                <button
                  onClick={() => copyToClipboard(`curl -X POST https://finetunelab.ai/api/inference/deploy \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider": "runpod-serverless",
    "deployment_name": "my-model-prod",
    "training_job_id": "job-12345",
    "gpu_type": "NVIDIA RTX A4000",
    "budget_limit": 5.0
  }'`, 'deploy')}
                  className="p-2 bg-gray-800 hover:bg-gray-700 rounded-md text-white transition-colors"
                  title="Copy code"
                >
                  {copiedCode === 'deploy' ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                <code className="text-sm font-mono">
{`curl -X POST https://finetunelab.ai/api/inference/deploy \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider": "runpod-serverless",
    "deployment_name": "my-model-prod",
    "training_job_id": "job-12345",
    "gpu_type": "NVIDIA RTX A4000",
    "budget_limit": 5.0
  }'`}
                </code>
              </pre>
            </div>

            {/* Expected Response */}
            <div className="mb-4">
              <h3 className="font-semibold mb-2">✅ Expected Response:</h3>
              <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm">
                <code className="font-mono">
{`{
  "success": true,
  "deployment_id": "dep-xyz789",
  "endpoint_url": "https://api.runpod.ai/v2/xyz789",
  "status": "deploying",
  "cost_per_request": 0.0004
}`}
                </code>
              </pre>
            </div>

            {/* Next Step Info */}
            <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
              <h3 className="font-semibold mb-2 text-green-800 dark:text-green-200">🎯 What&apos;s Next</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Wait 2-5 minutes for deployment to become active, then make inference requests to your endpoint.
              </p>
              <p className="text-sm">
                <strong>Learn more:</strong>{' '}
                <a href="/docs/guides#deployment" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Deploy to Production Guide
                </a>
                {' | '}
                <a href="/docs/examples#inference-deployment" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Full Code Examples
                </a>
              </p>
            </div>
          </section>

          {/* Common Issues */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4">⚠️ Common Issues</h2>
            <div className="space-y-4">
              <div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-950/20">
                <h3 className="font-semibold text-red-900 dark:text-red-100 mb-2">
                  ❌ &quot;Connection refused&quot;
                </h3>
                <p className="text-sm text-muted-foreground mb-2">
                  The API server isn&apos;t running. Start it with:
                </p>
                <code className="text-sm font-mono bg-white dark:bg-gray-900 p-2 rounded block">
                  npm run dev
                </code>
              </div>

              <div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-950/20">
                <h3 className="font-semibold text-red-900 dark:text-red-100 mb-2">
                  ❌ &quot;Dataset not found&quot;
                </h3>
                <p className="text-sm text-muted-foreground">
                  Check your dataset ID. List available datasets with:
                </p>
                <code className="text-sm font-mono bg-white dark:bg-gray-900 p-2 rounded block mt-2">
                  curl https://finetunelab.ai/api/datasets
                </code>
              </div>
            </div>
          </section>

          {/* Next Steps */}
          <section className="mb-12 p-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 border border-green-200 dark:border-green-800 rounded-lg">
            <h2 className="text-2xl font-bold mb-4">🎉 What&apos;s Next?</h2>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">→</span>
                <span>
                  <a href="/docs/api-reference" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                    API Reference
                  </a>
                  {' '}- Explore all available endpoints
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">→</span>
                <span>
                  <a href="/docs/guides" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                    Guides
                  </a>
                  {' '}- Learn advanced workflows
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">→</span>
                <span>
                  <a href="/docs/examples" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                    Examples
                  </a>
                  {' '}- See Python and JavaScript code
                </span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
