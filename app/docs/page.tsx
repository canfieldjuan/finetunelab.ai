'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Head from 'next/head';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { Zap, Code2, BookMarked, FileCode, AlertCircle, ArrowRight, Rocket, Package } from 'lucide-react';

export default function DocsPage() {
  const { user, signOut, loading } = useAuth();
  const router = useRouter();

  // Public page - no auth required
  // if (loading) {
  //   return <LoadingState fullScreen />;
  // }

  const docSections = [
    {
      title: 'Quick Start',
      description: 'Get up and running in under 5 minutes with simple, copy-paste examples.',
      icon: Zap,
      href: '/docs/quick-start',
      color: 'text-primary',
      bgColor: 'bg-muted/50',
      borderColor: 'border-border',
    },
    {
      title: 'Supported Models',
      description: 'OpenAI and Anthropic models with pricing, capabilities, and usage examples.',
      icon: Rocket,
      href: '/docs/models',
      color: 'text-primary',
      bgColor: 'bg-muted/50',
      borderColor: 'border-border',
    },
    {
      title: 'Features',
      description: 'Discover what Fine-Tune Lab can do with our comprehensive platform overview.',
      icon: Rocket,
      href: '/docs/features',
      color: 'text-primary',
      bgColor: 'bg-muted/50',
      borderColor: 'border-border',
    },
    {
      title: 'API Reference',
      description: 'Complete API documentation with interactive testing and LLM-friendly examples.',
      icon: Code2,
      href: '/docs/api-reference',
      color: 'text-primary',
      bgColor: 'bg-muted/50',
      borderColor: 'border-border',
    },
    {
      title: 'Guides',
      description: 'Step-by-step tutorials for common workflows and advanced features.',
      icon: BookMarked,
      href: '/docs/guides',
      color: 'text-primary',
      bgColor: 'bg-muted/50',
      borderColor: 'border-border',
    },
    {
      title: 'SDKs',
      description: 'Official Python and Node.js SDKs for inference, batch testing, and analytics.',
      icon: Package,
      href: '/docs/sdk',
      color: 'text-primary',
      bgColor: 'bg-muted/50',
      borderColor: 'border-border',
    },
    {
      title: 'Examples',
      description: 'Real working code examples in Python, JavaScript, and cURL.',
      icon: FileCode,
      href: '/docs/examples',
      color: 'text-primary',
      bgColor: 'bg-muted/50',
      borderColor: 'border-border',
    },
    {
      title: 'Troubleshooting',
      description: 'Common errors and their solutions. Debug faster with our error dictionary.',
      icon: AlertCircle,
      href: '/docs/troubleshooting',
      color: 'text-primary',
      bgColor: 'bg-muted/50',
      borderColor: 'border-border',
    },
  ];

  return (
    <>
      <Head>
        <title>AI Model Fine-Tuning Documentation | API Reference, Guides & Examples - Fine-Tune Lab</title>
        <meta
          name="description"
          content="Complete LLM fine-tuning documentation with API reference, Python/Node.js SDKs, training guides, troubleshooting, and copy-paste code examples. Built for AI-assisted development with Llama 3.3, Mistral, Qwen models."
        />
        <meta
          name="keywords"
          content="LLM fine-tuning documentation, AI model training API reference, Llama 3.3 training guide, Python fine-tuning SDK, Node.js AI training library, OpenAI API alternative docs, LoRA fine-tuning tutorial, QLoRA 4-bit training guide, custom AI model API, RunPod GPU training documentation, fine-tuning troubleshooting guide, JSONL dataset format examples, AI training REST API, machine learning API documentation, LLM deployment guide, model inference API reference, batch testing API docs, training metrics WebSocket API, fine-tuning cost calculator, AI model evaluation guide, Hugging Face model deployment, vLLM inference documentation, A4000 A5000 H100 GPU pricing, AI training Python examples, LLM API authentication guide, model endpoint configuration, training hyperparameters reference, gradient accumulation guide, early stopping configuration, learning rate scheduler docs, AI model versioning guide, fine-tuning best practices"
        />
        <meta name="author" content="Fine-Tune Lab" />
        <meta name="robots" content="index, follow" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="AI Model Fine-Tuning Documentation | Complete API Reference & Guides" />
        <meta property="og:description" content="LLM-first documentation for fine-tuning Llama, Mistral, and Qwen models. API reference, SDKs, guides, and working code examples optimized for AI assistants." />
        <meta property="og:url" content="https://finetunelab.ai/docs" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="AI Model Fine-Tuning Documentation | API Reference & Guides" />
        <meta name="twitter:description" content="Complete documentation for training custom LLMs. API reference, Python/Node.js SDKs, troubleshooting guides, and copy-paste examples." />
        
        {/* Canonical URL */}
        <link rel="canonical" href="https://finetunelab.ai/docs" />
      </Head>

      <PageWrapper currentPage="docs" user={user} signOut={signOut}>
        <PageHeader
          title="Documentation Hub"
          description="LLM-First documentation designed for AI-assisted development"
        />

          {/* What Makes This Different */}
          <div className="mb-12 p-6 bg-muted/50 border rounded-lg">
            <h2 className="text-2xl font-bold mb-4">🤖 Built for LLM Assistants</h2>
            <p className="text-muted-foreground mb-4">
              Traditional docs are written for experts. These docs are optimized for:
            </p>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span><strong>Copy-paste ready examples</strong> - Every code snippet works immediately</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span><strong>Plain English explanations</strong> - No jargon, just clear descriptions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span><strong>LLM Context Boxes</strong> - &quot;Tell your AI assistant&quot; snippets included</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span><strong>Interactive testing</strong> - Test endpoints right in the browser</span>
              </li>
            </ul>
          </div>

          {/* Documentation Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {docSections.map((section) => {
              const Icon = section.icon;
              return (
                <Link key={section.href} href={section.href}>
                  <div className={`p-6 border ${section.borderColor} ${section.bgColor} rounded-lg hover:shadow-lg transition-all duration-200 cursor-pointer group h-full`}>
                    <div className="flex items-start gap-4">
                      <div className={`${section.color} mt-1`}>
                        <Icon className="w-8 h-8" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                          {section.title}
                        </h3>
                        <p className="text-muted-foreground mb-3">
                          {section.description}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-primary font-medium group-hover:gap-3 transition-all">
                          <span>Explore</span>
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Quick Links */}
          <div className="border-t pt-8">
            <h2 className="text-2xl font-bold mb-6">Popular Topics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href="/docs/quick-start" className="p-4 border rounded-lg hover:bg-muted transition-colors">
                <h3 className="font-semibold mb-1">First API Call</h3>
                <p className="text-sm text-muted-foreground">Make your first request in 2 minutes</p>
              </Link>
              <Link href="/docs/api-reference" className="p-4 border rounded-lg hover:bg-muted transition-colors">
                <h3 className="font-semibold mb-1">Training API</h3>
                <p className="text-sm text-muted-foreground">Start and monitor training jobs</p>
              </Link>
              <Link href="/docs/troubleshooting" className="p-4 border rounded-lg hover:bg-muted transition-colors">
                <h3 className="font-semibold mb-1">Common Errors</h3>
                <p className="text-sm text-muted-foreground">Quick solutions to frequent issues</p>
              </Link>
            </div>
          </div>

          {/* JSON-LD Structured Data */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'TechArticle',
                headline: 'AI Model Fine-Tuning Documentation and API Reference',
                description: 'Complete documentation for fine-tuning LLMs including API reference, Python and Node.js SDKs, training guides, troubleshooting, and code examples for Llama 3.3, Mistral, and Qwen models.',
                author: {
                  '@type': 'Organization',
                  name: 'Fine-Tune Lab',
                  url: 'https://finetunelab.ai'
                },
                publisher: {
                  '@type': 'Organization',
                  name: 'Fine-Tune Lab',
                  url: 'https://finetunelab.ai'
                },
                datePublished: '2024-01-01',
                dateModified: new Date().toISOString().split('T')[0],
                inLanguage: 'en-US',
                about: [
                  {
                    '@type': 'Thing',
                    name: 'LLM Fine-Tuning'
                  },
                  {
                    '@type': 'Thing',
                    name: 'API Documentation'
                  },
                  {
                    '@type': 'Thing',
                    name: 'Machine Learning'
                  }
                ],
                mainEntity: {
                  '@type': 'ItemList',
                  itemListElement: [
                    {
                      '@type': 'ListItem',
                      position: 1,
                      name: 'Quick Start Guide',
                      url: 'https://finetunelab.ai/docs/quick-start'
                    },
                    {
                      '@type': 'ListItem',
                      position: 2,
                      name: 'API Reference',
                      url: 'https://finetunelab.ai/docs/api-reference'
                    },
                    {
                      '@type': 'ListItem',
                      position: 3,
                      name: 'Python & Node.js SDKs',
                      url: 'https://finetunelab.ai/docs/sdk'
                    },
                    {
                      '@type': 'ListItem',
                      position: 4,
                      name: 'Training Guides',
                      url: 'https://finetunelab.ai/docs/guides'
                    },
                    {
                      '@type': 'ListItem',
                      position: 5,
                      name: 'Troubleshooting',
                      url: 'https://finetunelab.ai/docs/troubleshooting'
                    }
                  ]
                }
              })
            }}
          />
    </PageWrapper>
    </>
  );
}
