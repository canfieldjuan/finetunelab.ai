"use client";

import React from "react";
import { AnnotatedTraceDemo } from "../AnnotatedTraceDemo";

export function LiveTraceDemo() {
  return (
    <section className="py-20 px-4 bg-background">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            See Every Request.
            <br />
            <span className="bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent">
              In Real-Time.
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            This is what you see for <span className="font-semibold text-foreground">every single LLM call</span>.
            No more guessing. No more debugging blind.
          </p>
        </div>

        {/* Trace Demo */}
        <div className="max-w-5xl mx-auto">
          <AnnotatedTraceDemo />
        </div>

        {/* Bottom Text */}
        <div className="text-center mt-12">
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
            Every trace captures 40+ metrics including TTFT, token counts, costs, errors, retries, and quality scores.
            <span className="block mt-2 font-medium text-foreground">
              All automatically. All in real-time. All without changing your code.
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
