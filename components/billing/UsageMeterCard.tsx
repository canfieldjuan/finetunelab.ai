/**
 * UsageMeterCard Component
 * Displays real-time usage for traces and payload with progress indicators
 */

"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface UsageMeterCardProps {
  label: string;
  description: string;
  current: number;
  included: number;
  overage: number;
  unit: string;
  icon?: React.ReactNode;
}

export function UsageMeterCard({
  label,
  description,
  current,
  included,
  overage,
  unit,
  icon,
}: UsageMeterCardProps) {
  const percentage = included > 0 ? (current / included) * 100 : 0;
  const isOverage = overage > 0;

  const getProgressColor = () => {
    if (isOverage) return "bg-red-500";
    if (percentage >= 90) return "bg-yellow-500";
    if (percentage >= 75) return "bg-orange-500";
    return "bg-green-500";
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(2)}K`;
    }
    return num.toFixed(2);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">
            {icon && <span className="mr-2">{icon}</span>}
            {label}
          </CardTitle>
        </div>
        <CardDescription className="text-xs">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-2xl font-bold">
                {formatNumber(current)}
              </span>
              <span className="text-sm text-muted-foreground">
                / {formatNumber(included)} {unit}
              </span>
            </div>
            <Progress
              value={Math.min(percentage, 100)}
              className="h-2"
              indicatorClassName={getProgressColor()}
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {percentage.toFixed(1)}% used
            </span>
            {isOverage && (
              <span className="font-medium text-red-600 dark:text-red-400">
                +{formatNumber(overage)} {unit} overage
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
