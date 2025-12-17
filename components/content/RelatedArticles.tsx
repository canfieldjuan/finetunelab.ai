'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface RelatedArticle {
  slug: string;
  title: string;
  description: string;
  category: string;
  readTime: string;
  type: 'lab-note' | 'academy';
}

interface RelatedArticlesProps {
  articles: RelatedArticle[];
}

export function RelatedArticles({ articles }: RelatedArticlesProps) {
  if (articles.length === 0) return null;

  return (
    <div className="mt-12 pt-8 border-t">
      <h2 className="text-2xl font-bold mb-6">Related Articles</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => {
          const href = article.type === 'lab-note' 
            ? `/lab-notes/${article.slug}` 
            : `/lab-academy/${article.slug}`;
          
          return (
            <Link key={article.slug} href={href}>
              <Card className="h-full hover:border-primary transition-colors">
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      {article.type === 'lab-note' ? 'Lab Notes' : 'Academy'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {article.readTime}
                    </span>
                  </div>
                  <CardTitle className="text-lg line-clamp-2 group-hover:text-primary">
                    {article.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {article.description}
                  </CardDescription>
                  <div className="flex items-center gap-1 text-sm text-primary mt-2">
                    Read more <ArrowRight className="w-4 h-4" />
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
