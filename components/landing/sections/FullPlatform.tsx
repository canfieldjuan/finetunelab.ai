"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  MessageSquare,
  Upload,
  Zap,
  GitBranch,
  CheckCircle,
  Rocket,
  Activity,
  DollarSign,
  Users
} from "lucide-react";

const features = [
  {
    icon: MessageSquare,
    name: "Playground Testing",
    before: ["Postman + JSON", "Manual curl commands", "No conversation history"],
    after: ["Chat interface", "Multi-turn testing", "Real user scenarios"]
  },
  {
    icon: Upload,
    name: "Dataset Upload",
    before: ["Manual file uploads", "Format conversions", "Version confusion"],
    after: ["Drag & drop", "Auto-format detection", "Versioned automatically"]
  },
  {
    icon: Zap,
    name: "Fine-Tuning Jobs",
    before: ["Custom training scripts", "Manual hyperparameter tuning", "No visibility"],
    after: ["One-click training", "Auto-optimization", "Live progress tracking"]
  },
  {
    icon: GitBranch,
    name: "Model Versioning",
    before: ["Git tags for references", "Slack: 'What's in staging?'", "Manual spreadsheet tracking"],
    after: ["Click 'Deploy v2.1'", "Timeline of all versions", "Rollback in one click"]
  },
  {
    icon: CheckCircle,
    name: "Evaluation Suite",
    before: ["Write evaluation scripts", "Parse outputs manually", "Inconsistent metrics"],
    after: ["Pre-built evaluators", "LLM-as-judge built in", "Standardized scores"]
  },
  {
    icon: Rocket,
    name: "One-Click Deploy",
    before: ["Deploy scripts", "Environment setup", "Hope it works"],
    after: ["Click deploy button", "Auto-scaling", "Instant rollback"]
  },
  {
    icon: Activity,
    name: "Production Monitoring",
    before: ["CloudWatch logs", "Custom dashboards", "Leave app to check logs"],
    after: ["Built-in monitoring", "Live trace viewer", "Everything in one UI"]
  },
  {
    icon: DollarSign,
    name: "Cost Analytics",
    before: ["Parse billing CSVs", "Manual cost tracking", "Surprises at month-end"],
    after: ["Real-time cost tracking", "Budget alerts", "Per-model breakdown"]
  },
  {
    icon: Users,
    name: "Team Collaboration",
    before: ["Slack threads", "Email chains", "Tribal knowledge"],
    after: ["Built-in comments", "Share workspaces", "Permission controls"]
  }
];

export function FullPlatform() {
  return (
    <section className="py-20 px-4 bg-muted/30 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-4xl md:text-5xl font-bold">
            That Was Just Testing.
            <br />
            <span className="text-primary">Here's Everything Else.</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            The complete lifecycle, end-to-end. No duct tape required.
          </p>
        </div>

        {/* Horizontal Scrollable Belt */}
        <div className="relative">
          {/* Scroll container */}
          <div className="overflow-x-auto pb-6 hide-scrollbar">
            <div className="flex gap-6 min-w-max px-4">
              {features.map((feature, i) => {
                const Icon = feature.icon;
                return (
                  <Card
                    key={i}
                    className="w-[320px] border-2 hover:border-primary/50 transition-all shrink-0"
                  >
                    <CardContent className="p-6">
                      {/* Icon & Name */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <h3 className="text-lg font-bold">{feature.name}</h3>
                      </div>

                      {/* Before */}
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-destructive mb-2">Before:</p>
                        <ul className="space-y-1">
                          {feature.before.map((item, j) => (
                            <li key={j} className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <span className="text-destructive mt-0.5">−</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* After */}
                      <div>
                        <p className="text-xs font-semibold text-green-600 mb-2">After:</p>
                        <ul className="space-y-1">
                          {feature.after.map((item, j) => (
                            <li key={j} className="text-xs text-foreground flex items-start gap-1.5">
                              <span className="text-green-600 mt-0.5">✓</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Scroll hint gradient */}
          <div className="absolute top-0 right-0 bottom-0 w-24 bg-gradient-to-l from-muted/30 to-transparent pointer-events-none" />
        </div>

        {/* Bottom Message */}
        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground">
            → Scroll to see all features →
          </p>
        </div>
      </div>

      <style jsx>{`
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  );
}
