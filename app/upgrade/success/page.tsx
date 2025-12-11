/**
 * Upgrade Success Page
 * Displayed after successful Stripe checkout
 */

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

function UpgradeSuccessPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get('session_id');
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    console.log('[UpgradeSuccess] Checkout session:', sessionId);
  }, [sessionId]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) {
      router.push('/account');
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Success Icon */}
        <div className="flex justify-center">
          <CheckCircle className="w-20 h-20 text-green-500" />
        </div>

        {/* Success Message */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            Payment Successful!
          </h1>
          <p className="text-muted-foreground">
            Your subscription has been activated. Thank you for upgrading!
          </p>
        </div>

        {/* Countdown */}
        <div className="text-sm text-muted-foreground">
          Redirecting to your account in {countdown} seconds...
        </div>

        {/* Manual Button */}
        <Button
          onClick={() => router.push('/account')}
          className="w-full"
        >
          Go to Account Now
        </Button>

        {/* Session ID (for debugging) */}
        {sessionId && (
          <p className="text-xs text-muted-foreground font-mono">
            Session: {sessionId.substring(0, 20)}...
          </p>
        )}
      </div>
    </div>
  );
}

export default function UpgradeSuccessPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <UpgradeSuccessPageContent />
    </Suspense>
  );
}
