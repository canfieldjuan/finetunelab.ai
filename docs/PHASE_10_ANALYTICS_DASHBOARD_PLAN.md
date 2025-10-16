# Phase 10: Analytics Dashboard Implementation

**Feature:** Visualize metrics and evaluations for training insights
**Estimated Time:** 3-4 hours
**Priority:** HIGH - Critical for model training optimization
**Status:** Planning Complete - Ready for Implementation

---

## Table of Contents
1. [Overview](#overview)
2. [Current State Analysis](#current-state-analysis)
3. [Architecture Design](#architecture-design)
4. [Implementation Plan](#implementation-plan)
5. [UI Design](#ui-design)
6. [Verification Checklist](#verification-checklist)

---

## Overview

### Objective
Create a dedicated analytics dashboard page (`/analytics`) that visualizes conversation metrics, evaluation data, and training insights. The dashboard will help users understand model performance, identify areas for improvement, and make data-driven decisions for fine-tuning.

### Success Criteria
- New `/analytics` route accessible from user settings
- Authentication required (follows existing auth pattern)
- Visualizes data from Phase 7 metrics and Phase 9 evaluations
- Responsive design matching existing pages
- No breaking changes to existing functionality
- TypeScript compiles successfully
- Dev server runs without errors

### Key Principle
**Never assume - always verify before implementing**

---

## Current State Analysis

### Existing Page Structure (Verified)

**Root Layout:** `app/layout.tsx`
- Uses `globals.css` for styling
- Wraps all pages in `<AuthProvider>`
- Sets metadata (title, description)

**Chat Page Pattern:** `app/chat/page.tsx`
```typescript
'use client';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function ChatPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) return <LoadingSpinner />;
  if (!user) return <AuthRequired />;
  return <MainComponent />;
}
```

**Key Patterns Identified:**
1. ✅ All pages use `'use client'` directive
2. ✅ Auth checks via `useAuth()` hook
3. ✅ Loading state with spinner
4. ✅ Redirect to `/login` if not authenticated
5. ✅ Tailwind CSS for styling
6. ✅ lucide-react for icons

### Available UI Components (Verified)

**Current Components:** `components/ui/`
- button.tsx ✅
- input.tsx ✅
- label.tsx ✅
- separator.tsx ✅
- alert.tsx ✅

**Missing Components Needed:**
- card.tsx (for dashboard sections)
- select.tsx (for filters)
- badge.tsx (for status indicators)
- table.tsx (optional, for data tables)

### Data Sources (Phase 7 + 9)

**Tables Available:**
1. `messages` - All messages with metrics
   - latency_ms
   - input_tokens
   - output_tokens
   - tools_called
   - tool_success
   - error_type
   - created_at

2. `message_evaluations` - Human ratings
   - rating (1-5)
   - success
   - failure_tags
   - notes
   - expected_behavior
   - created_at

3. `conversations` - Conversation metadata
   - title
   - created_at
   - user_id

### Navigation Integration Point

**Current Settings Menu:** `components/Chat.tsx:812-883`
```typescript
<div className="absolute bottom-full left-0 right-0 mb-2 bg-background border rounded-lg shadow-lg z-20">
  <button>Archived</button>
  <button>Export</button>
  <button>Knowledge</button>
  <button>GraphRAG</button>
  <button>Log out</button>
</div>
```

**Addition Required:**
Add "Analytics" button to settings dropdown

---

## Architecture Design

### Route Structure

```
/analytics
└── page.tsx (new file)
```

**URL:** `http://localhost:3000/analytics`

### Component Structure

```
app/analytics/page.tsx (Main page component)
└── components/analytics/
    ├── AnalyticsDashboard.tsx (Main dashboard component)
    ├── MetricsOverview.tsx (Summary cards)
    ├── RatingDistribution.tsx (Star rating chart)
    ├── SuccessRateChart.tsx (Success vs failure)
    ├── TokenUsageChart.tsx (Token trends)
    ├── ErrorBreakdown.tsx (Error type pie chart)
    ├── ToolPerformance.tsx (Tool success rates)
    └── index.ts (Barrel export)
```

### Data Flow

```
[Analytics Page]
    ↓
[useAnalytics hook] → Fetch data from Supabase
    ↓
[AnalyticsDashboard] → Aggregate and transform data
    ↓
[Chart Components] → Visualize data
```

### New Dependencies Required

**Chart Library:**
```bash
npm install recharts
npm install --save-dev @types/recharts
```

**Why Recharts?**
- React-native, works well with Next.js
- TypeScript support
- Responsive by default
- Composable API
- Lightweight (~100kb)
- Similar API to D3 but simpler

---

## Implementation Plan

### Phase 10.1: Install Dependencies

**Commands:**
```bash
npm install recharts
npm install --save-dev @types/recharts
```

**Verification:**
- [ ] package.json updated
- [ ] node_modules contains recharts
- [ ] TypeScript types available
- [ ] Dev server restarts successfully

---

### Phase 10.2: Create Missing UI Components

**File 1:** `components/ui/card.tsx` (NEW FILE - ~60 lines)

```typescript
import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

export { Card, CardHeader, CardTitle, CardContent }
```

**File 2:** `components/ui/select.tsx` (NEW FILE - ~80 lines)

```typescript
"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const Select = SelectPrimitive.Root
const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

export {
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
}
```

**Note:** Requires installing @radix-ui/react-select:
```bash
npm install @radix-ui/react-select
```

**Verification:**
- [ ] card.tsx created
- [ ] select.tsx created
- [ ] Components compile without errors
- [ ] Imports work correctly

---

### Phase 10.3: Create Analytics Hook

**File:** `hooks/useAnalytics.ts` (NEW FILE - ~150 lines)

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface AnalyticsData {
  overview: {
    totalMessages: number;
    totalConversations: number;
    totalEvaluations: number;
    avgRating: number;
    successRate: number;
  };
  ratingDistribution: Array<{ rating: number; count: number }>;
  successFailure: Array<{ name: string; value: number }>;
  tokenUsage: Array<{ date: string; input: number; output: number }>;
  errorBreakdown: Array<{ name: string; value: number }>;
  toolPerformance: Array<{ tool: string; success: number; failure: number }>;
}

interface UseAnalyticsParams {
  userId: string;
  timeRange?: '7d' | '30d' | '90d' | 'all';
}

export function useAnalytics({ userId, timeRange = '30d' }: UseAnalyticsParams) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      setError(null);

      try {
        // Calculate date filter
        const dateFilter = getDateFilter(timeRange);

        // Fetch messages with metrics
        const { data: messages, error: msgError } = await supabase
          .from('messages')
          .select('id, role, created_at, latency_ms, input_tokens, output_tokens, tools_called, tool_success, error_type')
          .eq('user_id', userId)
          .gte('created_at', dateFilter)
          .order('created_at', { ascending: true });

        if (msgError) throw msgError;

        // Fetch evaluations
        const { data: evaluations, error: evalError } = await supabase
          .from('message_evaluations')
          .select('rating, success, failure_tags, created_at')
          .eq('evaluator_id', userId)
          .gte('created_at', dateFilter);

        if (evalError) throw evalError;

        // Fetch conversations count
        const { count: convCount, error: convError } = await supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', dateFilter);

        if (convError) throw convError;

        // Process and aggregate data
        const analytics = processAnalyticsData(messages || [], evaluations || [], convCount || 0);
        setData(analytics);

        console.log('[Analytics] Data loaded:', {
          messages: messages?.length,
          evaluations: evaluations?.length,
          conversations: convCount
        });
      } catch (err) {
        console.error('[Analytics] Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchAnalytics();
    }
  }, [userId, timeRange]);

  return { data, loading, error, refetch: () => {} };
}

function getDateFilter(timeRange: string): string {
  const now = new Date();
  switch (timeRange) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    case 'all':
      return new Date(0).toISOString();
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }
}

function processAnalyticsData(
  messages: any[],
  evaluations: any[],
  conversationCount: number
): AnalyticsData {
  // Calculate overview stats
  const totalMessages = messages.filter(m => m.role === 'assistant').length;
  const totalEvaluations = evaluations.length;
  const avgRating = evaluations.length > 0
    ? evaluations.reduce((sum, e) => sum + (e.rating || 0), 0) / evaluations.length
    : 0;
  const successCount = evaluations.filter(e => e.success).length;
  const successRate = evaluations.length > 0 ? (successCount / evaluations.length) * 100 : 0;

  // Rating distribution
  const ratingCounts = [1, 2, 3, 4, 5].map(rating => ({
    rating,
    count: evaluations.filter(e => e.rating === rating).length
  }));

  // Success vs failure
  const successFailure = [
    { name: 'Successful', value: successCount },
    { name: 'Failed', value: evaluations.length - successCount }
  ];

  // Token usage by day (last 7-30 days)
  const tokenUsage = aggregateTokensByDay(messages);

  // Error breakdown
  const errorTypes = messages
    .filter(m => m.error_type)
    .reduce((acc: Record<string, number>, m) => {
      acc[m.error_type] = (acc[m.error_type] || 0) + 1;
      return acc;
    }, {});
  const errorBreakdown = Object.entries(errorTypes).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    value
  }));

  // Tool performance
  const toolStats = messages
    .filter(m => m.tools_called && Array.isArray(m.tools_called))
    .flatMap(m => m.tools_called)
    .reduce((acc: Record<string, { success: number; failure: number }>, tool: any) => {
      if (!acc[tool.name]) {
        acc[tool.name] = { success: 0, failure: 0 };
      }
      if (tool.success) {
        acc[tool.name].success++;
      } else {
        acc[tool.name].failure++;
      }
      return acc;
    }, {});
  const toolPerformance = Object.entries(toolStats).map(([tool, stats]) => ({
    tool,
    ...stats
  }));

  return {
    overview: {
      totalMessages,
      totalConversations: conversationCount,
      totalEvaluations,
      avgRating,
      successRate
    },
    ratingDistribution: ratingCounts,
    successFailure,
    tokenUsage,
    errorBreakdown,
    toolPerformance
  };
}

function aggregateTokensByDay(messages: any[]): Array<{ date: string; input: number; output: number }> {
  const dayMap: Record<string, { input: number; output: number }> = {};

  messages.forEach(msg => {
    const date = new Date(msg.created_at).toISOString().split('T')[0];
    if (!dayMap[date]) {
      dayMap[date] = { input: 0, output: 0 };
    }
    dayMap[date].input += msg.input_tokens || 0;
    dayMap[date].output += msg.output_tokens || 0;
  });

  return Object.entries(dayMap)
    .map(([date, tokens]) => ({ date, ...tokens }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
```

**Verification:**
- [ ] Hook created
- [ ] TypeScript types correct
- [ ] Database queries valid
- [ ] Data aggregation logic works

---

### Phase 10.4: Create Analytics Components

**File 1:** `components/analytics/MetricsOverview.tsx` (NEW FILE - ~80 lines)

```typescript
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { TrendingUp, MessageSquare, Star, CheckCircle } from 'lucide-react';

interface MetricsOverviewProps {
  totalMessages: number;
  totalConversations: number;
  totalEvaluations: number;
  avgRating: number;
  successRate: number;
}

export function MetricsOverview({
  totalMessages,
  totalConversations,
  totalEvaluations,
  avgRating,
  successRate
}: MetricsOverviewProps) {
  const metrics = [
    {
      title: 'Total Messages',
      value: totalMessages,
      icon: MessageSquare,
      color: 'text-blue-500'
    },
    {
      title: 'Conversations',
      value: totalConversations,
      icon: TrendingUp,
      color: 'text-green-500'
    },
    {
      title: 'Average Rating',
      value: avgRating.toFixed(1),
      suffix: ' / 5',
      icon: Star,
      color: 'text-yellow-500'
    },
    {
      title: 'Success Rate',
      value: `${successRate.toFixed(1)}%`,
      icon: CheckCircle,
      color: 'text-emerald-500'
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric, idx) => {
        const Icon = metric.icon;
        return (
          <Card key={idx}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {metric.title}
              </CardTitle>
              <Icon className={`h-4 w-4 ${metric.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metric.value}
                {metric.suffix && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {metric.suffix}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
```

**File 2:** `components/analytics/RatingDistribution.tsx` (NEW FILE - ~60 lines)

```typescript
"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface RatingDistributionProps {
  data: Array<{ rating: number; count: number }>;
}

export function RatingDistribution({ data }: RatingDistributionProps) {
  // Transform data for chart
  const chartData = data.map(item => ({
    rating: `${item.rating} ★`,
    count: item.count
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rating Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="rating" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#facc15" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

**File 3:** `components/analytics/SuccessRateChart.tsx` (NEW FILE - ~60 lines)

```typescript
"use client";

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface SuccessRateChartProps {
  data: Array<{ name: string; value: number }>;
}

const COLORS = ['#10b981', '#ef4444'];

export function SuccessRateChart({ data }: SuccessRateChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Success vs Failure</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

**File 4:** `components/analytics/TokenUsageChart.tsx` (NEW FILE - ~70 lines)

```typescript
"use client";

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface TokenUsageChartProps {
  data: Array<{ date: string; input: number; output: number }>;
}

export function TokenUsageChart({ data }: TokenUsageChartProps) {
  // Format dates for display
  const chartData = data.map(item => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }));

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Token Usage Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="input" stroke="#3b82f6" name="Input Tokens" />
            <Line type="monotone" dataKey="output" stroke="#10b981" name="Output Tokens" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

**File 5:** `components/analytics/index.ts` (NEW FILE - ~10 lines)

```typescript
export { MetricsOverview } from './MetricsOverview';
export { RatingDistribution } from './RatingDistribution';
export { SuccessRateChart } from './SuccessRateChart';
export { TokenUsageChart } from './TokenUsageChart';
```

**Verification:**
- [ ] All analytics components created
- [ ] Charts render correctly
- [ ] TypeScript types correct
- [ ] Responsive design works

---

### Phase 10.5: Create Main Dashboard Component

**File:** `components/analytics/AnalyticsDashboard.tsx` (NEW FILE - ~120 lines)

```typescript
"use client";

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import {
  MetricsOverview,
  RatingDistribution,
  SuccessRateChart,
  TokenUsageChart
} from './index';

export function AnalyticsDashboard() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const { data, loading, error } = useAnalytics({
    userId: user?.id || '',
    timeRange
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-800 mb-2">Error Loading Analytics</h2>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-muted-foreground">No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/chat">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Chat
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
              <p className="text-muted-foreground">
                Insights from your conversations and evaluations
              </p>
            </div>
          </div>

          {/* Time Range Filter */}
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Overview Cards */}
        <MetricsOverview
          totalMessages={data.overview.totalMessages}
          totalConversations={data.overview.totalConversations}
          totalEvaluations={data.overview.totalEvaluations}
          avgRating={data.overview.avgRating}
          successRate={data.overview.successRate}
        />

        {/* Charts Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          <RatingDistribution data={data.ratingDistribution} />
          <SuccessRateChart data={data.successFailure} />
        </div>

        {/* Token Usage */}
        {data.tokenUsage.length > 0 && (
          <TokenUsageChart data={data.tokenUsage} />
        )}

        {/* Additional Info */}
        {data.overview.totalEvaluations === 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              <strong>Tip:</strong> Rate some responses using the star button to see more detailed analytics!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Verification:**
- [ ] Dashboard component created
- [ ] Integrates all sub-components
- [ ] Loading and error states work
- [ ] Time range filter functional
- [ ] Responsive layout

---

### Phase 10.6: Create Analytics Page

**File:** `app/analytics/page.tsx` (NEW FILE - ~50 lines)

```typescript
'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';

export default function AnalyticsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('[AnalyticsPage] Auth state:', { user: user?.email, loading });

    if (!loading && !user) {
      console.warn('[AnalyticsPage] No authenticated user, redirecting to login');
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading authentication...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-yellow-800 mb-2">Authentication Required</h2>
          <p className="text-yellow-700 mb-4">You must be logged in to access analytics.</p>
          <p className="text-sm text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return <AnalyticsDashboard />;
}
```

**Verification:**
- [ ] Page created
- [ ] Follows existing page pattern
- [ ] Auth checks work
- [ ] Loading states correct
- [ ] Redirects to /login if not authenticated

---

### Phase 10.7: Add Navigation Link

**File:** `components/Chat.tsx`

**Change Location:** Lines 812-883 (User Settings Dropdown)

**Add Analytics Button (before Export button):**

```typescript
{/* Settings Dropdown */}
{showUserSettings && (
  <div className="absolute bottom-full left-0 right-0 mb-2 bg-background border rounded-lg shadow-lg z-20">
    <button
      onClick={() => {
        setShowArchiveManager(true);
        setShowUserSettings(false);
      }}
      className="w-full text-left px-4 py-3 text-sm hover:bg-muted flex items-center gap-3 rounded-t-lg"
    >
      <Archive className="w-4 h-4" />
      <span>Archived</span>
    </button>
    {/* NEW: Analytics Button */}
    <Link href="/analytics" passHref>
      <button
        onClick={() => setShowUserSettings(false)}
        className="w-full text-left px-4 py-3 text-sm hover:bg-muted flex items-center gap-3"
      >
        <BarChart3 className="w-4 h-4" />
        <span>Analytics</span>
      </button>
    </Link>
    {/* END NEW */}
    <button
      onClick={() => {
        setShowExportDialog(true);
        setShowUserSettings(false);
      }}
      className="w-full text-left px-4 py-3 text-sm hover:bg-muted flex items-center gap-3"
    >
      <Download className="w-4 h-4" />
      <span>Export</span>
    </button>
    {/* ... rest of menu ... */}
  </div>
)}
```

**Also add import at top:**
```typescript
import { BarChart3, Database, Paperclip, CheckCircle, MoreVertical, Trash2, Download, Archive, Settings, LogOut, Plus, Star } from 'lucide-react';
import Link from 'next/link';
```

**Verification:**
- [ ] Analytics button added to settings
- [ ] Link navigates to /analytics
- [ ] Icon renders correctly
- [ ] Menu closes after click

---

## UI Design

### Analytics Dashboard Layout

```
┌────────────────────────────────────────────────────────────┐
│  [← Back to Chat]  Analytics Dashboard    [Time Range ▼]  │
│  Insights from your conversations and evaluations          │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐      │
│  │ 💬      │  │ 📈      │  │ ⭐      │  │ ✓       │      │
│  │ Total   │  │ Convs   │  │ Avg     │  │ Success │      │
│  │ Msgs    │  │ 42      │  │ Rating  │  │ Rate    │      │
│  │ 156     │  │         │  │ 4.2/5   │  │ 87%     │      │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘      │
│                                                             │
│  ┌──────────────────────┐  ┌──────────────────────┐      │
│  │ Rating Distribution  │  │ Success vs Failure   │      │
│  │                      │  │                      │      │
│  │  [Bar Chart]         │  │  [Pie Chart]         │      │
│  │                      │  │  87% Success         │      │
│  │  1★ 2★ 3★ 4★ 5★     │  │  13% Failure         │      │
│  └──────────────────────┘  └──────────────────────┘      │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Token Usage Over Time                                 │ │
│  │                                                       │ │
│  │  [Line Chart showing input/output tokens by day]     │ │
│  │                                                       │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### Color Scheme (Matches Existing)

- Primary: Blue (#3b82f6)
- Success: Green (#10b981)
- Warning: Yellow (#facc15)
- Error: Red (#ef4444)
- Background: var(--background)
- Foreground: var(--foreground)
- Muted: var(--muted)

---

## Verification Checklist

### Dependencies
- [ ] recharts installed
- [ ] @types/recharts installed
- [ ] @radix-ui/react-select installed
- [ ] package.json updated
- [ ] node_modules populated

### UI Components
- [ ] card.tsx created and working
- [ ] select.tsx created and working
- [ ] Components use correct Tailwind classes
- [ ] Components follow existing UI patterns

### Analytics Hook
- [ ] useAnalytics.ts created
- [ ] Database queries working
- [ ] Data aggregation correct
- [ ] TypeScript types valid
- [ ] Error handling implemented

### Analytics Components
- [ ] MetricsOverview.tsx created
- [ ] RatingDistribution.tsx created
- [ ] SuccessRateChart.tsx created
- [ ] TokenUsageChart.tsx created
- [ ] Components render charts correctly
- [ ] Responsive design works

### Dashboard Component
- [ ] AnalyticsDashboard.tsx created
- [ ] Integrates all sub-components
- [ ] Time range filter works
- [ ] Loading state shows
- [ ] Error state shows
- [ ] Empty state shows message

### Page Integration
- [ ] app/analytics/page.tsx created
- [ ] Follows existing page pattern
- [ ] Auth checks implemented
- [ ] Loading states work
- [ ] Redirects to /login correctly

### Navigation
- [ ] Analytics button added to Chat.tsx
- [ ] Link navigates to /analytics
- [ ] Icon imports correct
- [ ] Menu closes after click

### Testing
- [ ] TypeScript compiles (0 errors)
- [ ] Dev server runs without errors
- [ ] Can navigate to /analytics
- [ ] Auth redirect works
- [ ] Charts render with data
- [ ] Time range filter updates data
- [ ] Back button returns to /chat
- [ ] Mobile responsive
- [ ] No breaking changes to chat

### Database Queries
- [ ] Messages query works
- [ ] Evaluations query works
- [ ] Conversations count works
- [ ] Date filters work correctly
- [ ] RLS policies respected

---

## Rollback Plan

### If Implementation Fails

1. Remove new files:
   - `app/analytics/page.tsx`
   - `components/analytics/` (entire directory)
   - `hooks/useAnalytics.ts`
   - `components/ui/card.tsx`
   - `components/ui/select.tsx`

2. Revert Chat.tsx changes:
   - Remove Analytics button
   - Remove BarChart3 import
   - Remove Link import

3. Uninstall dependencies:
   ```bash
   npm uninstall recharts @types/recharts @radix-ui/react-select
   ```

4. Clear cache and restart:
   ```bash
   rm -rf .next
   npm run dev
   ```

### Backward Compatibility

- ✅ No changes to existing tables
- ✅ No changes to existing APIs
- ✅ Chat functionality unchanged
- ✅ Export functionality unchanged
- ✅ Evaluation functionality unchanged
- ✅ Optional feature (analytics)
- ✅ Can be accessed only via settings menu

---

## Testing Strategy

### Manual Testing Checklist

1. **Authentication Flow:**
   - Visit /analytics without login → redirects to /login
   - Login → can access /analytics
   - Logout → redirected to /login

2. **Data Display:**
   - With no evaluations → shows "Tip" message
   - With evaluations → shows all charts
   - With different time ranges → data updates

3. **Navigation:**
   - Click "Analytics" in settings → opens /analytics
   - Click "Back to Chat" → returns to /chat
   - Browser back button → navigates correctly

4. **Responsive Design:**
   - Desktop (1920x1080) → 4 columns for metrics
   - Tablet (768px) → 2 columns for metrics
   - Mobile (375px) → 1 column, stacked charts

5. **Chart Interactions:**
   - Hover on charts → tooltip shows
   - Charts are readable
   - Colors are distinguishable
   - No overflow or clipping

6. **Time Range Filter:**
   - Select "Last 7 days" → data updates
   - Select "Last 30 days" → data updates
   - Select "All time" → all data shown

7. **Error Scenarios:**
   - Database error → shows error message
   - No data → shows "No data available"
   - Network error → shows error message

### Database Verification

**Check data is loaded correctly:**
```sql
-- Verify messages with metrics
SELECT COUNT(*), AVG(latency_ms), SUM(input_tokens)
FROM messages
WHERE user_id = 'your-user-id'
AND created_at >= NOW() - INTERVAL '30 days';

-- Verify evaluations
SELECT AVG(rating), COUNT(*)
FROM message_evaluations
WHERE evaluator_id = 'your-user-id'
AND created_at >= NOW() - INTERVAL '30 days';

-- Verify conversations count
SELECT COUNT(*)
FROM conversations
WHERE user_id = 'your-user-id'
AND created_at >= NOW() - INTERVAL '30 days';
```

---

## Next Steps After Phase 10

1. **Phase 11: Automated Training Pipeline** - CI/CD for model fine-tuning
2. **Phase 12: A/B Testing** - Compare model versions
3. **Phase 13: Enhanced Analytics** - More chart types, custom queries

---

## Performance Considerations

### Data Loading
- Load only necessary date range
- Aggregate data on client (not in DB)
- Cache results for time range
- Lazy load charts (viewport detection)

### Optimization Opportunities
- Add indices on created_at columns
- Paginate large datasets
- Server-side aggregation for large datasets
- Add Redis caching for aggregate queries

### Scalability
- Current design handles up to ~10,000 messages
- For larger datasets, consider:
  - Server-side aggregation API
  - Materialized views in Supabase
  - Background job for analytics updates

---

**Document Version:** 1.0
**Created:** 2025-10-13
**Last Updated:** 2025-10-13
**Status:** Ready for Implementation
**Estimated Lines of Code:** ~1,200 lines
**Estimated Time:** 3-4 hours
