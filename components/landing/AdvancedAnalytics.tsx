"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Brain,
  AlertTriangle,
  TrendingUp,
  Bug,
  Target,
  Clock,
  MessageSquare
} from "lucide-react";

const operations = [
  {
    icon: AlertTriangle,
    name: "Anomaly Detection",
    description: "Catches quality drops BEFORE customers complain",
    benefit: "Proactive alerts"
  },
  {
    icon: TrendingUp,
    name: "Predictive Quality Modeling",
    description: "Forecasts next week's performance trends",
    benefit: "Plan ahead"
  },
  {
    icon: Brain,
    name: "Advanced Sentiment Analysis",
    description: "Beyond basic positive/negative—understand emotions",
    benefit: "Deep insights"
  },
  {
    icon: Bug,
    name: "Error Analysis",
    description: "Finds root causes automatically, no manual debugging",
    benefit: "Fix issues faster"
  },
  {
    icon: Target,
    name: "Benchmark Analysis",
    description: "Compare against industry standards",
    benefit: "Know where you stand"
  },
  {
    icon: Clock,
    name: "Temporal Analysis",
    description: "Shows quality trends over time",
    benefit: "Track improvements"
  },
  {
    icon: MessageSquare,
    name: "Textual Feedback Analysis",
    description: "Extracts insights from your human notes",
    benefit: "Learn from evaluations"
  }
];

const visualizations = [
  "Analytics Dashboard",
  "Analytics Chat (NL queries)",
  "Metrics Overview",
  "Rating Distribution",
  "Success Rate Chart",
  "Token Usage Chart",
  "Tool Performance Chart",
  "Error Breakdown Chart",
  "Cost Tracking Chart",
  "Conversation Length Chart",
  "Response Time Chart",
  "Model Performance Table",
  "Session Comparison Table",
  "Training Effectiveness Chart",
  "Advanced Filter Panel",
  "Export Modal",
  "AI Insights Panel",
  "Custom Metric Selector",
  "Individual Insight Cards"
];

export function AdvancedAnalytics() {
  console.log("[AdvancedAnalytics] Component mounted");

  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center space-y-4 mb-16">
          <div className="inline-block px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <span className="text-sm font-semibold text-primary">Not Your Average Dashboard</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold">
            Deep Analytics, Not Surface-Level Metrics
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            7 advanced operations that actually tell you what&apos;s wrong and how to fix it.
            19 real-time visualizations that go beyond basic line charts.
          </p>
        </div>

        {/* 7 Advanced Operations */}
        <div className="mb-20">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-bold">7 Advanced Analytics Operations</h3>
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold">
              Automated
            </span>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {operations.map((op, index) => {
              const Icon = op.icon;
              return (
                <Card key={index} className="border-2 hover:border-primary/50 transition-colors">
                  <CardContent className="p-6 space-y-3">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <h4 className="font-semibold text-base">{op.name}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {op.description}
                    </p>
                    <div className="pt-2">
                      <span className="text-xs font-medium text-primary">
                        → {op.benefit}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Placeholder card for 8th slot */}
            <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
              <CardContent className="p-6 h-full flex flex-col items-center justify-center text-center space-y-2">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl">+</span>
                </div>
                <p className="text-sm font-medium text-primary">More coming soon</p>
                <p className="text-xs text-muted-foreground">
                  We&apos;re constantly adding new operations
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 19 Visualizations */}
        <div>
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-bold">19 Real-Time Visualizations</h3>
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold">
              Live Data
            </span>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visualizations.map((viz, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-4 rounded-lg border-2 hover:border-primary/50 transition-colors bg-card"
              >
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-sm font-medium">{viz}</span>
              </div>
            ))}
          </div>

          {/* Bottom highlight */}
          <div className="mt-12 p-6 rounded-xl bg-gradient-to-br from-primary/10 via-background to-accent/10 border-2 border-primary/20">
            <div className="grid md:grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-3xl font-bold text-primary mb-2">7</div>
                <div className="text-sm text-muted-foreground">
                  Advanced operations running automatically
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary mb-2">19</div>
                <div className="text-sm text-muted-foreground">
                  Real-time visualizations at your fingertips
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary mb-2">0</div>
                <div className="text-sm text-muted-foreground">
                  Manual SQL queries or dashboard building
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
