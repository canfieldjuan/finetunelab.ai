'use client';

import React from 'react';
import Link from 'next/link';
import { ContentPageHeader } from '@/components/layout/ContentPageHeader';
import {
  ArrowLeft,
  Clock,
  User,
  Tag,
  Share2,
  BookOpen
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LabNote, categoryConfig } from '../data';
import { RelatedArticles } from '@/components/content/RelatedArticles';

interface RelatedArticle {
  slug: string;
  title: string;
  description: string;
  category: string;
  readTime: string;
  type: 'lab-note' | 'academy';
}

interface LabNoteArticleViewProps {
  article: LabNote | null;
  relatedArticles?: RelatedArticle[];
}

export function LabNoteArticleView({ article, relatedArticles }: LabNoteArticleViewProps) {
  if (!article) {
    return (
      <div className="min-h-screen bg-background">
        <ContentPageHeader showBack backHref="/lab-notes" backLabel="Back to Lab Notes" />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Article Not Found</h1>
          <p className="text-muted-foreground mb-6">
            This lab note doesn&apos;t exist or has been moved.
          </p>
          <Link href="/lab-notes">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Lab Notes
            </Button>
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ContentPageHeader showBack backHref="/lab-notes" backLabel="Back to Lab Notes" />
      
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Article Header */}
        <header className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Badge className={categoryConfig[article.category].color}>
              {categoryConfig[article.category].label}
            </Badge>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {article.readTime} read
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            {article.title}
          </h1>

          <p className="text-xl text-muted-foreground mb-6">
            {article.description}
          </p>

          <div className="flex items-center justify-between border-y py-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4" />
                <span>{article.author}</span>
              </div>
              <span className="text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">{article.publishedAt}</span>
            </div>
            <Button variant="ghost" size="sm">
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>
        </header>

        {/* Article Content */}
        <article className="prose prose-gray dark:prose-invert max-w-none">
          <div
            className="[&>h2]:text-2xl [&>h2]:font-bold [&>h2]:mt-8 [&>h2]:mb-4
                       [&>h3]:text-xl [&>h3]:font-semibold [&>h3]:mt-6 [&>h3]:mb-3
                       [&>p]:mb-4 [&>p]:text-muted-foreground [&>p]:leading-relaxed
                       [&>ul]:mb-4 [&>ul]:list-disc [&>ul]:pl-6 [&>ul>li]:mb-2 [&>ul>li]:text-muted-foreground
                       [&>ol]:mb-4 [&>ol]:list-decimal [&>ol]:pl-6 [&>ol>li]:mb-2 [&>ol>li]:text-muted-foreground
                       [&>table]:w-full [&>table]:border-collapse [&>table]:mb-6
                       [&>table>thead>tr>th]:border [&>table>thead>tr>th]:p-2 [&>table>thead>tr>th]:bg-muted [&>table>thead>tr>th]:text-left
                       [&>table>tbody>tr>td]:border [&>table>tbody>tr>td]:p-2
                       [&>blockquote]:border-l-4 [&>blockquote]:border-primary [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-muted-foreground
                       [&>hr]:my-8 [&>hr]:border-border
                       [&>pre]:bg-muted [&>pre]:p-4 [&>pre]:rounded-lg [&>pre]:overflow-x-auto
                       [&>code]:bg-muted [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>code]:text-sm"
            dangerouslySetInnerHTML={{
              __html: article.content
                .replace(/^## /gm, '<h2>')
                .replace(/^### /gm, '<h3>')
                .replace(/\n\n/g, '</p><p>')
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                .replace(/\*([^*]+)\*/g, '<em>$1</em>')
                .replace(/^- /gm, '<li>')
                .replace(/^\d+\. /gm, '<li>')
                .replace(/\|(.+)\|/g, (match) => {
                  const cells = match.split('|').filter(c => c.trim());
                  return '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
                })
                .replace(/---/g, '<hr>')
            }}
          />
        </article>

        {/* Tags */}
        <div className="mt-8 pt-8 border-t">
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="w-4 h-4 text-muted-foreground" />
            {article.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        {/* Related Articles */}
        {relatedArticles && relatedArticles.length > 0 && (
          <RelatedArticles articles={relatedArticles} />
        )}

        {/* CTA */}
        <div className="mt-12 p-6 bg-muted/50 border rounded-lg text-center">
          <BookOpen className="w-8 h-8 mx-auto mb-3 text-primary" />
          <h3 className="text-xl font-bold mb-2">Want to try these techniques?</h3>
          <p className="text-muted-foreground mb-4">
            Start fine-tuning your own model on FineTune Lab. All experiments in this article were done on our platform.
          </p>
          <Link href="/training">
            <Button>
              Start Training
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
