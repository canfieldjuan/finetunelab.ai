import { LabNote } from "./data";

const siteUrl = 'https://finetunelab.ai';

export function generateArticleSchema(article: LabNote) {
  // Use TechArticle for case studies and experiments as they are more technical/scientific
  const type = ['case-study', 'experiment', 'technique'].includes(article.category)
    ? 'TechArticle'
    : 'BlogPosting';

  return {
    '@context': 'https://schema.org',
    '@type': type,
    headline: article.title,
    description: article.description,
    author: {
      '@type': 'Organization',
      name: article.author,
    },
    datePublished: article.publishedAt,
    dateModified: article.publishedAt,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${siteUrl}/lab-notes/${article.slug}`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Fine Tune Lab',
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/finetune-lab-icon.svg`,
      },
    },
    keywords: article.tags.join(', '),
    articleSection: article.category,
  };
}

export function generateListingSchema(articles: LabNote[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: articles.map((article, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${siteUrl}/lab-notes/${article.slug}`,
      name: article.title,
    })),
  };
}
