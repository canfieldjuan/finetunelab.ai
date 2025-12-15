import { Metadata } from 'next';
import SignupClient from './SignupClient';

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create your Fine Tune Lab account. From fine-tuning to production monitoring, with real-time telemetry and cloud or local training options.",
  keywords: ["sign up", "create account", "LLM fine-tuning", "AI training platform", "free trial"],
  openGraph: {
    title: "Sign Up | Fine Tune Lab",
    description: "Create your account. From fine-tuning to production monitoring.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Sign Up | Fine Tune Lab",
    description: "Create your account. From fine-tuning to production monitoring.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function SignupPage() {
  return <SignupClient />;
}
