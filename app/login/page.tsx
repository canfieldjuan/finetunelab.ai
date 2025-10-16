"use client";
import React, { Suspense, useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Separator } from "../../components/ui/separator";

function LoginClient() {
  const { signIn, signInWithOAuth, loading, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    const { error } = await signInWithOAuth(provider);
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

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-card rounded-lg border shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Login</h1>
      {message && (
        <Alert className="mb-6">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3 mb-6">
        <Button
          onClick={() => handleOAuthSignIn('github')}
          className="w-full"
          variant="default"
          type="button"
        >
          Continue with GitHub
        </Button>

        <Button
          onClick={() => handleOAuthSignIn('google')}
          className="w-full"
          variant="outline"
          type="button"
        >
          Continue with Google
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
          className="w-full"
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
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <LoginClient />
    </Suspense>
  );
}
