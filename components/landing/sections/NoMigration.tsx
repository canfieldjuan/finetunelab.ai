"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Database, Activity, Code } from "lucide-react";

const integrationPoints = [
  {
    icon: Database,
    title: "Existing Data",
    headline: "Don't move your datasets. Connect them.",
    description: "Point us to your S3 bucket, database, or data warehouse. No migration required.",
    features: [
      "Direct S3/GCS integration",
      "Database connectors",
      "API endpoints",
      "Keep data where it is"
    ]
  },
  {
    icon: Activity,
    title: "Current Monitoring",
    headline: "Keep your observability tools. We integrate.",
    description: "Already using Datadog, CloudWatch, or custom metrics? We'll send data there too.",
    features: [
      "OpenTelemetry compatible",
      "Webhook integrations",
      "Custom exporters",
      "Dual-write support"
    ]
  },
  {
    icon: Code,
    title: "Your Code",
    headline: "Works with your existing LLM calls. Drop in our SDK.",
    description: "2 lines of code. Works with OpenAI, Anthropic, AWS Bedrock, Azure, or any provider.",
    features: [
      "Provider-agnostic SDK",
      "Drop-in replacement",
      "No refactoring needed",
      "Backwards compatible"
    ]
  }
];

export function NoMigration() {
  return (
    <section className="py-20 px-4 bg-background">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-4 mb-16">
          <div className="inline-block px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
            <span className="text-sm font-semibold text-green-900 dark:text-green-200">
              No Migration Required
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold">
            Already Have Infrastructure?
            <br />
            <span className="text-green-600 dark:text-green-400">Keep It.</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            We integrate with what you already have. No rip-and-replace.
          </p>
        </div>

        {/* Three Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {integrationPoints.map((point, i) => {
            const Icon = point.icon;
            return (
              <Card key={i} className="border-2 hover:border-green-500/30 transition-all">
                <CardContent className="p-6">
                  {/* Icon & Title */}
                  <div className="mb-4">
                    <div className="inline-flex p-3 rounded-lg bg-green-100 dark:bg-green-900/30 mb-3">
                      <Icon className="h-8 w-8 text-green-600" />
                    </div>
                    <h3 className="text-lg font-bold text-green-600 dark:text-green-400 mb-2">
                      {point.title}
                    </h3>
                  </div>

                  {/* Headline */}
                  <p className="text-base font-semibold mb-2">
                    {point.headline}
                  </p>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground mb-4">
                    {point.description}
                  </p>

                  {/* Features */}
                  <ul className="space-y-2">
                    {point.features.map((feature, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm">
                        <span className="text-green-600 mt-0.5">✓</span>
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Bottom Message */}
        <div className="mt-12 text-center p-6 rounded-2xl bg-green-50 dark:bg-green-950/20 border-2 border-green-200 dark:border-green-800">
          <p className="text-lg font-medium">
            Start using FineTune Lab in 5 minutes. No infrastructure changes required.
          </p>
        </div>
      </div>
    </section>
  );
}
