import { LandingPage } from '@/components/landing';
import { Metadata } from 'next';

// Force static generation - landing page is fully static content
export const dynamic = 'force-static';

// Revalidate every hour to pick up any content changes
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Fine Tune Lab - From Fine-Tuning to Production Monitoring",
  description: "From fine-tuning to production monitoring. Train, evaluate, and deploy LLMs locally or in the cloud with real-time telemetry.",
  keywords: ["AI training", "LLM fine-tuning", "production monitoring", "Graph RAG", "Local LLM", "vLLM", "Ollama", "AI analytics", "RLHF", "DPO"],
  openGraph: {
    title: "Fine Tune Lab - From Fine-Tuning to Production Monitoring",
    description: "From fine-tuning to production monitoring. Train, evaluate, and deploy LLMs locally or in the cloud with real-time telemetry.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fine Tune Lab - From Fine-Tuning to Production Monitoring",
    description: "From fine-tuning to production monitoring. Train, evaluate, and deploy LLMs locally or in the cloud with real-time telemetry.",
  }
};

export default function WelcomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "name": "Fine Tune Lab",
        "applicationCategory": "DeveloperApplication",
        "operatingSystem": "Web, Linux, Windows, macOS",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        },
        "description": "A visual DAG-based platform that unifies training, evaluation, deployment, and real-world analytics for LLMs."
      },
      {
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "How long does setup take?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "5 minutes. Add 1 line of JavaScript to your site. No backend integration required. Works with any AI provider (OpenAI, Anthropic, AWS Bedrock, Azure, local models)."
            }
          },
          {
            "@type": "Question",
            "name": "Does it work with my AI provider?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. We're provider-agnostic. Works with OpenAI, Anthropic Claude, AWS Bedrock, Azure OpenAI, Google Vertex AI, Cohere, local models (Ollama, vLLM), and custom endpoints."
            }
          },
          {
            "@type": "Question",
            "name": "Is my customer data secure?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Absolutely. Multi-tenant data isolation, PII filtering built-in, SOC 2 Type II compliant, GDPR ready, data encrypted at rest and in transit. You can also self-host for maximum control."
            }
          },
          {
            "@type": "Question",
            "name": "What if I have low traffic?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Our Starter plan includes 10,000 conversations/month for just $49. Perfect for early-stage products. Upgrade as you grow."
            }
          },
          {
            "@type": "Question",
            "name": "Can I cancel anytime?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. No contracts. No lock-in. Cancel with one click. Export all your data before you go."
            }
          },
          {
            "@type": "Question",
            "name": "Do I need to be technical?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "No. Copy/paste the widget code (1 line). Everything else is UI-based—no SQL, no coding. Our natural language analytics chat lets you ask questions in plain English."
            }
          },
          {
            "@type": "Question",
            "name": "What formats can I export training data in?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "JSONL, CSV, Parquet. We support DPO (Direct Preference Optimization), RLHF (Reinforcement Learning from Human Feedback), and SFT (Supervised Fine-Tuning) formats out of the box."
            }
          },
          {
            "@type": "Question",
            "name": "Can I try before buying?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes! 14-day free trial. No credit card required. Full access to all features. Experience the complete platform risk-free."
            }
          },
          {
            "@type": "Question",
            "name": "How is this different from LangSmith or Weights & Biases?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "They focus on ML experiment tracking. We focus on the complete production-to-training loop: embed widget → capture conversations → human ratings → 7 advanced analytics → export training data → retrain → measure improvement."
            }
          },
          {
            "@type": "Question",
            "name": "What about Heap or Mixpanel?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "They're product analytics tools—they don't support human ratings, training data export, or AI-specific quality metrics. We're built specifically for AI quality intelligence."
            }
          },
          {
            "@type": "Question",
            "name": "Can I use this for local/on-prem models?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes! Works with any model that has an API endpoint—cloud providers, local models (Ollama, vLLM), or your own custom-trained models."
            }
          },
          {
            "@type": "Question",
            "name": "Do you offer enterprise plans?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Our Enterprise plan ($999/mo) includes unlimited conversations, dedicated support, SLA guarantees, and custom integrations. Contact us for volume discounts."
            }
          }
        ]
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage />
    </>
  );
}
