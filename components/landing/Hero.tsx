"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";
import { VideoModal } from "./VideoModal";
import { FineTuneLabFullLogoV2 } from "@/components/branding";
import Chat from "@/components/Chat";

export function Hero() {
  const [showVideoModal, setShowVideoModal] = useState(false);

  console.log("[Hero] Component mounted");

  return (
    <section className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Navigation */}
      <nav className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <FineTuneLabFullLogoV2 width={180} height={54} />
            </div>
            <div className="flex items-center gap-4">
              <Link href="/lab-academy" className="text-sm font-medium hover:text-primary transition-colors">
                Academy
              </Link>
              <Link href="/login" className="text-sm font-medium hover:text-primary transition-colors">
                Log In
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Content */}
      <div className="relative flex-1 flex items-center justify-center px-4 py-20">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/10" />
      
      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto text-center space-y-8">
        {/* Headline */}
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
          Fine-Tune Any Model
          <br />
          <span className="text-blue-600 dark:text-blue-400">In Under 2 Minutes</span>
        </h1>

        {/* Subheadline */}
        <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          From zero to production in under 2 minutes. Watch how easy it is to fine-tune models with Fine Tune Lab—no complex setup, no DevOps headaches.
        </p>

        {/* Video Demo Embed */}
        <div className="rounded-2xl shadow-2xl overflow-hidden bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 mx-auto max-w-5xl">
          <div className="aspect-video w-full">
            <iframe
              width="100%"
              height="100%"
              src="https://embed.app.guidde.com/playbooks/4bo1pisi2GNonHGAD8f9AF?mode=videoOnly"
              title="Start Fine Tuning and Launch Training Job Quickly"
              frameBorder="0"
              referrerPolicy="unsafe-url"
              allowFullScreen
              allow="clipboard-write"
              sandbox="allow-popups allow-popups-to-escape-sandbox allow-scripts allow-forms allow-same-origin allow-presentation"
              className="rounded-lg"
            />
          </div>
        </div>

        {/* CTA Below Video */}
        <div className="pt-4">
          <Link href="/signup">
            <Button size="lg" className="gap-2 text-lg px-8 py-6 bg-blue-600 hover:bg-blue-700 text-white">
              Start Training Your Model
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>

        {/* Social Proof */}
        <p className="text-sm text-muted-foreground pt-4">
          Experience the power of Fine Tune Lab's closed-loop AI platform with production analytics and real-time feedback.
        </p>
      </div>
      </div>

      {/* Video Modal */}
      <VideoModal
        isOpen={showVideoModal}
        onClose={() => setShowVideoModal(false)}
        title="Fine Tune Lab Demo"
        description="See how Fine Tune Lab works in action"
      />
    </section>
  );
}
