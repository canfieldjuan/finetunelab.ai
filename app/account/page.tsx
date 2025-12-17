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
import { ScheduledEvaluationManager } from "@/components/evaluation/ScheduledEvaluationManager";
import { safeJsonParse } from "@/lib/utils/safe-json";

// Usage Card Component
interface UsageCardProps {
  label: string;
  current: number;
  limit?: number;
  percentage?: number;
  unit?: string;
}

function UsageCard({ label, current, limit = -1, percentage, unit }: UsageCardProps) {
  const isUnlimited = limit === -1;
  const displayLimit = isUnlimited ? '∞' : limit?.toLocaleString();
  const displayCurrent = unit ? `${current.toLocaleString()} ${unit}` : current.toLocaleString();
  const displayLimitWithUnit = unit && !isUnlimited ? `${displayLimit} ${unit}` : displayLimit;

  // Determine progress bar color based on percentage
  const getProgressColor = () => {
    if (isUnlimited || !percentage) return 'bg-primary';
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-primary';
  };

  return (
    <div className="p-4 border border-border rounded-lg bg-background hover:bg-accent/50 transition-colors">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div className="text-2xl font-bold text-foreground mt-1">
        {displayCurrent}
        <span className="text-sm text-muted-foreground font-normal">
          {' '}/ {displayLimitWithUnit}
        </span>
      </div>
      {percentage !== undefined && !isUnlimited && (
        <div className="mt-2">
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className={`${getProgressColor()} h-2 rounded-full transition-all`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {percentage.toFixed(1)}% used
          </div>
        </div>
      )}
    </div>
  );
}

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
    batch_test_runs: number;
    scheduled_eval_runs: number;
    chat_messages: number;
    inference_calls: number;
    compute_minutes: number;
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

        const data = await safeJsonParse(response, { usage: null, limits: null, percentages: null });
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* API & Inference */}
                <UsageCard
                  label="API Calls"
                  current={usage.api_calls || 0}
                  limit={limits.api_calls_per_month}
                  percentage={percentages?.api_calls}
                />
                <UsageCard
                  label="Inference Calls"
                  current={usage.inference_calls || 0}
                  limit={limits.inference_calls_per_month}
                  percentage={percentages?.inference_calls}
                />

                {/* Operations */}
                <UsageCard
                  label="Chat Messages"
                  current={usage.chat_messages || 0}
                  limit={limits.chat_messages_per_month}
                  percentage={percentages?.chat_messages}
                />
                <UsageCard
                  label="Batch Tests"
                  current={usage.batch_test_runs || 0}
                  limit={limits.batch_test_runs_per_month}
                  percentage={percentages?.batch_test_runs}
                />
                <UsageCard
                  label="Scheduled Evals"
                  current={usage.scheduled_eval_runs || 0}
                  limit={limits.scheduled_eval_runs_per_month}
                  percentage={percentages?.scheduled_eval_runs}
                />

                {/* Resources */}
                <UsageCard
                  label="Storage"
                  current={usage.storage_mb || 0}
                  limit={limits.storage_mb}
                  percentage={percentages?.storage}
                  unit="MB"
                />
                <UsageCard
                  label="Models"
                  current={usage.models || 0}
                  limit={limits.models_limit}
                  percentage={percentages?.models}
                />
                <UsageCard
                  label="Compute Time"
                  current={usage.compute_minutes || 0}
                  limit={limits.compute_minutes_per_month}
                  percentage={percentages?.compute_minutes}
                  unit="min"
                />
              </div>

              {/* Hidden metrics (tracking but not displayed prominently) */}
              <details className="mt-6">
                <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                  View additional metrics
                </summary>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Training Jobs</span>
                    <div className="text-lg font-semibold text-foreground mt-1">
                      {usage.training_jobs || 0}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Tokens Used</span>
                    <div className="text-lg font-semibold text-foreground mt-1">
                      {usage.tokens?.toLocaleString() || 0}
                    </div>
                  </div>
                </div>
              </details>
            </div>
          )}

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
