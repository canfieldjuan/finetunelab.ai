'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { Brain, Zap, DollarSign, Info, CheckCircle2, ArrowRight } from 'lucide-react';

type ShowcaseModel = {
  name: string;
  id: string;
  description: string;
  contextWindow: string;
  pricing: {
    input: string;
    output: string;
  };
  strengths: string[];
  useCases: string[];
  recommended?: boolean;
  badge?: string;
  costWarning?: boolean;
};

export default function ModelsPage() {
  const { user, signOut, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return <LoadingState fullScreen />;
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  const openAIModels: ShowcaseModel[] = [
    {
      name: 'GPT o3-Pro',
      id: 'o3-pro',
      description: 'OpenAI\'s most advanced reasoning model with unprecedented problem-solving capabilities.',
      contextWindow: '256K tokens',
      pricing: {
        input: '$20.00 / 1M tokens',
        output: '$80.00 / 1M tokens'
      },
      strengths: [
        'Unprecedented reasoning depth',
        'Complex mathematical proofs',
        'Advanced scientific analysis',
        'Multi-step logical deduction'
      ],
      useCases: [
        'Research and academic work',
        'Complex mathematical problems',
        'Advanced scientific computing',
        'Competitive programming'
      ],
      badge: 'Most Advanced'
    },
    {
      name: 'GPT-5 Pro',
      id: 'gpt-5-pro',
      description: 'Most advanced GPT-5 model with highest reasoning effort for complex multi-step tasks.',
      contextWindow: '256K tokens',
      pricing: {
        input: '$15.00 / 1M tokens',
        output: '$120.00 / 1M tokens'
      },
      strengths: [
        'Highest reasoning capability',
        'Advanced multi-step problem solving',
        'Complex code architecture',
        'Research-level analysis'
      ],
      useCases: [
        'Complex system design',
        'Advanced research tasks',
        'Multi-step reasoning',
        'Code refactoring at scale'
      ],
      badge: 'Most Powerful',
      costWarning: true
    },
    {
      name: 'GPT-5',
      id: 'gpt-5-chat',
      description: 'Latest generation model with advanced reasoning and vision capabilities.',
      contextWindow: '256K tokens',
      pricing: {
        input: '$1.25 / 1M tokens',
        output: '$10.00 / 1M tokens'
      },
      strengths: [
        'Advanced reasoning',
        'Multimodal (text + vision)',
        'Extended context window',
        'Tool use and function calling'
      ],
      useCases: [
        'Complex conversations',
        'Vision-based tasks',
        'Advanced code generation',
        'Long document analysis'
      ],
      recommended: true
    },
    {
      name: 'GPT-5 Mini',
      id: 'gpt-5-mini',
      description: 'Compact GPT-5 model optimized for speed and cost while maintaining strong capabilities.',
      contextWindow: '256K tokens',
      pricing: {
        input: '$0.25 / 1M tokens',
        output: '$2.00 / 1M tokens'
      },
      strengths: [
        'Fast inference speed',
        'Cost-effective',
        'GPT-5 architecture benefits',
        'Large context window'
      ],
      useCases: [
        'High-volume applications',
        'Real-time chat',
        'Content generation',
        'Quick analysis tasks'
      ]
    },
    {
      name: 'GPT-4.1 Mini',
      id: 'gpt-4.1-mini',
      description: 'Fast and cost-effective GPT-4.1 model for most tasks with vision support.',
      contextWindow: '128K tokens',
      pricing: {
        input: '$0.40 / 1M tokens',
        output: '$1.60 / 1M tokens'
      },
      strengths: [
        'Fast response times',
        'Cost-effective',
        'Multimodal (text + vision)',
        'Good for most tasks'
      ],
      useCases: [
        'Chat applications',
        'Content moderation',
        'Data extraction',
        'Simple classification'
      ]
    }
  ];

  const anthropicModels: ShowcaseModel[] = [
    {
      name: 'Claude Sonnet 4.5',
      id: 'claude-sonnet-4.5',
      description: 'Next-generation Claude model with enhanced reasoning, vision, and extended context.',
      contextWindow: '300K tokens',
      pricing: {
        input: '$3.00 / 1M tokens',
        output: '$15.00 / 1M tokens'
      },
      strengths: [
        'Enhanced reasoning capabilities',
        'Extended 300K context',
        'Advanced vision support',
        'Superior code generation'
      ],
      useCases: [
        'Complex software architecture',
        'Long document analysis',
        'Advanced vision tasks',
        'Multi-file code review'
      ],
      recommended: true,
      badge: 'Latest'
    },
    {
      name: 'Claude Haiku 4.5',
      id: 'claude-haiku-4.5',
      description: 'Ultra-fast Claude 4.5 model optimized for speed and cost with vision support.',
      contextWindow: '300K tokens',
      pricing: {
        input: '$1.00 / 1M tokens',
        output: '$5.00 / 1M tokens'
      },
      strengths: [
        'Fastest Claude model',
        'Extended context window',
        'Vision capabilities',
        'Cost-effective for scale'
      ],
      useCases: [
        'Real-time chat applications',
        'High-volume processing',
        'Quick image analysis',
        'Content moderation at scale'
      ]
    },
    {
      name: 'Claude 3.5 Sonnet',
      id: 'claude-3-5-sonnet-20241022',
      description: 'Anthropic\'s most intelligent Claude 3 model with strong coding and reasoning.',
      contextWindow: '200K tokens',
      pricing: {
        input: '$3.00 / 1M tokens',
        output: '$15.00 / 1M tokens'
      },
      strengths: [
        'Excellent coding abilities',
        'Strong analytical reasoning',
        'Nuanced responses',
        'Vision support'
      ],
      useCases: [
        'Software development',
        'Technical writing',
        'Data analysis',
        'Research assistance'
      ]
    },
    {
      name: 'Claude 3 Opus',
      id: 'claude-3-opus-20240229',
      description: 'Most powerful Claude 3 model for highly complex tasks requiring deep reasoning.',
      contextWindow: '200K tokens',
      pricing: {
        input: '$15.00 / 1M tokens',
        output: '$75.00 / 1M tokens'
      },
      strengths: [
        'Highest intelligence (Claude 3)',
        'Complex reasoning',
        'Long-form content',
        'Vision capabilities'
      ],
      useCases: [
        'Complex problem solving',
        'Research-level analysis',
        'Strategic planning',
        'Advanced creative writing'
      ]
    },
    {
      name: 'Claude 3 Haiku',
      id: 'claude-3-haiku-20240307',
      description: 'Fast, compact Claude 3 model for quick responses and cost efficiency.',
      contextWindow: '200K tokens',
      pricing: {
        input: '$0.25 / 1M tokens',
        output: '$1.25 / 1M tokens'
      },
      strengths: [
        'Very fast responses',
        'Most cost-effective (Claude 3)',
        'Good for simple tasks',
        'Large context support'
      ],
      useCases: [
        'Customer support chatbots',
        'Content moderation',
        'Quick Q&A',
        'High-volume processing'
      ]
    }
  ];

  return (
    <PageWrapper currentPage="docs-models" user={user} signOut={signOut}>
      <PageHeader
        title="Supported Models"
        description="Choose the right AI model for your use case"
      />

      {/* Overview */}
      <div className="mb-12 p-6 bg-muted/50 border rounded-lg">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Brain className="w-6 h-6 text-primary" />
          Model Selection Guide
        </h2>
        <p className="text-muted-foreground mb-4">
          Fine-Tune Lab supports major AI providers with a unified API. Choose based on your needs:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="p-4 bg-background border rounded-lg">
            <Zap className="w-5 h-5 text-yellow-500 mb-2" />
            <h3 className="font-semibold mb-2">Speed</h3>
            <p className="text-sm text-muted-foreground">Claude Haiku 4.5, GPT-5 Mini, GPT-4.1 Mini</p>
          </div>
          <div className="p-4 bg-background border rounded-lg">
            <DollarSign className="w-5 h-5 text-green-500 mb-2" />
            <h3 className="font-semibold mb-2">Cost</h3>
            <p className="text-sm text-muted-foreground">GPT-4.1 Mini, GPT-5 Mini, Claude 3 Haiku</p>
          </div>
          <div className="p-4 bg-background border rounded-lg">
            <Brain className="w-5 h-5 text-purple-500 mb-2" />
            <h3 className="font-semibold mb-2">Intelligence</h3>
            <p className="text-sm text-muted-foreground">GPT-5 Pro, Claude Sonnet 4.5, GPT-5</p>
          </div>
        </div>
      </div>

      {/* OpenAI Models */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <span className="text-white font-bold text-xl">O</span>
          </div>
          <div>
            <h2 className="text-3xl font-bold">OpenAI Models</h2>
            <p className="text-muted-foreground">GPT-5 family with vision support</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {openAIModels.map((model) => (
            <div 
              key={model.id}
              className={`p-6 border rounded-lg hover:shadow-lg transition-all ${
                model.recommended ? 'border-primary/50 bg-primary/5' : ''
              }`}
            >
              {model.recommended && (
                <div className="inline-flex items-center gap-1 px-2 py-1 bg-primary/20 text-primary text-xs font-semibold rounded mb-3">
                  <CheckCircle2 className="w-3 h-3" />
                  Recommended
                </div>
              )}
              {model.badge && !model.recommended && (
                <div className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-semibold rounded mb-3">
                  <Brain className="w-3 h-3" />
                  {model.badge}
                </div>
              )}
              
              {model.costWarning && (
                <div className="p-3 mb-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex gap-2">
                    <DollarSign className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1">
                        ⚠️ Premium Pricing - Use With Caution
                      </p>
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        This model is <strong>10x more expensive</strong> than standard models. Recommended primarily for <strong>LLM-as-a-Judge evaluations</strong> where superior reasoning is critical. Budget carefully.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <h3 className="text-xl font-bold mb-2">{model.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{model.description}</p>

              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Model ID:</span>
                  <code className="px-2 py-1 bg-muted rounded text-xs">{model.id}</code>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Context:</span>
                  <span className="font-medium">{model.contextWindow}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Input:</span>
                  <span className="font-medium">{model.pricing.input}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Output:</span>
                  <span className="font-medium">{model.pricing.output}</span>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-semibold mb-2">Strengths</h4>
                <ul className="space-y-1">
                  {model.strengths.map((strength, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Best For</h4>
                <div className="flex flex-wrap gap-2">
                  {model.useCases.map((useCase, i) => (
                    <span key={i} className="px-2 py-1 bg-muted text-xs rounded">
                      {useCase}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Anthropic Models */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
            <span className="text-white font-bold text-xl">A</span>
          </div>
          <div>
            <h2 className="text-3xl font-bold">Anthropic Models</h2>
            <p className="text-muted-foreground">Claude 4.5 and Claude 3 families with extended context</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {anthropicModels.map((model) => (
            <div 
              key={model.id}
              className={`p-6 border rounded-lg hover:shadow-lg transition-all ${
                model.recommended ? 'border-primary/50 bg-primary/5' : ''
              }`}
            >
              {model.recommended && (
                <div className="inline-flex items-center gap-1 px-2 py-1 bg-primary/20 text-primary text-xs font-semibold rounded mb-3">
                  <CheckCircle2 className="w-3 h-3" />
                  Recommended
                </div>
              )}
              {model.badge && !model.recommended && (
                <div className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-semibold rounded mb-3">
                  <Brain className="w-3 h-3" />
                  {model.badge}
                </div>
              )}
              {model.badge && model.recommended && (
                <div className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-semibold rounded ml-2 mb-3">
                  {model.badge}
                </div>
              )}
              
              <h3 className="text-xl font-bold mb-2">{model.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{model.description}</p>

              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Model ID:</span>
                  <code className="px-2 py-1 bg-muted rounded text-xs">{model.id}</code>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Context:</span>
                  <span className="font-medium">{model.contextWindow}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Input:</span>
                  <span className="font-medium">{model.pricing.input}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Output:</span>
                  <span className="font-medium">{model.pricing.output}</span>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-semibold mb-2">Strengths</h4>
                <ul className="space-y-1">
                  {model.strengths.map((strength, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Best For</h4>
                <div className="flex flex-wrap gap-2">
                  {model.useCases.map((useCase, i) => (
                    <span key={i} className="px-2 py-1 bg-muted text-xs rounded">
                      {useCase}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* API Usage */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Using Models in API</h2>
        
        <div className="p-6 border rounded-lg bg-muted/50">
          <h3 className="text-lg font-semibold mb-4">Example: Chat Completion</h3>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">OpenAI Model</p>
              <pre className="p-4 bg-background border rounded-lg overflow-x-auto">
                <code className="text-sm">{`curl -X POST https://your-app.com/api/chat \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Explain quantum computing"
      }
    ],
    "model": "gpt-4o-mini",
    "temperature": 0.7
  }'`}</code>
              </pre>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">Anthropic Model</p>
              <pre className="p-4 bg-background border rounded-lg overflow-x-auto">
                <code className="text-sm">{`curl -X POST https://your-app.com/api/chat \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Explain quantum computing"
      }
    ],
    "model": "claude-3-5-sonnet-20241022",
    "temperature": 0.7
  }'`}</code>
              </pre>
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex gap-2">
              <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  Unified API
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  All models use the same API format. Just change the <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900 rounded">model</code> parameter to switch providers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Next Steps */}
      <section className="border-t pt-8">
        <h2 className="text-2xl font-bold mb-6">Next Steps</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/docs/quick-start" className="p-4 border rounded-lg hover:bg-muted transition-colors group">
            <h3 className="font-semibold mb-1 group-hover:text-primary flex items-center gap-2">
              Quick Start <ArrowRight className="w-4 h-4" />
            </h3>
            <p className="text-sm text-muted-foreground">Make your first API call</p>
          </Link>
          <Link href="/docs/api-reference" className="p-4 border rounded-lg hover:bg-muted transition-colors group">
            <h3 className="font-semibold mb-1 group-hover:text-primary flex items-center gap-2">
              API Reference <ArrowRight className="w-4 h-4" />
            </h3>
            <p className="text-sm text-muted-foreground">Complete API documentation</p>
          </Link>
          <Link href="/docs/guides" className="p-4 border rounded-lg hover:bg-muted transition-colors group">
            <h3 className="font-semibold mb-1 group-hover:text-primary flex items-center gap-2">
              Guides <ArrowRight className="w-4 h-4" />
            </h3>
            <p className="text-sm text-muted-foreground">Step-by-step tutorials</p>
          </Link>
        </div>
      </section>
    </PageWrapper>
  );
}
