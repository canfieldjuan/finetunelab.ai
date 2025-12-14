"use client";
import React, { Suspense, useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Separator } from "../../components/ui/separator";
import { FineTuneLabFullLogoV2 } from "@/components/branding";
import { ArrowLeft, Building2 } from "lucide-react";

function LoginForm() {
  const { signIn, signInWithOAuth, signInWithSSO, loading, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // SSO flow state
  const [showSSOFlow, setShowSSOFlow] = useState(false);
  const [ssoEmail, setSsoEmail] = useState("");
  const [ssoSubmitting, setSsoSubmitting] = useState(false);

  // Get message from URL params (for signup redirect)
  const message = searchParams?.get("message");

  // Redirect if already logged in
  useEffect(() => {
    console.log('[Login] Auth state - user:', user?.email, 'loading:', loading);
    if (user && !loading) {
      console.log('[Login] User already logged in, redirecting to chat');
      router.push("/chat");
    }
  }, [user, loading, router]);

  async function handleOAuthSignIn(provider: 'github' | 'google') {
    console.log('[Login] OAuth sign in with:', provider);
    setError(null);

    // Request 'gist' scope for GitHub to enable Gist creation for Colab notebooks
    const scopes = provider === 'github' ? ['gist'] : undefined;
    console.log('[Login] Requesting scopes:', scopes);

    const { error } = await signInWithOAuth(provider, scopes);
    if (error) {
      console.error('[Login] OAuth failed:', error);
      setError(error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log('[Login] Attempting login for:', email);
    setSubmitting(true);
    setError(null);
    const { error } = await signIn(email, password);
    if (error) {
      console.error('[Login] Login failed:', error);
      setError(error);
    } else {
      console.log('[Login] Login successful, redirecting to chat');
      // Redirect to chat after successful login
      router.push("/chat");
    }
    setSubmitting(false);
  }

  async function handleSSOSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate email format
    if (!ssoEmail || !ssoEmail.includes('@')) {
      setError('Please enter a valid work email address');
      return;
    }

    // Extract domain from email
    const domain = ssoEmail.split('@')[1];
    if (!domain) {
      setError('Please enter a valid work email address');
      return;
    }

    console.log('[Login] SSO sign in for domain:', domain);
    setSsoSubmitting(true);

    const { error, url } = await signInWithSSO(domain);

    if (error) {
      console.error('[Login] SSO failed:', error);
      setError(error);
      setSsoSubmitting(false);
      return;
    }

    // Redirect to IdP
    if (url) {
      console.log('[Login] Redirecting to IdP:', url);
      window.location.href = url;
    } else {
      setError('Failed to get SSO redirect URL. Please try again.');
      setSsoSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-card rounded-lg border border-border shadow-sm">
      <div className="flex flex-col items-center mb-6">
        <FineTuneLabFullLogoV2 width={240} height={72} className="mb-4" />
        <h1 className="text-2xl font-semibold tracking-tight">Login</h1>
      </div>
      {message && (
        <Alert className="mb-6">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {/* SSO Flow */}
      {showSSOFlow ? (
        <>
          <button
            onClick={() => {
              setShowSSOFlow(false);
              setError(null);
              setSsoEmail("");
            }}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login options
          </button>

          <form onSubmit={handleSSOSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sso-email">Work Email</Label>
              <Input
                id="sso-email"
                type="email"
                placeholder="you@company.com"
                value={ssoEmail}
                onChange={e => setSsoEmail(e.target.value)}
                autoComplete="email"
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Enter your work email and we&apos;ll redirect you to your company&apos;s login page.
              </p>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={ssoSubmitting}
            >
              {ssoSubmitting ? "Redirecting..." : "Continue with SSO"}
            </Button>
          </form>
        </>
      ) : (
        <>
          {/* OAuth and SSO Buttons */}
          <div className="space-y-3 mb-6">
            <Button
              onClick={() => handleOAuthSignIn('github')}
              className="w-full bg-gray-50 hover:bg-gray-100"
              variant="outline"
              type="button"
            >
              Continue with GitHub
            </Button>

            <Button
              onClick={() => handleOAuthSignIn('google')}
              className="w-full bg-gray-50 hover:bg-gray-100"
              variant="outline"
              type="button"
            >
              Continue with Google
            </Button>

            <Button
              onClick={() => {
                setShowSSOFlow(true);
                setError(null);
              }}
              className="w-full bg-gray-50 hover:bg-gray-100"
              variant="outline"
              type="button"
            >
              <Building2 className="h-4 w-4 mr-2" />
              Sign in with SSO
            </Button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-card text-muted-foreground">Or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={submitting || loading}
            >
              {submitting ? "Logging in..." : "Login"}
            </Button>
          </form>
          <p className="text-center mt-4">
            Don&apos;t have an account?{" "}
            <a href="/signup" className="text-primary hover:underline">
              Sign up
            </a>
          </p>
        </>
      )}
      </div>
    </div>
  );
}

export default function LoginClient() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
