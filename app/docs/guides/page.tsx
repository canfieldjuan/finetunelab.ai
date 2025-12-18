'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Copy, Check, Sparkles, AlertTriangle, Printer, FileDown } from 'lucide-react';

export default function GuidesPage() {
  const { user, signOut, loading } = useAuth();
  const router = useRouter();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedFullGuide, setCopiedFullGuide] = useState(false);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyFullGuide = () => {
    const guideContent = document.querySelector('.max-w-4xl')?.textContent || '';
    navigator.clipboard.writeText(guideContent);
    setCopiedFullGuide(true);
    setTimeout(() => setCopiedFullGuide(false), 2000);
  };

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

  return (
    <>
      <style jsx global>{`
        @media print {
          /* Hide sidebar and buttons when printing */
          .sidebar-container,
          button {
            display: none !important;
          }

          /* Remove screen-only constraints */
          .flex.h-screen.overflow-hidden {
            height: auto !important;
            overflow: visible !important;
          }

          .overflow-y-auto {
            overflow: visible !important;
            height: auto !important;
          }

          /* Ensure content flows naturally */
          body {
            height: auto !important;
            overflow: visible !important;
          }

          /* Add page breaks where appropriate */
          section {
            page-break-inside: avoid;
          }

          /* Remove background colors for print */
          * {
            background: white !important;
            color: black !important;
          }

          /* Keep code blocks readable */
          pre, code {
            background: #f5f5f5 !important;
            border: 1px solid #ddd !important;
            page-break-inside: avoid;
          }
        }
      `}</style>
      <div className="flex h-screen overflow-hidden">
        <AppSidebar currentPage="docs-guides" user={user} signOut={signOut} />
        <div className="flex-1 overflow-y-auto bg-background">
          <div className="max-w-4xl mx-auto p-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-4xl font-bold">📚 Guides</h1>
              <p className="text-xl text-muted-foreground mt-2">
                Step-by-step tutorials for common workflows
              </p>
            </div>
            <div className="flex gap-2 ml-4">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                title="Print or save as PDF"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Print</span>
              </button>
              <button
                onClick={handleCopyFullGuide}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                title="Copy full guide to clipboard"
              >
                {copiedFullGuide ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span className="hidden sm:inline">Copied!</span>
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" />
                    <span className="hidden sm:inline">Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Table of Contents */}
          <nav className="mb-12 p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
            <h2 className="text-lg font-semibold mb-4">📋 Quick Navigation</h2>
            <div className="grid gap-2 text-sm">
              <a href="#complete-workflow" className="text-blue-600 dark:text-blue-400 hover:underline">
                1. Complete Training Workflow
              </a>
              <a href="#dataset-creation" className="text-blue-600 dark:text-blue-400 hover:underline">
                2. Dataset Creation Best Practices
              </a>
              <a href="#dataset-prep" className="text-blue-600 dark:text-blue-400 hover:underline">
                3. Dataset Preparation
              </a>
              <a href="#hyperparameters" className="text-blue-600 dark:text-blue-400 hover:underline">
                4. Hyperparameter Tuning
              </a>
              <a href="#deployment" className="text-blue-600 dark:text-blue-400 hover:underline">
                5. Model Deployment
              </a>
              <a href="#monitoring" className="text-blue-600 dark:text-blue-400 hover:underline">
                6. Performance Monitoring
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
`curl -X POST https://finetunelab.ai/api/training/datasets \\
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
                      <code>{`curl -X POST https://finetunelab.ai/api/training/datasets \\
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
`curl -X POST https://finetunelab.ai/api/training \\
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
                      <code>{`curl -X POST https://finetunelab.ai/api/training \\
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
                      onClick={() => copyToClipboard('curl -X POST https://finetunelab.ai/api/training/execute -H "Content-Type: application/json" -d \'{"id": "config-456"}\'', 'start-training')}
                      className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1"
                    >
                      {copiedCode === 'start-training' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedCode === 'start-training' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg">
                    <pre className="text-sm text-slate-100">
                      <code>{`curl -X POST https://finetunelab.ai/api/training/execute \\
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
                      onClick={() => copyToClipboard('curl https://finetunelab.ai/api/training/metrics/job-789', 'get-metrics')}
                      className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1"
                    >
                      {copiedCode === 'get-metrics' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedCode === 'get-metrics' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg">
                    <pre className="text-sm text-slate-100">
                      <code>{`curl https://finetunelab.ai/api/training/metrics/job-789`}</code>
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

          {/* Guide 2: Dataset Creation Best Practices */}
          <section id="dataset-creation" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-yellow-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">2. Dataset Creation Best Practices</h2>
              <p className="text-muted-foreground">Professional guide for creating high-quality training datasets</p>
            </div>

            <div className="space-y-6">
              {/* Golden Rule */}
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <h3 className="font-semibold mb-2 text-yellow-900 dark:text-yellow-100">⭐ The Golden Rule</h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-200 font-bold mb-2">
                  Quality Over Quantity: A smaller, high-quality dataset is often more effective than a large, noisy one.
                </p>
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Research shows: For every 1% increase in training data error, you may see a ~4% increase in model error (quadratic impact).
                </p>
              </div>

              {/* Dataset Size Guidelines */}
              <div>
                <h3 className="text-xl font-semibold mb-3">Dataset Size Guidelines</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800">
                        <th className="border border-slate-300 dark:border-slate-700 p-2 text-left text-sm">Use Case</th>
                        <th className="border border-slate-300 dark:border-slate-700 p-2 text-left text-sm">Minimum</th>
                        <th className="border border-slate-300 dark:border-slate-700 p-2 text-left text-sm">Recommended</th>
                        <th className="border border-slate-300 dark:border-slate-700 p-2 text-left text-sm">Optimal</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      <tr>
                        <td className="border border-slate-300 dark:border-slate-700 p-2">Simple tasks (formatting, tone)</td>
                        <td className="border border-slate-300 dark:border-slate-700 p-2">50-100</td>
                        <td className="border border-slate-300 dark:border-slate-700 p-2">200-500</td>
                        <td className="border border-slate-300 dark:border-slate-700 p-2">500-1,000</td>
                      </tr>
                      <tr className="bg-slate-50 dark:bg-slate-900">
                        <td className="border border-slate-300 dark:border-slate-700 p-2">Domain-specific assistant</td>
                        <td className="border border-slate-300 dark:border-slate-700 p-2">500</td>
                        <td className="border border-slate-300 dark:border-slate-700 p-2">1,000-2,000</td>
                        <td className="border border-slate-300 dark:border-slate-700 p-2">5,000-10,000</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 dark:border-slate-700 p-2">Technical support bot</td>
                        <td className="border border-slate-300 dark:border-slate-700 p-2">1,000</td>
                        <td className="border border-slate-300 dark:border-slate-700 p-2">2,000-5,000</td>
                        <td className="border border-slate-300 dark:border-slate-700 p-2">10,000-20,000</td>
                      </tr>
                      <tr className="bg-slate-50 dark:bg-slate-900">
                        <td className="border border-slate-300 dark:border-slate-700 p-2">Complex reasoning</td>
                        <td className="border border-slate-300 dark:border-slate-700 p-2">5,000</td>
                        <td className="border border-slate-300 dark:border-slate-700 p-2">10,000-50,000</td>
                        <td className="border border-slate-300 dark:border-slate-700 p-2">100,000+</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* The 7-Category Framework */}
              <div>
                <h3 className="text-xl font-semibold mb-3">The 7-Category Framework</h3>
                <p className="text-muted-foreground mb-4">
                  A well-balanced dataset should include these categories in the following ratios:
                </p>
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="font-semibold text-green-900 dark:text-green-100">1. Positive Examples</h4>
                      <span className="text-sm text-green-700 dark:text-green-300">40-50%</span>
                    </div>
                    <p className="text-sm text-green-800 dark:text-green-200">
                      Standard Q&As about features, capabilities, and workflows. What the system DOES do.
                    </p>
                  </div>

                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="font-semibold text-red-900 dark:text-red-100">2. Adversarial/Negative Examples</h4>
                      <span className="text-sm text-red-700 dark:text-red-300">15-20%</span>
                    </div>
                    <p className="text-sm text-red-800 dark:text-red-200 mb-2">
                      Explicitly state what the system does NOT support. Critical to prevent hallucinations.
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-300 italic">
                      Example: &quot;Q: Can I train on AWS? A: No. Training only runs on RunPod infrastructure.&quot;
                    </p>
                  </div>

                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100">3. Boundary Examples</h4>
                      <span className="text-sm text-blue-700 dark:text-blue-300">10-15%</span>
                    </div>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Define edges of functionality - when it works, when it doesn&apos;t. Prevents overgeneralization.
                    </p>
                  </div>

                  <div className="p-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="font-semibold text-purple-900 dark:text-purple-100">4. Disambiguation Examples</h4>
                      <span className="text-sm text-purple-700 dark:text-purple-300">5-10%</span>
                    </div>
                    <p className="text-sm text-purple-800 dark:text-purple-200">
                      Clarify concepts that could be confused. Distinguish similar concepts.
                    </p>
                  </div>

                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="font-semibold text-indigo-900 dark:text-indigo-100">5. Procedural/Navigation Examples</h4>
                      <span className="text-sm text-indigo-700 dark:text-indigo-300">10-15%</span>
                    </div>
                    <p className="text-sm text-indigo-800 dark:text-indigo-200">
                      Granular UI navigation and step-by-step workflows. Enable self-service.
                    </p>
                  </div>

                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="font-semibold text-amber-900 dark:text-amber-100">6. Insider Knowledge Examples</h4>
                      <span className="text-sm text-amber-700 dark:text-amber-300">5-10%</span>
                    </div>
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      Power user details, pricing nuances, performance tips. Expert insights and gotchas.
                    </p>
                  </div>

                  <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="font-semibold text-rose-900 dark:text-rose-100">7. Failure Mode Examples</h4>
                      <span className="text-sm text-rose-700 dark:text-rose-300">5-10%</span>
                    </div>
                    <p className="text-sm text-rose-800 dark:text-rose-200">
                      Common errors, troubleshooting, and solutions. Prevent user frustration.
                    </p>
                  </div>
                </div>
              </div>

              {/* Enterprise Workflow */}
              <div>
                <h3 className="text-xl font-semibold mb-3">Enterprise Dataset Creation Workflow</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded">
                    <h4 className="font-semibold mb-1">Phase 1: Planning (Week 1)</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      <li>• Define objectives and success criteria</li>
                      <li>• Identify data sources (docs, support tickets, expert knowledge)</li>
                      <li>• Estimate target dataset size</li>
                    </ul>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded">
                    <h4 className="font-semibold mb-1">Phase 2: Collection (Week 2-3)</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      <li>• Gather raw data from multiple sources</li>
                      <li>• Initial categorization into 7 categories</li>
                      <li>• Flag gaps where categories are underrepresented</li>
                    </ul>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded">
                    <h4 className="font-semibold mb-1">Phase 3: Curation (Week 3-4)</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      <li>• Remove duplicates and low-quality examples</li>
                      <li>• Validate labels and schema integrity</li>
                      <li>• Ensure diversity and edge case coverage</li>
                    </ul>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded">
                    <h4 className="font-semibold mb-1">Phase 4: Assembly (Week 4)</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      <li>• Balance categories to match target ratios</li>
                      <li>• Create 80/20 train/validation split (stratified)</li>
                      <li>• Never leak validation examples into training</li>
                    </ul>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded">
                    <h4 className="font-semibold mb-1">Phase 5: Validation (Week 5)</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      <li>• Calculate quality metrics (aim for &lt;1% error rate)</li>
                      <li>• Pilot test on small subset (100-200 examples)</li>
                      <li>• Iterate based on results</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Common Pitfalls */}
              <div>
                <h3 className="text-xl font-semibold mb-3">⚠️ Common Pitfalls to Avoid</h3>
                <div className="space-y-2">
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded">
                    <h4 className="font-semibold text-red-900 dark:text-red-100 mb-1">❌ Focusing Only on Positives (60%+ positive examples)</h4>
                    <p className="text-sm text-red-800 dark:text-red-200">
                      Model fills gaps with prior knowledge, creates plausible but wrong answers. Maintain 15-20% adversarial examples.
                    </p>
                  </div>

                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded">
                    <h4 className="font-semibold text-red-900 dark:text-red-100 mb-1">❌ Ignoring Data Quality</h4>
                    <p className="text-sm text-red-800 dark:text-red-200">
                      1% error in data → ~4% error in model (quadratic). Invest in cleaning upfront.
                    </p>
                  </div>

                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded">
                    <h4 className="font-semibold text-red-900 dark:text-red-100 mb-1">❌ Not Testing Edge Cases</h4>
                    <p className="text-sm text-red-800 dark:text-red-200">
                      Dedicate 15-20% of dataset to edge cases and boundary examples. Model fails on unusual inputs otherwise.
                    </p>
                  </div>

                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded">
                    <h4 className="font-semibold text-red-900 dark:text-red-100 mb-1">❌ Insufficient Adversarial Examples</h4>
                    <p className="text-sm text-red-800 dark:text-red-200">
                      For every major feature, include &quot;what we DON&apos;T do&quot; examples to prevent confident wrong answers.
                    </p>
                  </div>
                </div>
              </div>

              {/* Key Takeaways */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="font-semibold mb-3 text-blue-900 dark:text-blue-100">🎯 Key Takeaways</h3>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-4">
                  <li>• <strong>Quality &gt; Quantity:</strong> 500 perfect examples beat 5,000 messy ones</li>
                  <li>• <strong>Balance Categories:</strong> 40-50% positive, 15-20% adversarial minimum</li>
                  <li>• <strong>Adversarial Examples Critical:</strong> Prevent gap-filling with prior knowledge</li>
                  <li>• <strong>Start Small, Iterate:</strong> 100-500 examples → pilot → scale based on results</li>
                  <li>• <strong>Clean Data = 4x Impact:</strong> 1% error in data → ~4% error in model</li>
                  <li>• <strong>Test Real Responses:</strong> Don&apos;t trust metrics alone</li>
                </ul>
              </div>

              {/* AI Assistant Box */}
              <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Tell your AI assistant:</h3>
                    <p className="text-sm text-purple-800 dark:text-purple-200">
                      &quot;Help me create a balanced training dataset using the 7-category framework&quot;
                    </p>
                  </div>
                </div>
              </div>

              {/* Reference Link */}
              <div className="p-4 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg">
                <h4 className="font-semibold mb-2">📚 Complete Reference Guide</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  This section is based on comprehensive research from 2025 enterprise best practices. 
                  For the full detailed guide with sources and advanced techniques, see:
                </p>
                <a 
                  href="/output/DATASET_CREATION_GUIDE.md" 
                  target="_blank"
                  className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
                >
                  Professional Dataset Creation Guide →
                </a>
              </div>
            </div>
          </section>

          {/* Guide 3: Dataset Preparation */}
          <section id="dataset-prep" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-green-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">3. Dataset Preparation</h2>
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

          {/* Guide 4: Hyperparameter Tuning */}
          <section id="hyperparameters" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-purple-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">4. Hyperparameter Tuning</h2>
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

          {/* Guide 5: Model Deployment */}
          <section id="deployment" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-orange-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">5. Deploy to Production Inference</h2>
              <p className="text-muted-foreground">Deploy your trained model to cloud inference with RunPod Serverless</p>
            </div>

            <div className="space-y-6">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="font-semibold mb-2">🚀 Deployment Options:</h3>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• <strong>RunPod Serverless</strong> - Auto-scaling cloud inference (A4000 to H100 GPUs)</li>
                  <li>• Budget controls with real-time cost tracking</li>
                  <li>• Auto-stop protection to prevent overspending</li>
                  <li>• Production-ready API endpoints</li>
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
`curl -X POST https://finetunelab.ai/api/inference/deploy \\
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
                          <code>{`curl -X POST https://finetunelab.ai/api/inference/deploy \\
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
`curl https://finetunelab.ai/api/inference/deployments/dep-xyz789/status \\
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
                          <code>{`curl https://finetunelab.ai/api/inference/deployments/dep-xyz789/status \\
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

          {/* Guide 6: Performance Monitoring */}
          <section id="monitoring" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-cyan-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">6. Performance Monitoring</h2>
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
                      onClick={() => copyToClipboard('curl https://finetunelab.ai/api/training/metrics/job-789', 'monitor-metrics')}
                      className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1"
                    >
                      {copiedCode === 'monitor-metrics' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedCode === 'monitor-metrics' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg">
                    <pre className="text-sm text-slate-100">
                      <code>{`curl https://finetunelab.ai/api/training/metrics/job-789`}</code>
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
                      onClick={() => copyToClipboard('curl https://finetunelab.ai/api/training/logs/job-789', 'get-logs')}
                      className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1"
                    >
                      {copiedCode === 'get-logs' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedCode === 'get-logs' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg">
                    <pre className="text-sm text-slate-100">
                      <code>{`curl https://finetunelab.ai/api/training/logs/job-789`}</code>
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
                      onClick={() => copyToClipboard('curl https://finetunelab.ai/api/training/analytics/job-789', 'get-analytics')}
                      className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1"
                    >
                      {copiedCode === 'get-analytics' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedCode === 'get-analytics' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg">
                    <pre className="text-sm text-slate-100">
                      <code>{`curl https://finetunelab.ai/api/training/analytics/job-789`}</code>
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

              <div>
                <h3 className="text-xl font-semibold mb-3">Diagnosing Model vs Dataset Issues</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  When training isn&apos;t going well, it&apos;s crucial to identify whether the problem is your model choice or your dataset. Here&apos;s how to tell:
                </p>
                
                <div className="space-y-4">
                  <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                    <h4 className="font-semibold mb-2 text-orange-900 dark:text-orange-100 flex items-center gap-2">
                      🧠 Signs Your Model is the Problem
                    </h4>
                    <ul className="text-sm text-orange-800 dark:text-orange-200 space-y-2 ml-4">
                      <li>• <strong>Loss plateaus immediately</strong> - Model may be too small to learn the task complexity</li>
                      <li>• <strong>Training loss stays high (&gt;2.0 for language tasks)</strong> - Model lacks capacity for your data</li>
                      <li>• <strong>Consistent poor performance across all examples</strong> - Wrong model architecture for your task</li>
                      <li>• <strong>Can&apos;t memorize even a single training example</strong> - Model fundamentally incompatible</li>
                    </ul>
                    <div className="mt-3 p-3 bg-white dark:bg-gray-900 rounded border border-orange-200 dark:border-orange-700">
                      <p className="text-sm font-semibold mb-1">💡 Solutions:</p>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                        <li>• Upgrade to a larger model (1B → 3B → 7B → 13B)</li>
                        <li>• Try a different model family (Llama, Mistral, Qwen, Phi)</li>
                        <li>• Use a model pre-trained on similar domain data</li>
                        <li>• Consider instruction-tuned models for instruction-following tasks</li>
                      </ul>
                    </div>
                  </div>

                  <div className="p-4 bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800 rounded-lg">
                    <h4 className="font-semibold mb-2 text-cyan-900 dark:text-cyan-100 flex items-center gap-2">
                      📊 Signs Your Dataset is the Problem
                    </h4>
                    <ul className="text-sm text-cyan-800 dark:text-cyan-200 space-y-2 ml-4">
                      <li>• <strong>Erratic loss pattern</strong> - Inconsistent or noisy data quality</li>
                      <li>• <strong>Model overfits quickly</strong> - Dataset too small or not diverse enough</li>
                      <li>• <strong>High eval loss vs train loss gap</strong> - Train/eval split mismatch or data leakage</li>
                      <li>• <strong>Works on some examples, fails on others</strong> - Insufficient coverage of edge cases</li>
                    </ul>
                    <div className="mt-3 p-3 bg-white dark:bg-gray-900 rounded border border-cyan-200 dark:border-cyan-700">
                      <p className="text-sm font-semibold mb-1">💡 Solutions:</p>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                        <li>• Add more training examples (aim for 1,000+ high-quality samples)</li>
                        <li>• Clean and validate data format consistency</li>
                        <li>• Balance dataset across different categories/tasks</li>
                        <li>• Add data augmentation or synthetic examples</li>
                        <li>• Review and fix labeling errors or inconsistencies</li>
                      </ul>
                    </div>
                  </div>

                  <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                    <h4 className="font-semibold mb-2 text-indigo-900 dark:text-indigo-100">🔬 Quick Diagnostic Test</h4>
                    <ol className="text-sm text-indigo-800 dark:text-indigo-200 space-y-2 ml-4 list-decimal">
                      <li><strong>Overfit test:</strong> Train on just 10-20 examples. If loss doesn&apos;t reach near-zero, it&apos;s likely a model capacity issue.</li>
                      <li><strong>Baseline comparison:</strong> Compare your loss to similar tasks. Language modeling baseline: ~2.5-3.0 initial, ~0.5-1.5 final.</li>
                      <li><strong>Model size ladder:</strong> If stuck, try the next size up. Improvement = model was bottleneck.</li>
                      <li><strong>Data inspection:</strong> Manually review 50 random samples. If you find obvious issues, fix dataset first.</li>
                    </ol>
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
    </>
  );
}
