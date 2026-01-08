"use client";

import React from "react";
import { Clock, DollarSign, Zap, Database, CheckCircle, TrendingUp, ArrowRight, Star, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function AnnotatedTraceDemo() {
  return (
    <div className="relative">
      {/* Trace Visualization */}
      <Card className="border-2 border-primary/20 bg-background/50 backdrop-blur-sm">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3 flex-wrap">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <h3 className="font-semibold text-lg">LLM Call - Chat Completion</h3>
              <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                llm_call
              </Badge>
              <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300 text-[10px]">
                Streaming
              </Badge>
              <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 text-[10px]">
                Cache Hit
              </Badge>
              <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                Fast TTFT
              </Badge>
            </div>
            <span className="text-sm text-muted-foreground">trace_id: a1b2c3d4</span>
          </div>

          {/* Timeline Bar */}
          <div className="relative mb-8">
            <div className="flex items-center gap-4 mb-2">
              <span className="text-xs text-muted-foreground w-20">Timeline</span>
              <div className="flex-1 h-8 bg-muted rounded-lg overflow-hidden relative">
                {/* TTFT Section */}
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-orange-400 to-orange-500"
                  style={{ width: '15%' }}
                >
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
                    TTFT
                  </span>
                </div>
                {/* Generation Section */}
                <div
                  className="absolute top-0 h-full bg-gradient-to-r from-blue-400 to-blue-500"
                  style={{ left: '15%', width: '85%' }}
                >
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
                    Token Generation
                  </span>
                </div>
              </div>
              <span className="text-xs font-medium w-16 text-right">1,247ms</span>
            </div>
          </div>

          {/* Primary Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {/* TTFT */}
            <div className="relative">
              <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-orange-600" />
                  <span className="text-xs font-medium text-orange-900 dark:text-orange-100">TTFT</span>
                </div>
                <div className="text-2xl font-bold text-orange-600">187ms</div>
                <div className="text-xs text-orange-700 dark:text-orange-300 mt-1">Time to First Token</div>
              </div>
            </div>

            {/* Tokens */}
            <div className="relative">
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-1">
                  <Database className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-medium text-blue-900 dark:text-blue-100">Tokens</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">2,847</div>
                <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  <span className="opacity-70">In: 512</span> • <span className="font-medium">Out: 2,335</span>
                </div>
              </div>
            </div>

            {/* Cost */}
            <div className="relative">
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-xs font-medium text-green-900 dark:text-green-100">Cost</span>
                </div>
                <div className="text-2xl font-bold text-green-600">$0.0042</div>
                <div className="text-xs text-green-700 dark:text-green-300 mt-1">
                  Per Request <span className="opacity-70">(saved $0.0018)</span>
                </div>
              </div>
            </div>

            {/* Throughput */}
            <div className="relative">
              <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                  <span className="text-xs font-medium text-purple-900 dark:text-purple-100">Speed</span>
                </div>
                <div className="text-2xl font-bold text-purple-600">2,204</div>
                <div className="text-xs text-purple-700 dark:text-purple-300 mt-1">Tokens/Second</div>
              </div>
            </div>
          </div>

          {/* Performance Breakdown */}
          <div className="mb-6 p-4 rounded-lg bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-slate-600" />
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Performance Breakdown</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-[10px] text-slate-500 uppercase mb-1">Queue Time</div>
                <div className="text-sm font-mono font-medium">23ms</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase mb-1">Inference Time</div>
                <div className="text-sm font-mono font-medium">1,187ms</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase mb-1">Network Time</div>
                <div className="text-sm font-mono font-medium">37ms</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase mb-1">Cache Hit Tokens</div>
                <div className="text-sm font-mono font-medium text-green-600">1,024</div>
              </div>
            </div>
          </div>

          {/* Token Flow */}
          <div className="mb-6 p-4 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-indigo-600" />
              <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-100 uppercase tracking-wider">Token Flow</span>
            </div>
            <div className="flex items-center text-sm flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs uppercase">Input</span>
                <span className="font-mono font-medium">512</span>
              </div>
              <ArrowRight className="h-3 w-3 text-slate-300" />
              <div className="flex items-center gap-2 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded border border-green-200">
                <Database className="h-3 w-3" />
                <span className="text-xs font-medium">1,024 Cache Hit</span>
              </div>
              <ArrowRight className="h-3 w-3 text-slate-300" />
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs uppercase">Output</span>
                <span className="font-mono font-medium text-purple-600">2,335</span>
              </div>
              <span className="text-slate-300 mx-2">|</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs uppercase">Total</span>
                <span className="font-mono font-bold text-indigo-600">2,847</span>
              </div>
            </div>
          </div>

          {/* Quality Score */}
          <div className="mb-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-semibold text-amber-900 dark:text-amber-100 uppercase tracking-wider">Quality Score</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < 4 ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm font-bold text-amber-600">4.0/5.0</span>
              </div>
            </div>
            <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              User rated: "Helpful and accurate response"
            </div>
          </div>

          {/* Model & Provider Info */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <span className="text-xs text-muted-foreground">Model:</span>
                <span className="ml-2 text-sm font-medium">gpt-4o-mini</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Provider:</span>
                <span className="ml-2 text-sm font-medium">OpenAI</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Region:</span>
                <span className="ml-2 text-sm font-medium">us-east-1</span>
              </div>
            </div>
            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
              <CheckCircle className="h-3 w-3 mr-1" />
              Completed
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Annotations - Positioned absolutely around the trace */}
      <div className="hidden lg:block">
        {/* TTFT Annotation */}
        <div className="absolute -left-64 top-24 w-56">
          <div className="flex items-center gap-2">
            <div className="flex-1 text-right">
              <div className="text-sm font-semibold text-foreground">Time to First Token</div>
              <div className="text-xs text-muted-foreground">
                How fast your model starts responding. Critical for user experience.
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-orange-600 flex-shrink-0" />
          </div>
        </div>

        {/* Cache Hit Annotation */}
        <div className="absolute -right-64 top-80 w-56">
          <div className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-green-600 flex-shrink-0 rotate-180" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">Cache Optimization</div>
              <div className="text-xs text-muted-foreground">
                Automatic prompt caching saves 43% on costs. We track every penny.
              </div>
            </div>
          </div>
        </div>

        {/* Performance Breakdown Annotation */}
        <div className="absolute -left-64 top-96 w-56">
          <div className="flex items-center gap-2">
            <div className="flex-1 text-right">
              <div className="text-sm font-semibold text-foreground">Deep Performance Metrics</div>
              <div className="text-xs text-muted-foreground">
                See queue time, inference, and network separately. Find the real bottlenecks.
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-600 flex-shrink-0" />
          </div>
        </div>

        {/* Quality Score Annotation */}
        <div className="absolute -right-64 top-[500px] w-56">
          <div className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-amber-600 flex-shrink-0 rotate-180" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">User Feedback & Quality</div>
              <div className="text-xs text-muted-foreground">
                Collect ratings, judgments, and quality scores automatically.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Annotations - Below the trace */}
      <div className="lg:hidden mt-6 space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200">
          <Zap className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-foreground">Time to First Token (TTFT)</div>
            <div className="text-xs text-muted-foreground mt-1">
              How fast your model starts responding. Critical for user experience.
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-950/30 border border-slate-200">
          <Activity className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-foreground">Performance Breakdown</div>
            <div className="text-xs text-muted-foreground mt-1">
              Queue time, inference, and network tracked separately. Find real bottlenecks.
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200">
          <Database className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-foreground">Cache Optimization</div>
            <div className="text-xs text-muted-foreground mt-1">
              Automatic prompt caching tracked. This request saved 43% on costs.
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200">
          <Star className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-foreground">Quality & User Feedback</div>
            <div className="text-xs text-muted-foreground mt-1">
              Collect ratings, judgments, and automated quality scores on every request.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
