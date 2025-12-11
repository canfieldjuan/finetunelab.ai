import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { academyArticles } from '@/lib/academy/content';
import { FineTuneLabFullLogoV2 } from '@/components/branding';

export const metadata: Metadata = {
  title: "Lab Academy - AI & MLOps Knowledge Base | Fine Tune Lab",
  description: "Expert answers to the top questions in AI, MLOps, RAG, and LLM engineering. Learn about fine-tuning, vector databases, and agentic workflows.",
  keywords: ["AI Academy", "MLOps FAQ", "RAG vs Fine-tuning", "LLM Engineering", "AI Knowledge Base"],
  openGraph: {
    title: "Lab Academy - AI & MLOps Knowledge Base",
    description: "Expert answers to the top questions in AI, MLOps, RAG, and LLM engineering.",
    type: "website",
  }
};

export default function LabAcademyPage() {
  // Structured Data for CollectionPage
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Lab Academy",
    "description": "Expert answers to the top questions in AI, MLOps, RAG, and LLM engineering.",
    "hasPart": academyArticles.map(article => ({
      "@type": "Article",
      "headline": article.title,
      "description": article.excerpt,
      "url": `https://finetunelab.ai/lab-academy/${article.slug}`
    }))
  };

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Navigation (Simplified for this page) */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/">
                <FineTuneLabFullLogoV2 width={150} height={45} />
              </Link>
              <span className="ml-4 text-lg font-semibold text-muted-foreground border-l pl-4">
                Lab Academy
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/" className="text-sm font-medium hover:text-primary transition-colors">
                Home
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            AI Engineering Knowledge Base
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Deep dives into the most critical questions in MLOps, RAG, and LLM development.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {academyArticles.map((article) => (
            <Link key={article.slug} href={`/lab-academy/${article.slug}`} className="group">
              <Card className="h-full transition-all hover:border-primary/50 hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                      {article.category}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {article.publishedAt}
                    </span>
                  </div>
                  <CardTitle className="group-hover:text-primary transition-colors">
                    {article.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="line-clamp-3">
                    {article.excerpt}
                  </CardDescription>
                </CardContent>
                <CardFooter>
                  <div className="flex flex-wrap gap-2">
                    {article.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
