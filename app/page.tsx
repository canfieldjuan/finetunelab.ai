import { Metadata } from 'next';
import HomeRedirect from './HomeRedirect';

export const metadata: Metadata = {
  title: "Fine Tune Lab - From Fine-Tuning to Production Monitoring",
  description: "From fine-tuning to production monitoring. Train, evaluate, and deploy LLMs locally or in the cloud with real-time telemetry.",
  openGraph: {
    title: "Fine Tune Lab - From Fine-Tuning to Production Monitoring",
    description: "From fine-tuning to production monitoring. Train, evaluate, and deploy LLMs locally or in the cloud with real-time telemetry.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fine Tune Lab - From Fine-Tuning to Production Monitoring",
    description: "From fine-tuning to production monitoring. Train, evaluate, and deploy LLMs locally or in the cloud with real-time telemetry.",
  },
};

export default function HomePage() {
  return <HomeRedirect />;
}
