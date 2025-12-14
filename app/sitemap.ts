import { MetadataRoute } from 'next';
import { labNotes } from './lab-notes/data';
import { academyArticles } from '@/lib/academy/content';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://finetunelab.ai';

  const notes = labNotes.map((note) => ({
    url: `${baseUrl}/lab-notes/${note.slug}`,
    lastModified: new Date(note.publishedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  const academy = academyArticles.map((article) => ({
    url: `${baseUrl}/lab-academy/${article.slug}`,
    lastModified: new Date(article.publishedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [
    // Main pages
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/welcome`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    // Content hubs
    {
      url: `${baseUrl}/lab-notes`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/lab-academy`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/case-studies`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    // Auth pages (for brand searches)
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    // Individual articles
    ...notes,
    ...academy,
  ];
}
