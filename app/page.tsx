import { Metadata } from 'next';
import HomeRedirect from './HomeRedirect';

export const metadata: Metadata = {
  title: "Fine Tune Lab - Visual DAG-Based AI Training Platform",
  description: "Unify training, evaluation, and deployment with a visual DAG builder. Fine-tune LLMs locally or in the cloud with real-time telemetry.",
  openGraph: {
    title: "Fine Tune Lab - Visual DAG-Based AI Training Platform",
    description: "Unify training, evaluation, and deployment with a visual DAG builder. Fine-tune LLMs locally or in the cloud with real-time telemetry.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fine Tune Lab - Visual DAG-Based AI Training Platform",
    description: "Unify training, evaluation, and deployment with a visual DAG builder. Fine-tune LLMs locally or in the cloud with real-time telemetry.",
  },
};

export default function HomePage() {
  return <HomeRedirect />;
}
