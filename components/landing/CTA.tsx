"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export function CTA() {
  console.log("[CTA] Component mounted");

  return (
    <section className="py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-12 text-center text-white">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-24 -translate-x-24" />
          
          {/* Content */}
          <div className="relative z-10 space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Start building AI workflows today</span>
            </div>
            
            <h2 className="text-4xl md:text-5xl font-bold">
              Ready to Build Your AI DAG?
            </h2>
            
            <p className="text-xl text-white/90 max-w-2xl mx-auto">
              The Core tier is free forever. Train locally, build workflows visually, and deploy with confidence.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link href="/signup">
                <Button
                  size="lg"
                  variant="secondary"
                  className="gap-2 text-lg px-8 py-6"
                >
                  Launch the Core Studio
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="gap-2 text-lg px-8 py-6 bg-white/10 hover:bg-white/20 border-white/30 text-white"
              >
                Schedule Demo
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
