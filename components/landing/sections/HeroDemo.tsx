"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Zap, Check } from "lucide-react";

const providers = [
  "Together.ai",
  "Fireworks.ai",
  "OpenRouter",
  "Groq",
  "vLLM",
  "Ollama",
  "Custom endpoints"
];

export function HeroDemo() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-gradient-to-b from-background to-muted/30 pt-16">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-20 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 mb-6">
          <Zap className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <span className="text-sm font-semibold text-orange-900 dark:text-orange-200">
            No signup required • 2-minute demo
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
          See Your LLM in Action.
          <br />
          <span className="bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent">
            Right Now.
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
          Plug in your model. Run 10 test prompts. Get live traces, cost analysis, and quality scores.
          <br />
          <span className="font-medium">No signup. Takes 2 minutes.</span>
        </p>

        {/* Primary CTA */}
        <div className="mb-12">
          <Link href="/demo/test-model">
            <Button
              size="lg"
              className="gap-2 text-lg px-8 py-6 h-auto bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transition-all"
            >
              Try Your Model Now
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>

        {/* Supported Providers */}
        <div className="max-w-2xl mx-auto">
          <p className="text-sm text-muted-foreground mb-3">Supported Providers:</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {providers.map((provider, i) => (
              <Badge
                key={i}
                variant="outline"
                className="text-xs px-3 py-1.5 bg-background/50 backdrop-blur-sm"
              >
                <Check className="h-3 w-3 mr-1.5 text-green-600" />
                {provider}
              </Badge>
            ))}
          </div>
        </div>

        {/* Secondary CTA / Scroll indicator */}
        <div className="mt-16 flex flex-col items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Or see why teams are ditching their duct-taped LLM stacks
          </p>
          <div className="animate-bounce">
            <ArrowRight className="h-5 w-5 text-muted-foreground rotate-90" />
          </div>
        </div>
      </div>
    </section>
  );
}
