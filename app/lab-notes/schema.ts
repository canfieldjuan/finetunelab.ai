import { LabNote } from "./data";

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
      '@type': 'Organization', // FineTune Lab Team is an org/team
      name: article.author,
    },
    datePublished: article.publishedAt,
    dateModified: article.publishedAt,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://your-domain.com/lab-notes/${article.slug}`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'FineTune Lab',
      logo: {
        '@type': 'ImageObject',
        url: 'https://your-domain.com/logo.png', // TODO: Update this
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
      url: `https://your-domain.com/lab-notes/${article.slug}`,
      name: article.title,
    })),
  };
}
