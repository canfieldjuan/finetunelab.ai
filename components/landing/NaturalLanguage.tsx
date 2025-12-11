"use client";

import React from "react";
import { MessageSquare, Sparkles } from "lucide-react";

const exampleQueries = [
  {
    question: "Why did response time increase last Tuesday?",
    answer: "AI analyzes logs, finds root cause, shows affected conversations"
  },
  {
    question: "Which model performs best for customer support?",
    answer: "Compares all models across 7 metrics, ranks by success rate"
  },
  {
    question: "Show me conversations rated 1-star this week",
    answer: "Filtered list with sentiment breakdown and common failure patterns"
  },
  {
    question: "What's the ROI of our last training run?",
    answer: "Before/after metrics, cost analysis, quality improvement %"
  }
];

export function NaturalLanguage() {
  console.log("[NaturalLanguage] Component mounted");

  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center space-y-4 mb-16">
          <div className="inline-block px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-950 border border-blue-500/30 mb-4">
            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Killer Feature
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold">
            Ask Questions. Get Answers.
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Forget SQL queries and dashboard hunting. Just ask in plain English.
          </p>
        </div>

        {/* Analytics Chat Preview */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="rounded-xl border-2 border-primary/20 bg-card shadow-xl overflow-hidden">
            {/* Chat Header */}
            <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-4 border-b">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Analytics Chat</h3>
                  <p className="text-xs text-muted-foreground">
                    Natural language queries powered by AI
                  </p>
                </div>
              </div>
            </div>

            {/* Chat Examples */}
            <div className="p-6 space-y-6 bg-gradient-to-br from-background via-background to-muted/20">
              {exampleQueries.slice(0, 2).map((query, index) => (
                <div key={index} className="space-y-3">
                  {/* User Question */}
                  <div className="flex justify-end">
                    <div className="max-w-[80%] bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3">
                      <p className="text-sm">{query.question}</p>
                    </div>
                  </div>

                  {/* AI Response */}
                  <div className="flex justify-start">
                    <div className="max-w-[80%] bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex items-start gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-muted-foreground font-medium">
                          {query.answer}
                        </p>
                      </div>
                      {/* Placeholder for chart/data */}
                      <div className="mt-2 h-16 rounded bg-primary/5 border border-primary/10 flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">
                          [Visual data & charts here]
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs">Analyzing your data...</span>
              </div>
            </div>

            {/* Input */}
            <div className="p-4 border-t bg-background">
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-muted bg-muted/30">
                <MessageSquare className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground flex-1">
                  Try: &quot;What caused the quality drop last week?&quot;
                </span>
                <button className="px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
                  Ask
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Example Queries Grid */}
        <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {exampleQueries.slice(2).map((query, index) => (
            <div key={index} className="p-4 rounded-lg border-2 hover:border-primary/50 transition-colors bg-card">
              <div className="flex items-start gap-3">
                <MessageSquare className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm mb-1">&quot;{query.question}&quot;</p>
                  <p className="text-xs text-muted-foreground">→ {query.answer}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 text-center space-y-4">
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            <span className="font-semibold text-foreground">Your data. Your language. Instant insights.</span>
            <br />
            No SQL. No dashboard hunting. Just ask.
          </p>
        </div>
      </div>
    </section>
  );
}
