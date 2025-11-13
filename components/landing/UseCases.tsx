"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, MessageSquare, FileText, Code, Building2, Sparkles } from "lucide-react";

const useCases = [
  {
    icon: MessageSquare,
    title: "AI Customer Support",
    description: "Train chatbots on real support conversations. Improve resolution rates continuously.",
    metrics: ["32% faster resolution", "18% quality improvement"]
  },
  {
    icon: ShoppingCart,
    title: "E-commerce AI Assistants",
    description: "Optimize product recommendations and shopping assistance based on customer behavior.",
    metrics: ["15% conversion lift", "Real customer patterns"]
  },
  {
    icon: FileText,
    title: "Content Generation",
    description: "Fine-tune models on what customers actually engage with, not generic training data.",
    metrics: ["2x engagement", "Higher quality output"]
  },
  {
    icon: Code,
    title: "Developer Tools",
    description: "Improve code completion and generation with real developer workflows.",
    metrics: ["40% acceptance rate", "Production-validated"]
  },
  {
    icon: Building2,
    title: "Enterprise AI",
    description: "Deploy internal AI tools with quality monitoring and continuous improvement.",
    metrics: ["Measurable ROI", "Compliance-ready"]
  },
  {
    icon: Sparkles,
    title: "AI Features",
    description: "Launch any AI feature with confidence. Monitor quality and iterate fast.",
    metrics: ["Deploy weekly", "Zero guesswork"]
  }
];

export function UseCases() {
  console.log("[UseCases] Component mounted");

  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl md:text-5xl font-bold">
            Built For Every AI Use Case
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            From chatbots to content generation, improve any AI application
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {useCases.map((useCase, index) => {
            const Icon = useCase.icon;
            return (
              <Card key={index} className="border-2 hover:border-primary/50 transition-colors">
                <CardContent className="p-6 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold">{useCase.title}</h3>
                  <p className="text-muted-foreground text-sm">{useCase.description}</p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {useCase.metrics.map((metric, mIndex) => (
                      <span 
                        key={mIndex}
                        className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-medium"
                      >
                        {metric}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
