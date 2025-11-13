"use client";

import React from "react";
import { Check, X } from "lucide-react";

const competitors = [
  { name: "Shell Scripts", subtext: "DIY Pipelines" },
  { name: "Airflow / Prefect", subtext: "General Orchestration" },
  { name: "Kubeflow", subtext: "K8s ML Ops" },
  { name: "Fine Tune Lab", subtext: "AI-Native DAG", highlight: true }
];

const features = [
  {
    category: "Training",
    items: [
      { name: "Visual DAG Builder", values: [false, false, false, true] },
      { name: "Local GPU Support", values: [true, false, false, true] },
      { name: "Multi-Model Training", values: [false, true, true, true] }
    ]
  },
  {
    category: "Benchmarking",
    items: [
      { name: "Cross-Provider Comparison", values: [false, false, false, true] },
      { name: "Automated Eval Suites", values: [false, false, true, true] },
      { name: "Model Family Support", values: ["1-2", "N/A", "Limited", "GPT/Claude/Gemini+"], type: "text" }
    ]
  },
  {
    category: "Deployment",
    items: [
      { name: "One-Click Deploy", values: [false, false, false, true] },
      { name: "Real-Time Telemetry (SSE)", values: [false, false, false, true] },
      { name: "Setup Time", values: ["Days", "Weeks", "Months", "Minutes"], type: "text" }
    ]
  },
  {
    category: "Closed-Loop Learning",
    items: [
      { name: "Telemetry → Training Data", values: [false, false, false, true] },
      { name: "Automated Retraining", values: [false, true, true, true] },
      { name: "Graph RAG Integration", values: [false, false, false, true] }
    ]
  },
  {
    category: "Cost",
    items: [
      { name: "Core Tier (Local)", values: ["Free", "N/A", "N/A", "Free Forever"], type: "text" },
      { name: "Cloud Orchestration", values: ["N/A", "$500/mo", "$1000/mo", "Usage-based"], type: "text" }
    ]
  }
];

export function Comparison() {
  console.log("[Comparison] Component mounted");

  const renderValue = (value: boolean | string, type?: string, columnIndex?: number) => {
    const isHighlight = columnIndex === 3;

    if (typeof value === "boolean") {
      return value ? (
        <Check className={`w-5 h-5 mx-auto ${isHighlight ? "text-primary" : "text-green-500"}`} />
      ) : (
        <X className="w-5 h-5 mx-auto text-muted-foreground/30" />
      );
    }

    return (
      <span className={`text-sm font-medium ${isHighlight ? "text-primary" : "text-foreground"}`}>
        {value}
      </span>
    );
  };

  return (
    <section className="py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl md:text-5xl font-bold">
            Built for AI Workflows, Not Generic Tasks
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Compare Fine Tune Lab to general orchestration tools. We&apos;re purpose-built for the AI lifecycle.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Header */}
            <div className="grid grid-cols-5 gap-4 mb-8">
              <div className="font-semibold text-sm text-muted-foreground">Features</div>
              {competitors.map((comp, idx) => (
                <div
                  key={idx}
                  className={`text-center p-4 rounded-lg ${
                    comp.highlight
                      ? "bg-primary/10 border-2 border-primary"
                      : "bg-muted/50"
                  }`}
                >
                  <div className={`font-bold ${comp.highlight ? "text-primary" : ""}`}>
                    {comp.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{comp.subtext}</div>
                </div>
              ))}
            </div>

            {/* Feature Categories */}
            {features.map((category, catIdx) => (
              <div key={catIdx} className="mb-8">
                <div className="font-semibold text-sm text-primary mb-3 uppercase tracking-wide">
                  {category.category}
                </div>
                <div className="space-y-2">
                  {category.items.map((item, itemIdx) => (
                    <div
                      key={itemIdx}
                      className="grid grid-cols-5 gap-4 items-center py-3 px-2 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <div className="text-sm font-medium">{item.name}</div>
                      {item.values.map((value, valIdx) => (
                        <div key={valIdx} className="text-center">
                          {renderValue(value, item.type, valIdx)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Bottom CTA */}
            <div className="mt-12 p-6 rounded-xl bg-gradient-to-br from-primary/5 via-background to-accent/5 border-2 border-primary/20">
              <div className="text-center space-y-4">
                <h3 className="text-2xl font-bold">
                  AI-Native Orchestration, Free to Start
                </h3>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Why struggle with Airflow or pay $1000/month for Kubeflow when the Core tier 
                  of Fine Tune Lab is free forever? Local training, visual DAGs, and deployment included.
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-primary" />
                  <span>Core tier free forever</span>
                  <span className="text-muted-foreground/50">•</span>
                  <Check className="w-4 h-4 text-primary" />
                  <span>No credit card required</span>
                  <span className="text-muted-foreground/50">•</span>
                  <Check className="w-4 h-4 text-primary" />
                  <span>Scale when ready</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
