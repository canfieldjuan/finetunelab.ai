"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Zap, ArrowRight } from "lucide-react";

const seniorDevSteps = [
  "Set up MLflow tracking",
  "Write custom evaluation scripts",
  "Configure monitoring pipelines",
  "Debug across 5 platforms",
  "Document in Slack/Notion",
  "Pray it works in prod"
];

const anyoneSteps = [
  "Upload dataset",
  "Click \"Train\"",
  "Review quality scores",
  "Click \"Deploy\"",
  "Monitor in same UI"
];

export function Democratization() {
  return (
    <section className="py-20 px-4 bg-background">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-4 mb-16">
          <div className="inline-block px-4 py-2 rounded-full bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800">
            <span className="text-sm font-semibold text-purple-900 dark:text-purple-200">
              Democratizing Production LLMs
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold">
            Your Junior Developer Can Ship
            <br />
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Production Models on Day One
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            We removed the guessing, technical debt, and tribal knowledge.
            <br />
            <span className="font-medium">If you can click, you can build production LLMs.</span>
          </p>
        </div>

        {/* Comparison Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Without FineTune Lab */}
          <Card className="border-2">
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-muted">
                  <Users className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Without FineTune Lab</h3>
                  <p className="text-sm text-muted-foreground">(Senior Dev Required)</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {seniorDevSteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-medium">{i + 1}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{step}</p>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm font-medium text-destructive">
                  → Weeks, senior-dev-only work
                </p>
              </div>
            </CardContent>
          </Card>

          {/* With FineTune Lab */}
          <Card className="border-2 border-primary">
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">With FineTune Lab</h3>
                  <p className="text-sm text-primary">(Anyone Can Do It)</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {anyoneSteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-medium text-primary-foreground">{i + 1}</span>
                    </div>
                    <p className="text-sm font-medium">{step}</p>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-sm font-medium text-green-600">
                  → Hours, any skill level
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Key Message */}
        <div className="text-center p-8 rounded-2xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-2 border-purple-500/20">
          <p className="text-2xl font-bold mb-2">
            If your junior dev can't ship a production model,
          </p>
          <p className="text-xl text-muted-foreground">
            your tools are the problem—not your team.
          </p>
        </div>
      </div>
    </section>
  );
}
