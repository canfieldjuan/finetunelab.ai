'use client';

// Export Type Selector Component
// Date: October 25, 2025

import { Label } from '@/components/ui/label';
import {
  BarChart3,
  TrendingUp,
  Database,
  GitCompare,
  Wrench,
  Star,
} from 'lucide-react';
import type { ExportType } from './types';
import { EXPORT_TYPE_LABELS, EXPORT_TYPE_DESCRIPTIONS } from './types';

export interface ExportTypeSelectorProps {
  selectedType: ExportType;
  onChange: (type: ExportType) => void;
  availableTypes?: ExportType[];
}

export function ExportTypeSelector({
  selectedType,
  onChange,
  availableTypes,
}: ExportTypeSelectorProps) {
  console.log('[ExportTypeSelector] Rendered', { selectedType });

  const types: ExportType[] = availableTypes || [
    'overview',
    'timeseries',
    'complete',
    'model_comparison',
    'tool_usage',
    'quality_trends',
  ];

  const getIcon = (type: ExportType) => {
    const className = "h-4 w-4";
    switch (type) {
      case 'overview':
        return <BarChart3 className={className} />;
      case 'timeseries':
        return <TrendingUp className={className} />;
      case 'complete':
        return <Database className={className} />;
      case 'model_comparison':
        return <GitCompare className={className} />;
      case 'tool_usage':
        return <Wrench className={className} />;
      case 'quality_trends':
        return <Star className={className} />;
    }
  };

  return (
    <div className="space-y-2">
      <Label>Data Type</Label>
      <div className="grid gap-2">
        {types.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
              selectedType === type
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <div className="mt-0.5">{getIcon(type)}</div>
            <div className="flex-1">
              <div className="font-medium">{EXPORT_TYPE_LABELS[type]}</div>
              <div className="text-sm text-muted-foreground">
                {EXPORT_TYPE_DESCRIPTIONS[type]}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
