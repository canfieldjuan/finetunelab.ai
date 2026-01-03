'use client';

/**
 * Enhanced Demo Export Modal
 * Integrates full unified export v2 capabilities with persona selection
 * Supports: CEO, Senior Dev, New Team Member personas
 * Date: 2026-01-03
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Download,
  FileText,
  FileJson,
  FileCode,
  File,
  Users,
  Code,
  GraduationCap,
  CheckCircle,
  Loader2,
  X,
  AlertCircle
} from 'lucide-react';

export interface DemoExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  modelName: string;
}

type ExportFormat = 'csv' | 'json' | 'html' | 'pdf';
type AudiencePersona = 'executive' | 'engineering' | 'onboarding';

interface PersonaOption {
  id: AudiencePersona;
  label: string;
  description: string;
  icon: React.ElementType;
  features: string[];
}

const PERSONA_OPTIONS: PersonaOption[] = [
  {
    id: 'executive',
    label: 'CEO / Leadership',
    description: 'High-level business metrics for executives',
    icon: Users,
    features: [
      'Cost trends and ROI',
      'Success rate overview',
      '1-page summary',
      'Business-friendly language'
    ]
  },
  {
    id: 'engineering',
    label: 'Senior Developer',
    description: 'Detailed technical metrics for debugging',
    icon: Code,
    features: [
      'Latency breakdowns',
      'Error stack traces',
      'Performance bottlenecks',
      'Technical language'
    ]
  },
  {
    id: 'onboarding',
    label: 'New Team Member',
    description: 'System overview and getting started guide',
    icon: GraduationCap,
    features: [
      'Model capabilities',
      'Usage patterns',
      'Best practices',
      'Common issues'
    ]
  }
];

export function DemoExportModal({
  isOpen,
  onClose,
  sessionId,
  modelName
}: DemoExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');
  const [selectedPersona, setSelectedPersona] = useState<AudiencePersona>('executive');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    setExportSuccess(false);

    try {
      // For PDF/HTML formats, use persona templates
      if (selectedFormat === 'pdf' || selectedFormat === 'html') {
        await exportWithPersona();
      } else {
        // CSV/JSON - use simple demo export
        await exportBasicFormat();
      }

      setExportSuccess(true);
      setTimeout(() => {
        onClose();
        setExportSuccess(false);
      }, 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed';
      setExportError(message);
    } finally {
      setIsExporting(false);
    }
  };

  const exportWithPersona = async () => {
    // Use unified export v2 API with persona templates
    const url = `/api/demo/v2/export/advanced?session_id=${sessionId}&format=${selectedFormat}&audience=${selectedPersona}`;
    window.open(url, '_blank');
  };

  const exportBasicFormat = async () => {
    // Use basic demo export for CSV/JSON
    const url = `/api/demo/v2/export?session_id=${sessionId}&format=${selectedFormat}`;
    window.open(url, '_blank');
  };

  const formatIcon = (format: ExportFormat) => {
    switch (format) {
      case 'csv':
        return FileText;
      case 'json':
        return FileJson;
      case 'html':
        return FileCode;
      case 'pdf':
        return File;
    }
  };

  const formatLabel = (format: ExportFormat) => {
    switch (format) {
      case 'csv':
        return 'CSV (Spreadsheet)';
      case 'json':
        return 'JSON (Structured Data)';
      case 'html':
        return 'HTML (Web Report)';
      case 'pdf':
        return 'PDF (Printable Report)';
    }
  };

  const formatDescription = (format: ExportFormat) => {
    switch (format) {
      case 'csv':
        return 'Excel-compatible, easy data analysis';
      case 'json':
        return 'Programmatic access, API integration';
      case 'html':
        return 'Web-viewable with charts';
      case 'pdf':
        return 'Professional, printable format';
    }
  };

  const showPersonaSelection = selectedFormat === 'pdf' || selectedFormat === 'html';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Download className="w-6 h-6 text-orange-600" />
              <div>
                <CardTitle>Export Test Results</CardTitle>
                <CardDescription className="mt-1">
                  Model: {modelName} • Session: {sessionId.slice(0, 8)}...
                </CardDescription>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
              disabled={isExporting}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Format Selection */}
          <div>
            <label className="text-sm font-semibold mb-3 block">
              Export Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['csv', 'json', 'html', 'pdf'] as ExportFormat[]).map((format) => {
                const Icon = formatIcon(format);
                return (
                  <button
                    key={format}
                    onClick={() => setSelectedFormat(format)}
                    className={`p-4 border-2 rounded-lg transition-all text-left ${
                      selectedFormat === format
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
                        : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${
                        selectedFormat === format ? 'text-orange-600' : 'text-gray-500'
                      }`} />
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{formatLabel(format)}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatDescription(format)}
                        </div>
                      </div>
                      {selectedFormat === format && (
                        <CheckCircle className="w-5 h-5 text-orange-600" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Persona Selection (only for HTML/PDF) */}
          {showPersonaSelection && (
            <div>
              <label className="text-sm font-semibold mb-3 block">
                Report Template (Who's Reading?)
              </label>
              <div className="space-y-3">
                {PERSONA_OPTIONS.map((persona) => {
                  const Icon = persona.icon;
                  return (
                    <button
                      key={persona.id}
                      onClick={() => setSelectedPersona(persona.id)}
                      className={`w-full p-4 border-2 rounded-lg transition-all text-left ${
                        selectedPersona === persona.id
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
                          : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className={`w-5 h-5 mt-0.5 ${
                          selectedPersona === persona.id ? 'text-orange-600' : 'text-gray-500'
                        }`} />
                        <div className="flex-1">
                          <div className="font-semibold">{persona.label}</div>
                          <div className="text-sm text-muted-foreground mb-2">
                            {persona.description}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {persona.features.map((feature, idx) => (
                              <span
                                key={idx}
                                className={`text-xs px-2 py-1 rounded ${
                                  selectedPersona === persona.id
                                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                }`}
                              >
                                {feature}
                              </span>
                            ))}
                          </div>
                        </div>
                        {selectedPersona === persona.id && (
                          <CheckCircle className="w-5 h-5 text-orange-600 shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Export Summary */}
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="text-sm font-semibold mb-2">Export Summary</div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Format: <span className="font-medium text-foreground">{formatLabel(selectedFormat)}</span></div>
              {showPersonaSelection && (
                <div>
                  Template: <span className="font-medium text-foreground">
                    {PERSONA_OPTIONS.find(p => p.id === selectedPersona)?.label}
                  </span>
                </div>
              )}
              <div>
                Filename: <span className="font-mono text-foreground">
                  {sessionId.slice(0, 8)}_results_{showPersonaSelection ? selectedPersona + '_' : ''}{selectedFormat}
                </span>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {exportError && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <div className="text-sm text-red-800 dark:text-red-400 font-medium">
                {exportError}
              </div>
            </div>
          )}

          {/* Success Message */}
          {exportSuccess && (
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div className="text-sm text-green-800 dark:text-green-400 font-medium">
                Export started! Your download should begin automatically.
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="gap-2 bg-orange-500 hover:bg-orange-600 text-white"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Export {selectedFormat.toUpperCase()}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
