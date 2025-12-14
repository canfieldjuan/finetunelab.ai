import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { academyArticles } from '@/lib/academy/content';
import { FineTuneLabFullLogoV2 } from '@/components/branding';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = academyArticles.find((a) => a.slug === slug);

  if (!article) {
    return {
      title: 'Article Not Found',
    };
  }

  return {
    title: `${article.title} | Lab Academy`,
    description: article.excerpt,
    keywords: article.tags,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: 'article',
      publishedTime: article.publishedAt,
      authors: [article.author],
      tags: article.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.excerpt,
    }
  };
}

export async function generateStaticParams() {
  return academyArticles.map((article) => ({
    slug: article.slug,
  }));
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = academyArticles.find((a) => a.slug === slug);

  if (!article) {
    notFound();
  }

  const faqEntities = (article.faq && article.faq.length > 0)
    ? article.faq.map((item) => ({
        "@type": "Question",
        "name": item.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": item.answer,
        },
      }))
    : [
        {
          "@type": "Question",
          "name": article.title,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": article.excerpt,
          },
        },
      ];

  // Structured Data: Article + FAQPage
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "headline": article.title,
        "description": article.excerpt,
        "author": {
          "@type": "Organization",
          "name": article.author
        },
        "datePublished": article.publishedAt,
        "mainEntityOfPage": {
          "@type": "WebPage",
          "@id": `https://finetunelab.ai/lab-academy/${article.slug}`
        }
      },
      {
        "@type": "FAQPage",
        "mainEntity": faqEntities
      }
    ]
  };

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/lab-academy" className="flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Academy
            </Link>
            <Link href="/">
              <FineTuneLabFullLogoV2 width={120} height={36} />
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <article className="prose prose-slate dark:prose-invert max-w-none">
          <div className="mb-8 not-prose">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-medium px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                {article.category}
              </span>
              <span className="text-sm text-muted-foreground">
                {article.publishedAt}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              {article.title}
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              {article.excerpt}
            </p>
          </div>

          <div 
            className="mt-8"
            dangerouslySetInnerHTML={{ __html: article.content }} 
          />

          <div className="mt-12 pt-8 border-t not-prose">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Related Topics
            </h3>
            <div className="flex flex-wrap gap-2">
              {article.tags.map(tag => (
                <span key={tag} className="text-sm bg-muted px-3 py-1 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </article>

        <div className="mt-16 p-8 bg-muted/30 rounded-2xl text-center">
          <h3 className="text-2xl font-bold mb-4">Ready to put this into practice?</h3>
          <p className="text-muted-foreground mb-6">
            Start building your AI pipeline with our visual DAG builder today.
          </p>
          <Link href="/signup">
            <Button size="lg">Get Started for Free</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
