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
  UserSubscription
} from "@/lib/subscriptions/types";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { ScheduledEvaluationManager } from "@/components/evaluation/ScheduledEvaluationManager";
import { UsageDashboard } from "@/components/billing/UsageDashboard";
import { TierSelector } from "@/components/billing/TierSelector";
import { UsageHistoryChart, type MonthlyUsage } from "@/components/billing/UsageHistoryChart";
import { InvoiceHistoryTable, type Invoice } from "@/components/billing/InvoiceHistoryTable";
import { safeJsonParse } from "@/lib/utils/safe-json";
import type { UsageTier } from "@/lib/pricing/usage-based-config";

// DEPRECATED: UsageCard component removed - no longer using OLD subscription-based usage tracking

export default function AccountPage() {
  const { user, signOut, session } = useAuth();

  // Subscription state
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);

  // DEPRECATED: OLD usage tracking system removed
  // Now using usage_meters table via /api/billing/usage

  // Subscription management state
  const [managingSubscription, setManagingSubscription] = useState(false);

  // Usage-based pricing state
  const [currentTier, setCurrentTier] = useState<UsageTier | undefined>(undefined);
  const [showTierSelector, setShowTierSelector] = useState(false);
  const [usageHistory, setUsageHistory] = useState<MonthlyUsage[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(true);

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

        const data = await safeJsonParse(response, { subscription: null, plan: null });
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

  // DEPRECATED: Removed fetchUsage - now using /api/billing/usage

  // Fetch usage history
  useEffect(() => {
    const fetchUsageHistory = async () => {
      if (!user || !session?.access_token) {
        setLoadingHistory(false);
        return;
      }

      try {
        const response = await fetch('/api/billing/usage-history', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const data = await safeJsonParse(response, { history: [] });
          console.log('[AccountPage] Usage history received:', data.history?.length || 0, 'months');
          setUsageHistory(data.history);
        } else {
          console.error('[AccountPage] Failed to fetch usage history:', response.status);
        }
      } catch (error) {
        console.error('[AccountPage] Error fetching usage history:', error);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchUsageHistory();
  }, [user, session?.access_token]);

  // Fetch invoices
  useEffect(() => {
    const fetchInvoices = async () => {
      if (!user || !session?.access_token) {
        setLoadingInvoices(false);
        return;
      }

      try {
        const response = await fetch('/api/billing/invoices', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const data = await safeJsonParse(response, { invoices: [] });
          setInvoices(data.invoices);
        }
      } catch (error) {
        console.error('[AccountPage] Error fetching invoices:', error);
      } finally {
        setLoadingInvoices(false);
      }
    };

    fetchInvoices();
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
        const errorData = await safeJsonParse(response, { error: 'Failed to create portal session' });
        console.error('[AccountPage] Portal session error:', errorData);
        throw new Error(errorData.error || 'Failed to create portal session');
      }

      const data = await safeJsonParse(response, { url: '' });
      console.log('[AccountPage] Portal session created:', data);

      // Redirect to Stripe billing portal
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No portal URL returned');
      }
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
        const error = await safeJsonParse(response, { error: 'Failed to delete account' });
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

          {/* Usage-Based Pricing Dashboard */}
          {session?.access_token && (
            <div className="mb-8">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-foreground">Usage & Billing</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Real-time usage tracking and cost estimation
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowTierSelector(!showTierSelector)}
                >
                  {showTierSelector ? 'Hide Tiers' : 'Change Tier'}
                </Button>
              </div>
              <UsageDashboard 
                sessionToken={session.access_token}
                onTierLoaded={(tier: UsageTier | undefined) => setCurrentTier(tier)}
              />
              
              {showTierSelector && (
                <div className="mt-8 pt-8 border-t border-border">
                  <TierSelector
                    currentTier={currentTier}
                    sessionToken={session.access_token}
                    onTierSelect={(tier) => {
                      console.log('[AccountPage] Tier selected:', tier);
                      setShowTierSelector(false);
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Usage Analytics */}
          {session?.access_token && (
            <div className="mb-8">
              <div className="mb-4">
                <h2 className="text-2xl font-semibold text-foreground">Usage Analytics</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Historical trends and invoice history
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <UsageHistoryChart data={usageHistory} loading={loadingHistory} />
                <InvoiceHistoryTable invoices={invoices} loading={loadingInvoices} />
              </div>
            </div>
          )}

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

          {/* DEPRECATED: Removed "Current Usage" section - now using Usage & Billing card above */}

          {/* Notification Settings */}
          {session?.access_token && (
            <div className="mb-8">
              <NotificationSettings sessionToken={session.access_token} />
            </div>
          )}

          {/* Scheduled Evaluations */}
          <div className="mb-8">
            <ScheduledEvaluationManager />
          </div>

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
