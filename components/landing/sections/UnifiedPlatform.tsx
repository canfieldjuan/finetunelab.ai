"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Target, BarChart2, DollarSign, CheckCircle, TrendingUp, RefreshCw } from "lucide-react";

const features = [
  {
    title: "Production-Like Testing Playground",
    description: "Test your model like your users will use it. No developer tools. Just conversation.",
    icon: Target,
    size: "large",
    color: "blue"
  },
  {
    title: "Live Traces",
    description: "See every call, every token, every decision",
    icon: BarChart2,
    size: "small",
    color: "purple"
  },
  {
    title: "Instant Cost Analysis",
    description: "Know what each conversation costs. Before deploying.",
    icon: DollarSign,
    size: "small",
    color: "green"
  },
  {
    title: "Quality Scoring",
    description: "LLM-as-judge built in. No setup.",
    icon: CheckCircle,
    size: "small",
    color: "orange"
  },
  {
    title: "Training & Fine-Tuning",
    description: "Upload data. Click train. Monitor. Deploy.",
    icon: TrendingUp,
    size: "small",
    color: "pink"
  },
  {
    title: "Automatic Versioning & Monitoring",
    description: "Everything tracked. Nothing lost in Slack.",
    icon: RefreshCw,
    size: "large",
    color: "cyan"
  }
];

export function UnifiedPlatform() {
  return (
    <section className="py-20 px-4 bg-background">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-4 mb-16">
          <div className="inline-block px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
            <span className="text-sm font-semibold text-green-900 dark:text-green-200">
              The Solution
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold">
            What If It Was All
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              in One Place?
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            One platform for the entire lifecycle. No migrations. No integrations. Just works.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            const isLarge = feature.size === "large";

            return (
              <Card
                key={i}
                className={`${
                  isLarge ? "md:col-span-2" : ""
                } border-2 hover:border-primary/50 transition-all group`}
              >
                <CardContent className={`p-6 ${isLarge ? "md:p-8" : ""}`}>
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg bg-${feature.color}-100 dark:bg-${feature.color}-900/30 shrink-0 group-hover:scale-110 transition-transform`}>
                      <Icon className={`h-6 w-6 text-${feature.color}-600 dark:text-${feature.color}-400`} />
                    </div>
                    <div className="flex-1">
                      <h3 className={`font-bold mb-2 ${isLarge ? "text-xl" : "text-lg"}`}>
                        {feature.title}
                      </h3>
                      <p className={`text-muted-foreground ${isLarge ? "text-base" : "text-sm"}`}>
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Bottom Message */}
        <div className="mt-12 text-center">
          <p className="text-lg text-muted-foreground italic">
            Where it should have been from the start.
          </p>
        </div>
      </div>
    </section>
  );
}
