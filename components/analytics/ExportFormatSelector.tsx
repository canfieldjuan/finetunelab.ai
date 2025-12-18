'use client';

// Export Format Selector Component
// Date: October 25, 2025

import { Label } from '@/components/ui/label';
import { FileSpreadsheet, Code, FileText, File } from 'lucide-react';
import type { ExportFormat } from './types';
import { FORMAT_LABELS, FORMAT_DESCRIPTIONS } from './types';

export interface ExportFormatSelectorProps {
  selectedFormat: ExportFormat;
  onChange: (format: ExportFormat) => void;
}

export function ExportFormatSelector({
  selectedFormat,
  onChange,
}: ExportFormatSelectorProps) {
  console.log('[ExportFormatSelector] Rendered', { selectedFormat });

  const formats: ExportFormat[] = ['csv', 'json', 'pdf', 'html', 'report'];

  const getIcon = (format: ExportFormat) => {
    const className = "h-4 w-4";
    switch (format) {
      case 'csv':
        return <FileSpreadsheet className={className} />;
      case 'json':
        return <Code className={className} />;
      case 'pdf':
        return <File className={className} />;
      case 'html':
        return <FileText className={className} />;
      case 'report':
        return <FileText className={className} />;
    }
  };

  return (
    <div className="space-y-2">
      <Label>Export Format</Label>
      <div className="grid gap-2">
        {formats.map((format) => (
          <button
            key={format}
            type="button"
            onClick={() => onChange(format)}
            className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
              selectedFormat === format
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <div className="mt-0.5">{getIcon(format)}</div>
            <div className="flex-1">
              <div className="font-medium">{FORMAT_LABELS[format]}</div>
              <div className="text-sm text-muted-foreground">
                {FORMAT_DESCRIPTIONS[format]}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
