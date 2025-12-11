"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../components/ui/button";
import { AppSidebar } from "../../components/layout/AppSidebar";
import type {
  SubscriptionPlan,
  UserSubscription,
  UsageMetrics,
  PlanLimits
} from "@/lib/subscriptions/types";
import { PLAN_NAMES } from "@/lib/constants";

export default function AccountPage() {
  const { user, signOut, session } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [usage, setUsage] = useState<UsageMetrics | null>(null);
  const [limits, setLimits] = useState<PlanLimits | null>(null);
  const [percentages, setPercentages] = useState<{
    api_calls: number;
    storage: number;
    models: number;
  } | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [managingSubscription, setManagingSubscription] = useState(false);

  // Fetch user's subscription
  useEffect(() => {
    const fetchSubscription = async () => {
      if (!user || !session?.access_token) {
        console.log('[AccountPage] No user or session, skipping subscription fetch');
        setLoadingSubscription(false);
        return;
      }

      try {
        console.log('[AccountPage] Fetching subscription for user:', user.id);
        const response = await fetch('/api/subscriptions/current', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch subscription');
        }

        const data = await response.json();
        console.log('[AccountPage] Subscription data:', data);

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
        console.log('[AccountPage] No user or session, skipping usage fetch');
        setLoadingUsage(false);
        return;
      }

      try {
        console.log('[AccountPage] Fetching usage for user:', user.id);
        const response = await fetch('/api/usage/current', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch usage');
        }

        const data = await response.json();
        console.log('[AccountPage] Usage data:', data);

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

  const handleUpgrade = async (plan: 'pro' | 'enterprise', billing: 'monthly' | 'yearly' = 'monthly') => {
    if (!session?.access_token) {
      alert('Please log in to upgrade');
      return;
    }

    setUpgrading(true);
    try {
      console.log('[AccountPage] Initiating upgrade:', plan, billing);
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan, billing }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const data = await response.json();
      console.log('[AccountPage] Checkout session created:', data.sessionId);

      // Redirect to Stripe checkout
      window.location.href = data.url;
    } catch (error) {
      console.error('[AccountPage] Error initiating upgrade:', error);
      alert('Failed to initiate upgrade. Please try again.');
      setUpgrading(false);
    }
  };

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
      alert('Failed to open billing portal. Please try again.');
      setManagingSubscription(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    const confirmed = confirm(
      "Are you sure you want to delete your account? This action cannot be undone."
    );

    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      });

      if (res.ok) {
        signOut();
      } else {
        alert("Failed to delete account.");
      }
    } catch (error) {
      console.error("Error deleting account:", error);
      alert("Failed to delete account.");
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
    <div className="flex h-screen overflow-hidden">
      <AppSidebar
        currentPage="account"
        user={user}
        signOut={signOut}
      />

      <main className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-4xl mx-auto p-8">
          <div className="bg-card border rounded-lg shadow-sm p-8">
            <h1 className="text-3xl font-bold text-foreground mb-6">Account Settings</h1>

            {/* User Information Section */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-4">User Information</h2>
              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Email:</span>
                  <div className="text-foreground mt-1">{user.email}</div>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">User ID:</span>
                  <div className="text-foreground mt-1 font-mono text-sm">{user.id}</div>
                </div>
              </div>
            </div>

            {/* Subscription Section */}
            <div className="mb-8 border-t pt-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Subscription</h2>

              {loadingSubscription ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />
                  <span>Loading subscription...</span>
                </div>
              ) : plan ? (
                <div className="space-y-4">
                  {/* Current Plan Badge */}
                  <div className="flex items-center gap-3">
                    <div className={`
                      px-4 py-2 rounded-lg font-semibold text-lg
                      ${plan.name === PLAN_NAMES.FREE ? 'bg-gray-100 text-gray-800' : ''}
                      ${plan.name === PLAN_NAMES.PRO ? 'bg-blue-100 text-blue-800' : ''}
                      ${plan.name === PLAN_NAMES.ENTERPRISE ? 'bg-purple-100 text-purple-800' : ''}
                    `}>
                      {plan.display_name} Plan
                    </div>
                    {subscription?.status === 'active' && (
                      <span className="text-sm text-green-600 font-medium">Active</span>
                    )}
                  </div>

                  {/* Plan Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Price:</span>
                      <div className="text-foreground mt-1">
                        ${plan.price_monthly}/month or ${plan.price_yearly}/year
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Status:</span>
                      <div className="text-foreground mt-1 capitalize">{subscription?.status}</div>
                    </div>
                  </div>

                  {/* Features */}
                  {plan.features && plan.features.length > 0 && (
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Features:</span>
                      <ul className="mt-2 space-y-1">
                        {plan.features.map((feature, idx) => (
                          <li key={idx} className="text-sm text-foreground flex items-center gap-2">
                            <span className="text-green-500">✓</span>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Manage Subscription Button (if on paid plan) */}
                  {plan.name !== PLAN_NAMES.FREE && subscription?.stripe_customer_id && (
                    <div className="pt-4">
                      <Button
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={handleManageSubscription}
                        disabled={managingSubscription}
                      >
                        {managingSubscription ? 'Loading...' : 'Manage Subscription'}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">
                        Update payment method, view invoices, or cancel subscription
                      </p>
                    </div>
                  )}

                  {/* Upgrade Button (if on free plan) */}
                  {plan.name === PLAN_NAMES.FREE && (
                    <div className="pt-4">
                      <Button
                        className="w-full sm:w-auto"
                        onClick={() => handleUpgrade(PLAN_NAMES.PRO, 'monthly')}
                        disabled={upgrading}
                      >
                        {upgrading ? 'Processing...' : 'Upgrade to Pro'}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-muted-foreground">
                  No subscription found. Please contact support.
                </div>
              )}
            </div>

            {/* Usage Section */}
            <div className="mb-8 border-t pt-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Usage & Limits</h2>

              {loadingUsage ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />
                  <span>Loading usage...</span>
                </div>
              ) : usage && limits && percentages ? (
                <div className="space-y-6">
                  {/* API Calls Usage */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-foreground">API Calls</span>
                      <span className="text-sm text-muted-foreground">
                        {usage.api_calls.toLocaleString()} / {limits.api_calls_per_month === -1 ? 'Unlimited' : limits.api_calls_per_month.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full transition-all"
                        style={{ width: `${percentages.api_calls === -1 ? 0 : Math.min(percentages.api_calls, 100)}%` }}
                      />
                    </div>
                    {percentages.api_calls !== -1 && percentages.api_calls > 80 && (
                      <p className="text-xs text-orange-600 mt-1">Warning: Approaching limit</p>
                    )}
                  </div>

                  {/* Storage Usage */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-foreground">Storage</span>
                      <span className="text-sm text-muted-foreground">
                        {usage.storage_mb.toLocaleString()} MB / {limits.storage_mb === -1 ? 'Unlimited' : `${limits.storage_mb.toLocaleString()} MB`}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                      <div
                        className="bg-green-600 h-2.5 rounded-full transition-all"
                        style={{ width: `${percentages.storage === -1 ? 0 : Math.min(percentages.storage, 100)}%` }}
                      />
                    </div>
                    {percentages.storage !== -1 && percentages.storage > 80 && (
                      <p className="text-xs text-orange-600 mt-1">Warning: Approaching limit</p>
                    )}
                  </div>

                  {/* Models Usage */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-foreground">Models</span>
                      <span className="text-sm text-muted-foreground">
                        {usage.models.toLocaleString()} / {limits.models_limit === -1 ? 'Unlimited' : limits.models_limit.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                      <div
                        className="bg-purple-600 h-2.5 rounded-full transition-all"
                        style={{ width: `${percentages.models === -1 ? 0 : Math.min(percentages.models, 100)}%` }}
                      />
                    </div>
                    {percentages.models !== -1 && percentages.models > 80 && (
                      <p className="text-xs text-orange-600 mt-1">Warning: Approaching limit</p>
                    )}
                  </div>

                  {/* Additional Metrics (no limits, just display) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Training Jobs:</span>
                      <div className="text-foreground mt-1 text-lg">{usage.training_jobs.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Tokens Used:</span>
                      <div className="text-foreground mt-1 text-lg">{usage.tokens.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  No usage data available.
                </div>
              )}
            </div>

            {/* Danger Zone */}
            <div className="border-t pt-6">
              <h2 className="text-lg font-semibold text-destructive mb-4">Danger Zone</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Once you delete your account, there is no going back. This will permanently delete all your data.
              </p>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="w-full sm:w-auto"
              >
                {deleting ? "Deleting..." : "Delete Account"}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
