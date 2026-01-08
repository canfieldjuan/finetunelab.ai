"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Settings, Play, Activity, FileDown, Clock } from "lucide-react";

const steps = [
  {
    number: 1,
    title: "Connect Your Model",
    time: "15 seconds",
    icon: Settings,
    items: [
      "Select Provider: [Together.ai ▼]",
      "Endpoint: https://api.together.xyz/...",
      "API Key: ••••••••••••"
    ],
    note: "Works with: Together, Fireworks, OpenRouter, Groq, vLLM, Ollama, or any OpenAI-compatible endpoint"
  },
  {
    number: 2,
    title: "Run the Test Suite",
    time: "30 seconds",
    icon: Play,
    items: [
      "Edge cases",
      "Ambiguous queries",
      "Multi-turn conversations",
      "Common failure modes"
    ],
    note: "Or write your own."
  },
  {
    number: 3,
    title: "Watch Live Traces",
    time: "1 minute",
    icon: Activity,
    items: [
      "Token usage per message",
      "Cost per conversation",
      "Latency breakdown",
      "Quality scoring",
      "Error detection"
    ],
    note: ""
  },
  {
    number: 4,
    title: "Get Your Report",
    time: "30 seconds",
    icon: FileDown,
    items: [
      "Total cost projection",
      "Performance bottlenecks",
      "Quality score distribution",
      "Recommended optimizations",
      "Export as CSV/JSON"
    ],
    note: ""
  }
];

export function TwoMinuteCheck() {
  return (
    <section className="py-20 px-4 bg-background">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-900 dark:text-blue-200">
              Quick Health Check
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold">
            See Your Model's Blind Spots
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              in 2 Minutes
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Four simple steps. Real insights. No commitment.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <Card key={step.number} className="border-2 hover:border-primary/50 transition-all">
                <CardContent className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <span className="text-lg font-bold text-primary-foreground">{step.number}</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">{step.title}</h3>
                        <p className="text-xs text-muted-foreground">{step.time}</p>
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>

                  {/* Items */}
                  <div className="space-y-2 mb-3">
                    {step.items.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-primary mt-0.5">├─</span>
                        <span className="text-muted-foreground">{item}</span>
                      </div>
                    ))}
                  </div>

                  {/* Note */}
                  {step.note && (
                    <p className="text-xs text-muted-foreground italic mt-3 pt-3 border-t">
                      {step.note}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link href="/demo/test-model">
            <Button
              size="lg"
              className="gap-2 text-lg px-8 py-6 h-auto bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
            >
              Try It With Your Model
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
