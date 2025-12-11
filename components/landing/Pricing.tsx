"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { PricingTiers } from "@/components/pricing/PricingTiers";
import { ContactSalesModal } from "@/components/pricing/ContactSalesModal";
import type { PlanTier } from "@/lib/pricing/config";

export function Pricing() {
  console.log("[Pricing] Component mounted");
  const router = useRouter();

  // Modal state
  const [showContactSales, setShowContactSales] = useState(false);

  // Handle upgrade click - redirect to signup/login
  const handleUpgrade = (tier: PlanTier, billing: 'monthly' | 'yearly', seats: number) => {
    console.log('[Pricing] Upgrade requested:', tier, billing, seats, 'users');
    
    // For landing page, redirect to signup with plan info
    router.push(`/signup?plan=${tier}&billing=${billing}&seats=${seats}`);
  };

  // Handle contact sales
  const handleContactSales = () => {
    console.log('[Pricing] Contact sales clicked');
    setShowContactSales(true);
  };

  return (
    <section className="py-20 px-4 bg-gradient-to-b from-background to-muted/20">
      <div className="max-w-7xl mx-auto">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl md:text-5xl font-bold">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Choose the plan that fits your scale. Start with a 15-day free trial.
          </p>
        </div>

        <PricingTiers
          currentPlan={null as any}
          onUpgrade={handleUpgrade}
          onContactSales={handleContactSales}
        />
      </div>

      {/* Contact Sales Modal */}
      <ContactSalesModal
        isOpen={showContactSales}
        onClose={() => setShowContactSales(false)}
      />
    </section>
  );
}
