"use client";

import React from "react";
import { CheckCircle2 } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Train in Cloud",
    description: "Fine-tune models with LoRA/QLoRA on cloud GPUs. All managed through our unified platform.",
    benefit: "Flexible infrastructure"
  },
  {
    number: "02",
    title: "Assess & Benchmark",
    description: "Run automated evaluations on HuggingFace open-source models. Compare quality metrics and performance side-by-side.",
    benefit: "Data-driven decisions"
  },
  {
    number: "03",
    title: "Deploy & Monitor",
    description: "Push to production with one click. Stream real-time telemetry via SSE: token counts, latency, user ratings, errors.",
    benefit: "Live observability"
  },
  {
    number: "04",
    title: "Close the Loop",
    description: "Telemetry flows back into training datasets. Use production data to improve your next training run.",
    benefit: "Continuous improvement"
  }
];

export function Solution() {
  console.log("[Solution] Component mounted");

  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl md:text-5xl font-bold">
            The Closed-Loop AI Lifecycle
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Train → Assess → Benchmark → Deploy → Monitor → Improve. All connected in one unified platform.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="space-y-4">
              <div className="text-5xl font-bold text-primary/20">{step.number}</div>
              <h3 className="text-xl font-semibold">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
              <div className="flex items-center gap-2 text-sm text-primary">
                <CheckCircle2 className="w-4 h-4" />
                <span className="font-medium">{step.benefit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
