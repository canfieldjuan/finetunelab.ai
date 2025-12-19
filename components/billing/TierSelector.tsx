/**
 * TierSelector Component
 * Grid display of all available pricing tiers with comparison
 */

"use client";

import React, { useState } from "react";
import { TierComparisonCard } from "./TierComparisonCard";
import { USAGE_PLANS, type UsageTier } from "@/lib/pricing/usage-based-config";

interface TierSelectorProps {
  currentTier?: UsageTier;
  onTierSelect?: (tier: UsageTier) => void;
  sessionToken?: string;
}

export function TierSelector({
  currentTier,
  onTierSelect,
  sessionToken,
}: TierSelectorProps) {
  const [selectedTier, setSelectedTier] = useState<UsageTier | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleTierSelect = async (tier: UsageTier) => {
    if (tier === currentTier) return;

    setSelectedTier(tier);

    if (onTierSelect) {
      onTierSelect(tier);
    } else {
      setIsProcessing(true);
      try {
        console.log(`[TierSelector] Selected tier: ${tier}`);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const tiers: UsageTier[] = ["starter", "growth", "business", "enterprise"];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground mb-2">
          Choose Your Tier
        </h2>
        <p className="text-muted-foreground">
          Usage-based pricing that scales with your needs
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {tiers.map((tier) => (
          <TierComparisonCard
            key={tier}
            config={USAGE_PLANS[tier]}
            isCurrentTier={tier === currentTier}
            onSelectTier={() => handleTierSelect(tier)}
            disabled={isProcessing}
          />
        ))}
      </div>

      {currentTier && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>Current Tier:</strong> {USAGE_PLANS[currentTier].name}
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
            Upgrade or downgrade at any time. Changes take effect at the start of your next billing period.
          </p>
        </div>
      )}
    </div>
  );
}
