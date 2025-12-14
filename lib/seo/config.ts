/**
 * SEO Configuration
 * Central config for sitemap, structured data, and meta tags
 */

export const siteConfig = {
  name: 'Fine Tune Lab',
  url: 'https://finetunelab.ai',
  description: 'Visual DAG-based AI training platform for fine-tuning LLMs locally or in the cloud with real-time telemetry.',
  twitter: '@finetunelab',
  github: 'https://github.com/finetunelab',
};

/**
 * Public pages to include in sitemap
 * Add new public routes here and they'll be auto-included
 */
export const publicPages = [
  // Main pages
  { path: '/', priority: 1.0, changeFreq: 'daily' as const },
  { path: '/welcome', priority: 1.0, changeFreq: 'weekly' as const },

  // Content hubs
  { path: '/lab-notes', priority: 0.9, changeFreq: 'weekly' as const },
  { path: '/lab-academy', priority: 0.9, changeFreq: 'weekly' as const },
  { path: '/case-studies', priority: 0.9, changeFreq: 'weekly' as const },

  // Auth pages (for brand searches)
  { path: '/login', priority: 0.5, changeFreq: 'monthly' as const },
  { path: '/signup', priority: 0.6, changeFreq: 'monthly' as const },
] as const;

/**
 * Organization structured data
 */
export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": siteConfig.name,
  "url": siteConfig.url,
  "logo": `${siteConfig.url}/finetune-lab-icon.svg`,
  "description": siteConfig.description,
  "sameAs": [
    `https://twitter.com/${siteConfig.twitter.replace('@', '')}`,
    siteConfig.github,
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer support",
    "email": "support@finetunelab.ai"
  },
};

/**
 * Website structured data with SearchAction for sitelinks search
 */
export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": siteConfig.name,
  "url": siteConfig.url,
  "description": siteConfig.description,
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": `${siteConfig.url}/lab-academy?q={search_term_string}`
    },
    "query-input": "required name=search_term_string"
  }
};

/**
 * Software Application schema for the platform
 */
export const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": siteConfig.name,
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "Web, Linux, Windows, macOS",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "description": siteConfig.description,
  "featureList": [
    "Visual DAG-based workflow builder",
    "LLM fine-tuning (SFT, DPO, RLHF, ORPO)",
    "Local and cloud training",
    "Real-time telemetry and monitoring",
    "Model evaluation and testing",
    "Multi-provider support (OpenAI, Anthropic, local models)"
  ]
};

/**
 * Generate Article schema for content pages
 */
export function generateArticleSchema(article: {
  title: string;
  description: string;
  slug: string;
  publishedAt: string;
  author: string;
  tags?: string[];
  section?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "description": article.description,
    "author": {
      "@type": "Organization",
      "name": article.author,
      "url": siteConfig.url
    },
    "publisher": {
      "@type": "Organization",
      "name": siteConfig.name,
      "logo": {
        "@type": "ImageObject",
        "url": `${siteConfig.url}/finetune-lab-icon.svg`
      }
    },
    "datePublished": article.publishedAt,
    "dateModified": article.publishedAt,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `${siteConfig.url}/${article.section || 'lab-academy'}/${article.slug}`
    },
    "keywords": article.tags?.join(', '),
    "articleSection": article.section || "AI & Machine Learning"
  };
}

/**
 * Generate FAQ schema for pages with Q&A content
 * This helps get featured in Google's "People also ask" and AI Overviews
 */
export function generateFAQSchema(faqs: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };
}

/**
 * Generate HowTo schema for tutorial content
 * Helps rank for "how to" searches
 */
export function generateHowToSchema(howto: {
  name: string;
  description: string;
  totalTime?: string;
  steps: Array<{ name: string; text: string }>;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": howto.name,
    "description": howto.description,
    "totalTime": howto.totalTime,
    "step": howto.steps.map((step, index) => ({
      "@type": "HowToStep",
      "position": index + 1,
      "name": step.name,
      "text": step.text
    }))
  };
}

/**
 * Generate Breadcrumb schema for navigation
 */
export function generateBreadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": `${siteConfig.url}${item.path}`
    }))
  };
}
