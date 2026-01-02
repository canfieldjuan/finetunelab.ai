"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Code, Database, BarChart3, MessageSquare, FileCode, GitBranch, Activity, Cloud } from "lucide-react";

const painPoints = {
  developers: [
    "Context switching kills flow",
    "Debugging across 5+ platforms",
    "Custom glue code everywhere"
  ],
  users: [
    "Can't test models easily",
    "Need developer to run tests",
    "No visibility into quality"
  ],
  teams: [
    "Tribal knowledge required",
    "Unclear what's in prod",
    "Slow iteration cycles"
  ]
};

const tools = [
  { name: "MLflow", icon: Database },
  { name: "W&B", icon: BarChart3 },
  { name: "Custom Scripts", icon: FileCode },
  { name: "Jupyter", icon: Code },
  { name: "CloudWatch", icon: Cloud },
  { name: "Slack (for versioning!)", icon: MessageSquare },
  { name: "Datadog", icon: Activity },
  { name: "Postman", icon: GitBranch }
];

export function FragmentationProblem() {
  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-4 mb-16">
          <div className="inline-block px-4 py-2 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
            <span className="text-sm font-semibold text-red-900 dark:text-red-200">
              The Tool Sprawl Crisis
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold">
            Building LLMs Today Means
            <br />
            Juggling 8+ Tools
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Your team is duct-taping together MLflow, W&B, custom scripts, and Slack threads.
            There has to be a better way.
          </p>
        </div>

        {/* Tools Chaos Visualization */}
        <div className="mb-16 p-8 rounded-2xl bg-card border-2 border-dashed border-muted-foreground/20">
          <div className="flex flex-col items-center gap-6">
            {/* Tools scattered around */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
              {tools.map((tool, i) => {
                const Icon = tool.icon;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-muted-foreground/20"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium truncate">{tool.name}</span>
                  </div>
                );
              })}
            </div>

            {/* Arrow pointing down */}
            <div className="flex flex-col items-center gap-2">
              <div className="h-12 w-0.5 bg-muted-foreground/30" />
              <div className="text-lg font-bold text-muted-foreground">???</div>
              <div className="h-12 w-0.5 bg-muted-foreground/30" />
            </div>

            {/* "Your Model" box */}
            <div className="px-6 py-3 rounded-lg bg-destructive/10 border-2 border-destructive/30">
              <span className="font-semibold text-destructive">Your Model (Somewhere)</span>
            </div>

            {/* Arrow pointing down */}
            <div className="flex flex-col items-center gap-2">
              <div className="h-12 w-0.5 bg-muted-foreground/30" />
              <div className="text-lg font-bold text-muted-foreground">???</div>
            </div>

            {/* Production */}
            <div className="px-6 py-3 rounded-lg bg-muted border">
              <span className="font-semibold">Production ???</span>
            </div>
          </div>
        </div>

        {/* Pain Points Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="border-2">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold mb-4 text-blue-600 dark:text-blue-400">
                For Developers
              </h3>
              <ul className="space-y-2">
                {painPoints.developers.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-destructive mt-0.5">✗</span>
                    {point}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold mb-4 text-purple-600 dark:text-purple-400">
                For Users/QA
              </h3>
              <ul className="space-y-2">
                {painPoints.users.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-destructive mt-0.5">✗</span>
                    {point}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold mb-4 text-orange-600 dark:text-orange-400">
                For Teams
              </h3>
              <ul className="space-y-2">
                {painPoints.teams.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-destructive mt-0.5">✗</span>
                    {point}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Transition */}
        <div className="text-center mt-12">
          <p className="text-lg font-medium text-foreground">
            There's a better way ↓
          </p>
        </div>
      </div>
    </section>
  );
}
