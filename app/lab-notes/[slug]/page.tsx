import React from 'react';
import { Metadata } from 'next';
import { LabNoteArticleView } from './LabNoteArticleView';
import { labNotes } from '../data';
import { generateArticleSchema } from '../schema';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = labNotes.find((note) => note.slug === slug);

  if (!article) {
    return {
      title: 'Article Not Found | FineTune Lab',
    };
  }

  return {
    title: `${article.title} | FineTune Lab Notes`,
    description: article.description,
    openGraph: {
      title: article.title,
      description: article.description,
      type: 'article',
      publishedTime: article.publishedAt,
      authors: [article.author],
      tags: article.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.description,
    },
  };
}

export default async function LabNoteArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = labNotes.find((note) => note.slug === slug);
  const jsonLd = article ? generateArticleSchema(article) : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <LabNoteArticleView article={article || null} />
    </>
  );
}
