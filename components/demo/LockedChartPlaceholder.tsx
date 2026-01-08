/**
 * LockedChartPlaceholder Component
 * Shows grayed-out chart placeholder with upgrade CTA
 */

'use client';

import React from 'react';
import { Lock, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface LockedChartPlaceholderProps {
  title: string;
  description: string;
  benefit: string;
  icon: React.ComponentType<{ className?: string }>;
  onUpgradeClick: () => void;
}

export function LockedChartPlaceholder({
  title,
  description,
  benefit,
  icon: Icon,
  onUpgradeClick
}: LockedChartPlaceholderProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-5 w-5 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Grayed-out chart area */}
        <div className="relative h-48 bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
          {/* Lock overlay */}
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="p-3 bg-muted rounded-full">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-sm mb-1">{description}</p>
              <p className="text-xs text-muted-foreground">{benefit}</p>
            </div>
            <Button
              onClick={onUpgradeClick}
              size="sm"
              variant="default"
              className="mt-2"
            >
              Unlock Full Analytics
              <ArrowRight className="ml-2 h-3 w-3" />
            </Button>
          </div>

          {/* Chart silhouette (decorative) */}
          <div className="absolute inset-0 p-4 opacity-20">
            <div className="h-full flex items-end gap-1">
              <div className="flex-1 bg-primary/40 rounded-t" style={{ height: '40%' }} />
              <div className="flex-1 bg-primary/40 rounded-t" style={{ height: '60%' }} />
              <div className="flex-1 bg-primary/40 rounded-t" style={{ height: '35%' }} />
              <div className="flex-1 bg-primary/40 rounded-t" style={{ height: '80%' }} />
              <div className="flex-1 bg-primary/40 rounded-t" style={{ height: '55%' }} />
              <div className="flex-1 bg-primary/40 rounded-t" style={{ height: '70%' }} />
              <div className="flex-1 bg-primary/40 rounded-t" style={{ height: '45%' }} />
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Historical analytics require 7+ days of trace data
        </p>
      </CardContent>
    </Card>
  );
}
