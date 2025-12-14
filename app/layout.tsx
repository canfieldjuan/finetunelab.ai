import type { Metadata } from "next";
import "../styles/globals.css";
import { AuthProvider } from "../contexts/AuthContext";
import { WorkspaceProvider } from "../contexts/WorkspaceContext";
import { Inter } from "next/font/google";
// import { LoggerInit } from "../components/LoggerInit"; // Temporarily disabled

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://finetunelab.ai';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Fine Tune Lab - Visual DAG-Based AI Training Platform",
    template: "%s | Fine Tune Lab",
  },
  description: "Unify training, evaluation, and deployment with a visual DAG builder. Fine-tune LLMs locally or in the cloud with real-time telemetry.",
  keywords: ["AI training", "LLM fine-tuning", "DAG builder", "MLOps", "model evaluation", "RLHF", "DPO", "SFT", "local LLM", "vLLM", "Ollama"],
  authors: [{ name: "Fine Tune Lab Team" }],
  creator: "Fine Tune Lab",
  publisher: "Fine Tune Lab",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Fine Tune Lab",
    title: "Fine Tune Lab - Visual DAG-Based AI Training Platform",
    description: "Unify training, evaluation, and deployment with a visual DAG builder. Fine-tune LLMs locally or in the cloud with real-time telemetry.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fine Tune Lab - Visual DAG-Based AI Training Platform",
    description: "Unify training, evaluation, and deployment with a visual DAG builder. Fine-tune LLMs locally or in the cloud with real-time telemetry.",
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
  "description": "Visual DAG-based AI training platform for fine-tuning LLMs locally or in the cloud with real-time telemetry.",
  "sameAs": [
    "https://twitter.com/finetunelab",
    "https://github.com/finetunelab"
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
