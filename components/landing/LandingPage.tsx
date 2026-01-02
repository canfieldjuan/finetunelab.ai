"use client";

import React from "react";
import {
  HeroDemo,
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

      {/* Section 2: Validate Your Infrastructure (Traces First!) */}
      <ValidateInfrastructure />

      {/* Section 3: The Fragmentation Problem */}
      <FragmentationProblem />

      {/* Section 4: One Platform, Entire Lifecycle */}
      <UnifiedPlatform />

      {/* Section 5: Test Like Users, Not Developers */}
      <TestLikeUsers />

      {/* Section 6: The 2-Minute Model Health Check */}
      <TwoMinuteCheck />

      {/* Section 7: From Testing to Production */}
      <FullPlatform />

      {/* Section 8: Democratizing Production-Quality LLMs */}
      <Democratization />

      {/* Section 9: No Migration Needed */}
      <NoMigration />

      {/* Existing Sections (Additional Content) */}
      <AdvancedAnalytics />
      <NaturalLanguage />
      <Features />
      <UseCases />

      {/* Pricing & FAQ */}
      <Pricing />
      <FAQ />

      {/* Section 9: Final CTA */}
      <FinalCTA />

      {/* Footer */}
      <Footer />
    </div>
  );
}
