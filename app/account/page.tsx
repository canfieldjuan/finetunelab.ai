/**
 * Account Page - Redesigned with New Pricing Tiers
 * Shows subscription management with beautiful pricing comparison
 */

"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../components/ui/button";
import { PageWrapper } from "../../components/layout/PageWrapper";
import { PageHeader } from "../../components/layout/PageHeader";
import type {
  SubscriptionPlan,
  UserSubscription,
  UsageMetrics,
  PlanLimits
} from "@/lib/subscriptions/types";
import { NotificationSettings } from "@/components/settings/NotificationSettings";

export default function AccountPage() {
  const { user, signOut, session } = useAuth();

  // Subscription state
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);

  // Usage state
  const [usage, setUsage] = useState<UsageMetrics | null>(null);
  const [limits, setLimits] = useState<PlanLimits | null>(null);
  const [percentages, setPercentages] = useState<{
    api_calls: number;
    storage: number;
    models: number;
  } | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);

  // Subscription management state
  const [managingSubscription, setManagingSubscription] = useState(false);

  // Account management
  const [deleting, setDeleting] = useState(false);

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

        const data = await response.json();
        setSubscription(data.subscription);
        setPlan(data.plan);
      } catch (error) {
        console.error('[AccountPage] Error fetching subscription:', error);
      } finally {
        setLoadingSubscription(false);
      }
    };

    fetchSubscription();
  }, [user, session?.access_token]);

  // Fetch user's usage metrics
  useEffect(() => {
    const fetchUsage = async () => {
      if (!user || !session?.access_token) {
        setLoadingUsage(false);
        return;
      }

      try {
        const response = await fetch('/api/usage/current', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch usage');
        }

        const data = await response.json();
        setUsage(data.usage);
        setLimits(data.limits);
        setPercentages(data.percentages);
      } catch (error) {
        console.error('[AccountPage] Error fetching usage:', error);
      } finally {
        setLoadingUsage(false);
      }
    };

    fetchUsage();
  }, [user, session?.access_token]);

  // Handle manage subscription (Stripe portal)
  const handleManageSubscription = async () => {
    if (!session?.access_token) {
      alert('Please log in to manage your subscription');
      return;
    }

    setManagingSubscription(true);
    try {
      console.log('[AccountPage] Opening billing portal');
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[AccountPage] Portal session error:', errorData);
        throw new Error(errorData.error || 'Failed to create portal session');
      }

      const data = await response.json();
      console.log('[AccountPage] Portal session created:', data);

      // Redirect to Stripe billing portal
      window.location.href = data.url;
    } catch (error) {
      console.error('[AccountPage] Error opening portal:', error);
      const message = error instanceof Error ? error.message : 'Failed to open billing portal. Please try again.';
      alert(message);
      setManagingSubscription(false);
    }
  };

  // Handle account deletion
  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This action cannot be undone.'
    );

    if (!confirmed) return;

    setDeleting(true);
    try {
      const response = await fetch('/api/auth/delete-account', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      });

      if (response.ok) {
        alert('Your account has been deleted.');
        await signOut();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account.');
    } finally {
      setDeleting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Please log in to view your account.</p>
      </div>
    );
  }

  return (
    <PageWrapper currentPage="account" user={user} signOut={signOut}>
      <PageHeader
        title="Account Settings"
        description="Manage your subscription, usage, and account settings"
      />

          {/* User Information Card */}
          <div className="bg-card border border-border rounded-lg shadow-sm p-6 mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">User Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium text-muted-foreground">Email</span>
                <div className="text-foreground mt-1">{user.email}</div>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">User ID</span>
                <div className="text-foreground mt-1 font-mono text-sm">{user.id}</div>
              </div>
            </div>
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

          {/* Manage Subscription Button */}
          {!loadingSubscription && plan && plan.name !== 'free_trial' && subscription?.stripe_customer_id && (
            <div className="mb-8">
              <Button
                variant="outline"
                size="lg"
                onClick={handleManageSubscription}
                disabled={managingSubscription}
                className="w-full sm:w-auto"
              >
                {managingSubscription ? 'Opening Billing Portal...' : 'Manage Subscription & Billing'}
              </Button>
            </div>
          )}

          {/* Usage Summary (if loaded) */}
          {!loadingUsage && usage && limits && (
            <div className="bg-card border border-border rounded-lg shadow-sm p-6 mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">Current Usage</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">API Calls</span>
                  <div className="text-2xl font-bold text-foreground mt-1">
                    {usage.api_calls?.toLocaleString() || 0}
                    <span className="text-sm text-muted-foreground font-normal">
                      {' '}/ {limits.api_calls_per_month === -1 ? '∞' : limits.api_calls_per_month?.toLocaleString()}
                    </span>
                  </div>
                  {percentages && (
                    <div className="mt-2 w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${Math.min(percentages.api_calls, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Storage</span>
                  <div className="text-2xl font-bold text-foreground mt-1">
                    {usage.storage_mb?.toLocaleString() || 0} MB
                    <span className="text-sm text-muted-foreground font-normal">
                      {' '}/ {limits.storage_mb === -1 ? '∞' : `${limits.storage_mb?.toLocaleString()} MB`}
                    </span>
                  </div>
                  {percentages && (
                    <div className="mt-2 w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${Math.min(percentages.storage, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Models</span>
                  <div className="text-2xl font-bold text-foreground mt-1">
                    {usage.models || 0}
                    <span className="text-sm text-muted-foreground font-normal">
                      {' '}/ {limits.models_limit === -1 ? '∞' : limits.models_limit}
                    </span>
                  </div>
                  {percentages && (
                    <div className="mt-2 w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${Math.min(percentages.models, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Notification Settings */}
          {session?.access_token && (
            <div className="mb-8">
              <NotificationSettings sessionToken={session.access_token} />
            </div>
          )}

          {/* Danger Zone */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-900 dark:text-red-100 mb-2">Danger Zone</h2>
            <p className="text-sm text-red-700 dark:text-red-300 mb-4">
              Once you delete your account, there is no going back. Please be certain.
            </p>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Account'}
            </Button>
          </div>
    </PageWrapper>
  );
}
