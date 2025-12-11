"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Download, FileText, FileJson, Check } from 'lucide-react';
import {
  exportOverviewToCSV,
  exportModelPerformanceToCSV,
  exportSessionMetricsToCSV,
  exportTrainingEffectivenessToCSV,
  exportRatingDistributionToCSV,
  exportTokenUsageToCSV,
  exportCostTrackingToCSV,
  exportAllAnalyticsToCSV,
  type AnalyticsData as CsvAnalyticsData
} from '@/lib/csv-export';

// Using Record<string, unknown> to accept any analytics data shape from the hook
// The CSV functions will cast as needed
type AnalyticsDataShape = Record<string, unknown>;

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: AnalyticsDataShape | null | undefined;
}

type ExportFormat = 'csv' | 'json';
type ExportSection =
  | 'all'
  | 'overview'
  | 'modelPerformance'
  | 'sessionMetrics'
  | 'trainingEffectiveness'
  | 'ratingDistribution'
  | 'tokenUsage'
  | 'costTracking';

interface ExportOption {
  id: ExportSection;
  label: string;
  description: string;
  available: boolean;
}

export function ExportModal({ isOpen, onClose, data }: ExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');
  const [selectedSection, setSelectedSection] = useState<ExportSection>('all');
  const [exportSuccess, setExportSuccess] = useState(false);

  if (!isOpen) return null;

  const exportOptions: ExportOption[] = [
    {
      id: 'all',
      label: 'All Analytics Data',
      description: 'Complete analytics export with all available sections',
      available: true
    },
    {
      id: 'overview',
      label: 'Overview Metrics',
      description: 'Key performance indicators and summary statistics',
      available: true
    },
    {
      id: 'modelPerformance',
      label: 'Model Performance',
      description: 'Detailed metrics for each AI model',
      available: ((data?.modelPerformance as unknown[] | undefined)?.length ?? 0) > 0
    },
    {
      id: 'sessionMetrics',
      label: 'Session Metrics',
      description: 'A/B testing and session comparison data',
      available: ((data?.sessionMetrics as unknown[] | undefined)?.length ?? 0) > 0
    },
    {
      id: 'trainingEffectiveness',
      label: 'Training Effectiveness',
      description: 'Performance comparison across training methods',
      available: ((data?.trainingEffectiveness as unknown[] | undefined)?.length ?? 0) > 0
    },
    {
      id: 'ratingDistribution',
      label: 'Rating Distribution',
      description: 'Breakdown of ratings (1-5 stars)',
      available: true
    },
    {
      id: 'tokenUsage',
      label: 'Token Usage',
      description: 'Token consumption over time',
      available: ((data?.tokenUsage as unknown[] | undefined)?.length ?? 0) > 0
    },
    {
      id: 'costTracking',
      label: 'Cost Tracking',
      description: 'Cost analysis and trends',
      available: ((data?.costTracking as unknown[] | undefined)?.length ?? 0) > 0
    }
  ];

  const handleExport = () => {
    console.log('[ExportModal] Exporting:', { format: selectedFormat, section: selectedSection });

    if (!data) return;

    if (selectedFormat === 'csv') {
      // CSV exports - cast data to expected types
      switch (selectedSection) {
        case 'all':
          exportAllAnalyticsToCSV(data as unknown as CsvAnalyticsData);
          break;
        case 'overview':
          exportOverviewToCSV(data.overview as Parameters<typeof exportOverviewToCSV>[0]);
          break;
        case 'modelPerformance':
          exportModelPerformanceToCSV(data.modelPerformance as Parameters<typeof exportModelPerformanceToCSV>[0]);
          break;
        case 'sessionMetrics':
          exportSessionMetricsToCSV(data.sessionMetrics as Parameters<typeof exportSessionMetricsToCSV>[0]);
          break;
        case 'trainingEffectiveness':
          exportTrainingEffectivenessToCSV(data.trainingEffectiveness as Parameters<typeof exportTrainingEffectivenessToCSV>[0]);
          break;
        case 'ratingDistribution':
          exportRatingDistributionToCSV(data.ratingDistribution as Parameters<typeof exportRatingDistributionToCSV>[0]);
          break;
        case 'tokenUsage':
          exportTokenUsageToCSV(data.tokenUsage as Parameters<typeof exportTokenUsageToCSV>[0]);
          break;
        case 'costTracking':
          exportCostTrackingToCSV(data.costTracking as Parameters<typeof exportCostTrackingToCSV>[0]);
          break;
      }
    } else if (selectedFormat === 'json') {
      // JSON export
      let exportData: unknown;
      switch (selectedSection) {
        case 'all':
          exportData = data;
          break;
        case 'overview':
          exportData = data.overview;
          break;
        case 'modelPerformance':
          exportData = data.modelPerformance;
          break;
        case 'sessionMetrics':
          exportData = data.sessionMetrics;
          break;
        case 'trainingEffectiveness':
          exportData = data.trainingEffectiveness;
          break;
        case 'ratingDistribution':
          exportData = data.ratingDistribution;
          break;
        case 'tokenUsage':
          exportData = data.tokenUsage;
          break;
        case 'costTracking':
          exportData = data.costTracking;
          break;
      }

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `analytics-${selectedSection}-${timestamp}.json`;
      link.click();
      URL.revokeObjectURL(url);

      console.log('[ExportModal] JSON exported:', selectedSection);
    }

    // Show success message
    setExportSuccess(true);
    setTimeout(() => {
      setExportSuccess(false);
      onClose();
    }, 1500);
  };

  const selectedOption = exportOptions.find(opt => opt.id === selectedSection);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Download className="w-6 h-6 text-blue-600" />
              <div>
                <CardTitle>Export Analytics Data</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Download your analytics in CSV or JSON format
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Format Selection */}
          <div>
            <label className="text-sm font-semibold mb-3 block">Export Format</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSelectedFormat('csv')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  selectedFormat === 'csv'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-semibold">CSV</div>
                    <div className="text-xs text-gray-500">For spreadsheets</div>
                  </div>
                  {selectedFormat === 'csv' && (
                    <Check className="w-5 h-5 text-blue-600 ml-auto" />
                  )}
                </div>
              </button>

              <button
                onClick={() => setSelectedFormat('json')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  selectedFormat === 'json'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <FileJson className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-semibold">JSON</div>
                    <div className="text-xs text-gray-500">For developers</div>
                  </div>
                  {selectedFormat === 'json' && (
                    <Check className="w-5 h-5 text-blue-600 ml-auto" />
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Section Selection */}
          <div>
            <label className="text-sm font-semibold mb-3 block">Data to Export</label>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {exportOptions.map(option => (
                <button
                  key={option.id}
                  onClick={() => option.available && setSelectedSection(option.id)}
                  disabled={!option.available}
                  className={`w-full p-3 border rounded-lg text-left transition-all ${
                    selectedSection === option.id
                      ? 'border-blue-500 bg-blue-50'
                      : option.available
                      ? 'border-gray-200 hover:border-gray-300'
                      : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        {option.label}
                        {option.id === 'all' && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                            Recommended
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {option.description}
                      </div>
                    </div>
                    {selectedSection === option.id && (
                      <Check className="w-5 h-5 text-blue-600 ml-2 flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Export Preview */}
          {selectedOption && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="text-sm font-semibold mb-2">Export Summary</div>
              <div className="text-xs text-gray-600 space-y-1">
                <div>Format: <span className="font-medium">{selectedFormat.toUpperCase()}</span></div>
                <div>Section: <span className="font-medium">{selectedOption.label}</span></div>
                <div>Filename: <span className="font-mono">analytics-{selectedSection}-YYYY-MM-DD.{selectedFormat}</span></div>
              </div>
            </div>
          )}

          {/* Export Success Message */}
          {exportSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <Check className="w-5 h-5 text-green-600" />
              <div className="text-sm text-green-800 font-medium">
                Export successful! Your download should start automatically.
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={exportSuccess}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={exportSuccess || !selectedOption?.available}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Export {selectedFormat.toUpperCase()}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
