import { MetadataRoute } from 'next';
import { labNotes } from './lab-notes/data';
import { academyArticles } from '@/lib/academy/content';
import { siteConfig, publicPages } from '@/lib/seo/config';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = siteConfig.url;

  // Static public pages from config
  const staticPages = publicPages.map((page) => ({
    url: `${baseUrl}${page.path === '/' ? '' : page.path}`,
    lastModified: new Date(),
    changeFrequency: page.changeFreq,
    priority: page.priority,
  }));

  // Dynamic lab notes articles
  const notes = labNotes.map((note) => ({
    url: `${baseUrl}/lab-notes/${note.slug}`,
    lastModified: new Date(note.publishedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  // Dynamic academy articles
  const academy = academyArticles.map((article) => ({
    url: `${baseUrl}/lab-academy/${article.slug}`,
    lastModified: new Date(article.publishedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.8, // Higher priority for SEO-focused content
  }));

  return [...staticPages, ...notes, ...academy];
}
