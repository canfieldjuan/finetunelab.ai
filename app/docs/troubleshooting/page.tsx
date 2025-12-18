'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { AlertTriangle, CheckCircle, XCircle, HelpCircle } from 'lucide-react';

export default function TroubleshootingPage() {
  const { user, signOut, loading } = useAuth();
  const router = useRouter();

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
    <div className="flex h-screen overflow-hidden">
      <AppSidebar currentPage="docs-troubleshooting" user={user} signOut={signOut} />
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-4xl mx-auto p-8">
          <h1 className="text-4xl font-bold mb-4">🔧 Troubleshooting</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Common errors and their solutions
          </p>

          {/* Table of Contents */}
          <nav className="mb-12 p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
            <h2 className="text-lg font-semibold mb-4">📋 Quick Navigation</h2>
            <div className="grid gap-2 text-sm">
              <a href="#training-errors" className="text-blue-600 dark:text-blue-400 hover:underline">
                Training Errors
              </a>
              <a href="#dataset-issues" className="text-blue-600 dark:text-blue-400 hover:underline">
                Dataset Issues
              </a>
              <a href="#api-errors" className="text-blue-600 dark:text-blue-400 hover:underline">
                API Errors
              </a>
              <a href="#inference-deployment" className="text-orange-600 dark:text-orange-400 hover:underline font-semibold">
                🚀 Inference Deployment Issues
              </a>
              <a href="#performance" className="text-blue-600 dark:text-blue-400 hover:underline">
                Performance Problems
              </a>
              <a href="#faq" className="text-blue-600 dark:text-blue-400 hover:underline">
                FAQ
              </a>
            </div>
          </nav>

          {/* Training Errors */}
          <section id="training-errors" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-red-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">🚨 Training Errors</h2>
              <p className="text-muted-foreground">Issues during model training</p>
            </div>

            <div className="space-y-6">
              {/* Error 1 */}
              <div className="border border-red-200 dark:border-red-800 rounded-lg overflow-hidden">
                <div className="bg-red-50 dark:bg-red-950/20 p-4 flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-red-900 dark:text-red-100">Training loss is NaN or exploding</h3>
                    <p className="text-sm text-red-800 dark:text-red-200 mt-1">Loss increases dramatically or becomes NaN</p>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      Causes
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                      <li>• Learning rate too high</li>
                      <li>• Bad data (corrupted examples, extreme values)</li>
                      <li>• Numerical instability in model</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Solutions
                    </h4>
                    <ul className="text-sm space-y-2 ml-6">
                      <li>
                        ✓ <strong>Reduce learning rate</strong> - Try 10x smaller (e.g., 1e-5 instead of 1e-4)
                        <code className="block mt-1 px-2 py-1 bg-slate-100 dark:bg-slate-900 rounded text-xs">
                          {`{ "learning_rate": 0.00001 }`}
                        </code>
                      </li>
                      <li>✓ <strong>Enable gradient clipping</strong> - Add max_grad_norm parameter</li>
                      <li>✓ <strong>Check dataset</strong> - Run validation script to find corrupted examples</li>
                      <li>✓ <strong>Use mixed precision</strong> - Enable fp16 or bf16 training</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Error 2 */}
              <div className="border border-red-200 dark:border-red-800 rounded-lg overflow-hidden">
                <div className="bg-red-50 dark:bg-red-950/20 p-4 flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-red-900 dark:text-red-100">CUDA out of memory</h3>
                    <p className="text-sm text-red-800 dark:text-red-200 mt-1">RuntimeError: CUDA out of memory</p>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Solutions
                    </h4>
                    <ul className="text-sm space-y-2 ml-6">
                      <li>
                        ✓ <strong>Reduce batch size</strong> - Most common fix
                        <code className="block mt-1 px-2 py-1 bg-slate-100 dark:bg-slate-900 rounded text-xs">
                          {`{ "batch_size": 1 }  // Start with 1, increase gradually`}
                        </code>
                      </li>
                      <li>✓ <strong>Enable gradient accumulation</strong> - Simulate larger batches
                        <code className="block mt-1 px-2 py-1 bg-slate-100 dark:bg-slate-900 rounded text-xs">
                          {`{ "batch_size": 1, "gradient_accumulation_steps": 4 }  // Effective batch_size = 4`}
                        </code>
                      </li>
                      <li>✓ <strong>Reduce sequence length</strong> - Shorter sequences use less memory</li>
                      <li>✓ <strong>Use LoRA</strong> - Fine-tune only adapter layers instead of full model</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Error 3 */}
              <div className="border border-red-200 dark:border-red-800 rounded-lg overflow-hidden">
                <div className="bg-red-50 dark:bg-red-950/20 p-4 flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-red-900 dark:text-red-100">Training stuck / not progressing</h3>
                    <p className="text-sm text-red-800 dark:text-red-200 mt-1">Loss not decreasing after many steps</p>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">Causes & Solutions</h4>
                    <ul className="text-sm space-y-2 ml-6">
                      <li>✓ <strong>Learning rate too low</strong> - Increase by 2-5x</li>
                      <li>✓ <strong>Not enough warmup</strong> - Add warmup steps (100-500)</li>
                      <li>✓ <strong>Dataset too small</strong> - Need at least 50-100 quality examples</li>
                      <li>✓ <strong>Task too complex</strong> - Base model may not have required capabilities</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Error 4 */}
              <div className="border border-red-200 dark:border-red-800 rounded-lg overflow-hidden">
                <div className="bg-red-50 dark:bg-red-950/20 p-4 flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-red-900 dark:text-red-100">Wrong model loaded when reusing config</h3>
                    <p className="text-sm text-red-800 dark:text-red-200 mt-1">Selected new model but training uses old model from config</p>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      What&apos;s Happening
                    </h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      When reusing a training config, changing the model in the dropdown doesn&apos;t automatically update the saved config file.
                      The trainer loads the model from the config JSON, not from your dropdown selection.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Workaround
                    </h4>
                    <ol className="text-sm space-y-2 ml-6 list-decimal">
                      <li>Select your desired model from the HuggingFace dropdown</li>
                      <li><strong>Open the config editor</strong> (click &quot;Edit Config&quot; or &quot;Advanced Settings&quot;)</li>
                      <li><strong>Save the config</strong> - This writes the new model name to the JSON file</li>
                      <li>Now start training - it will use the correct model</li>
                    </ol>
                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded">
                      <p className="text-xs text-blue-900 dark:text-blue-100">
                        💡 <strong>Tip:</strong> Always verify the model name in the config editor before starting training when reusing configs.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Dataset Issues */}
          <section id="dataset-issues" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-amber-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">� Dataset Issues</h2>
              <p className="text-muted-foreground">Problems with training data</p>
            </div>

            <div className="space-y-6">
              {/* Issue 1 */}
              <div className="border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden">
                <div className="bg-amber-50 dark:bg-amber-950/20 p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-amber-900 dark:text-amber-100">Invalid JSON in dataset</h3>
                    <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">JSONDecodeError: Expecting property name</p>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">Common Mistakes</h4>
                    <div className="space-y-2 text-sm">
                      <div className="p-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded">
                        <p className="font-semibold text-red-900 dark:text-red-100 mb-1">❌ Wrong:</p>
                        <code className="text-xs">{`{'messages': [{'role': 'user', 'content': 'test'}]}  // Single quotes`}</code>
                      </div>
                      <div className="p-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded">
                        <p className="font-semibold text-green-900 dark:text-green-100 mb-1">✅ Correct:</p>
                        <code className="text-xs">{`{"messages": [{"role": "user", "content": "test"}]}  // Double quotes`}</code>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Fix It</h4>
                    <ul className="text-sm space-y-1 ml-6">
                      <li>✓ Use double quotes, not single quotes</li>
                      <li>✓ Remove trailing commas</li>
                      <li>✓ Escape special characters in strings</li>
                      <li>✓ Run validation script before uploading</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Issue 2 */}
              <div className="border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden">
                <div className="bg-amber-50 dark:bg-amber-950/20 p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-amber-900 dark:text-amber-100">Dataset validation failed</h3>
                    <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">Missing required fields or invalid structure</p>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">Required Structure</h4>
                    <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded">
                      <pre className="text-xs">{`{
  "messages": [
    {"role": "user", "content": "Question here"},
    {"role": "assistant", "content": "Answer here"}
  ]
}`}</pre>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Checklist</h4>
                    <ul className="text-sm space-y-1 ml-6">
                      <li>□ Each line has &quot;messages&quot; array</li>
                      <li>□ Messages have &quot;role&quot; and &quot;content&quot;</li>
                      <li>□ No empty content strings</li>
                      <li>□ Valid roles: user, assistant, system</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* API Errors */}
          <section id="api-errors" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-blue-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">🌐 API Errors</h2>
              <p className="text-muted-foreground">HTTP error codes and fixes</p>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <code className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded font-mono text-sm">401</code>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">Unauthorized</h3>
                    <p className="text-sm text-muted-foreground mb-2">Missing or invalid authentication token</p>
                    <p className="text-sm"><strong>Fix:</strong> Include <code className="px-1 py-0.5 bg-slate-200 dark:bg-slate-800 rounded text-xs">Authorization: Bearer TOKEN</code> header</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <code className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded font-mono text-sm">404</code>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">Not Found</h3>
                    <p className="text-sm text-muted-foreground mb-2">Resource doesn&apos;t exist or wrong ID</p>
                    <p className="text-sm"><strong>Fix:</strong> Verify job ID, config ID, or model ID is correct</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <code className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded font-mono text-sm">409</code>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">Conflict</h3>
                    <p className="text-sm text-muted-foreground mb-2">Resource already exists (e.g., duplicate model name)</p>
                    <p className="text-sm"><strong>Fix:</strong> Use a different name or delete existing resource first</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <code className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded font-mono text-sm">500</code>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">Internal Server Error</h3>
                    <p className="text-sm text-muted-foreground mb-2">Server-side issue or bug</p>
                    <p className="text-sm"><strong>Fix:</strong> Check server logs, verify database connection, retry request</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Inference Deployment Issues */}
          <section id="inference-deployment" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-orange-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">🚀 Inference Deployment Issues</h2>
              <p className="text-muted-foreground">RunPod Serverless deployment troubleshooting</p>
            </div>

            <div className="space-y-6">
              {/* Issue 1: RunPod API Key Error */}
              <div className="border border-orange-200 dark:border-orange-800 rounded-lg overflow-hidden">
                <div className="bg-orange-50 dark:bg-orange-950/20 p-4 flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-orange-900 dark:text-orange-100">RunPod API key not found or invalid</h3>
                    <p className="text-sm text-orange-800 dark:text-orange-200 mt-1">Error: &quot;RunPod API key not configured&quot;</p>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Solutions
                    </h4>
                    <ul className="text-sm space-y-2 ml-6">
                      <li>✓ <strong>Add RunPod API key</strong> - Go to Settings → Secrets → Add Secret
                        <code className="block mt-1 px-2 py-1 bg-slate-100 dark:bg-slate-900 rounded text-xs">
                          Name: runpod<br/>
                          Value: your-runpod-api-key-here
                        </code>
                      </li>
                      <li>✓ <strong>Get API key</strong> - Visit <a href="https://runpod.io/console/user/settings" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">RunPod Console → API Keys</a></li>
                      <li>✓ <strong>Check key name</strong> - Must be exactly &quot;runpod&quot; (lowercase)</li>
                      <li>✓ <strong>Verify permissions</strong> - Key must have serverless endpoint permissions</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Issue 2: Deployment Stuck in "Deploying" */}
              <div className="border border-orange-200 dark:border-orange-800 rounded-lg overflow-hidden">
                <div className="bg-orange-50 dark:bg-orange-950/20 p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-orange-900 dark:text-orange-100">Deployment stuck in &quot;deploying&quot; status</h3>
                    <p className="text-sm text-orange-800 dark:text-orange-200 mt-1">Takes longer than 5 minutes to become active</p>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">Common Causes</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                      <li>• RunPod provisioning GPU resources (can take 2-5 minutes)</li>
                      <li>• Large model download and initialization</li>
                      <li>• RunPod service issues or capacity constraints</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Solutions
                    </h4>
                    <ul className="text-sm space-y-2 ml-6">
                      <li>✓ <strong>Wait 5-10 minutes</strong> - First deployment can be slow</li>
                      <li>✓ <strong>Check RunPod status</strong> - Visit <a href="https://status.runpod.io" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">status.runpod.io</a></li>
                      <li>✓ <strong>Try different GPU type</strong> - Some GPU types have better availability</li>
                      <li>✓ <strong>Check deployment status</strong> - Use GET /api/inference/deployments/:id/status</li>
                      <li>✓ <strong>If stuck &gt;15min</strong> - Stop deployment and retry with fresh deployment</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Issue 3: Budget Exceeded */}
              <div className="border border-orange-200 dark:border-orange-800 rounded-lg overflow-hidden">
                <div className="bg-orange-50 dark:bg-orange-950/20 p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-orange-900 dark:text-orange-100">Deployment auto-stopped: Budget exceeded</h3>
                    <p className="text-sm text-orange-800 dark:text-orange-200 mt-1">Reached 100% budget utilization</p>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">What Happened</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Your deployment reached the budget limit you set. This is a safety feature to prevent unexpected costs.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Solutions
                    </h4>
                    <ul className="text-sm space-y-2 ml-6">
                      <li>✓ <strong>Review costs</strong> - Check /inference page for detailed breakdown</li>
                      <li>✓ <strong>Increase budget</strong> - Redeploy with higher budget_limit</li>
                      <li>✓ <strong>Optimize costs</strong> - Use cheaper GPU type (A4000 instead of H100)</li>
                      <li>✓ <strong>Scale to zero</strong> - Set min_workers=0 to avoid idle costs</li>
                      <li>✓ <strong>Monitor usage</strong> - Check budget alerts at 50% and 80%</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Issue 4: Endpoint Connection Failed */}
              <div className="border border-orange-200 dark:border-orange-800 rounded-lg overflow-hidden">
                <div className="bg-orange-50 dark:bg-orange-950/20 p-4 flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-orange-900 dark:text-orange-100">Cannot connect to inference endpoint</h3>
                    <p className="text-sm text-orange-800 dark:text-orange-200 mt-1">Error 503, 504, or connection timeout</p>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Solutions
                    </h4>
                    <ul className="text-sm space-y-2 ml-6">
                      <li>✓ <strong>Check deployment status</strong> - Must be &quot;active&quot; not &quot;scaling&quot; or &quot;deploying&quot;</li>
                      <li>✓ <strong>Wait for cold start</strong> - First request after idle can take 30-60 seconds</li>
                      <li>✓ <strong>Verify endpoint URL</strong> - Check /inference page for correct URL</li>
                      <li>✓ <strong>Check request format</strong> - Must include &quot;input&quot; field with &quot;prompt&quot;
                        <code className="block mt-1 px-2 py-1 bg-slate-100 dark:bg-slate-900 rounded text-xs">
                          {`{ "input": { "prompt": "Your text", "max_tokens": 512 } }`}
                        </code>
                      </li>
                      <li>✓ <strong>Test with cURL</strong> - Verify endpoint works outside your app</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Issue 5: Model Loading Failed */}
              <div className="border border-orange-200 dark:border-orange-800 rounded-lg overflow-hidden">
                <div className="bg-orange-50 dark:bg-orange-950/20 p-4 flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-orange-900 dark:text-orange-100">Model failed to load</h3>
                    <p className="text-sm text-orange-800 dark:text-orange-200 mt-1">Deployment status shows &quot;failed&quot; or &quot;error&quot;</p>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">Common Causes</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                      <li>• Training job checkpoint corrupted or incomplete</li>
                      <li>• Model too large for selected GPU type</li>
                      <li>• Model storage URL inaccessible</li>
                      <li>• Incompatible model format</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Solutions
                    </h4>
                    <ul className="text-sm space-y-2 ml-6">
                      <li>✓ <strong>Verify training completed</strong> - Check training job status is &quot;completed&quot;</li>
                      <li>✓ <strong>Use larger GPU</strong> - Try A6000 or A100 for larger models</li>
                      <li>✓ <strong>Check checkpoint</strong> - Download and test checkpoint locally first</li>
                      <li>✓ <strong>Use quantization</strong> - Deploy 4-bit or 8-bit quantized version</li>
                      <li>✓ <strong>Check error message</strong> - View deployment.error_message in status API</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Cost Optimization Tips */}
              <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <h4 className="font-semibold mb-2 text-green-800 dark:text-green-200">💡 Cost Optimization Tips</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Start with small budget ($1-5) for testing before scaling up</li>
                  <li>• Use A4000 ($0.0004/req) for development, reserve H100 for production</li>
                  <li>• Enable auto_stop_on_budget to prevent overruns</li>
                  <li>• Set min_workers=0 to scale to zero when idle (no idle costs)</li>
                  <li>• Monitor real-time spend on /inference page</li>
                  <li>• Set up budget alerts at 50% and 80% utilization</li>
                  <li>• Stop deployments when not in use (no restart cost)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Performance Problems */}
          <section id="performance" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-purple-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">⚡ Performance Problems</h2>
              <p className="text-muted-foreground">Slow training and optimization tips</p>
            </div>

            <div className="space-y-6">
              <div className="border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                <h3 className="font-semibold mb-3">Training is very slow</h3>
                <ul className="space-y-2 text-sm ml-6">
                  <li>✓ <strong>Increase batch size</strong> - Better GPU utilization (if memory allows)</li>
                  <li>✓ <strong>Use mixed precision</strong> - Enable fp16/bf16 for 2-3x speedup</li>
                  <li>✓ <strong>Reduce sequence length</strong> - Shorter sequences = faster training</li>
                  <li>✓ <strong>Check GPU usage</strong> - Should be &gt;80% during training</li>
                  <li>✓ <strong>Use faster data loading</strong> - Increase num_workers for data loader</li>
                </ul>
              </div>

              <div className="border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                <h3 className="font-semibold mb-3">High memory usage</h3>
                <ul className="space-y-2 text-sm ml-6">
                  <li>✓ <strong>Use LoRA</strong> - Train adapters instead of full model (90% memory reduction)</li>
                  <li>✓ <strong>Enable gradient checkpointing</strong> - Trade compute for memory</li>
                  <li>✓ <strong>Reduce batch size</strong> - Most direct way to reduce memory</li>
                  <li>✓ <strong>Clear cache regularly</strong> - torch.cuda.empty_cache()</li>
                </ul>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" className="mb-16 scroll-mt-8">
            <div className="border-l-4 border-cyan-500 pl-6 mb-6">
              <h2 className="text-3xl font-bold mb-2">❓ FAQ</h2>
              <p className="text-muted-foreground">Frequently asked questions</p>
            </div>

            <div className="space-y-4">
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg">
                <div className="p-4 bg-slate-50 dark:bg-slate-900">
                  <div className="flex items-start gap-3">
                    <HelpCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <h3 className="font-semibold">How long should training take?</h3>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm text-muted-foreground">
                    Depends on model size and dataset. For Llama-3.2-1B with 500 examples: ~30-60 minutes on a single GPU.
                    Larger models (7B+) can take several hours or days.
                  </p>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-lg">
                <div className="p-4 bg-slate-50 dark:bg-slate-900">
                  <div className="flex items-start gap-3">
                    <HelpCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <h3 className="font-semibold">How many training examples do I need?</h3>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm text-muted-foreground">
                    Minimum 50 examples, but 200-1000 is ideal. Quality matters more than quantity - 100 perfect examples
                    beat 1000 mediocre ones.
                  </p>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-lg">
                <div className="p-4 bg-slate-50 dark:bg-slate-900">
                  <div className="flex items-start gap-3">
                    <HelpCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <h3 className="font-semibold">Can I pause and resume training?</h3>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    Yes! Use POST /api/training/pause/:id and POST /api/training/resume/:id. Training will resume from
                    the last checkpoint.
                  </p>
                  <code className="text-xs bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">
                    curl -X POST https://finetunelab.ai/api/training/pause/job-789
                  </code>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-lg">
                <div className="p-4 bg-slate-50 dark:bg-slate-900">
                  <div className="flex items-start gap-3">
                    <HelpCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <h3 className="font-semibold">What GPU do I need?</h3>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm text-muted-foreground">
                    Minimum 8GB VRAM (RTX 3070, A10) for small models (1B params). 16GB+ recommended for 7B models.
                    40GB+ for 13B+ models. Can use LoRA to reduce requirements.
                  </p>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-lg">
                <div className="p-4 bg-slate-50 dark:bg-slate-900">
                  <div className="flex items-start gap-3">
                    <HelpCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <h3 className="font-semibold">How do I know if my model is overfitting?</h3>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm text-muted-foreground">
                    Watch the eval loss. If training loss decreases but eval loss increases or plateaus, you&apos;re overfitting.
                    Solutions: reduce epochs, add more data, increase regularization.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Summary */}
          <div className="p-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 border border-green-200 dark:border-green-800 rounded-lg">
            <h2 className="text-xl font-bold mb-3">💡 Still Stuck?</h2>
            <p className="text-muted-foreground mb-4">
              Can&apos;t find your issue here? Check the full API reference or review the guides for more detailed explanations.
            </p>
            <div className="flex gap-4">
              <a href="/docs/api-reference" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                API Reference →
              </a>
              <a href="/docs/guides" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                Guides →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
