import { Metadata } from 'next';
import dynamic from 'next/dynamic';

const HomeRedirect = dynamic(() => import('./HomeRedirect'), {
  ssr: false,
  loading: () => (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </main>
  ),
});

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
