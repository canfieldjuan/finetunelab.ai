'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Copy, Check, Sparkles } from 'lucide-react';

export default function APIReferencePage() {
  const { user, signOut, loading } = useAuth();
  const router = useRouter();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Public page - no auth required
  // if (loading) {
  //   return (
  //     <div className="flex items-center justify-center min-h-screen">
  //       <div className="text-center">
  //         <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
  //         <p className="text-muted-foreground">Loading...</p>
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
      <AppSidebar currentPage="docs-api" user={user} signOut={signOut} />
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-4xl mx-auto p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-4">📡 API Reference</h1>
            <p className="text-xl text-muted-foreground">
              Complete API documentation for training, models, and analytics
            </p>
          </div>

          {/* Base URL Info */}
          <div className="mb-12 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h2 className="text-xl font-bold mb-3">🌐 Base URL</h2>
            <code className="block bg-white dark:bg-gray-900 p-3 rounded-md font-mono text-sm border">
              https://finetunelab.ai
            </code>
            <p className="text-sm text-muted-foreground mt-3">
              All endpoints are relative to this base URL. For local development, use http://localhost:3000
            </p>
          </div>

          {/* Table of Contents */}
          <nav className="mb-12 p-6 bg-muted rounded-lg">
            <h2 className="text-xl font-bold mb-4">📋 Endpoints</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <a href="#list-models" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">→ GET /api/models</a>
              <a href="#start-training" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">→ POST /api/training/start</a>
              <a href="#get-status" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">→ GET /api/training/status/:jobId</a>
              <a href="#pause-job" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">→ POST /api/training/pause/:jobId</a>
              <a href="#resume-job" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">→ POST /api/training/resume/:jobId</a>
              <a href="#cancel-job" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">→ POST /api/training/cancel/:jobId</a>
              <a href="#list-datasets" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">→ GET /api/training/dataset</a>
              <a href="#deploy-model" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">→ POST /api/training/deploy</a>
              <a href="#execute-training" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">→ POST /api/training/execute</a>
              <a href="#get-metrics" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">→ GET /api/training/metrics/:jobId</a>
              <a href="#get-logs" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">→ GET /api/training/logs/:jobId</a>
              <a href="#list-checkpoints" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">→ GET /api/training/checkpoints/:jobId</a>
              <a href="#validate-model" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">→ POST /api/training/validate</a>
              <a href="#download-model" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">→ GET /api/training/:jobId/download/model</a>
              <a href="#download-logs" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">→ GET /api/training/:jobId/download/logs</a>
              <a href="#job-analytics" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">→ GET /api/training/:jobId/analytics</a>
              <a href="#analytics-summary" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">→ GET /api/training/analytics/summary</a>
              <a href="#analytics-compare" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">→ GET /api/training/analytics/compare</a>
              <a href="#list-configs" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">→ GET /api/training (List Configs)</a>
              <a href="#create-config" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">→ POST /api/training (Create Config)</a>
              <a href="#get-config" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">→ GET /api/training/:id</a>
              <a href="#update-config" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">→ PUT /api/training/:id</a>
              <a href="#delete-config" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">→ DELETE /api/training/:id</a>
              <a href="#create-model" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">→ POST /api/models (Create Model)</a>
              <a href="#delete-model" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">→ DELETE /api/models/:id</a>
              <a href="#deploy-inference" className="text-orange-600 dark:text-orange-400 hover:underline text-sm font-semibold">→ POST /api/inference/deploy</a>
              <a href="#inference-status" className="text-orange-600 dark:text-orange-400 hover:underline text-sm font-semibold">→ GET /api/inference/deployments/:id/status</a>
              <a href="#stop-inference" className="text-orange-600 dark:text-orange-400 hover:underline text-sm font-semibold">→ DELETE /api/inference/deployments/:id/stop</a>
              <a href="#upload-document" className="text-teal-600 dark:text-teal-400 hover:underline text-sm font-semibold">→ POST /api/graphrag/upload</a>
              <a href="#list-documents" className="text-teal-600 dark:text-teal-400 hover:underline text-sm font-semibold">→ GET /api/graphrag/documents</a>
              <a href="#search-knowledge" className="text-teal-600 dark:text-teal-400 hover:underline text-sm font-semibold">→ POST /api/graphrag/search</a>
              <a href="#delete-document" className="text-teal-600 dark:text-teal-400 hover:underline text-sm font-semibold">→ DELETE /api/graphrag/delete/:id</a>
              <a href="#analytics-data" className="text-purple-600 dark:text-purple-400 hover:underline text-sm font-semibold">→ GET /api/analytics/data</a>
              <a href="#analytics-chat" className="text-purple-600 dark:text-purple-400 hover:underline text-sm font-semibold">→ POST /api/analytics/chat</a>
              <a href="#training-metrics-status" className="text-purple-600 dark:text-purple-400 hover:underline text-sm font-semibold">→ GET /api/training/local/:jobId/status</a>
              <a href="#training-metrics-history" className="text-purple-600 dark:text-purple-400 hover:underline text-sm font-semibold">→ GET /api/training/local/:jobId/metrics</a>
              <a href="#sentiment-insights" className="text-purple-600 dark:text-purple-400 hover:underline text-sm font-semibold">→ GET /api/analytics/sentiment/insights</a>
              <a href="#cohorts-management" className="text-purple-600 dark:text-purple-400 hover:underline text-sm font-semibold">→ GET/POST/PATCH/DELETE /api/analytics/cohorts</a>
            </div>
          </nav>

          {/* Endpoint 1: List Models */}
          <section id="list-models" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-blue-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">List Available Models</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-md text-sm font-mono">
                  GET
                </span>
                <code className="text-lg font-mono">/api/models</code>
              </div>
            </div>

            {/* What it does */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Retrieves a list of all available models that can be used for training and inference. No authentication required.
              </p>
            </div>

            {/* Request */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Request:</h3>
              <div className="relative">
                <div className="absolute top-3 right-3 z-10">
                  <button
                    onClick={() => copyToClipboard('curl https://finetunelab.ai/api/models', 'list-models')}
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-md text-white transition-colors"
                  >
                    {copiedCode === 'list-models' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <code className="text-sm font-mono">curl https://finetunelab.ai/api/models</code>
                </pre>
              </div>
            </div>

            {/* Response */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">✅ Response (200 OK):</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                <code className="font-mono">{`{
  "models": [
    {
      "id": "llama-3-8b",
      "name": "LLaMA 3 8B",
      "status": "available",
      "parameters": "8B"
    },
    {
      "id": "mistral-7b",
      "name": "Mistral 7B",
      "status": "available",
      "parameters": "7B"
    }
  ]
}`}</code>
              </pre>
            </div>

            {/* LLM Prompt */}
            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-2 text-purple-900 dark:text-purple-100">💬 Ask Your AI Assistant:</h3>
                  <p className="text-sm font-mono bg-white dark:bg-gray-900 p-2 rounded border">
                    &quot;Get the list of available models from the API&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 2: Start Training Job */}
          <section id="start-training" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-green-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Start Training Job</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-md text-sm font-mono">
                  POST
                </span>
                <code className="text-lg font-mono">/api/training/start</code>
              </div>
            </div>

            {/* What it does */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Starts a new fine-tuning job with the specified model, dataset, and configuration. Returns a job ID for monitoring progress.
              </p>
            </div>

            {/* Request Body */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Request Body:</h3>
              <div className="space-y-3 mb-4">
                <div className="p-3 bg-muted rounded-md">
                  <code className="font-mono text-sm">model</code>
                  <span className="text-red-500 ml-2">*</span>
                  <span className="text-muted-foreground text-sm ml-2">string</span>
                  <p className="text-sm text-muted-foreground mt-1">Model ID from /api/models</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <code className="font-mono text-sm">dataset</code>
                  <span className="text-red-500 ml-2">*</span>
                  <span className="text-muted-foreground text-sm ml-2">string</span>
                  <p className="text-sm text-muted-foreground mt-1">Dataset ID from /api/training/dataset</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <code className="font-mono text-sm">config</code>
                  <span className="text-muted-foreground text-sm ml-2">string</span>
                  <p className="text-sm text-muted-foreground mt-1">Training configuration (default: &quot;default&quot;)</p>
                </div>
              </div>

              {/* Example */}
              <div className="relative">
                <div className="absolute top-3 right-3 z-10">
                  <button
                    onClick={() => copyToClipboard(
`curl -X POST https://finetunelab.ai/api/training/start \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama-3-8b",
    "dataset": "dataset-abc123",
    "config": "default"
  }'`,
                      'start-training'
                    )}
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-md text-white transition-colors"
                  >
                    {copiedCode === 'start-training' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <code className="text-sm font-mono">{`curl -X POST https://finetunelab.ai/api/training/start \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama-3-8b",
    "dataset": "dataset-abc123",
    "config": "default"
  }'`}</code>
                </pre>
              </div>
            </div>

            {/* Response */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">✅ Response (200 OK):</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                <code className="font-mono">{`{
  "job_id": "job-12345-abcde",
  "status": "queued",
  "message": "Training job started successfully",
  "estimated_duration": "2-4 hours"
}`}</code>
              </pre>
            </div>

            {/* LLM Prompt */}
            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-2 text-purple-900 dark:text-purple-100">💬 Ask Your AI Assistant:</h3>
                  <p className="text-sm font-mono bg-white dark:bg-gray-900 p-2 rounded border">
                    &quot;Start a training job with model llama-3-8b and dataset dataset-abc123&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 3: Get Job Status */}
          <section id="get-status" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-yellow-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Get Training Status</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-md text-sm font-mono">
                  GET
                </span>
                <code className="text-lg font-mono">/api/training/status/:jobId</code>
              </div>
            </div>

            {/* What it does */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Retrieves the current status, progress, and metrics for a specific training job.
              </p>
            </div>

            {/* Request */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Request:</h3>
              <div className="relative">
                <div className="absolute top-3 right-3 z-10">
                  <button
                    onClick={() => copyToClipboard('curl https://finetunelab.ai/api/training/status/job-12345-abcde', 'get-status')}
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-md text-white transition-colors"
                  >
                    {copiedCode === 'get-status' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <code className="text-sm font-mono">curl https://finetunelab.ai/api/training/status/job-12345-abcde</code>
                </pre>
              </div>
            </div>

            {/* Response */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">✅ Response (200 OK):</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                <code className="font-mono">{`{
  "job_id": "job-12345-abcde",
  "status": "running",
  "progress": 45,
  "current_epoch": 2,
  "total_epochs": 5,
  "current_step": 1250,
  "total_steps": 2500,
  "loss": 0.234,
  "learning_rate": 0.0001,
  "elapsed_time": "1h 23m",
  "estimated_remaining": "1h 45m"
}`}</code>
              </pre>
            </div>

            {/* Status Values */}
            <div className="mb-6 p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-3">Possible Status Values:</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  <code>queued</code> - Waiting to start
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                  <code>pending</code> - Initializing
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <code>running</code> - Training in progress
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <code>paused</code> - Temporarily stopped
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  <code>completed</code> - Finished successfully
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <code>failed</code> - Error occurred
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  <code>cancelled</code> - User cancelled
                </div>
              </div>
            </div>

            {/* LLM Prompt */}
            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-2 text-purple-900 dark:text-purple-100">💬 Ask Your AI Assistant:</h3>
                  <p className="text-sm font-mono bg-white dark:bg-gray-900 p-2 rounded border">
                    &quot;Check the status of training job job-12345-abcde&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 4: Pause Job */}
          <section id="pause-job" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-amber-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Pause Training Job</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-md text-sm font-mono">
                  POST
                </span>
                <code className="text-lg font-mono">/api/training/pause/:jobId</code>
              </div>
            </div>

            {/* What it does */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Temporarily pauses a running training job. The job can be resumed later from the same checkpoint.
              </p>
            </div>

            {/* Request */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Request:</h3>
              <div className="relative">
                <div className="absolute top-3 right-3 z-10">
                  <button
                    onClick={() => copyToClipboard('curl -X POST https://finetunelab.ai/api/training/pause/job-12345-abcde', 'pause-job')}
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-md text-white transition-colors"
                  >
                    {copiedCode === 'pause-job' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <code className="text-sm font-mono">curl -X POST https://finetunelab.ai/api/training/pause/job-12345-abcde</code>
                </pre>
              </div>
            </div>

            {/* Response */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">✅ Response (200 OK):</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                <code className="font-mono">{`{
  "success": true,
  "message": "Training job paused successfully",
  "job_id": "job-12345-abcde",
  "status": "paused"
}`}</code>
              </pre>
            </div>

            {/* LLM Prompt */}
            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-2 text-purple-900 dark:text-purple-100">💬 Ask Your AI Assistant:</h3>
                  <p className="text-sm font-mono bg-white dark:bg-gray-900 p-2 rounded border">
                    &quot;Pause the training job job-12345-abcde&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 5: Resume Job */}
          <section id="resume-job" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-green-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Resume Training Job</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-md text-sm font-mono">
                  POST
                </span>
                <code className="text-lg font-mono">/api/training/resume/:jobId</code>
              </div>
            </div>

            {/* What it does */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Resumes a paused training job from its last checkpoint. Training continues where it left off.
              </p>
            </div>

            {/* Request */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Request:</h3>
              <div className="relative">
                <div className="absolute top-3 right-3 z-10">
                  <button
                    onClick={() => copyToClipboard('curl -X POST https://finetunelab.ai/api/training/resume/job-12345-abcde', 'resume-job')}
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-md text-white transition-colors"
                  >
                    {copiedCode === 'resume-job' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <code className="text-sm font-mono">curl -X POST https://finetunelab.ai/api/training/resume/job-12345-abcde</code>
                </pre>
              </div>
            </div>

            {/* Response */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">✅ Response (200 OK):</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                <code className="font-mono">{`{
  "success": true,
  "message": "Training job resumed successfully",
  "job_id": "job-12345-abcde",
  "status": "running"
}`}</code>
              </pre>
            </div>

            {/* LLM Prompt */}
            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-2 text-purple-900 dark:text-purple-100">💬 Ask Your AI Assistant:</h3>
                  <p className="text-sm font-mono bg-white dark:bg-gray-900 p-2 rounded border">
                    &quot;Resume the training job job-12345-abcde&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 6: Cancel Job */}
          <section id="cancel-job" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-red-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Cancel Training Job</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-md text-sm font-mono">
                  POST
                </span>
                <code className="text-lg font-mono">/api/training/cancel/:jobId</code>
              </div>
            </div>

            {/* What it does */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Permanently cancels a training job. This action cannot be undone. The job will be marked as cancelled.
              </p>
            </div>

            {/* Warning */}
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
              <h3 className="font-semibold text-red-900 dark:text-red-100 mb-2">⚠️ Warning:</h3>
              <p className="text-sm text-muted-foreground">
                This action is permanent. Cancelled jobs cannot be resumed. Consider pausing instead if you might want to continue later.
              </p>
            </div>

            {/* Request */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Request:</h3>
              <div className="relative">
                <div className="absolute top-3 right-3 z-10">
                  <button
                    onClick={() => copyToClipboard('curl -X POST https://finetunelab.ai/api/training/cancel/job-12345-abcde', 'cancel-job')}
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-md text-white transition-colors"
                  >
                    {copiedCode === 'cancel-job' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <code className="text-sm font-mono">curl -X POST https://finetunelab.ai/api/training/cancel/job-12345-abcde</code>
                </pre>
              </div>
            </div>

            {/* Response */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">✅ Response (200 OK):</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                <code className="font-mono">{`{
  "success": true,
  "message": "Training job cancelled successfully",
  "job_id": "job-12345-abcde",
  "status": "cancelled"
}`}</code>
              </pre>
            </div>

            {/* LLM Prompt */}
            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-2 text-purple-900 dark:text-purple-100">💬 Ask Your AI Assistant:</h3>
                  <p className="text-sm font-mono bg-white dark:bg-gray-900 p-2 rounded border">
                    &quot;Cancel the training job job-12345-abcde&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 7: List Datasets */}
          <section id="list-datasets" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-purple-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">List Available Datasets</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-md text-sm font-mono">
                  GET
                </span>
                <code className="text-lg font-mono">/api/training/dataset</code>
              </div>
            </div>

            {/* What it does */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Retrieves a list of all available datasets that can be used for training. Includes dataset metadata like size and format.
              </p>
            </div>

            {/* Request */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Request:</h3>
              <div className="relative">
                <div className="absolute top-3 right-3 z-10">
                  <button
                    onClick={() => copyToClipboard('curl https://finetunelab.ai/api/training/dataset', 'list-datasets')}
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-md text-white transition-colors"
                  >
                    {copiedCode === 'list-datasets' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <code className="text-sm font-mono">curl https://finetunelab.ai/api/training/dataset</code>
                </pre>
              </div>
            </div>

            {/* Response */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">✅ Response (200 OK):</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                <code className="font-mono">{`{
  "datasets": [
    {
      "id": "dataset-abc123",
      "name": "Customer Support Chat",
      "samples": 10000,
      "format": "jsonl",
      "size_mb": 45.2,
      "created_at": "2025-11-01T10:30:00Z"
    },
    {
      "id": "dataset-xyz789",
      "name": "Product Reviews",
      "samples": 5000,
      "format": "csv",
      "size_mb": 12.8,
      "created_at": "2025-11-05T14:20:00Z"
    }
  ]
}`}</code>
              </pre>
            </div>

            {/* LLM Prompt */}
            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-2 text-purple-900 dark:text-purple-100">💬 Ask Your AI Assistant:</h3>
                  <p className="text-sm font-mono bg-white dark:bg-gray-900 p-2 rounded border">
                    &quot;Show me all available datasets&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 8: Deploy Model */}
          <section id="deploy-model" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-indigo-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Deploy Trained Model</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-md text-sm font-mono">
                  POST
                </span>
                <code className="text-lg font-mono">/api/training/deploy</code>
              </div>
            </div>

            {/* What it does */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">💡 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Deploys a completed training job to RunPod Serverless cloud inference. Makes the model available for real-time predictions with auto-scaling.
              </p>
            </div>

            {/* Request Body */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Request Body:</h3>
              <div className="space-y-3 mb-4">
                <div className="p-3 bg-muted rounded-md">
                  <code className="font-mono text-sm">job_id</code>
                  <span className="text-red-500 ml-2">*</span>
                  <span className="text-muted-foreground text-sm ml-2">string</span>
                  <p className="text-sm text-muted-foreground mt-1">Completed training job ID</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <code className="font-mono text-sm">checkpoint</code>
                  <span className="text-muted-foreground text-sm ml-2">string</span>
                  <p className="text-sm text-muted-foreground mt-1">Specific checkpoint to deploy (default: latest)</p>
                </div>
              </div>

              {/* Example */}
              <div className="relative">
                <div className="absolute top-3 right-3 z-10">
                  <button
                    onClick={() => copyToClipboard(
`curl -X POST https://finetunelab.ai/api/training/deploy \\
  -H "Content-Type: application/json" \\
  -d '{
    "job_id": "job-12345-abcde",
    "checkpoint": "checkpoint-final",
    "port": 8001
  }'`,
                      'deploy-model'
                    )}
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-md text-white transition-colors"
                  >
                    {copiedCode === 'deploy-model' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <code className="text-sm font-mono">{`curl -X POST https://finetunelab.ai/api/training/deploy \\
  -H "Content-Type: application/json" \\
  -d '{
    "job_id": "job-12345-abcde",
    "checkpoint": "checkpoint-final",
    "port": 8001
  }'`}</code>
                </pre>
              </div>
            </div>

            {/* Response */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">✅ Response (200 OK):</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                <code className="font-mono">{`{
  "success": true,
  "message": "Model deployed successfully",
  "deployment_id": "deploy-xyz123",
  "endpoint": "https://finetunelab.ai/v1/completions",
  "model_name": "llama-3-8b-finetuned"
}`}</code>
              </pre>
            </div>

            {/* LLM Prompt */}
            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-2 text-purple-900 dark:text-purple-100">💬 Ask Your AI Assistant:</h3>
                  <p className="text-sm font-mono bg-white dark:bg-gray-900 p-2 rounded border">
                    &quot;Deploy the trained model from job job-12345-abcde&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 9: Execute Training (Direct Server Call) */}
          <section id="execute-training" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-violet-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Execute Training Job</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-md text-sm font-mono">
                  POST
                </span>
                <code className="text-lg font-mono">/api/training/execute</code>
              </div>
            </div>

            {/* What it does */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Directly executes a training job on the training server. This is a lower-level endpoint that bypasses the Next.js API
                and directly interacts with the training server. Use this for advanced scenarios or when you need direct server control.
              </p>
            </div>

            {/* Request */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Request Body:</h3>
                <button
                  onClick={() => copyToClipboard(
`curl -X POST https://finetunelab.ai/api/training/execute \\
  -H "Content-Type: application/json" \\
  -d '{
    "execution_id": "exec-123",
    "name": "My Training Job",
    "dataset_path": "/datasets/my-dataset.jsonl",
    "dataset_content": "{\\"text\\": \\"Example\\", \\"label\\": \\"positive\\"}\\n{\\"text\\": \\"Another\\", \\"label\\": \\"negative\\"}",
    "config": {
      "model": {
        "base_model": "gpt2",
        "model_type": "causal-lm"
      },
      "training": {
        "num_train_epochs": 3,
        "per_device_train_batch_size": 4,
        "learning_rate": 2e-5
      }
    }
  }'`,
                    'execute-training'
                  )}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  {copiedCode === 'execute-training' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedCode === 'execute-training' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm text-slate-100">
                  <code className="text-sm font-mono">{`curl -X POST https://finetunelab.ai/api/training/execute \\
  -H "Content-Type: application/json" \\
  -d '{
    "execution_id": "exec-123",
    "name": "My Training Job",
    "dataset_path": "/datasets/my-dataset.jsonl",
    "dataset_content": "<JSONL data>",
    "config": {
      "model": {
        "base_model": "gpt2",
        "model_type": "causal-lm"
      },
      "training": {
        "num_train_epochs": 3,
        "per_device_train_batch_size": 4,
        "learning_rate": 2e-5
      }
    }
  }'`}</code>
                </pre>
              </div>
            </div>

            {/* Response */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Response:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm">
                  {`{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "message": "Training job queued successfully"
}`}
                </pre>
              </div>
            </div>

            {/* LLM Prompt Box */}
            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    &quot;Execute a training job directly on the training server using /api/training/execute with my config and dataset&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 10: Get Training Metrics */}
          <section id="get-metrics" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-cyan-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Get Training Metrics</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-md text-sm font-mono">
                  GET
                </span>
                <code className="text-lg font-mono">/api/training/metrics/:jobId</code>
              </div>
            </div>

            {/* What it does */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Retrieves the complete metrics history for a training job. Returns all data points including loss, learning rate, 
                and other metrics over time. Perfect for creating training progress charts.
              </p>
            </div>

            {/* Request */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Request:</h3>
                <button
                  onClick={() => copyToClipboard('curl https://finetunelab.ai/api/training/metrics/job-12345-abcde', 'get-metrics')}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  {copiedCode === 'get-metrics' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedCode === 'get-metrics' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm text-slate-100">
                  <code className="text-sm font-mono">curl https://finetunelab.ai/api/training/metrics/job-12345-abcde</code>
                </pre>
              </div>
            </div>

            {/* Response */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Response:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm">
                  {`{
  "job_id": "job-12345-abcde",
  "metrics": [
    {
      "epoch": 1,
      "step": 100,
      "loss": 2.45,
      "learning_rate": 0.0001,
      "grad_norm": 1.23,
      "timestamp": "2025-01-15T10:30:00Z"
    },
    {
      "epoch": 1,
      "step": 200,
      "loss": 2.12,
      "learning_rate": 0.0001,
      "grad_norm": 1.18,
      "timestamp": "2025-01-15T10:35:00Z"
    }
  ],
  "total_points": 2
}`}
                </pre>
              </div>
            </div>

            {/* LLM Prompt Box */}
            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    &quot;Get the full metrics history for my training job and plot the loss curve over time&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 11: Get Training Logs */}
          <section id="get-logs" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-orange-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Get Training Logs</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-md text-sm font-mono">
                  GET
                </span>
                <code className="text-lg font-mono">/api/training/logs/:jobId</code>
              </div>
            </div>

            {/* What it does */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Retrieves the raw training logs for a job. Useful for debugging and monitoring the training process in real-time.
                Returns the most recent log entries.
              </p>
            </div>

            {/* Request */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Request:</h3>
                <button
                  onClick={() => copyToClipboard('curl https://finetunelab.ai/api/training/logs/job-12345-abcde', 'get-logs')}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  {copiedCode === 'get-logs' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedCode === 'get-logs' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm text-slate-100">
                  <code className="text-sm font-mono">curl https://finetunelab.ai/api/training/logs/job-12345-abcde</code>
                </pre>
              </div>
            </div>

            {/* Response */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Response:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm">
                  {`{
  "job_id": "job-12345-abcde",
  "logs": [
    "[2025-01-15 10:30:00] Loading model gpt2...",
    "[2025-01-15 10:30:05] Model loaded successfully",
    "[2025-01-15 10:30:10] Starting training...",
    "[2025-01-15 10:30:15] Epoch 1/3 - Step 100 - Loss: 2.45"
  ],
  "total_lines": 4
}`}
                </pre>
              </div>
            </div>

            {/* LLM Prompt Box */}
            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    &quot;Show me the training logs for my job to debug any issues&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 12: List Checkpoints */}
          <section id="list-checkpoints" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-pink-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">List Training Checkpoints</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-md text-sm font-mono">
                  GET
                </span>
                <code className="text-lg font-mono">/api/training/checkpoints/:jobId</code>
              </div>
            </div>

            {/* What it does */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Lists all saved checkpoints for a training job, including metadata like eval loss, training loss, file size, and timestamps.
                Helps you find the best checkpoint to use for deployment.
              </p>
            </div>

            {/* Request */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Request:</h3>
                <button
                  onClick={() => copyToClipboard('curl https://finetunelab.ai/api/training/checkpoints/job-12345-abcde', 'list-checkpoints')}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  {copiedCode === 'list-checkpoints' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedCode === 'list-checkpoints' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm text-slate-100">
                  <code className="text-sm font-mono">curl https://finetunelab.ai/api/training/checkpoints/job-12345-abcde</code>
                </pre>
              </div>
            </div>

            {/* Response */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Response:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm">
                  {`{
  "job_id": "job-12345-abcde",
  "checkpoints": [
    {
      "path": "checkpoint-1000",
      "epoch": 1,
      "step": 1000,
      "eval_loss": 1.85,
      "train_loss": 1.92,
      "size_mb": 245.7,
      "created_at": "2025-01-15T10:40:00Z"
    },
    {
      "path": "checkpoint-2000",
      "epoch": 2,
      "step": 2000,
      "eval_loss": 1.23,
      "train_loss": 1.45,
      "size_mb": 245.7,
      "created_at": "2025-01-15T11:10:00Z"
    }
  ],
  "best_checkpoint": "checkpoint-2000",
  "total": 2
}`}
                </pre>
              </div>
            </div>

            {/* LLM Prompt Box */}
            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    &quot;List all checkpoints for my training job and identify the one with the lowest eval loss&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 13: Validate Model */}
          <section id="validate-model" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-teal-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Validate Model</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-md text-sm font-mono">
                  POST
                </span>
                <code className="text-lg font-mono">/api/training/validate</code>
              </div>
            </div>

            {/* What it does */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Runs validation on a trained model using a test dataset. Computes metrics like accuracy, perplexity, BLEU score, etc.
                Essential for evaluating model performance before deployment.
              </p>
            </div>

            {/* Request */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Request Body:</h3>
                <button
                  onClick={() => copyToClipboard(
`curl -X POST https://finetunelab.ai/api/training/validate \\
  -H "Content-Type: application/json" \\
  -d '{
    "model_path": "/models/checkpoint-2000",
    "test_dataset_id": "test-dataset-001",
    "metrics_to_compute": ["perplexity", "accuracy", "bleu"]
  }'`,
                    'validate-model'
                  )}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  {copiedCode === 'validate-model' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedCode === 'validate-model' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm text-slate-100">
                  <code className="text-sm font-mono">{`curl -X POST https://finetunelab.ai/api/training/validate \\
  -H "Content-Type: application/json" \\
  -d '{
    "model_path": "/models/checkpoint-2000",
    "test_dataset_id": "test-dataset-001",
    "metrics_to_compute": ["perplexity", "accuracy", "bleu"]
  }'`}</code>
                </pre>
              </div>
            </div>

            {/* Response */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Response:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm">
                  {`{
  "job_id": "val-550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "metrics": {
    "perplexity": 15.23,
    "accuracy": 0.87,
    "bleu": 0.42
  },
  "message": "Validation completed successfully with 3 metrics"
}`}
                </pre>
              </div>
            </div>

            {/* LLM Prompt Box */}
            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    &quot;Validate my trained model on the test dataset and compute perplexity and accuracy metrics&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 14: Download Model */}
          <section id="download-model" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-emerald-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Download Trained Model</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-md text-sm font-mono">
                  GET
                </span>
                <code className="text-lg font-mono">/api/training/:jobId/download/model</code>
              </div>
            </div>

            {/* What it does */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Downloads a trained model or specific checkpoint as a ZIP file. Perfect for backing up your models or deploying them to production.
                You can specify a checkpoint name to download a specific checkpoint, or omit it to download the entire output directory.
              </p>
            </div>

            {/* Request */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Request (with checkpoint):</h3>
                <button
                  onClick={() => copyToClipboard('curl https://finetunelab.ai/api/training/job-12345-abcde/download/model?checkpoint=checkpoint-2000', 'download-model')}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  {copiedCode === 'download-model' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedCode === 'download-model' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm text-slate-100">
                  <code className="text-sm font-mono">curl https://finetunelab.ai/api/training/job-12345-abcde/download/model?checkpoint=checkpoint-2000 -O</code>
                </pre>
              </div>
            </div>

            {/* Parameters */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Query Parameters:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg space-y-2">
                <div>
                  <code className="text-sm font-mono text-blue-600 dark:text-blue-400">checkpoint</code>
                  <span className="text-sm text-muted-foreground ml-2">(optional)</span>
                  <p className="text-sm text-muted-foreground mt-1">Specific checkpoint directory name (e.g., &quot;checkpoint-2000&quot;)</p>
                </div>
              </div>
            </div>

            {/* Response */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Response:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm">
                  {`ZIP file stream
Content-Type: application/zip
Content-Disposition: attachment; filename=job_12345-abcde_checkpoint-2000.zip

Contains:
- adapter_config.json
- adapter_model.bin
- tokenizer.json
- config.json
- ... (all model files)`}
                </pre>
              </div>
            </div>

            {/* LLM Prompt Box */}
            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    &quot;Download the best checkpoint from my training job as a ZIP file&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 15: Download Logs */}
          <section id="download-logs" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-lime-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Download Training Logs</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-md text-sm font-mono">
                  GET
                </span>
                <code className="text-lg font-mono">/api/training/:jobId/download/logs</code>
              </div>
            </div>

            {/* What it does */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Downloads all training logs as a ZIP archive. Includes training.log (full console output) and progress.json (metrics data).
                Essential for debugging, analysis, and record-keeping.
              </p>
            </div>

            {/* Request */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Request:</h3>
                <button
                  onClick={() => copyToClipboard('curl https://finetunelab.ai/api/training/job-12345-abcde/download/logs -O', 'download-logs')}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  {copiedCode === 'download-logs' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedCode === 'download-logs' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm text-slate-100">
                  <code className="text-sm font-mono">curl https://finetunelab.ai/api/training/job-12345-abcde/download/logs -O</code>
                </pre>
              </div>
            </div>

            {/* Response */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Response:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm">
                  {`ZIP file stream
Content-Type: application/zip
Content-Disposition: attachment; filename=job_12345-abcde_logs.zip

Contains:
- training.log (full console output)
- progress.json (metrics history)`}
                </pre>
              </div>
            </div>

            {/* LLM Prompt Box */}
            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    &quot;Download all training logs for analysis and debugging&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 16: Job Analytics */}
          <section id="job-analytics" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-sky-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Get Job Analytics</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-md text-sm font-mono">
                  GET
                </span>
                <code className="text-lg font-mono">/api/training/:jobId/analytics</code>
              </div>
            </div>

            {/* What it does */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Retrieves comprehensive analytics for a specific training job. Includes performance metrics, resource utilization,
                checkpoints info, loss progression, and efficiency scores. Perfect for understanding how well your training job performed.
              </p>
            </div>

            {/* Request */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Request:</h3>
                <button
                  onClick={() => copyToClipboard('curl https://finetunelab.ai/api/training/job-12345-abcde/analytics', 'job-analytics')}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  {copiedCode === 'job-analytics' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedCode === 'job-analytics' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm text-slate-100">
                  <code className="text-sm font-mono">curl https://finetunelab.ai/api/training/job-12345-abcde/analytics</code>
                </pre>
              </div>
            </div>

            {/* Response */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Response:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm">
                  {`{
  "job_id": "job-12345-abcde",
  "duration": {
    "total_seconds": 3600,
    "formatted": "1h 0m 0s"
  },
  "performance": {
    "avg_iteration_time": 2.5,
    "throughput": 400,
    "total_iterations": 1000
  },
  "resources": {
    "gpu_utilization": 0.85,
    "memory_used_gb": 8.2,
    "peak_temperature": 72
  },
  "loss_progression": {
    "initial_loss": 3.2,
    "final_loss": 1.1,
    "improvement": 2.1
  },
  "checkpoints": {
    "total": 3,
    "best_checkpoint": "checkpoint-2000"
  },
  "efficiency_score": 0.92
}`}
                </pre>
              </div>
            </div>

            {/* LLM Prompt Box */}
            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    &quot;Get detailed analytics for my training job including performance metrics and resource utilization&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 17: Analytics Summary */}
          <section id="analytics-summary" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-fuchsia-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Get System Analytics Summary</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-md text-sm font-mono">
                  GET
                </span>
                <code className="text-lg font-mono">/api/training/analytics/summary</code>
              </div>
            </div>

            {/* What it does */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Retrieves system-wide analytics across all training jobs. Shows aggregated metrics including total job counts by status,
                average training duration, total training time, and resource utilization trends. Great for getting an overview of your training infrastructure.
              </p>
            </div>

            {/* Request */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Request:</h3>
                <button
                  onClick={() => copyToClipboard('curl https://finetunelab.ai/api/training/analytics/summary', 'analytics-summary')}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  {copiedCode === 'analytics-summary' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedCode === 'analytics-summary' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm text-slate-100">
                  <code className="text-sm font-mono">curl https://finetunelab.ai/api/training/analytics/summary</code>
                </pre>
              </div>
            </div>

            {/* Response */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Response:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm">
                  {`{
  "total_jobs": 42,
  "jobs_by_status": {
    "completed": 35,
    "running": 2,
    "failed": 3,
    "cancelled": 2
  },
  "avg_training_duration_seconds": 2400,
  "total_training_time_hours": 28.0,
  "avg_throughput": 450,
  "top_performing_jobs": [
    {
      "job_id": "job-12345-abcde",
      "efficiency_score": 0.95,
      "duration_seconds": 1800
    }
  ],
  "resource_utilization": {
    "avg_gpu_usage": 0.82,
    "avg_memory_gb": 7.5
  }
}`}
                </pre>
              </div>
            </div>

            {/* LLM Prompt Box */}
            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    &quot;Show me system-wide analytics for all training jobs including success rates and average performance&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 18: Compare Jobs */}
          <section id="analytics-compare" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-rose-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Compare Training Jobs</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-md text-sm font-mono">
                  GET
                </span>
                <code className="text-lg font-mono">/api/training/analytics/compare</code>
              </div>
            </div>

            {/* What it does */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Compares multiple training jobs side-by-side across key metrics like duration, throughput, loss improvement, and resource usage.
                Perfect for A/B testing different hyperparameters or comparing model architectures.
              </p>
            </div>

            {/* Request */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Request:</h3>
                <button
                  onClick={() => copyToClipboard('curl "https://finetunelab.ai/api/training/analytics/compare?job_ids=job-123,job-456,job-789"', 'analytics-compare')}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  {copiedCode === 'analytics-compare' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedCode === 'analytics-compare' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm text-slate-100">
                  <code className="text-sm font-mono">curl &quot;https://finetunelab.ai/api/training/analytics/compare?job_ids=job-123,job-456,job-789&quot;</code>
                </pre>
              </div>
            </div>

            {/* Parameters */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Query Parameters:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg space-y-2">
                <div>
                  <code className="text-sm font-mono text-blue-600 dark:text-blue-400">job_ids</code>
                  <span className="text-sm text-muted-foreground ml-2">(required)</span>
                  <p className="text-sm text-muted-foreground mt-1">Comma-separated list of job IDs to compare</p>
                </div>
              </div>
            </div>

            {/* Response */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Response:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm">
                  {`{
  "comparison": [
    {
      "job_id": "job-123",
      "duration_seconds": 1800,
      "throughput": 450,
      "loss_improvement": 2.1,
      "gpu_utilization": 0.85,
      "efficiency_score": 0.92
    },
    {
      "job_id": "job-456",
      "duration_seconds": 2100,
      "throughput": 380,
      "loss_improvement": 1.8,
      "gpu_utilization": 0.78,
      "efficiency_score": 0.85
    }
  ],
  "winner": {
    "best_duration": "job-123",
    "best_throughput": "job-123",
    "best_efficiency": "job-123"
  }
}`}
                </pre>
              </div>
            </div>

            {/* LLM Prompt Box */}
            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    &quot;Compare these training jobs to see which hyperparameters worked best&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 19: List Training Configs */}
          <section id="list-configs" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-slate-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">List Training Configs</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-md text-sm font-mono">
                  GET
                </span>
                <code className="text-lg font-mono">/api/training</code>
              </div>
            </div>

            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Lists all training configurations saved by the current user. Includes metadata, validation status, and configuration details.
                Requires authentication.
              </p>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Request:</h3>
                <button
                  onClick={() => copyToClipboard('curl https://finetunelab.ai/api/training -H "Authorization: Bearer YOUR_TOKEN"', 'list-configs')}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  {copiedCode === 'list-configs' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedCode === 'list-configs' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm text-slate-100">
                  <code className="text-sm font-mono">curl https://finetunelab.ai/api/training -H &quot;Authorization: Bearer YOUR_TOKEN&quot;</code>
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Response:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm">
                  {`{
  "configs": [
    {
      "id": "config-123",
      "name": "My GPT-2 Fine-tune",
      "description": "Fine-tuning GPT-2 on custom dataset",
      "template_type": "sft",
      "is_validated": true,
      "created_at": "2025-01-15T10:00:00Z",
      "config_json": { ... }
    }
  ]
}`}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    &quot;Show me all my saved training configurations&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 20: Create Training Config */}
          <section id="create-config" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-zinc-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Create Training Config</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-md text-sm font-mono">
                  POST
                </span>
                <code className="text-lg font-mono">/api/training</code>
              </div>
            </div>

            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Creates a new training configuration with validation. Automatically validates the config against schema rules.
                Returns the created config with validation results. Requires authentication.
              </p>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Request Body:</h3>
                <button
                  onClick={() => copyToClipboard(
`curl -X POST https://finetunelab.ai/api/training \\
                        -H &quot;Authorization: Bearer YOUR_TOKEN&quot; \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My Training Config",
    "description": "Fine-tuning for customer support",
    "template_type": "sft",
    "config_json": {
      "model": {
        "base_model": "gpt2",
        "model_type": "causal-lm"
      },
      "training": {
        "num_train_epochs": 3,
        "learning_rate": 2e-5
      }
    }
  }'`,
                    'create-config'
                  )}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  {copiedCode === 'create-config' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedCode === 'create-config' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm text-slate-100">
                  <code className="text-sm font-mono">{`curl -X POST https://finetunelab.ai/api/training \\
                        -H &quot;Authorization: Bearer YOUR_TOKEN&quot; \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "My Config", "template_type": "sft", "config_json": {...} }'`}</code>
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Response (201 Created):</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm">
                  {`{
  "config": {
    "id": "config-456",
    "user_id": "user-789",
    "name": "My Training Config",
    "description": "Fine-tuning for customer support",
    "template_type": "sft",
    "is_validated": true,
    "validation_errors": null,
    "created_at": "2025-01-15T11:30:00Z",
    "config_json": { ... }
  }
}`}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    &quot;Create a new training configuration for fine-tuning GPT-2&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 21: Get Single Config */}
          <section id="get-config" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-neutral-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Get Training Config</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-md text-sm font-mono">
                  GET
                </span>
                <code className="text-lg font-mono">/api/training/:id</code>
              </div>
            </div>

            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Retrieves a specific training configuration by ID. Only returns configs owned by the authenticated user.
              </p>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Request:</h3>
                <button
                  onClick={() => copyToClipboard('curl https://finetunelab.ai/api/training/config-123 -H "Authorization: Bearer YOUR_TOKEN"', 'get-config')}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  {copiedCode === 'get-config' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedCode === 'get-config' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm text-slate-100">
                  <code className="text-sm font-mono">curl https://finetunelab.ai/api/training/config-123 -H &quot;Authorization: Bearer YOUR_TOKEN&quot;</code>
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Response:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm">
                  {`{
  "config": {
    "id": "config-123",
    "name": "My GPT-2 Fine-tune",
    "description": "Fine-tuning GPT-2 on custom dataset",
    "template_type": "sft",
    "is_validated": true,
    "config_json": {
      "model": { ... },
      "training": { ... }
    }
  }
}`}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    &quot;Get the details of my training configuration&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 22: Update Config */}
          <section id="update-config" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-stone-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Update Training Config</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-md text-sm font-mono">
                  PUT
                </span>
                <code className="text-lg font-mono">/api/training/:id</code>
              </div>
            </div>

            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Updates an existing training configuration. Re-validates the config if config_json is provided.
                Only updates fields that are provided in the request body.
              </p>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Request Body:</h3>
                <button
                  onClick={() => copyToClipboard(
`curl -X PUT https://finetunelab.ai/api/training/config-123 \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Updated Config Name",
    "description": "Updated description",
    "config_json": {
      "training": {
        "num_train_epochs": 5,
        "learning_rate": 1e-5
      }
    }
  }'`,
                    'update-config'
                  )}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  {copiedCode === 'update-config' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedCode === 'update-config' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm text-slate-100">
                  <code className="text-sm font-mono">{`curl -X PUT https://finetunelab.ai/api/training/config-123 \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{ "name": "Updated Name", "config_json": {...} }'`}</code>
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Response:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm">
                  {`{
  "config": {
    "id": "config-123",
    "name": "Updated Config Name",
    "description": "Updated description",
    "is_validated": true,
    "updated_at": "2025-01-15T12:00:00Z",
    "config_json": { ... }
  }
}`}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    &quot;Update my training configuration to use 5 epochs instead of 3&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 23: Delete Config */}
          <section id="delete-config" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-red-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Delete Training Config</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-md text-sm font-mono">
                  DELETE
                </span>
                <code className="text-lg font-mono">/api/training/:id</code>
              </div>
            </div>

            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
              <h3 className="font-semibold mb-2 text-red-900 dark:text-red-100">⚠️ Warning:</h3>
              <p className="text-sm text-red-800 dark:text-red-200">
                This permanently deletes the training configuration. This action cannot be undone.
                Make sure you&apos;ve backed up any important configurations before deleting.
              </p>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Request:</h3>
                <button
                  onClick={() => copyToClipboard('curl -X DELETE https://finetunelab.ai/api/training/config-123 -H "Authorization: Bearer YOUR_TOKEN"', 'delete-config')}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  {copiedCode === 'delete-config' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedCode === 'delete-config' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm text-slate-100">
                  <code className="text-sm font-mono">curl -X DELETE https://finetunelab.ai/api/training/config-123 -H &quot;Authorization: Bearer YOUR_TOKEN&quot;</code>
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Response:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm">
                  {`{
  "success": true
}`}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    &quot;Delete this training configuration - I don&apos;t need it anymore&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 24: Create Custom Model */}
          <section id="create-model" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-indigo-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Create Custom Model</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-md text-sm font-mono">
                  POST
                </span>
                <code className="text-lg font-mono">/api/models</code>
              </div>
            </div>

            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Creates a new custom model configuration for your account. Perfect for adding private models, custom endpoints,
                or models from providers not in the default list. Supports various authentication methods and streaming capabilities.
              </p>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Request Body:</h3>
                <button
                  onClick={() => copyToClipboard(
`curl -X POST https://finetunelab.ai/api/models \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My Custom GPT-4",
    "description": "Custom OpenAI GPT-4 endpoint",
    "provider": "openai",
    "base_url": "https://api.openai.com/v1",
    "model_id": "gpt-4",
    "auth_type": "bearer",
    "api_key": "sk-...",
    "supports_streaming": true,
    "supports_functions": true,
    "context_length": 8192,
    "max_output_tokens": 4096,
    "default_temperature": 0.7
  }'`,
                    'create-model'
                  )}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  {copiedCode === 'create-model' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedCode === 'create-model' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm text-slate-100">
                  <code className="text-sm font-mono">{`curl -X POST https://finetunelab.ai/api/models \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{
    "name": "My Custom GPT-4",
    "provider": "openai",
    "base_url": "https://api.openai.com/v1",
    "model_id": "gpt-4",
    "auth_type": "bearer",
    "api_key": "sk-..."
  }'`}</code>
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Required Fields:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg space-y-2">
                <div>
                  <code className="text-sm font-mono text-blue-600 dark:text-blue-400">name</code>
                  <p className="text-sm text-muted-foreground mt-1">Display name for the model</p>
                </div>
                <div>
                  <code className="text-sm font-mono text-blue-600 dark:text-blue-400">provider</code>
                  <p className="text-sm text-muted-foreground mt-1">Provider name (e.g., &quot;openai&quot;, &quot;anthropic&quot;, &quot;custom&quot;)</p>
                </div>
                <div>
                  <code className="text-sm font-mono text-blue-600 dark:text-blue-400">base_url</code>
                  <p className="text-sm text-muted-foreground mt-1">API base URL</p>
                </div>
                <div>
                  <code className="text-sm font-mono text-blue-600 dark:text-blue-400">model_id</code>
                  <p className="text-sm text-muted-foreground mt-1">Model identifier used in API calls</p>
                </div>
                <div>
                  <code className="text-sm font-mono text-blue-600 dark:text-blue-400">auth_type</code>
                  <p className="text-sm text-muted-foreground mt-1">Authentication type: &quot;bearer&quot;, &quot;api-key&quot;, or &quot;none&quot;</p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Response (201 Created):</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm">
                  {`{
  "success": true,
  "model": {
    "id": "model-789",
    "name": "My Custom GPT-4",
    "provider": "openai",
    "enabled": true
  },
  "message": "Model created successfully"
}`}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    &quot;Add a custom model configuration for my private OpenAI API endpoint&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 25: Delete Custom Model */}
          <section id="delete-model" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-red-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Delete Custom Model</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-md text-sm font-mono">
                  DELETE
                </span>
                <code className="text-lg font-mono">/api/models/:id</code>
              </div>
            </div>

            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
              <h3 className="font-semibold mb-2 text-red-900 dark:text-red-100">⚠️ Warning:</h3>
              <p className="text-sm text-red-800 dark:text-red-200">
                This permanently deletes the model configuration. This action cannot be undone. 
                Note: You cannot delete global/system models, only your own custom models.
              </p>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Request:</h3>
                <button
                  onClick={() => copyToClipboard('curl -X DELETE https://finetunelab.ai/api/models/model-789 -H "Authorization: Bearer YOUR_TOKEN"', 'delete-model')}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  {copiedCode === 'delete-model' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedCode === 'delete-model' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm text-slate-100">
                  <code className="text-sm font-mono">curl -X DELETE https://finetunelab.ai/api/models/model-789 -H &quot;Authorization: Bearer YOUR_TOKEN&quot;</code>
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Response:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm">
                  {`{
  "success": true,
  "message": "Model deleted successfully"
}`}
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Error Response (403 Forbidden):</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm">
                  {`{
  "success": false,
  "error": "Cannot delete global models"
}`}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    &quot;Remove this custom model - I&apos;m no longer using it&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Phase 5: GraphRAG (Knowledge Graph) Endpoints */}
          <div id="graphrag" className="mb-12 scroll-mt-8">
            <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-teal-600 to-cyan-600 dark:from-teal-400 dark:to-cyan-400 bg-clip-text text-transparent">
              Phase 5: GraphRAG - Knowledge Graph Integration
            </h2>
            <div className="mb-8 p-6 bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 rounded-lg">
              <h3 className="text-xl font-semibold mb-3">🧠 What is GraphRAG?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                GraphRAG (Graph-based Retrieval Augmented Generation) transforms your documents and conversations into a rich knowledge graph using Neo4j and Graphiti. 
                This enables context-aware responses, relationship discovery, and intelligent document search powered by vector embeddings + graph traversal.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-semibold mb-2">Key Features:</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Upload PDFs, DOCX, TXT, Markdown</li>
                    <li>• Automatic entity & relationship extraction</li>
                    <li>• Hybrid search (vector + graph)</li>
                    <li>• Conversation enrichment</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Technology Stack:</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Neo4j for knowledge graph</li>
                    <li>• Graphiti for entity extraction</li>
                    <li>• OpenAI embeddings for search</li>
                    <li>• Supabase for document storage</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* INFERENCE DEPLOYMENT ENDPOINTS - Section Divider */}
          <div className="mb-16 p-6 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
            <h2 className="text-2xl font-bold mb-3">🚀 Inference Deployment Endpoints</h2>
            <p className="text-muted-foreground mb-4">
              Deploy trained models to production inference endpoints. Support for RunPod Serverless with auto-scaling, budget controls, and real-time cost tracking.
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2">Key Features:</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• RunPod Serverless with auto-scaling (A4000 to H100 GPUs)</li>
                  <li>• Budget limits with real-time cost tracking</li>
                  <li>• Automatic checkpoint selection</li>
                  <li>• Budget alerts at 50%, 80%, 100%</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Supported Deployments:</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• LoRA adapters (optimized)</li>
                  <li>• Merged models</li>
                  <li>• Quantized models (4-bit, 8-bit)</li>
                  <li>• GGUF format</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Endpoint: Deploy to Production */}
          <section id="deploy-inference" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-orange-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Deploy to Production Inference</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-md text-sm font-mono">
                  POST
                </span>
                <code className="text-lg font-mono">/api/inference/deploy</code>
              </div>
            </div>

            {/* What it does */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Deploys a trained model to RunPod Serverless for production inference. Creates an auto-scaling endpoint with budget controls and cost tracking. Returns deployment ID and endpoint URL.
              </p>
            </div>

            {/* Request Body */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Request Body:</h3>
              <div className="space-y-3 mb-4">
                <div className="flex gap-2">
                  <code className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">provider</code>
                  <span className="text-sm text-muted-foreground">string (required) - Provider type: &quot;runpod-serverless&quot;</span>
                </div>
                <div className="flex gap-2">
                  <code className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">deployment_name</code>
                  <span className="text-sm text-muted-foreground">string (required) - User-friendly deployment name</span>
                </div>
                <div className="flex gap-2">
                  <code className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">training_job_id</code>
                  <span className="text-sm text-muted-foreground">string (required) - Training job ID with checkpoints</span>
                </div>
                <div className="flex gap-2">
                  <code className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">checkpoint_selection</code>
                  <span className="text-sm text-muted-foreground">string (optional) - &quot;best&quot;, &quot;final&quot;, or &quot;step-N&quot; (default: &quot;best&quot;)</span>
                </div>
                <div className="flex gap-2">
                  <code className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">gpu_type</code>
                  <span className="text-sm text-muted-foreground">string (optional) - GPU type: &quot;NVIDIA RTX A4000&quot; to &quot;NVIDIA H100&quot; (default: A4000)</span>
                </div>
                <div className="flex gap-2">
                  <code className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">min_workers</code>
                  <span className="text-sm text-muted-foreground">number (optional) - Minimum workers, 0 = scale to zero (default: 0)</span>
                </div>
                <div className="flex gap-2">
                  <code className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">max_workers</code>
                  <span className="text-sm text-muted-foreground">number (optional) - Maximum workers for auto-scaling (default: 3)</span>
                </div>
                <div className="flex gap-2">
                  <code className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">budget_limit</code>
                  <span className="text-sm text-muted-foreground">number (required) - Budget limit in USD (minimum: $1.00)</span>
                </div>
                <div className="flex gap-2">
                  <code className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">auto_stop_on_budget</code>
                  <span className="text-sm text-muted-foreground">boolean (optional) - Auto-stop when budget exceeded (default: true)</span>
                </div>
              </div>

              <div className="relative">
                <div className="absolute top-3 right-3 z-10">
                  <button
                    onClick={() => copyToClipboard(`curl -X POST https://finetunelab.ai/api/inference/deploy \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -d '{
    "provider": "runpod-serverless",
    "deployment_name": "my-model-prod",
    "training_job_id": "job-abc123",
    "checkpoint_selection": "best",
    "gpu_type": "NVIDIA RTX A4000",
    "min_workers": 0,
    "max_workers": 3,
    "budget_limit": 10.0,
    "auto_stop_on_budget": true
  }'`, 'deploy-inference')}
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-md text-white transition-colors"
                  >
                    {copiedCode === 'deploy-inference' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code className="font-mono">{`curl -X POST https://finetunelab.ai/api/inference/deploy \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -d '{
    "provider": "runpod-serverless",
    "deployment_name": "my-model-prod",
    "training_job_id": "job-abc123",
    "checkpoint_selection": "best",
    "gpu_type": "NVIDIA RTX A4000",
    "min_workers": 0,
    "max_workers": 3,
    "budget_limit": 10.0,
    "auto_stop_on_budget": true
  }'`}</code>
                </pre>
              </div>
            </div>

            {/* Response */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">✅ Response (200 OK):</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                <code className="font-mono">{`{
  "success": true,
  "deployment_id": "dep-xyz789",
  "endpoint_id": "runpod-ep-abc123",
  "endpoint_url": "https://api.runpod.ai/v2/abc123/runsync",
  "status": "deploying",
  "gpu_type": "NVIDIA RTX A4000",
  "cost_per_request": 0.0004,
  "budget_limit": 10.0,
  "estimated_requests": 25000,
  "created_at": "2025-11-12T10:30:00Z"
}`}</code>
              </pre>
            </div>

            {/* Error Responses */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">❌ Error Responses:</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-mono mb-2">400 Bad Request - Invalid configuration</p>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                    <code className="font-mono">{`{
  "success": false,
  "error": {
    "code": "INVALID_CONFIG",
    "message": "budget_limit must be at least $1.00"
  }
}`}</code>
                  </pre>
                </div>
                <div>
                  <p className="text-sm font-mono mb-2">401 Unauthorized - Missing or invalid API key</p>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                    <code className="font-mono">{`{
  "success": false,
  "error": {
    "code": "NO_RUNPOD_KEY",
    "message": "No RunPod API key found. Please add your RunPod API key in Settings > Secrets"
  }
}`}</code>
                  </pre>
                </div>
                <div>
                  <p className="text-sm font-mono mb-2">404 Not Found - Training job not found</p>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                    <code className="font-mono">{`{
  "success": false,
  "error": {
    "code": "JOB_NOT_FOUND",
    "message": "Training job not found or no checkpoints available"
  }
}`}</code>
                  </pre>
                </div>
              </div>
            </div>

            {/* GPU Types Reference */}
            <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900 border rounded-lg">
              <h3 className="font-semibold mb-3">Available GPU Types & Pricing:</h3>
              <div className="grid md:grid-cols-2 gap-2 text-sm font-mono">
                <div>• NVIDIA RTX A4000 - $0.0004/request</div>
                <div>• NVIDIA RTX A5000 - $0.0006/request</div>
                <div>• NVIDIA RTX A6000 - $0.0008/request</div>
                <div>• NVIDIA A40 - $0.0010/request</div>
                <div>• NVIDIA A100 40GB - $0.0020/request</div>
                <div>• NVIDIA A100 80GB - $0.0025/request</div>
                <div>• NVIDIA H100 - $0.0035/request</div>
              </div>
            </div>

            {/* LLM Prompt */}
            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-2 text-purple-900 dark:text-purple-100">💬 Ask Your AI Assistant:</h3>
                  <p className="text-sm font-mono bg-white dark:bg-gray-900 p-2 rounded border">
                    &quot;Deploy my completed training job to RunPod Serverless with a $10 budget limit and auto-scaling on A4000 GPUs&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint: Get Deployment Status */}
          <section id="inference-status" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-orange-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Get Deployment Status</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-md text-sm font-mono">
                  GET
                </span>
                <code className="text-lg font-mono">/api/inference/deployments/:id/status</code>
              </div>
            </div>

            {/* What it does */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Retrieves real-time status, cost tracking, and metrics for an inference deployment. Includes request count, current spend, budget utilization, and performance metrics.
              </p>
            </div>

            {/* Request */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Request:</h3>
              <div className="relative">
                <div className="absolute top-3 right-3 z-10">
                  <button
                    onClick={() => copyToClipboard(`curl https://finetunelab.ai/api/inference/deployments/dep-xyz789/status \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"`, 'inference-status')}
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-md text-white transition-colors"
                  >
                    {copiedCode === 'inference-status' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code className="font-mono">{`curl https://finetunelab.ai/api/inference/deployments/dep-xyz789/status \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"`}</code>
                </pre>
              </div>
            </div>

            {/* Response */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">✅ Response (200 OK):</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                <code className="font-mono">{`{
  "success": true,
  "deployment": {
    "id": "dep-xyz789",
    "deployment_name": "my-model-prod",
    "provider": "runpod-serverless",
    "endpoint_id": "runpod-ep-abc123",
    "endpoint_url": "https://api.runpod.ai/v2/abc123/runsync",
    "status": "active",

    "config": {
      "gpu_type": "NVIDIA RTX A4000",
      "min_workers": 0,
      "max_workers": 3,
      "auto_stop_enabled": true
    },

    "cost_per_request": 0.0004,
    "budget_limit": 10.0,
    "current_spend": 2.47,
    "request_count": 6175,

    "budget_utilization_percent": 24.7,
    "budget_alert": null,
    "estimated_requests_remaining": 18813,

    "metrics": {
      "total_requests": 6175,
      "successful_requests": 6150,
      "failed_requests": 25,
      "avg_latency_ms": 145,
      "p95_latency_ms": 320,
      "requests_per_minute": 42,
      "gpu_utilization_percent": 67,
      "last_request_at": "2025-11-12T11:45:30Z",
      "uptime_seconds": 7200
    },

    "created_at": "2025-11-12T10:30:00Z",
    "deployed_at": "2025-11-12T10:32:15Z",
    "last_updated": "2025-11-12T11:45:45Z"
  }
}`}</code>
              </pre>
            </div>

            {/* Status Values */}
            <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900 border rounded-lg">
              <h3 className="font-semibold mb-3">Status Values:</h3>
              <ul className="space-y-2 text-sm">
                <li><code className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">deploying</code> - Initial deployment in progress</li>
                <li><code className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">active</code> - Running and accepting requests</li>
                <li><code className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">scaling</code> - Auto-scaling workers</li>
                <li><code className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">stopped</code> - Manually stopped or budget exceeded</li>
                <li><code className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">failed</code> - Deployment failed</li>
                <li><code className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">error</code> - Runtime error state</li>
              </ul>
            </div>

            {/* LLM Prompt */}
            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-2 text-purple-900 dark:text-purple-100">💬 Ask Your AI Assistant:</h3>
                  <p className="text-sm font-mono bg-white dark:bg-gray-900 p-2 rounded border">
                    &quot;Check the status and cost tracking for my inference deployment&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint: Stop Deployment */}
          <section id="stop-inference" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-orange-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Stop Deployment</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-md text-sm font-mono">
                  DELETE
                </span>
                <code className="text-lg font-mono">/api/inference/deployments/:id/stop</code>
              </div>
            </div>

            {/* What it does */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Gracefully stops an active inference deployment. Finalizes cost tracking, updates status to &quot;stopped&quot;, and terminates the RunPod Serverless endpoint. Cost will be calculated up to the stop time.
              </p>
            </div>

            {/* Request */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Request:</h3>
              <div className="relative">
                <div className="absolute top-3 right-3 z-10">
                  <button
                    onClick={() => copyToClipboard(`curl -X DELETE https://finetunelab.ai/api/inference/deployments/dep-xyz789/stop \\
  -H &quot;Authorization: Bearer YOUR_ACCESS_TOKEN&quot;`, 'stop-inference')}
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-md text-white transition-colors"
                  >
                    {copiedCode === 'stop-inference' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code className="font-mono">{`curl -X DELETE https://finetunelab.ai/api/inference/deployments/dep-xyz789/stop \\
  -H &quot;Authorization: Bearer YOUR_ACCESS_TOKEN&quot;`}</code>
                </pre>
              </div>
            </div>

            {/* Response */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">✅ Response (200 OK):</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                <code className="font-mono">{`{
  "success": true,
  "message": "Deployment stopped successfully",
  "deployment_id": "dep-xyz789",
  "final_status": {
    "status": "stopped",
    "total_requests": 6175,
    "final_spend": 2.47,
    "budget_limit": 10.0,
    "stopped_at": "2025-11-12T12:00:00Z",
    "uptime_hours": 1.5
  }
}`}</code>
              </pre>
            </div>

            {/* Important Notes */}
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <h3 className="font-semibold mb-2">⚠️ Important:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Stopping a deployment is permanent - you cannot restart it</li>
                <li>• Final costs will be calculated and recorded</li>
                <li>• The endpoint URL will no longer accept requests</li>
                <li>• To redeploy, use the deploy endpoint again</li>
                <li>• Auto-stop will trigger automatically if budget limit is reached</li>
              </ul>
            </div>

            {/* LLM Prompt */}
            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-2 text-purple-900 dark:text-purple-100">💬 Ask Your AI Assistant:</h3>
                  <p className="text-sm font-mono bg-white dark:bg-gray-900 p-2 rounded border">
                    &quot;Stop my inference deployment and show me the final cost breakdown&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 26: Upload Document */}
          <section id="upload-document" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-teal-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Upload Document</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-md text-sm font-mono">
                  POST
                </span>
                <code className="text-lg font-mono">/api/graphrag/upload</code>
              </div>
            </div>

            <div className="mb-6 p-4 bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 rounded-lg">
              <h3 className="font-semibold mb-2">📘 What this does:</h3>
              <p className="text-sm text-muted-foreground">
                Uploads a document, parses it, and processes it through Graphiti to extract entities and relationships.
                Supported formats: PDF, DOCX, TXT, MD. Automatically chunks large documents and creates knowledge graph nodes.
              </p>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Request (multipart/form-data):</h3>
                <button
                  onClick={() => copyToClipboard(
`curl -X POST https://finetunelab.ai/api/graphrag/upload \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -F "file=@document.pdf" \\
  -F 'metadata={"title":"My Document","source":"research"}'`,
                    'upload-doc'
                  )}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  {copiedCode === 'upload-doc' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedCode === 'upload-doc' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm text-slate-100">
                  <code className="text-sm font-mono">{`curl -X POST https://finetunelab.ai/api/graphrag/upload \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -F "file=@document.pdf" \\
  -F 'metadata={"title":"My Document","source":"research"}'`}</code>
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Response:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm">
                  {`{
  "success": true,
  "document": {
    "id": "doc-abc-123",
    "filename": "document.pdf",
    "fileType": "pdf",
    "processed": false,
    "uploadPath": "documents/user-123/document.pdf",
    "metadata": {
      "title": "My Document",
      "source": "research"
    },
    "createdAt": "2025-01-15T10:30:00Z"
  },
  "message": "Document uploaded successfully, processing started"
}`}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    &quot;Upload this PDF to the knowledge graph&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 27: List Documents */}
          <section id="list-documents" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-teal-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">List Documents</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded-md text-sm font-mono">
                  GET
                </span>
                <code className="text-lg font-mono">/api/graphrag/documents</code>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Request:</h3>
                <button
                  onClick={() => copyToClipboard('curl -X GET https://finetunelab.ai/api/graphrag/documents -H "Authorization: Bearer YOUR_TOKEN"', 'list-docs')}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  {copiedCode === 'list-docs' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedCode === 'list-docs' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm text-slate-100">
                  <code className="text-sm font-mono">curl -X GET https://finetunelab.ai/api/graphrag/documents -H &quot;Authorization: Bearer YOUR_TOKEN&quot;</code>
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Response:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm">
                  {`{
  "documents": [
    {
      "id": "doc-abc-123",
      "filename": "research.pdf",
      "fileType": "pdf",
      "processed": true,
      "neo4jEpisodeIds": ["ep-1", "ep-2"],
      "uploadPath": "documents/user-123/research.pdf",
      "metadata": { "title": "Research Paper" },
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ],
  "total": 1
}`}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    &quot;Show me all my uploaded documents&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 28: Search Knowledge Graph */}
          <section id="search-knowledge" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-teal-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Search Knowledge Graph</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-md text-sm font-mono">
                  POST
                </span>
                <code className="text-lg font-mono">/api/graphrag/search</code>
              </div>
            </div>

            <div className="mb-6 p-4 bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 rounded-lg">
              <h3 className="font-semibold mb-2">🔍 Hybrid Search:</h3>
              <p className="text-sm text-muted-foreground">
                Combines vector similarity (OpenAI embeddings) with graph traversal to find the most relevant context from your knowledge base.
                Perfect for enriching chat conversations with document context.
              </p>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Request:</h3>
                <button
                  onClick={() => copyToClipboard(
`curl -X POST https://finetunelab.ai/api/graphrag/search \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"query":"quantum computing applications","limit":5}'`,
                    'search-graph'
                  )}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  {copiedCode === 'search-graph' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedCode === 'search-graph' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm text-slate-100">
                  <code className="text-sm font-mono">{`curl -X POST https://finetunelab.ai/api/graphrag/search \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"query":"quantum computing applications","limit":5}'`}</code>
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Response:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm">
                  {`{
  "context": "Quantum computing has applications in...",
  "sources": [
    {
      "documentId": "doc-abc-123",
      "filename": "quantum-research.pdf",
      "relevanceScore": 0.92,
      "excerpt": "Quantum algorithms can solve..."
    }
  ],
  "metadata": {
    "searchMethod": "hybrid",
    "resultsFound": 5
  },
  "query": "quantum computing applications",
  "limit": 5
}`}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    &quot;Search my knowledge base for information about quantum computing&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint 29: Delete Document */}
          <section id="delete-document" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-red-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Delete Document</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-md text-sm font-mono">
                  DELETE
                </span>
                <code className="text-lg font-mono">/api/graphrag/delete/:id</code>
              </div>
            </div>

            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
              <h3 className="font-semibold mb-2 text-red-900 dark:text-red-100">⚠️ Complete Cleanup:</h3>
              <p className="text-sm text-red-800 dark:text-red-200">
                Deletes the document from Supabase storage AND removes all associated nodes/relationships from the Neo4j knowledge graph. This action is permanent.
              </p>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Request:</h3>
                <button
                  onClick={() => copyToClipboard('curl -X DELETE https://finetunelab.ai/api/graphrag/delete/doc-abc-123 -H "Authorization: Bearer YOUR_TOKEN"', 'delete-doc')}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  {copiedCode === 'delete-doc' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedCode === 'delete-doc' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm text-slate-100">
                  <code className="text-sm font-mono">curl -X DELETE https://finetunelab.ai/api/graphrag/delete/doc-abc-123 -H &quot;Authorization: Bearer YOUR_TOKEN&quot;</code>
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Response:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm">
                  {`{
  "success": true,
  "id": "doc-abc-123",
  "message": "Document and knowledge graph entries deleted successfully"
}`}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    &quot;Remove this document from my knowledge base&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Phase 6: Analytics & Metrics Endpoints */}
          <div className="mb-12 p-6 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
            <h2 className="text-2xl font-bold mb-3">
              Phase 6: Analytics & Metrics - Data-Driven Insights
            </h2>
            <p className="text-muted-foreground mb-3">
              Fine Tune Lab provides comprehensive analytics and metrics collection to help you understand training performance, 
              conversation quality, costs, and user behavior. Track token usage, sentiment, cohorts, and get AI-powered insights.
            </p>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-md">
              <h3 className="font-semibold mb-2">🎯 Key Capabilities:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li><strong>Real-time Metrics:</strong> Track training progress, loss, GPU usage, and throughput</li>
                <li><strong>Cost Analysis:</strong> Monitor token usage and estimated costs across conversations</li>
                <li><strong>Quality Tracking:</strong> Measure success rates, ratings, and evaluation metrics</li>
                <li><strong>AI Analytics Assistant:</strong> Ask questions about your sessions with natural language</li>
                <li><strong>Sentiment Analysis:</strong> Detect sentiment trends and anomalies in conversations</li>
                <li><strong>User Cohorts:</strong> Segment users for targeted analysis and experiments</li>
              </ul>
            </div>
          </div>

          {/* Endpoint: Analytics Data API */}
          <section id="analytics-data" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-purple-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Get Analytics Data</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-md text-sm font-mono">
                  GET
                </span>
                <code className="text-sm font-mono">/api/analytics/data</code>
              </div>
            </div>

            <p className="text-muted-foreground mb-6">
              Fetch aggregated analytics data across 6 metric categories: token usage, quality, tools, conversations, errors, and latency. 
              Supports flexible date ranges, granularity options, and selective metric filtering for efficient data retrieval.
            </p>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Query Parameters:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm">
                  {`startDate: ISO 8601 date (required) - Start of date range
endDate: ISO 8601 date (required) - End of date range
metrics: String (optional) - Comma-separated list or "all"
  Values: tokens, quality, tools, conversations, errors, latency
granularity: String (optional) - Data aggregation period
  Values: hour, day (default), week, month, all`}
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Example Request:</h3>
              <div className="relative group">
                <button
                  onClick={() => copyToClipboard(`curl -X GET 'https://finetunelab.ai/api/analytics/data?startDate=2025-11-01T00:00:00Z&endDate=2025-11-12T23:59:59Z&metrics=tokens,quality,tools&granularity=day' \\
  -H "Authorization: Bearer YOUR_TOKEN"`, 'analytics-data-curl')}
                  className="absolute top-2 right-2 p-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  title="Copy to clipboard"
                >
                  {copiedCode === 'analytics-data-curl' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
                <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg pr-14 text-sm overflow-x-auto">
                  {`curl -X GET 'https://finetunelab.ai/api/analytics/data?startDate=2025-11-01T00:00:00Z&endDate=2025-11-12T23:59:59Z&metrics=tokens,quality,tools&granularity=day' \\
  -H "Authorization: Bearer YOUR_TOKEN"`}
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Response:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm overflow-x-auto">
                  {`{
  "success": true,
  "data": {
    "userId": "user-123",
    "timeRange": {
      "start": "2025-11-01T00:00:00.000Z",
      "end": "2025-11-12T23:59:59.000Z",
      "period": "day"
    },
    "metrics": {
      "tokenUsage": [
        {
          "timestamp": "2025-11-01T12:00:00.000Z",
          "messageId": "msg-abc",
          "conversationId": "conv-123",
          "modelId": "gpt-4o",
          "inputTokens": 1250,
          "outputTokens": 890,
          "totalTokens": 2140,
          "estimatedCost": 0.00321
        }
      ],
      "quality": [
        {
          "timestamp": "2025-11-01T12:05:00.000Z",
          "messageId": "msg-abc",
          "rating": 4,
          "successStatus": "success",
          "evaluationType": "user_feedback"
        }
      ],
      "tools": [
        {
          "timestamp": "2025-11-01T12:02:00.000Z",
          "toolName": "calculator",
          "executionTimeMs": 45,
          "success": true
        }
      ]
    },
    "aggregations": {
      "totals": {
        "messages": 156,
        "conversations": 23,
        "tokens": 334210,
        "cost": 0.501,
        "evaluations": 89,
        "errors": 3
      },
      "averages": {
        "tokensPerMessage": 2142,
        "costPerMessage": 0.00321,
        "rating": 4.2,
        "successRate": 94.3,
        "errorRate": 1.9,
        "latencyMs": 1834
      }
    }
  }
}`}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    &quot;Get my analytics data for the past week showing token usage and quality metrics&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint: Analytics Chat API */}
          <section id="analytics-chat" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-purple-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">AI-Powered Analytics Chat</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-md text-sm font-mono">
                  POST
                </span>
                <code className="text-sm font-mono">/api/analytics/chat</code>
              </div>
            </div>

            <p className="text-muted-foreground mb-6">
              Chat with an AI analytics assistant powered by GPT-4o that can analyze your training sessions, compute metrics, 
              detect patterns, and provide insights. Equipped with 7 specialized tools including calculator, evaluation metrics 
              (13 operations), datetime utilities, system monitoring, and training control.
            </p>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Available Tools:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm">
                  {`1. calculator - Exact mathematical calculations
2. evaluation_metrics - 13 operations:
   • get_metrics, quality_trends, success_analysis
   • compare_periods, model_comparison, tool_impact_analysis
   • error_analysis, temporal_analysis, textual_feedback_analysis
   • benchmark_analysis, advanced_sentiment_analysis
   • predictive_quality_modeling, anomaly_detection
3. datetime - Date/time operations and timezone conversions
4. system_monitor - System health and resource monitoring
5. get_session_evaluations - Ratings and feedback data
6. get_session_metrics - Token usage, costs, response times
7. get_session_conversations - Full message history
8. training_control - List configs, attach datasets, start training`}
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Request Body:</h3>
              <div className="relative group">
                <button
                  onClick={() => copyToClipboard(`{
  "messages": [
    {
      "role": "user",
      "content": "What's my success rate for this session? How does it compare to typical benchmarks?"
    }
  ],
  "sessionId": "session-abc-123",
  "experimentName": "Production Evaluation Q4",
  "conversationIds": ["conv-1", "conv-2", "conv-3"]
}`, 'analytics-chat-req')}
                  className="absolute top-2 right-2 p-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  title="Copy to clipboard"
                >
                  {copiedCode === 'analytics-chat-req' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
                <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg pr-14 text-sm overflow-x-auto">
                  {`{
  "messages": [
    {
      "role": "user",
      "content": "What's my success rate for this session? How does it compare to typical benchmarks?"
    }
  ],
  "sessionId": "session-abc-123",
  "experimentName": "Production Evaluation Q4",
  "conversationIds": ["conv-1", "conv-2", "conv-3"]
}`}
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Example Request:</h3>
              <div className="relative group">
                <button
                  onClick={() => copyToClipboard(`curl -X POST https://finetunelab.ai/api/analytics/chat \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{
    "messages": [{"role": "user", "content": "Analyze my session costs"}],
    "sessionId": "session-abc-123",
    "experimentName": "Q4 Eval",
    "conversationIds": ["conv-1", "conv-2"]
  }'`, 'analytics-chat-curl')}
                  className="absolute top-2 right-2 p-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  title="Copy to clipboard"
                >
                  {copiedCode === 'analytics-chat-curl' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
                <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg pr-14 text-sm overflow-x-auto">
                  {`curl -X POST https://finetunelab.ai/api/analytics/chat \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{
    "messages": [{"role": "user", "content": "Analyze my session costs"}],
    "sessionId": "session-abc-123",
    "experimentName": "Q4 Eval",
    "conversationIds": ["conv-1", "conv-2"]
  }'`}
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Streaming Response:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm overflow-x-auto">
                  {`data: {"type": "token_usage", "input_tokens": 1250, "output_tokens": 340}

data: {"type": "tools_metadata", "tools_called": [
  {"name": "get_session_metrics", "success": true},
  {"name": "calculator", "success": true}
]}

data: {"content": "I analyzed your session and found:"}
data: {"content": " The total cost was $0.0123"}
data: {"content": " across 3 conversations."}
data: {"content": " Average cost per conversation: $0.0041"}

data: [DONE]`}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    &quot;Chat with the analytics assistant about my training session performance&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint: Training Metrics Status */}
          <section id="training-metrics-status" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-purple-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Get Training Job Status & Metrics</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-md text-sm font-mono">
                  GET
                </span>
                <code className="text-sm font-mono">/api/training/local/:jobId/status</code>
              </div>
            </div>

            <p className="text-muted-foreground mb-6">
              Get comprehensive real-time status and current metrics for a local training job. Returns progress tracking, 
              latest loss values, GPU utilization, throughput stats, perplexity, learning rate, and trend analysis. 
              Includes stale job detection and time estimates.
            </p>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Response Fields:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm">
                  {`Progress Tracking:
• current_step, current_epoch, total_steps, total_epochs, progress (%)
• elapsed_seconds, remaining_seconds

Loss Metrics:
• loss (current train loss), eval_loss (current eval loss)
• best_eval_loss, best_epoch, best_step
• loss_trend: "improving" | "degrading" | "stable"
• epochs_without_improvement (early stopping detection)
• train_perplexity, eval_perplexity (exp of loss)

GPU Metrics:
• gpu_memory_allocated_gb, gpu_memory_reserved_gb
• gpu_utilization_percent

Training Parameters:
• learning_rate (current), grad_norm (gradient norm)
• samples_per_second, tokens_per_second (throughput)

Status & Warnings:
• status: "pending" | "running" | "completed" | "failed" | "cancelled"
• warning: Stale job detection (no updates >5 minutes)
• error: Error message if failed`}
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Example Request:</h3>
              <div className="relative group">
                <button
                  onClick={() => copyToClipboard(`curl -X GET https://finetunelab.ai/api/training/local/job-abc-123/status \\
  -H "Authorization: Bearer YOUR_TOKEN"`, 'training-status-curl')}
                  className="absolute top-2 right-2 p-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  title="Copy to clipboard"
                >
                  {copiedCode === 'training-status-curl' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
                <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg pr-14 text-sm overflow-x-auto">
                  {`curl -X GET https://finetunelab.ai/api/training/local/job-abc-123/status \\
  -H "Authorization: Bearer YOUR_TOKEN"`}
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Response:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm overflow-x-auto">
                  {`{
  "job_id": "job-abc-123",
  "status": "running",
  "model_name": "meta-llama/Llama-3.2-1B",
  
  "current_step": 450,
  "current_epoch": 2,
  "total_steps": 1000,
  "total_epochs": 3,
  "total_samples": 5000,
  "progress": 45,
  
  "loss": 1.89,
  "eval_loss": 1.82,
  "best_eval_loss": 1.75,
  "best_epoch": 1,
  "best_step": 350,
  "loss_trend": "improving",
  "epochs_without_improvement": 1,
  
  "train_perplexity": 6.62,
  "eval_perplexity": 6.17,
  
  "learning_rate": 0.00008,
  "grad_norm": 0.72,
  
  "gpu_memory_allocated_gb": 15.8,
  "gpu_memory_reserved_gb": 18.0,
  "gpu_utilization_percent": 92.3,
  
  "samples_per_second": 13.2,
  "tokens_per_second": 1689,
  
  "started_at": "2025-11-12T09:00:00.000Z",
  "elapsed_seconds": 3420,
  "remaining_seconds": 4180
}`}
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Stale Job Warning Example:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm overflow-x-auto">
                  {`{
  "job_id": "job-xyz-789",
  "status": "running",
  "current_step": 200,
  "progress": 20,
  "warning": "⚠️ No updates received in 8 minute(s). The training process may have terminated unexpectedly.",
  ...
}`}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    &quot;Check my training job status and tell me the current loss, GPU usage, and time remaining&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint: Training Metrics History */}
          <section id="training-metrics-history" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-purple-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Get Training Metrics History</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-md text-sm font-mono">
                  GET
                </span>
                <code className="text-sm font-mono">/api/training/local/:jobId/metrics</code>
              </div>
            </div>

            <p className="text-muted-foreground mb-6">
              Retrieve complete metrics history from the database for charting and analysis. Returns all tracked metrics 
              including loss values, GPU stats, learning rate, throughput, and perplexity ordered by training step.
            </p>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Metrics Tracked:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm">
                  {`• Loss Metrics: train_loss, eval_loss, train_perplexity, eval_perplexity
• Training Progress: step, epoch, learning_rate, grad_norm
• GPU Metrics: gpu_memory_allocated_gb, gpu_memory_reserved_gb, 
                gpu_utilization_percent
• Throughput: samples_per_second, tokens_per_second
• Timestamps: created_at (when metric was recorded)`}
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Example Request:</h3>
              <div className="relative group">
                <button
                  onClick={() => copyToClipboard(`curl -X GET https://finetunelab.ai/api/training/local/job-abc-123/metrics \\
  -H "Authorization: Bearer YOUR_TOKEN"`, 'training-metrics-curl')}
                  className="absolute top-2 right-2 p-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  title="Copy to clipboard"
                >
                  {copiedCode === 'training-metrics-curl' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
                <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg pr-14 text-sm overflow-x-auto">
                  {`curl -X GET https://finetunelab.ai/api/training/local/job-abc-123/metrics \\
  -H "Authorization: Bearer YOUR_TOKEN"`}
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Response:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm overflow-x-auto">
                  {`{
  "job_id": "job-abc-123",
  "metrics": [
    {
      "id": "metric-001",
      "job_id": "job-abc-123",
      "step": 100,
      "epoch": 1,
      "train_loss": 2.45,
      "eval_loss": 2.38,
      "train_perplexity": 11.59,
      "perplexity": 10.80,
      "learning_rate": 0.0001,
      "grad_norm": 0.85,
      "gpu_memory_allocated_gb": 14.2,
      "gpu_memory_reserved_gb": 16.0,
      "gpu_utilization_percent": 89.5,
      "samples_per_second": 12.4,
      "tokens_per_second": 1586,
      "created_at": "2025-11-12T10:15:23.000Z"
    },
    {
      "id": "metric-002",
      "job_id": "job-abc-123",
      "step": 200,
      "epoch": 1,
      "train_loss": 2.12,
      "eval_loss": 2.05,
      "learning_rate": 0.00009,
      "samples_per_second": 12.8,
      "created_at": "2025-11-12T10:20:45.000Z"
    }
  ]
}`}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    &quot;Show me the complete metrics history for my training job so I can chart the loss curve&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint: Sentiment Insights */}
          <section id="sentiment-insights" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-purple-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">Get Sentiment Insights</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-md text-sm font-mono">
                  GET
                </span>
                <code className="text-sm font-mono">/api/analytics/sentiment/insights</code>
              </div>
            </div>

            <p className="text-muted-foreground mb-6">
              Detect sentiment-related insights, anomalies, and patterns across your conversations. Analyzes evaluation 
              feedback, detects sudden sentiment shifts, identifies trending issues, and highlights conversations requiring attention.
            </p>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Query Parameters:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm">
                  {`lookback_days: Number (optional, default: 30)
  - Number of days to analyze for insights
  - Example: lookback_days=7 for weekly insights`}
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Example Request:</h3>
              <div className="relative group">
                <button
                  onClick={() => copyToClipboard(`curl -X GET 'https://finetunelab.ai/api/analytics/sentiment/insights?lookback_days=14' \\
  -H "Authorization: Bearer YOUR_TOKEN"`, 'sentiment-insights-curl')}
                  className="absolute top-2 right-2 p-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  title="Copy to clipboard"
                >
                  {copiedCode === 'sentiment-insights-curl' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
                <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg pr-14 text-sm overflow-x-auto">
                  {`curl -X GET 'https://finetunelab.ai/api/analytics/sentiment/insights?lookback_days=14' \\
  -H "Authorization: Bearer YOUR_TOKEN"`}
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Response:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm overflow-x-auto">
                  {`{
  "insights": [
    {
      "type": "anomaly",
      "severity": "high",
      "title": "Sudden Sentiment Drop Detected",
      "description": "Average sentiment decreased by 35% in the past 3 days",
      "affectedConversations": 12,
      "detectedAt": "2025-11-12T08:30:00.000Z",
      "recommendation": "Review recent model changes or data quality issues"
    },
    {
      "type": "trend",
      "severity": "medium",
      "title": "Increasing Negative Feedback",
      "description": "Negative ratings increased by 15% week-over-week",
      "affectedConversations": 8,
      "detectedAt": "2025-11-12T08:30:00.000Z",
      "recommendation": "Analyze error patterns in recent conversations"
    },
    {
      "type": "positive",
      "severity": "low",
      "title": "Quality Improvement Detected",
      "description": "Success rate improved from 82% to 94% this week",
      "affectedConversations": 45,
      "detectedAt": "2025-11-12T08:30:00.000Z",
      "recommendation": "Document successful strategies for future reference"
    }
  ]
}`}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    &quot;Check for any sentiment anomalies or trends in my conversations from the past 2 weeks&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoint: Cohorts Management */}
          <section id="cohorts-management" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-purple-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">User Cohorts Management</h2>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-md text-sm font-mono">
                  GET
                </span>
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-md text-sm font-mono">
                  POST
                </span>
                <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-md text-sm font-mono">
                  PATCH
                </span>
                <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-md text-sm font-mono">
                  DELETE
                </span>
                <code className="text-sm font-mono">/api/analytics/cohorts</code>
              </div>
            </div>

            <p className="text-muted-foreground mb-6">
              Create and manage user cohorts for segmentation, targeted analysis, and A/B testing. Supports 5 cohort types: 
              static (manual lists), dynamic (auto-updating rules), behavioral (action-based), subscription (tier-based), 
              and custom (advanced criteria).
            </p>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Cohort Types:</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm">
                  {`• static: Fixed list of users (manual membership)
• dynamic: Auto-updates based on criteria (e.g., "active in last 7 days")
• behavioral: Action-based segmentation (e.g., "used calculator tool")
• subscription: Tier-based grouping (free, pro, enterprise)
• custom: Advanced custom criteria and rules`}
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">GET - List Cohorts:</h3>
              <div className="relative group">
                <button
                  onClick={() => copyToClipboard(`curl -X GET 'https://finetunelab.ai/api/analytics/cohorts?cohort_type=dynamic&is_active=true&limit=20' \\
  -H "Authorization: Bearer YOUR_TOKEN"`, 'cohorts-get-curl')}
                  className="absolute top-2 right-2 p-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  title="Copy to clipboard"
                >
                  {copiedCode === 'cohorts-get-curl' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
                <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg pr-14 text-sm overflow-x-auto">
                  {`curl -X GET 'https://finetunelab.ai/api/analytics/cohorts?cohort_type=dynamic&is_active=true&limit=20' \\
  -H "Authorization: Bearer YOUR_TOKEN"`}
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">POST - Create Cohort:</h3>
              <div className="relative group">
                <button
                  onClick={() => copyToClipboard(`curl -X POST https://finetunelab.ai/api/analytics/cohorts \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{
    "name": "Power Users",
    "description": "Users with >50 conversations in last month",
    "cohort_type": "dynamic",
    "criteria": {
      "min_conversations": 50,
      "lookback_days": 30,
      "active_status": true
    }
  }'`, 'cohorts-post-curl')}
                  className="absolute top-2 right-2 p-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  title="Copy to clipboard"
                >
                  {copiedCode === 'cohorts-post-curl' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
                <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg pr-14 text-sm overflow-x-auto">
                  {`curl -X POST https://finetunelab.ai/api/analytics/cohorts \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{
    "name": "Power Users",
    "description": "Users with >50 conversations in last month",
    "cohort_type": "dynamic",
    "criteria": {
      "min_conversations": 50,
      "lookback_days": 30,
      "active_status": true
    }
  }'`}
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">PATCH - Update Cohort:</h3>
              <div className="relative group">
                <button
                  onClick={() => copyToClipboard(`curl -X PATCH https://finetunelab.ai/api/analytics/cohorts \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{
    "cohort_id": "cohort-abc-123",
    "is_active": false
  }'`, 'cohorts-patch-curl')}
                  className="absolute top-2 right-2 p-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  title="Copy to clipboard"
                >
                  {copiedCode === 'cohorts-patch-curl' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
                <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg pr-14 text-sm overflow-x-auto">
                  {`curl -X PATCH https://finetunelab.ai/api/analytics/cohorts \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{
    "cohort_id": "cohort-abc-123",
    "is_active": false
  }'`}
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">DELETE - Remove Cohort:</h3>
              <div className="relative group">
                <button
                  onClick={() => copyToClipboard(`curl -X DELETE 'https://finetunelab.ai/api/analytics/cohorts?cohort_id=cohort-abc-123' \\
  -H "Authorization: Bearer YOUR_TOKEN"`, 'cohorts-delete-curl')}
                  className="absolute top-2 right-2 p-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  title="Copy to clipboard"
                >
                  {copiedCode === 'cohorts-delete-curl' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
                <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg pr-14 text-sm overflow-x-auto">
                  {`curl -X DELETE 'https://finetunelab.ai/api/analytics/cohorts?cohort_id=cohort-abc-123' \\
  -H "Authorization: Bearer YOUR_TOKEN"`}
                </pre>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Response Example (Create):</h3>
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg">
                <pre className="text-sm overflow-x-auto">
                  {`{
  "cohort": {
    "id": "cohort-abc-123",
    "name": "Power Users",
    "description": "Users with >50 conversations in last month",
    "cohort_type": "dynamic",
    "criteria": {
      "min_conversations": 50,
      "lookback_days": 30,
      "active_status": true
    },
    "member_count": 0,
    "is_active": true,
    "created_at": "2025-11-12T10:30:00.000Z",
    "updated_at": "2025-11-12T10:30:00.000Z"
  }
}`}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    &quot;Create a cohort for power users with more than 50 conversations in the last month&quot;
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Summary Section */}
          <div className="p-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 border border-green-200 dark:border-green-800 rounded-lg">
            <h2 className="text-xl font-bold mb-3">🎉 You&apos;re All Set!</h2>
            <p className="text-muted-foreground mb-4">
              You now have complete API documentation for <strong>35 endpoints</strong> covering training, analytics, configuration management, custom model integration, GraphRAG knowledge graph, and comprehensive analytics & metrics. Ready to build something awesome!
            </p>
            <div className="flex gap-4">
              <a href="/docs/quick-start" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                ← Back to Quick Start
              </a>
              <a href="/docs/examples" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                View Code Examples →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
