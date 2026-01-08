"use client";

import React from "react";
import {
  HeroDemo,
  LiveTraceDemo,
  ValidateInfrastructure,
  FragmentationProblem,
  UnifiedPlatform,
  TestLikeUsers,
  TwoMinuteCheck,
  FullPlatform,
  Democratization,
  NoMigration,
  FinalCTA
} from "./sections";
import { AdvancedAnalytics } from "./AdvancedAnalytics";
import { NaturalLanguage } from "./NaturalLanguage";
import { Features } from "./Features";
import { UseCases } from "./UseCases";
import { Pricing } from "./Pricing";
import { FAQ } from "./FAQ";
import { Footer } from "./Footer";
import { Header } from "./Header";

export function LandingPage() {
  console.log("[LandingPage] Component mounted");

  return (
    <div className="min-h-screen">
      {/* Header with Logo */}
      <Header />

      {/* Section 1: Hero - Demo-First Approach */}
      <HeroDemo />

      {/* Section 2: Live Trace Demo - Show What Users Get */}
      <LiveTraceDemo />

      {/* Section 3: Validate Your Infrastructure (Traces First!) */}
      <ValidateInfrastructure />

      {/* Section 4: The Fragmentation Problem */}
      <FragmentationProblem />

      {/* Section 5: One Platform, Entire Lifecycle */}
      <UnifiedPlatform />

      {/* Section 6: Test Like Users, Not Developers */}
      <TestLikeUsers />

      {/* Section 7: The 2-Minute Model Health Check */}
      <TwoMinuteCheck />

      {/* Section 8: From Testing to Production */}
      <FullPlatform />

      {/* Section 9: Democratizing Production-Quality LLMs */}
      <Democratization />

      {/* Section 10: No Migration Needed */}
      <NoMigration />

      {/* Existing Sections (Additional Content) */}
      <AdvancedAnalytics />
      <NaturalLanguage />
      <Features />
      <UseCases />

      {/* Pricing & FAQ */}
      <Pricing />
      <FAQ />

      {/* Section 11: Final CTA */}
      <FinalCTA />

      {/* Footer */}
      <Footer />
    </div>
  );
}
