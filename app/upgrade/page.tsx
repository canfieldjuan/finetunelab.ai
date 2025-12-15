/**
 * Upgrade Page - Subscription Management and Pricing
 * Displays pricing tiers and allows users to upgrade their subscription
 */

"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { AppSidebar } from "../../components/layout/AppSidebar";
import { PricingTiers } from "../../components/pricing/PricingTiers";
import { UpgradeConfirmationModal } from "../../components/pricing/UpgradeConfirmationModal";
import { ContactSalesModal } from "../../components/pricing/ContactSalesModal";
import type { PlanTier } from "@/lib/pricing/config";
import type {
  SubscriptionPlan,
  UserSubscription,
} from "@/lib/subscriptions/types";
import { PLAN_NAMES } from "@/lib/constants";
import { safeJsonParse } from "@/lib/utils/safe-json";

export default function UpgradePage() {
  const { user, signOut, session } = useAuth();

  // Subscription state
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);

  // Modal state
  const [showUpgradeConfirmation, setShowUpgradeConfirmation] = useState(false);
  const [showContactSales, setShowContactSales] = useState(false);
  const [selectedTier, setSelectedTier] = useState<PlanTier>(PLAN_NAMES.PRO);
  const [selectedBilling, setSelectedBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedSeats, setSelectedSeats] = useState(1);
  const [upgrading, setUpgrading] = useState(false);

  // Fetch user's subscription
  useEffect(() => {
    const fetchSubscription = async () => {
      if (!user || !session?.access_token) {
        setLoadingSubscription(false);
        return;
      }

      try {
        const response = await fetch('/api/subscriptions/current', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch subscription');
        }

        const data = await safeJsonParse(response, { subscription: null, plan: null });
        setSubscription(data.subscription);
        setPlan(data.plan);
      } catch (error) {
        console.error('[UpgradePage] Error fetching subscription:', error);
      } finally {
        setLoadingSubscription(false);
      }
    };

    fetchSubscription();
  }, [user, session?.access_token]);

  // Handle upgrade click
  const handleUpgrade = (tier: PlanTier, billing: 'monthly' | 'yearly', seats: number) => {
    console.log('[UpgradePage] Upgrade requested:', tier, billing, seats, 'users');
    setSelectedTier(tier);
    setSelectedBilling(billing);
    setSelectedSeats(seats);
    setShowUpgradeConfirmation(true);
  };

  // Confirm upgrade and redirect to Stripe
  const confirmUpgrade = async () => {
    if (!session?.access_token) {
      alert('Please log in to upgrade');
      return;
    }

    setUpgrading(true);
    try {
      console.log('[UpgradePage] Creating checkout session for:', {
        plan: selectedTier,
        billing: selectedBilling,
        seats: selectedSeats,
      });

      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          plan: selectedTier,
          billing: selectedBilling,
          seats: selectedSeats,
        }),
      });

      if (!response.ok) {
        const errorData = await safeJsonParse(response, { error: 'Failed to create checkout session' });
        console.error('[UpgradePage] Checkout error:', errorData);
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const data = await safeJsonParse(response, { url: '' });
      console.log('[UpgradePage] Checkout session created:', data);

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('[UpgradePage] Error creating checkout:', error);
      const message = error instanceof Error ? error.message : 'Failed to start checkout. Please try again.';
      alert(message);
      setUpgrading(false);
      setShowUpgradeConfirmation(false);
    }
  };

  // Handle contact sales
  const handleContactSales = () => {
    console.log('[UpgradePage] Contact sales clicked');
    setShowContactSales(true);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Please log in to view upgrade options.</p>
      </div>
    );
  }

  const currentPlan: PlanTier = (plan?.name as PlanTier) || PLAN_NAMES.FREE_TRIAL;

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar
        currentPage="upgrade"
        user={user}
        signOut={signOut}
      />

      <main className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-7xl mx-auto p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">Upgrade Your Subscription</h1>
            <p className="text-muted-foreground">
              Unlock powerful features and capabilities. Upgrade or downgrade anytime.
            </p>
          </div>

          {/* Current Plan Summary */}
          {!loadingSubscription && plan && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border rounded-lg p-6 mb-8">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-1">
                    Current Plan: {plan.display_name}
                  </h2>
                  <p className="text-muted-foreground">
                    {subscription?.status === 'active' && '✓ Active'}
                    {subscription?.trial_ends_at && ` • Trial ends ${new Date(subscription.trial_ends_at).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Pricing Tiers */}
          <div className="bg-card border border-border rounded-lg shadow-sm p-8">
            <PricingTiers
              currentPlan={currentPlan}
              onUpgrade={handleUpgrade}
              onContactSales={handleContactSales}
            />
          </div>
        </div>
      </main>

      {/* Modals */}
      <UpgradeConfirmationModal
        isOpen={showUpgradeConfirmation}
        targetPlan={selectedTier}
        billingInterval={selectedBilling}
        seats={selectedSeats}
        onConfirm={confirmUpgrade}
        onCancel={() => setShowUpgradeConfirmation(false)}
        isProcessing={upgrading}
      />

      <ContactSalesModal
        isOpen={showContactSales}
        onClose={() => setShowContactSales(false)}
      />
    </div>
  );
}
