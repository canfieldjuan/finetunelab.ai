"use client";

import React from "react";
import { Hero } from "./Hero";
import { Demo } from "./Demo";
import { Problem } from "./Problem";
import { Comparison } from "./Comparison";
import { Solution } from "./Solution";
import { AdvancedAnalytics } from "./AdvancedAnalytics";
import { NaturalLanguage } from "./NaturalLanguage";
import { Features } from "./Features";
import { UseCases } from "./UseCases";
import { Pricing } from "./Pricing";
import { FAQ } from "./FAQ";
import { CTA } from "./CTA";
import { Footer } from "./Footer";

export function LandingPage() {
  console.log("[LandingPage] Component mounted");

  return (
    <div className="min-h-screen">
      <Hero />
      <Problem />
      <Comparison />
      <Solution />
      <AdvancedAnalytics />
      <NaturalLanguage />
      <Features />
      <UseCases />
      <Pricing />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
}
