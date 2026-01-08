"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Zap, Rocket, Calendar } from "lucide-react";

export function FinalCTA() {
  return (
    <section className="py-20 px-4 bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl md:text-5xl font-bold">
            Ready to See It
            <br />
            <span className="bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent">
              In Action?
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Choose your path. No pressure. No commitment.
          </p>
        </div>

        {/* Three Paths */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {/* Path 1: Try Demo */}
          <Card className="border-2 border-primary hover:shadow-xl transition-all group">
            <CardContent className="p-8 text-center space-y-4">
              <div className="inline-flex p-4 rounded-full bg-orange-100 dark:bg-orange-900/30 group-hover:scale-110 transition-transform">
                <Zap className="h-8 w-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold">Try Your Model Now</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Test with real data
                <br />
                No signup required
                <br />
                Takes 2 minutes
              </p>
              <Link href="/demo/test-model" className="block">
                <Button className="w-full bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-700 hover:to-pink-700">
                  Launch Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Path 2: Sign Up */}
          <Card className="border-2 hover:border-primary transition-all group">
            <CardContent className="p-8 text-center space-y-4">
              <div className="inline-flex p-4 rounded-full bg-blue-100 dark:bg-blue-900/30 group-hover:scale-110 transition-transform">
                <Rocket className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold">Start Building</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Full platform access
                <br />
                Free during beta
                <br />
                No credit card
              </p>
              <Link href="/signup" className="block">
                <Button variant="outline" className="w-full">
                  Sign Up Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Path 3: Book Call */}
          <Card className="border-2 hover:border-primary transition-all group">
            <CardContent className="p-8 text-center space-y-4">
              <div className="inline-flex p-4 rounded-full bg-purple-100 dark:bg-purple-900/30 group-hover:scale-110 transition-transform">
                <Calendar className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold">Book a Walkthrough</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                30-min demo with your data
                <br />
                Questions answered live
                <br />
                Team-ready guidance
              </p>
              <Link href="https://cal.com/finetunelab" target="_blank" rel="noopener noreferrer" className="block">
                <Button variant="outline" className="w-full">
                  Book a Call
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Trust Indicators */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            ✓ No credit card required  •  ✓ Free during beta  •  ✓ Cancel anytime
          </p>
        </div>
      </div>
    </section>
  );
}
