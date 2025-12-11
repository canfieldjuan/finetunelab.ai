'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { Zap, Code2, BookMarked, FileCode, AlertCircle, ArrowRight, Rocket } from 'lucide-react';

export default function DocsPage() {
  const { user, signOut, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return <LoadingState fullScreen />;
  }

  if (!user) {
    router.push('/login');
    return null;
  }

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
    </PageWrapper>
  );
}
