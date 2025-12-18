'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { 
  Brain, 
  Database, 
  BarChart3, 
  Server, 
  Code2, 
  Shield, 
  Layers,
  GitBranch,
  TrendingUp,
  Gauge,
  CheckCircle2
} from 'lucide-react';

export default function FeaturesPage() {
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

  const features = [
    {
      icon: Brain,
      title: 'LLM Fine-Tuning Made Simple',
      description: 'Train custom AI models on your data without PhD-level ML knowledge. Upload dataset, click train, get results.',
      highlights: [
        'Support for Llama, Mistral, Qwen, and more',
        'Automatic hyperparameter optimization',
        'LoRA and full fine-tuning options',
        'Mixed precision training (FP16/BF16)'
      ],
      color: 'text-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-950/20',
      borderColor: 'border-purple-200 dark:border-purple-800'
    },
    {
      icon: Database,
      title: 'Dataset Management',
      description: 'Upload, validate, and manage training datasets with built-in quality checks and format verification.',
      highlights: [
        'JSONL format validation',
        'Automatic dataset splitting',
        'Dataset versioning',
        'Quality metrics and stats'
      ],
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
      borderColor: 'border-blue-200 dark:border-blue-800'
    },
    {
      icon: BarChart3,
      title: 'Real-Time Training Metrics',
      description: 'Monitor loss curves, learning rates, and GPU utilization in real-time as your model trains.',
      highlights: [
        'Live loss visualization',
        'Epoch-by-epoch progress',
        'GPU memory tracking',
        'Training/validation split metrics'
      ],
      color: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-950/20',
      borderColor: 'border-green-200 dark:border-green-800'
    },
    {
      icon: Server,
      title: 'Production Inference Deployment',
      description: 'Deploy trained models to production with one click. Cloud deployment via RunPod Serverless with automatic scaling and production-ready API endpoints.',
      highlights: [
        'RunPod Serverless with auto-scaling (A4000 to H100 GPUs)',
        'Budget limits with real-time cost tracking',
        'Automatic checkpoint selection and optimization',
        'Production-ready API endpoints'
      ],
      color: 'text-orange-500',
      bgColor: 'bg-orange-50 dark:bg-orange-950/20',
      borderColor: 'border-orange-200 dark:border-orange-800'
    },
    {
      icon: Code2,
      title: 'Developer-First API',
      description: 'RESTful API with 25+ endpoints. Complete SDK support for Python, JavaScript, and cURL.',
      highlights: [
        'Comprehensive REST API',
        'Real-time WebSocket updates',
        'Python SDK with async support',
        'TypeScript client libraries'
      ],
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-50 dark:bg-cyan-950/20',
      borderColor: 'border-cyan-200 dark:border-cyan-800'
    },
    {
      icon: Shield,
      title: 'Enterprise Security',
      description: 'Multi-tenant architecture with row-level security. Your data stays yours, always encrypted.',
      highlights: [
        'Supabase RLS authentication',
        'API key encryption at rest',
        'User-scoped resources',
        'Audit logging'
      ],
      color: 'text-red-500',
      bgColor: 'bg-red-50 dark:bg-red-950/20',
      borderColor: 'border-red-200 dark:border-red-800'
    },
    {
      icon: Layers,
      title: 'Model Version Control',
      description: 'Track every training run, compare results, and roll back to previous checkpoints instantly.',
      highlights: [
        'Automatic checkpoint saving',
        'A/B testing support',
        'Model comparison tools',
        'Training run history'
      ],
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950/20',
      borderColor: 'border-indigo-200 dark:border-indigo-800'
    },
    {
      icon: GitBranch,
      title: 'Training Pipeline Control',
      description: 'Pause, resume, or cancel training jobs. Adjust hyperparameters on the fly without starting over.',
      highlights: [
        'Pause/resume functionality',
        'Dynamic config updates',
        'Multi-job orchestration',
        'Graceful cancellation'
      ],
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
      borderColor: 'border-yellow-200 dark:border-yellow-800'
    },
    {
      icon: TrendingUp,
      title: 'Analytics & Insights',
      description: 'Compare training runs, identify best hyperparameters, and optimize for cost or performance.',
      highlights: [
        'Training run comparisons',
        'Cost analysis per job',
        'Performance benchmarking',
        'Hyperparameter optimization suggestions'
      ],
      color: 'text-pink-500',
      bgColor: 'bg-pink-50 dark:bg-pink-950/20',
      borderColor: 'border-pink-200 dark:border-pink-800'
    },
    {
      icon: Gauge,
      title: 'Performance Optimization',
      description: 'Automatic batch size tuning, gradient accumulation, and mixed precision for maximum GPU efficiency.',
      highlights: [
        'Auto batch size detection',
        'Gradient checkpointing',
        'Flash Attention support',
        'Multi-GPU training'
      ],
      color: 'text-teal-500',
      bgColor: 'bg-teal-50 dark:bg-teal-950/20',
      borderColor: 'border-teal-200 dark:border-teal-800'
    }
  ];

  const useCases = [
    {
      title: 'Customer Support Automation',
      description: 'Train models on your support tickets to answer customer questions in your brand voice.',
      example: 'Fine-tune Llama on 5000 historical support conversations → 80% ticket deflection rate'
    },
    {
      title: 'Code Generation',
      description: 'Create AI coding assistants that understand your codebase conventions and patterns.',
      example: 'Train on your GitHub repos → Generate boilerplate in your team\'s style'
    },
    {
      title: 'Domain-Specific Expertise',
      description: 'Build specialized models for legal, medical, or financial applications with domain knowledge.',
      example: 'Fine-tune on medical papers → Answer clinical questions with citations'
    },
    {
      title: 'Content Generation',
      description: 'Generate marketing copy, product descriptions, or social media posts in your brand tone.',
      example: 'Train on past campaigns → Generate on-brand content at scale'
    }
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar currentPage="docs-features" user={user} signOut={signOut} />
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-6xl mx-auto p-8">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl font-bold mb-4">🚀 Features</h1>
            <p className="text-xl text-muted-foreground mb-6">
              Everything you need to fine-tune, deploy, and manage custom LLMs
            </p>
            <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-muted-foreground">
                <strong>Fine-Tune Lab</strong> is a complete platform for training custom AI models. 
                From dataset upload to production deployment, we handle the complexity so you can focus on results.
              </p>
            </div>
          </div>

          {/* Core Features */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-8">Core Capabilities</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {features.map((feature, idx) => {
                const Icon = feature.icon;
                return (
                  <div 
                    key={idx}
                    className={`p-6 border ${feature.borderColor} ${feature.bgColor} rounded-lg`}
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <Icon className={`w-8 h-8 ${feature.color} flex-shrink-0`} />
                      <div>
                        <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                        <p className="text-sm text-muted-foreground mb-4">{feature.description}</p>
                      </div>
                    </div>
                    <ul className="space-y-2">
                      {feature.highlights.map((highlight, hIdx) => (
                        <li key={hIdx} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className={`w-4 h-4 ${feature.color} mt-0.5 flex-shrink-0`} />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Use Cases */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-8">Common Use Cases</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {useCases.map((useCase, idx) => (
                <div 
                  key={idx}
                  className="p-6 border border-border rounded-lg hover:shadow-lg transition-shadow"
                >
                  <h3 className="text-xl font-bold mb-2">{useCase.title}</h3>
                  <p className="text-muted-foreground mb-4">{useCase.description}</p>
                  <div className="p-3 bg-muted border border-border rounded">
                    <p className="text-sm font-mono">{useCase.example}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* How It Works */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-8">How It Works</h2>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">1</div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Upload Your Dataset</h3>
                  <p className="text-muted-foreground">
                    Upload a JSONL file with your training examples. We validate format and provide quality metrics automatically.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">2</div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Configure Training</h3>
                  <p className="text-muted-foreground">
                    Choose your base model (Llama, Mistral, etc.) and set hyperparameters. Or use our recommended defaults.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">3</div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Start Training</h3>
                  <p className="text-muted-foreground">
                    Click start and watch real-time metrics as your model learns. Pause/resume anytime.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">4</div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Deploy to Production</h3>
                  <p className="text-muted-foreground">
                    Deploy to RunPod Serverless with auto-scaling cloud inference. Set budget limits and get a production-ready API endpoint within minutes.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">✓</div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Monitor & Improve</h3>
                  <p className="text-muted-foreground">
                    Track usage analytics, compare model versions, and iterate with new training data.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Technical Stack */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-8">Built On Proven Technology</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg text-center">
                <p className="font-bold mb-1">Hugging Face</p>
                <p className="text-sm text-muted-foreground">Model Training</p>
              </div>
              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg text-center">
                <p className="font-bold mb-1">RunPod</p>
                <p className="text-sm text-muted-foreground">Cloud GPU & Inference</p>
              </div>
              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg text-center">
                <p className="font-bold mb-1">RunPod Serverless</p>
                <p className="text-sm text-muted-foreground">Cloud Inference</p>
              </div>
              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg text-center">
                <p className="font-bold mb-1">PyTorch</p>
                <p className="text-sm text-muted-foreground">Deep Learning</p>
              </div>
              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg text-center">
                <p className="font-bold mb-1">Supabase</p>
                <p className="text-sm text-muted-foreground">Database & Auth</p>
              </div>
              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg text-center">
                <p className="font-bold mb-1">Next.js</p>
                <p className="text-sm text-muted-foreground">Frontend</p>
              </div>
              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg text-center">
                <p className="font-bold mb-1">CUDA</p>
                <p className="text-sm text-muted-foreground">GPU Acceleration</p>
              </div>
              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg text-center">
                <p className="font-bold mb-1">Docker</p>
                <p className="text-sm text-muted-foreground">Containerization</p>
              </div>
              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg text-center">
                <p className="font-bold mb-1">Redis</p>
                <p className="text-sm text-muted-foreground">Job Queue</p>
              </div>
            </div>
          </section>

          {/* CTA */}
          <div className="p-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 border border-green-200 dark:border-green-800 rounded-lg">
            <h2 className="text-2xl font-bold mb-3">Ready to Get Started?</h2>
            <p className="text-muted-foreground mb-4">
              Follow our quick start guide to train your first custom model in under 10 minutes.
            </p>
            <div className="flex gap-4">
              <a 
                href="/docs/quick-start" 
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                Quick Start Guide →
              </a>
              <a 
                href="/docs/api-reference" 
                className="px-6 py-2 border border-blue-600 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors font-semibold"
              >
                View API Docs
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
