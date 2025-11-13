"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";

export function Hero() {
  console.log("[Hero] Component mounted");

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center px-4 py-20 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/10" />
      
      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto text-center space-y-8">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          <span className="text-sm font-medium text-primary">Visual DAG-Based AI Platform</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
          Train Smarter. Adapt Faster.
          <br />
          <span className="text-primary">Learn Continuously.</span>
        </h1>

        {/* Subheadline */}
        <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          A visual DAG-based platform that unifies training, evaluation, deployment, and real-world analytics.
          Fine-tune locally or in the cloud, benchmark across model families, and watch live telemetry flow straight back into your training graph.
        </p>

        {/* Key Stats */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-base md:text-lg">
          <div className="flex items-center gap-2">
            <span className="font-bold text-primary">Drag & Drop</span>
            <span className="text-muted-foreground">DAG Builder</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-muted-foreground" />
          <div className="flex items-center gap-2">
            <span className="font-bold text-primary">Closed-Loop</span>
            <span className="text-muted-foreground">AI Lifecycle</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-muted-foreground" />
          <div className="flex items-center gap-2">
            <span className="font-bold text-primary">Real-Time</span>
            <span className="text-muted-foreground">SSE Analytics</span>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link href="/signup">
            <Button size="lg" className="gap-2 text-lg px-8 py-6">
              Launch the Core Studio
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
          <Button size="lg" variant="outline" className="gap-2 text-lg px-8 py-6">
            <Play className="w-5 h-5" />
            Watch Demo
          </Button>
        </div>

        {/* Live Chat Widget Demo */}
        <div className="relative max-w-5xl mx-auto mt-12">
          <div className="rounded-xl border-2 border-primary/20 bg-card shadow-2xl overflow-hidden">
            {/* Widget Container - Embedded Chat UI */}
            <div className="bg-gradient-to-br from-background via-muted/30 to-background">
              {/* Chat Header */}
              <div className="bg-primary/10 border-b border-primary/20 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">AI Assistant</h3>
                      <p className="text-xs text-muted-foreground">Powered by Fine Tune Lab</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs text-muted-foreground">Online</span>
                  </div>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="h-[400px] overflow-y-auto p-6 space-y-4">
                {/* Assistant Message */}
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="bg-muted rounded-lg px-4 py-3 text-sm">
                      <p className="text-foreground">
                        👋 Welcome! I&apos;m your AI assistant. I can help you with training models, building DAG pipelines, and analyzing your ML workflows.
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 ml-1">Just now</p>
                  </div>
                </div>

                {/* User Message */}
                <div className="flex gap-3 justify-end">
                  <div className="flex-1 flex flex-col items-end">
                    <div className="bg-primary rounded-lg px-4 py-3 text-sm max-w-[80%]">
                      <p className="text-primary-foreground">
                        Show me how to create a training pipeline for Qwen 0.5B
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 mr-1">Just now</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>

                {/* Assistant Response */}
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="bg-muted rounded-lg px-4 py-3 text-sm">
                      <p className="text-foreground mb-3">
                        Great! Here&apos;s a visual DAG pipeline for fine-tuning Qwen 0.5B:
                      </p>
                      <div className="bg-background/80 rounded border border-border p-3 space-y-2 font-mono text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full" />
                          <span>📊 Load Dataset → PC Parts QA</span>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <div className="w-2 h-2 bg-purple-500 rounded-full" />
                          <span>🔧 Configure LoRA → rank=16, alpha=32</span>
                        </div>
                        <div className="flex items-center gap-2 ml-8">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <span>🚀 Train → Qwen/Qwen2.5-0.5B-Instruct</span>
                        </div>
                        <div className="flex items-center gap-2 ml-12">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                          <span>📈 Evaluate → Loss: 1.69</span>
                        </div>
                      </div>
                      <p className="text-foreground mt-3">
                        Click &quot;Deploy&quot; to push this to production, or &quot;Benchmark&quot; to compare against GPT-4o.
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 ml-1">Just now</p>
                  </div>
                </div>
              </div>

              {/* Chat Input */}
              <div className="border-t border-border bg-background/50 px-6 py-4">
                <div className="flex gap-3 items-center">
                  <input
                    type="text"
                    placeholder="Ask about training, DAGs, or benchmarks..."
                    className="flex-1 px-4 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                    disabled
                  />
                  <button className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  This is a demo preview • <a href="/chat" className="text-primary hover:underline">Try the full experience →</a>
                </p>
              </div>
            </div>
          </div>
          {/* Decorative elements */}
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-accent/10 rounded-full blur-3xl" />
        </div>

        {/* Social Proof */}
        <p className="text-sm text-muted-foreground pt-8">
          Fine Tune Lab keeps your models improving themselves—visually, securely, and automatically.
        </p>
      </div>
    </section>
  );
}
