import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  // Hardcode production URL to avoid env var parsing issues
  const baseUrl = 'https://finetunelab.ai';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/account/',
        '/api/',
        '/dashboard/',
        '/chat/',
        '/analytics/',
        '/training/',
        '/datasets/',
        '/models/',
        '/secrets/',
        '/docs/',
        '/inference/',
        '/finetuned-models/',
        '/test-*',  // Block all test pages
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
