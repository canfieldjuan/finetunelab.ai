"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, BarChart3, Database } from "lucide-react";

const tiers = [
  {
    icon: Globe,
    title: "Core (Free Forever)",
    features: [
      "Local training (LoRA/QLoRA)",
      "Visual DAG builder",
      "Basic evaluation & benchmarks",
      "Model version management",
      "Community support"
    ]
  },
  {
    icon: Database,
    title: "Intelligent Graph RAG",
    features: [
      "Conversational graph database",
      "Entity extraction & relationships",
      "Context-aware retrieval",
      "Natural language queries",
      "Advanced analytics dashboard"
    ]
  },
  {
    icon: BarChart3,
    title: "DAG Orchestration Ops",
    features: [
      "Cloud GPU orchestration",
      "Parameterized pipeline templates",
      "Real-time SSE telemetry",
      "Automated retraining workflows",
      "Multi-model deployment"
    ]
  }
];

export function Features() {
  console.log("[Features] Component mounted");

  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl md:text-5xl font-bold">
            Three Tiers, One Platform
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Start free. Add intelligence with Graph RAG. Scale with orchestration.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {tiers.map((tier, index) => {
            const Icon = tier.icon;
            return (
              <Card key={index} className="border-2">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{tier.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {tier.features.map((feature, fIndex) => (
                      <li key={fIndex} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-0.5">✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
