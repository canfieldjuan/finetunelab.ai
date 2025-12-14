import { Metadata } from 'next';
import dynamic from 'next/dynamic';

const SignupClient = dynamic(() => import('./SignupClient'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center">Loading...</div>
  ),
});

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create your Fine Tune Lab account. Start fine-tuning LLMs with our visual DAG builder, real-time monitoring, and cloud or local training options.",
  keywords: ["sign up", "create account", "LLM fine-tuning", "AI training platform", "free trial"],
  openGraph: {
    title: "Sign Up | Fine Tune Lab",
    description: "Create your account and start fine-tuning LLMs with our visual DAG builder.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Sign Up | Fine Tune Lab",
    description: "Create your account and start fine-tuning LLMs with our visual DAG builder.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function SignupPage() {
  return <SignupClient />;
}
