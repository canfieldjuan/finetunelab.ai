/**
 * Upgrade Cancel Page
 * Displayed when user cancels Stripe checkout
 */

'use client';

import { useRouter } from 'next/navigation';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function UpgradeCancelPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Cancel Icon */}
        <div className="flex justify-center">
          <XCircle className="w-20 h-20 text-orange-500" />
        </div>

        {/* Cancel Message */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            Upgrade Cancelled
          </h1>
          <p className="text-muted-foreground">
            Your payment was cancelled. No charges were made to your account.
          </p>
        </div>

        {/* Info */}
        <div className="bg-muted p-4 rounded-lg text-sm text-muted-foreground">
          You can upgrade anytime from your account settings. Your current plan remains active.
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={() => router.push('/account')}
            className="w-full"
          >
            Back to Account
          </Button>
          <Button
            onClick={() => router.push('/')}
            variant="outline"
            className="w-full"
          >
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
