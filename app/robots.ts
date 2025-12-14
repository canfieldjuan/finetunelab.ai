import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://finetunelab.ai';

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
