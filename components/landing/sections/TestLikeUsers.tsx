"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { X, Check, Code, MessageSquare } from "lucide-react";

const oldWay = [
  "Postman with JSON payloads",
  "curl commands in terminal",
  "Custom test scripts",
  "Jupyter notebooks"
];

const newWay = [
  "Dedicated chat playground",
  "Multi-turn conversations",
  "Upload files, send images",
  "Test edge cases interactively"
];

export function TestLikeUsers() {
  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl md:text-5xl font-bold">
            Postman is for APIs.
            <br />
            <span className="text-primary">Your Users Use Chat.</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Stop testing like a developer. Start testing like your users.
          </p>
        </div>

        {/* Split Comparison */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Old Way */}
          <Card className="border-2 border-destructive/30 bg-destructive/5">
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-destructive/20">
                  <Code className="h-6 w-6 text-destructive" />
                </div>
                <h3 className="text-xl font-bold text-destructive">
                  How Devs Test Today
                </h3>
              </div>

              <ul className="space-y-3 mb-6">
                {oldWay.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <X className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>

              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm font-medium text-destructive mb-1">Result:</p>
                <p className="text-sm text-muted-foreground">
                  You test like a developer. Your users experience something different.
                  Quality issues slip through.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* New Way */}
          <Card className="border-2 border-green-500/30 bg-green-500/5">
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <MessageSquare className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-green-600">
                  How You Should Test
                </h3>
              </div>

              <ul className="space-y-3 mb-6">
                {newWay.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>

              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-sm font-medium text-green-600 mb-1">Result:</p>
                <p className="text-sm text-muted-foreground">
                  You test exactly how users will use it. Catch issues before deployment.
                  Ship with confidence.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Message */}
        <div className="mt-12 text-center">
          <p className="text-lg font-medium">
            Test production scenarios, not API endpoints.
          </p>
        </div>
      </div>
    </section>
  );
}
