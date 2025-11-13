"use client";

import React from "react";
import { AlertCircle, TrendingDown, DollarSign, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const problems = [
  {
    icon: AlertCircle,
    title: "Training scripts scattered everywhere",
    description: "Your team writes one-off Python scripts for each model. No versioning, no reusability, no visibility into what's running.",
    impact: "Zero reproducibility"
  },
  {
    icon: Clock,
    title: "Manual orchestration hell",
    description: "You manually chain training → eval → benchmark → deploy steps. Missing one breaks everything. No rollback, no error handling.",
    impact: "Days wasted debugging"
  },
  {
    icon: DollarSign,
    title: "No closed-loop feedback",
    description: "Models go to production. Telemetry data sits unused. You never retrain on real-world performance—just hope it works.",
    impact: "Stale models"
  },
  {
    icon: TrendingDown,
    title: "Can't compare model families",
    description: "Testing GPT-4o vs Claude vs Gemini means rewriting infrastructure each time. No standardized benchmarks across providers.",
    impact: "Vendor lock-in"
  }
];

export function Problem() {
  console.log("[Problem] Component mounted");

  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center space-y-4 mb-16">
          <div className="inline-block px-4 py-2 rounded-full bg-destructive/10 border border-destructive/20 mb-4">
            <span className="text-sm font-semibold text-destructive">The AI Workflow Crisis</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold">
            Why AI Teams Move So Slowly
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            You&apos;re stitching together training, evaluation, and deployment with duct tape and shell scripts.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {problems.map((problem, index) => {
            const Icon = problem.icon;
            return (
              <Card key={index} className="border-2 hover:border-destructive/30 transition-colors bg-card">
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-destructive" />
                    </div>
                    <span className="px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-semibold">
                      {problem.impact}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold leading-tight">{problem.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{problem.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
