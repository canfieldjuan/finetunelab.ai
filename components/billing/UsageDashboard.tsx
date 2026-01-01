/**
 * UsageDashboard Component
 * Main container for usage-based pricing UI
 * Fetches and displays real-time usage, cost, and warnings
 */

"use client";

import React, { useEffect, useState } from "react";
import { UsageMeterCard } from "./UsageMeterCard";
import { CostEstimatorCard } from "./CostEstimatorCard";
import { UsageWarningBanner } from "./UsageWarningBanner";

interface UsageData {
  period: {
    month: number;
    year: number;
  };
  tier: string;
  usage: {
    rootTraces: number;
    includedTraces: number;
    overageTraces: number;
    payloadGb: number;
    includedPayloadGb: number;
    overagePayloadGb: number;
    retentionDays: number;
  };
  cost: {
    baseMinimum: number;
    traceOverage: number;
    payloadOverage: number;
    retentionMultiplier: number;
    estimatedTotal: number;
  };
  warnings: {
    traceWarning: boolean;
    payloadWarning: boolean;
    traceUsagePercent: number;
    payloadUsagePercent: number;
  };
  lastUpdated: string;
}

interface UsageDashboardProps {
  sessionToken: string;
  onTierLoaded?: (tier: string) => void;
}

export function UsageDashboard({ sessionToken, onTierLoaded }: UsageDashboardProps) {
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const response = await fetch("/api/billing/usage", {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch usage data");
        }

        const data = await response.json();
        setUsageData(data);
        setError(null);
        
        if (onTierLoaded && data.tier) {
          onTierLoaded(data.tier);
        }
      } catch (err) {
        console.error("[UsageDashboard] Error fetching usage:", err);
        setError(err instanceof Error ? err.message : "Failed to load usage data");
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-48 bg-muted animate-pulse rounded-lg" />
          <div className="h-48 bg-muted animate-pulse rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !usageData) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
          Error Loading Usage Data
        </h3>
        <p className="text-sm text-red-700 dark:text-red-300">
          {error || "Unable to load usage information. Please try again later."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <UsageWarningBanner warnings={usageData.warnings} tier={usageData.tier} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UsageMeterCard
              label="Root Traces"
              description="Monitored requests this period"
              current={usageData.usage.rootTraces}
              included={usageData.usage.includedTraces}
              overage={usageData.usage.overageTraces}
              unit="traces"
              icon={
                <svg
                  className="w-4 h-4 inline"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              }
            />

            <UsageMeterCard
              label="Payload Storage"
              description="Compressed trace data stored"
              current={usageData.usage.payloadGb}
              included={usageData.usage.includedPayloadGb}
              overage={usageData.usage.overagePayloadGb}
              unit="GB"
              icon={
                <svg
                  className="w-4 h-4 inline"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                  />
                </svg>
              }
            />
          </div>

          <div className="mt-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Retention Period</span>
              <span className="font-medium">
                {usageData.usage.retentionDays} days
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-muted-foreground">Last Updated</span>
              <span className="font-medium">
                {new Date(usageData.lastUpdated).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div>
          <CostEstimatorCard
            tier={usageData.tier}
            cost={usageData.cost}
            periodMonth={usageData.period.month}
            periodYear={usageData.period.year}
          />
        </div>
      </div>
    </div>
  );
}
