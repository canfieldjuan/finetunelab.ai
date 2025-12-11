/**
 * Upgrade Confirmation Modal
 * Shows plan details and confirms upgrade before redirecting to Stripe
 */

'use client';

import { AlertCircle, Check, X, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PLANS, calculateTotalPrice, getSeatYearlySavings, type PlanTier } from '@/lib/pricing/config';

interface UpgradeConfirmationModalProps {
  isOpen: boolean;
  targetPlan: PlanTier;
  billingInterval: 'monthly' | 'yearly';
  seats: number;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export function UpgradeConfirmationModal({
  isOpen,
  targetPlan,
  billingInterval,
  seats,
  onConfirm,
  onCancel,
  isProcessing = false,
}: UpgradeConfirmationModalProps) {
  if (!isOpen) return null;

  const plan = PLANS[targetPlan];
  const basePrice = billingInterval === 'monthly' ? plan.pricing.monthly : plan.pricing.yearly;
  const totalPrice = calculateTotalPrice(plan, billingInterval, seats);
  const interval = billingInterval === 'monthly' ? 'month' : 'year';
  const seatSavings = billingInterval === 'yearly' ? getSeatYearlySavings(plan, seats) : 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 relative">
          {/* Close Button */}
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full">
              <AlertCircle className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mb-2">
            Upgrade to {plan.name}?
          </h2>

          {/* Subtitle */}
          <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
            You&apos;re about to upgrade your subscription
          </p>

          {/* Plan Details */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-gray-600 dark:text-gray-400">Plan</span>
              <span className="font-semibold">{plan.name}</span>
            </div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-gray-600 dark:text-gray-400">Billing</span>
              <span className="font-semibold capitalize">{billingInterval}</span>
            </div>
            {plan.pricing.seatPrice && (
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  Users
                </span>
                <span className="font-semibold">{seats} {seats === 1 ? 'user' : 'users'}</span>
              </div>
            )}
            {plan.pricing.seatPrice && seats > 1 && (
              <>
                <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-500 mb-1">
                  <span>Base price</span>
                  <span>${basePrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-500 mb-3">
                  <span>{seats - 1} additional seat{seats > 2 ? 's' : ''}</span>
                  <span>
                    ${((totalPrice - basePrice).toLocaleString())}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total</span>
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                ${totalPrice.toLocaleString()}/{interval}
              </span>
            </div>
            {seatSavings > 0 && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-2 text-right">
                Saving ${seatSavings.toLocaleString()}/year on seats!
              </p>
            )}
          </div>

          {/* What You Get */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3 text-sm text-gray-700 dark:text-gray-300">
              What you&apos;ll get:
            </h3>
            <ul className="space-y-2">
              {plan.features.features.slice(0, 5).map((feature, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Important Note */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-6">
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              <strong>Note:</strong> You&apos;ll be redirected to Stripe to complete your payment securely.
              Your subscription will activate immediately after payment.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={onCancel}
              variant="outline"
              className="flex-1"
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : `Upgrade for $${totalPrice.toLocaleString()}/${interval}`}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
