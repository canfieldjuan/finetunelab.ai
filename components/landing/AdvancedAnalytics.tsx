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
  { name: "Analytics Dashboard", description: "Central hub for all metrics and insights" },
  { name: "Analytics Chat (NL queries)", description: "Ask questions about your data in plain English" },
  { name: "Metrics Overview", description: "High-level summary of key performance indicators" },
  { name: "Rating Distribution", description: "See how users rate your model responses" },
  { name: "Success Rate Chart", description: "Track successful vs failed interactions over time" },
  { name: "Token Usage Chart", description: "Monitor token consumption and costs" },
  { name: "Tool Performance Chart", description: "Measure effectiveness of different tools" },
  { name: "Error Breakdown Chart", description: "Categorize and visualize error patterns" },
  { name: "Cost Tracking Chart", description: "Track spending across models and providers" },
  { name: "Conversation Length Chart", description: "Analyze interaction duration trends" },
  { name: "Response Time Chart", description: "Monitor latency and response speeds" },
  { name: "Model Performance Table", description: "Compare metrics across different models" },
  { name: "Session Comparison Table", description: "Side-by-side session analysis" },
  { name: "Training Effectiveness Chart", description: "Measure impact of fine-tuning iterations" },
  { name: "Advanced Filter Panel", description: "Filter data by date, model, user, and more" },
  { name: "Export Modal", description: "Download analytics in multiple formats" },
  { name: "AI Insights Panel", description: "Automated insights from your analytics data" },
  { name: "Custom Metric Selector", description: "Choose which metrics to display" },
  { name: "Individual Insight Cards", description: "Focused cards for specific metrics" },
  { name: "Anomaly Feed", description: "Real-time alerts for unusual patterns" },
  { name: "Benchmark Analysis Chart", description: "Compare against industry standards" },
  { name: "Cohort Analysis View", description: "Group and analyze user segments" },
  { name: "Cohort Card", description: "Summary cards for each cohort" },
  { name: "Cohort Comparison Chart", description: "Compare performance across cohorts" },
  { name: "Cohort Trend Chart", description: "Track cohort metrics over time" },
  { name: "Quality Forecast Chart", description: "Predict future performance trends" },
  { name: "Sentiment Analyzer", description: "Analyze emotional tone of interactions" },
  { name: "Sentiment Dashboard", description: "Comprehensive sentiment metrics view" },
  { name: "Sentiment Trend Chart", description: "Track sentiment changes over time" },
  { name: "SLA Breach Chart", description: "Monitor service level agreement violations" },
  { name: "Provider Telemetry Panel", description: "Track metrics by cloud provider" },
  { name: "Research Jobs Panel", description: "Monitor training job analytics" },
  { name: "Experiment Manager", description: "Track A/B tests and experiments" },
  { name: "Judgments Breakdown", description: "Detailed view of evaluation results" },
  { name: "Judgments Table", description: "Tabular view of all judgments" },
  { name: "Active Filters Bar", description: "See currently applied filters at a glance" },
  { name: "Export Button", description: "Quick export to CSV, JSON, or Excel" },
  { name: "Export Format Selector", description: "Choose your preferred export format" },
  { name: "Export Type Selector", description: "Select which data to export" },
  { name: "Export History", description: "Access previously exported files" },
  { name: "Download Link", description: "Direct download links for exports" },
  { name: "Contributing Factors List", description: "Identify root causes of issues" },
  { name: "Recommendation Card", description: "AI-generated improvement suggestions" },
  { name: "Root Cause Timeline", description: "Trace issues back to their source" },
  { name: "Trace View", description: "Detailed execution trace for debugging" }
];

export function AdvancedAnalytics() {
  console.log("[AdvancedAnalytics] Component mounted");

  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center space-y-4 mb-16">
          <div className="inline-block px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-950 border border-blue-500/30 mb-4">
            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">Not Your Average Dashboard</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold">
            Deep Analytics, Not Surface-Level Metrics
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            7 advanced operations that actually tell you what&apos;s wrong and how to fix it.
            46 real-time visualizations that go beyond basic line charts.
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

        {/* 46 Visualizations */}
        <div>
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-bold">46 Real-Time Visualizations</h3>
            <span className="px-3 py-1 rounded-full bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400 text-sm font-semibold flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Live Data
            </span>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-4">
            {visualizations.map((viz, index) => (
              <div
                key={index}
                className="flex gap-3 p-4 rounded-lg border-2 hover:border-primary/50 transition-colors bg-card"
              >
                <div className="w-2 h-2 rounded-full bg-primary mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-semibold mb-1">{viz.name}</div>
                  <div className="text-xs text-muted-foreground">{viz.description}</div>
                </div>
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
                <div className="text-3xl font-bold text-primary mb-2">46</div>
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
