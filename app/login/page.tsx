import { Metadata } from 'next';
import dynamic from 'next/dynamic';

const LoginClient = dynamic(() => import('./LoginClient'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center">Loading...</div>
  ),
});

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to Fine Tune Lab to access your AI training dashboard, manage models, and monitor fine-tuning jobs.",
  openGraph: {
    title: "Login | Fine Tune Lab",
    description: "Sign in to access your AI training dashboard and fine-tuning tools.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Login | Fine Tune Lab",
    description: "Sign in to access your AI training dashboard and fine-tuning tools.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function LoginPage() {
  return <LoginClient />;
}
