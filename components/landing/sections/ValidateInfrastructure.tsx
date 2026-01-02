"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Shield, Activity, FileSearch, AlertCircle } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Shield,
    heading: "Point-and-Click Connectivity",
    title: "Secure Integration",
    copy: "Simply provide your Model ID and API Endpoint (OpenAI, Anthropic, or Custom). We act as a lightweight observability layer, securely proxying requests to your model without storing sensitive keys.",
    expertiseSignal: "Supports REST API, OpenAI-compatible schemas, and custom Hugging Face inference endpoints."
  },
  {
    number: "02",
    icon: Activity,
    heading: "Real-Time Performance Profiling",
    title: "Live Execution & Telemetry",
    copy: "Interact with your model through our specialized interface. As you chat, FineTuneLab captures high-fidelity telemetry in real-time, including time-to-first-token (TTFT), total latency, and precise token consumption.",
    expertiseSignal: "Monitor Stream-Side Events (SSE) and resource utilization as they happen, not after the fact."
  },
  {
    number: "03",
    icon: FileSearch,
    heading: "Peek Inside the Black Box",
    title: "Deep Trace Analysis",
    copy: "Every interaction generates a \"Trace Map.\" View the raw JSON, see how the system prompt was injected, and inspect the reasoning chain. Identify exactly where a response went off the rails or why a specific tool call failed.",
    expertiseSignal: "Audit-ready logs with step-by-step breakdown of the completion lifecycle."
  }
];

export function ValidateInfrastructure() {
  return (
    <section className="py-20 px-4 bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl md:text-5xl font-bold">
            Validate Your Infrastructure
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              in Minutes
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Stop guessing how your models behave. Connect your endpoint to our diagnostic environment to visualize performance, trace logic, and stress-test your prompts in a production-simulated sandbox.
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8 mb-12">
          {/* 3-Step Visual Grid */}
          <div className="lg:col-span-2 space-y-6">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <Card key={i} className="border-2 hover:border-primary/50 transition-all">
                  <CardContent className="p-6">
                    {/* Header Row */}
                    <div className="flex items-start gap-4 mb-4">
                      {/* Number Badge */}
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                          <span className="text-lg font-bold text-primary-foreground">
                            {step.number}
                          </span>
                        </div>
                      </div>

                      {/* Title & Icon */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="h-5 w-5 text-primary" />
                          <h3 className="text-xl font-bold">{step.title}</h3>
                        </div>
                        <p className="text-sm font-semibold text-primary mb-3">
                          {step.heading}
                        </p>
                      </div>
                    </div>

                    {/* Copy */}
                    <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                      {step.copy}
                    </p>

                    {/* Expertise Signal */}
                    <div className="p-3 rounded-lg bg-muted/50 border border-muted-foreground/20">
                      <p className="text-xs font-medium text-foreground">
                        <span className="text-primary">💡 </span>
                        {step.expertiseSignal}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Technical Proof Sidebar */}
          <div className="lg:col-span-1">
            <Card className="border-2 border-orange-500/30 bg-orange-50/50 dark:bg-orange-950/20 sticky top-24">
              <CardContent className="p-6">
                <div className="flex items-start gap-3 mb-4">
                  <AlertCircle className="h-6 w-6 text-orange-600 shrink-0 mt-1" />
                  <h3 className="text-lg font-bold">
                    Why Bring Your Own Model?
                  </h3>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  Generic benchmarks don't tell you how a model will handle <span className="font-semibold text-foreground">your specific edge cases</span>.
                </p>

                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  By testing your production-ready models within FineTuneLab, you get an immediate preview of our <span className="font-semibold text-foreground">46 real-time visualizations</span> using your actual data.
                </p>

                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  It's a <span className="font-semibold text-orange-600">zero-risk way</span> to see if your model is ready for the "AI Workflow Crisis."
                </p>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="p-3 rounded-lg bg-background border">
                    <div className="text-2xl font-bold text-primary">46</div>
                    <div className="text-xs text-muted-foreground">Real-time Visualizations</div>
                  </div>
                  <div className="p-3 rounded-lg bg-background border">
                    <div className="text-2xl font-bold text-primary">0</div>
                    <div className="text-xs text-muted-foreground">Risk to Your Data</div>
                  </div>
                </div>

                {/* Mini CTA */}
                <div className="p-4 rounded-lg bg-gradient-to-r from-orange-100 to-pink-100 dark:from-orange-950/50 dark:to-pink-950/50 border border-orange-200 dark:border-orange-800">
                  <p className="text-xs font-semibold text-center mb-2">
                    See how traces work with <span className="text-orange-600">your model</span>
                  </p>
                  <Link href="/demo/test-model">
                    <Button
                      size="sm"
                      className="w-full bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-700 hover:to-pink-700 text-white"
                    >
                      Try It Now
                      <ArrowRight className="ml-2 h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Main CTA */}
        <div className="text-center">
          <Link href="/demo/test-model">
            <Button
              size="lg"
              className="gap-2 text-lg px-8 py-6 h-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg"
            >
              Launch the Diagnostic Sandbox
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
          <p className="text-sm text-muted-foreground mt-3">
            No credit card required. Connect via API Key or OIDC.
          </p>
        </div>
      </div>
    </section>
  );
}
