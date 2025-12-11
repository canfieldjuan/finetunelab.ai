"use client";

import React from "react";
import { Check, X } from "lucide-react";

const competitors = [
  { name: "FineTune Lab", subtext: "AI-Native Platform", highlight: true },
  { name: "Shell Scripts", subtext: "DIY Pipelines" },
  { name: "Airflow / Prefect", subtext: "General Orchestration" },
  { name: "Kubeflow", subtext: "K8s ML Ops" }
];

const features = [
  {
    category: "Training",
    items: [
      { name: "Local GPU Support", values: [true, true, false, false] },
      { name: "Multi-Model Training", values: [true, false, true, true] },
      { name: "LoRA/QLoRA Fine-tuning", values: [true, false, false, false] },
      { name: "Multiple Training Methods", values: [true, false, false, false] },
      { name: "Real-time Training Metrics", values: [true, false, true, true] }
    ]
  },
  {
    category: "Benchmarking",
    items: [
      { name: "Training Evaluation", values: [true, false, false, true] },
      { name: "Model Family Support", values: ["HuggingFace OSS", "1-2", "N/A", "Limited"], type: "text" },
      { name: "Custom Evaluation Metrics", values: [true, false, false, true] }
    ]
  },
  {
    category: "Deployment",
    items: [
      { name: "One-Click Deploy", values: [true, false, false, false] },
      { name: "Real-Time Telemetry (SSE)", values: [true, false, false, false] },
      { name: "Multi-Cloud Support", values: [true, false, false, true] },
      { name: "Setup Time", values: ["Minutes", "Days", "Weeks", "Months"], type: "text" }
    ]
  },
  {
    category: "Closed-Loop Learning",
    items: [
      { name: "Telemetry → Training Data", values: [true, false, false, false] },
      { name: "Production Analytics", values: [true, false, false, false] },
      { name: "Feedback Loop Integration", values: [true, false, false, false] }
    ]
  },
  {
    category: "Cost",
    items: [
      { name: "Free Trial", values: ["15 Days", "N/A", "N/A", "N/A"], type: "text" },
      { name: "Pricing Model", values: ["Subscription + Compute", "N/A", "$500/mo", "$1000/mo"], type: "text" }
    ]
  }
];

export function Comparison() {
  console.log("[Comparison] Component mounted");

  const renderValue = (value: boolean | string, type?: string, columnIndex?: number) => {
    const isHighlight = columnIndex === 0;

    if (typeof value === "boolean") {
      return value ? (
        <Check className={`w-5 h-5 mx-auto ${isHighlight ? "text-green-500" : "text-green-500"}`} />
      ) : (
        <X className="w-5 h-5 mx-auto text-muted-foreground/30" />
      );
    }

    return (
      <span className={`text-sm font-medium ${isHighlight ? "text-green-600 font-semibold" : "text-foreground"}`}>
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
                      ? "bg-green-50 border-2 border-green-500 dark:bg-green-950/20 dark:border-green-500"
                      : "bg-muted/50"
                  }`}
                >
                  <div className={`font-bold ${comp.highlight ? "text-green-600 dark:text-green-400" : ""}`}>
                    {comp.name}
                  </div>
                  <div className={`text-xs mt-1 ${comp.highlight ? "text-green-600/70 dark:text-green-400/70" : "text-muted-foreground"}`}>{comp.subtext}</div>
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
                  AI-Native Platform, Try It Free
                </h3>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Why struggle with Airflow or pay $1000/month for Kubeflow? Fine Tune Lab offers
                  a 15-day free trial with local training, benchmarking, and deployment included.
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-primary" />
                  <span>15-day free trial</span>
                  <span className="text-muted-foreground/50">•</span>
                  <Check className="w-4 h-4 text-primary" />
                  <span>No credit card required</span>
                  <span className="text-muted-foreground/50">•</span>
                  <Check className="w-4 h-4 text-primary" />
                  <span>Usage-based pricing</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
