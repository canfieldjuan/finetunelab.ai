/**
 * CostEstimatorCard Component
 * Shows real-time cost breakdown with base + overage charges
 */

"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CostBreakdown {
  baseMinimum: number;
  traceOverage: number;
  payloadOverage: number;
  retentionMultiplier: number;
  estimatedTotal: number;
}

interface CostEstimatorCardProps {
  tier: string;
  cost: CostBreakdown;
  periodMonth: number;
  periodYear: number;
}

export function CostEstimatorCard({
  tier,
  cost,
  periodMonth,
  periodYear,
}: CostEstimatorCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getMonthName = (month: number) => {
    const date = new Date(periodYear, month - 1);
    return date.toLocaleString("en-US", { month: "long" });
  };

  const hasOverage = cost.traceOverage > 0 || cost.payloadOverage > 0;
  const retentionAdjustment =
    (cost.traceOverage + cost.payloadOverage) * (cost.retentionMultiplier - 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Estimated Cost</CardTitle>
          <Badge variant="outline" className="capitalize">
            {tier}
          </Badge>
        </div>
        <CardDescription>
          {getMonthName(periodMonth)} {periodYear} billing period
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold text-foreground">
              {formatCurrency(cost.estimatedTotal)}
            </span>
            <span className="text-sm text-muted-foreground">/ month</span>
          </div>

          <div className="space-y-2 pt-4 border-t border-border">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Base minimum</span>
              <span className="font-medium">
                {formatCurrency(cost.baseMinimum)}
              </span>
            </div>

            {cost.traceOverage > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Trace overage</span>
                <span className="font-medium text-orange-600 dark:text-orange-400">
                  +{formatCurrency(cost.traceOverage)}
                </span>
              </div>
            )}

            {cost.payloadOverage > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payload overage</span>
                <span className="font-medium text-orange-600 dark:text-orange-400">
                  +{formatCurrency(cost.payloadOverage)}
                </span>
              </div>
            )}

            {cost.retentionMultiplier > 1.0 && retentionAdjustment > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Retention ({cost.retentionMultiplier.toFixed(1)}x)
                </span>
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  +{formatCurrency(retentionAdjustment)}
                </span>
              </div>
            )}

            {!hasOverage && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>Within included limits</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
