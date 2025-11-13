'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Zap, Code2, BookMarked, FileCode, AlertCircle, ArrowRight, Rocket } from 'lucide-react';

export default function DocsPage() {
  const { user, signOut, loading } = useAuth();
  const router = useRouter();

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

  const docSections = [
    {
      title: 'Quick Start',
      description: 'Get up and running in under 5 minutes with simple, copy-paste examples.',
      icon: Zap,
      href: '/docs/quick-start',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
      borderColor: 'border-yellow-200 dark:border-yellow-800',
    },
    {
      title: 'Features',
      description: 'Discover what Fine-Tune Lab can do with our comprehensive platform overview.',
      icon: Rocket,
      href: '/docs/features',
      color: 'text-orange-500',
      bgColor: 'bg-orange-50 dark:bg-orange-950/20',
      borderColor: 'border-orange-200 dark:border-orange-800',
    },
    {
      title: 'API Reference',
      description: 'Complete API documentation with interactive testing and LLM-friendly examples.',
      icon: Code2,
      href: '/docs/api-reference',
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
    },
    {
      title: 'Guides',
      description: 'Step-by-step tutorials for common workflows and advanced features.',
      icon: BookMarked,
      href: '/docs/guides',
      color: 'text-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-950/20',
      borderColor: 'border-purple-200 dark:border-purple-800',
    },
    {
      title: 'Examples',
      description: 'Real working code examples in Python, JavaScript, and cURL.',
      icon: FileCode,
      href: '/docs/examples',
      color: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-950/20',
      borderColor: 'border-green-200 dark:border-green-800',
    },
    {
      title: 'Troubleshooting',
      description: 'Common errors and their solutions. Debug faster with our error dictionary.',
      icon: AlertCircle,
      href: '/docs/troubleshooting',
      color: 'text-red-500',
      bgColor: 'bg-red-50 dark:bg-red-950/20',
      borderColor: 'border-red-200 dark:border-red-800',
    },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar currentPage="docs" user={user} signOut={signOut} />
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-5xl mx-auto p-8">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl font-bold mb-4">Documentation Hub</h1>
            <p className="text-xl text-muted-foreground">
              LLM-First documentation designed for AI-assisted development
            </p>
          </div>

          {/* What Makes This Different */}
          <div className="mb-12 p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
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
        </div>
      </div>
    </div>
  );
}
