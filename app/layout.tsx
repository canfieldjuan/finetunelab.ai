import type { Metadata } from "next";
import "../styles/globals.css";
import { AuthProvider } from "../contexts/AuthContext";
import { WorkspaceProvider } from "../contexts/WorkspaceContext";
import { Inter } from "next/font/google";
// import { LoggerInit } from "../components/LoggerInit"; // Temporarily disabled

// Hardcode production URL to avoid env var parsing issues
const siteUrl = 'https://finetunelab.ai';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Fine Tune Lab - From Fine-Tuning to Production Monitoring",
    template: "%s | Fine Tune Lab",
  },
  description: "AI training platform for fine-tuning LLMs with RunPod cloud GPUs, GraphRAG knowledge integration, automated evaluation, and real-time analytics. Train models with SFT, DPO, RLHF, and deploy with confidence.",
  keywords: ["AI training platform", "LLM fine-tuning", "GraphRAG", "RunPod training", "model evaluation", "RLHF", "DPO", "SFT", "LLM analytics", "batch testing", "A/B model comparison"],
  authors: [{ name: "Fine Tune Lab Team" }],
  creator: "Fine Tune Lab",
  publisher: "Fine Tune Lab",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Fine Tune Lab",
    title: "Fine Tune Lab - From Fine-Tuning to Production Monitoring",
    description: "AI training platform for fine-tuning LLMs with RunPod cloud GPUs, GraphRAG knowledge integration, automated evaluation, and real-time analytics.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fine Tune Lab - From Fine-Tuning to Production Monitoring",
    description: "AI training platform for fine-tuning LLMs with RunPod cloud GPUs, GraphRAG knowledge integration, automated evaluation, and real-time analytics.",
    creator: "@finetunelab",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

// Organization JSON-LD for site-wide structured data
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Fine Tune Lab",
  "url": "https://finetunelab.ai",
  "logo": "https://finetunelab.ai/finetune-lab-icon.svg",
  "description": "AI training platform for fine-tuning and testing LLMs with real-time analytics, GraphRAG knowledge integration, and automated evaluation workflows.",
  "sameAs": [
    "https://twitter.com/finetunelab",
    "https://github.com/finetunelab",
    "https://www.linkedin.com/company/finetunelab"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer support",
    "email": "support@finetunelab.ai"
  },
  "offers": {
    "@type": "Offer",
    "description": "AI training and fine-tuning platform",
    "price": "0",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock"
  }
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Fine Tune Lab",
  "url": "https://finetunelab.ai",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://finetunelab.ai/lab-academy?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body className={`${inter.className} h-full`} suppressHydrationWarning>
        {/* <LoggerInit /> */}
        <AuthProvider>
          <WorkspaceProvider>
            {children}
          </WorkspaceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
