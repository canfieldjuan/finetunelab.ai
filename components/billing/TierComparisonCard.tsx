/**
 * TierComparisonCard Component
 * Displays a single pricing tier with features and pricing details
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
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import type { UsagePlanConfig } from "@/lib/pricing/usage-based-config";

interface TierComparisonCardProps {
  config: UsagePlanConfig;
  isCurrentTier?: boolean;
  onSelectTier?: () => void;
  disabled?: boolean;
}

export function TierComparisonCard({
  config,
  isCurrentTier = false,
  onSelectTier,
  disabled = false,
}: TierComparisonCardProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const keyFeatures = [
    `${formatNumber(config.traces.includedTraces)} traces included`,
    `${config.payload.includedKbPerTrace} KB/trace payload`,
    `${config.retention.baseDays} days retention`,
    `${config.features.alertChannels} alert channels`,
    config.features.maxTeamMembers === -1
      ? "Unlimited team members"
      : `Up to ${config.features.maxTeamMembers} team members`,
    config.features.ssoEnabled && "SSO enabled",
    config.features.rbacEnabled && "RBAC enabled",
    config.features.piiControlsEnabled && "PII controls",
    config.features.vpcPeeringEnabled && "VPC peering",
  ].filter(Boolean);

  return (
    <Card className={isCurrentTier ? "border-2 border-primary" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <CardTitle className="text-xl">{config.name}</CardTitle>
          {isCurrentTier && (
            <Badge variant="default">Current</Badge>
          )}
        </div>
        <CardDescription className="text-sm">
          {config.tagline}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-4xl font-bold">
                {formatCurrency(config.minimumMonthly)}
              </span>
              <span className="text-muted-foreground text-sm">/month</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Minimum monthly commitment
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Usage Pricing</div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>
                ${config.traces.pricePerThousandTraces.toFixed(2)} per 1K traces
              </div>
              <div>
                ${config.payload.overagePricePerGb.toFixed(2)}/GB payload overage
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="text-sm font-medium mb-3">Key Features</div>
            <ul className="space-y-2">
              {keyFeatures.slice(0, 6).map((feature, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <Button
            onClick={onSelectTier}
            disabled={disabled || isCurrentTier}
            variant={isCurrentTier ? "outline" : "default"}
            className="w-full"
          >
            {isCurrentTier ? "Current Plan" : "Select Tier"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
