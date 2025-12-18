'use client';

// Export Button Component
// Triggers analytics data export with format and type selection
// Date: October 25, 2025

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, Loader2, X, CheckCircle, AlertCircle } from 'lucide-react';
import { ExportFormatSelector } from './ExportFormatSelector';
import { ExportTypeSelector } from './ExportTypeSelector';
import { AudienceSelector } from './AudienceSelector';
import type {
  ExportFormat,
  ExportType,
  AudienceType,
  DateRange,
  ExportCreationResponse,
  ExportErrorResponse,
} from './types';

export interface ExportButtonProps {
  userId: string;
  dateRange: DateRange;
  defaultFormat?: ExportFormat;
  defaultType?: ExportType;
  defaultAudience?: AudienceType;
  includedMetrics?: string[];
  onExportCreated?: (exportId: string, downloadUrl: string) => void;
  onError?: (error: string) => void;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
  label?: string;
}

export function ExportButton({
  userId,
  dateRange,
  defaultFormat = 'csv',
  defaultType = 'overview',
  defaultAudience = 'executive',
  includedMetrics,
  onExportCreated,
  onError,
  size = 'default',
  variant = 'default',
  label = 'Export Data',
}: ExportButtonProps) {
  console.log('[ExportButton] Initialized', { userId, dateRange });

  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(defaultFormat);
  const [selectedType, setSelectedType] = useState<ExportType>(defaultType);
  const [selectedAudience, setSelectedAudience] = useState<AudienceType>(defaultAudience);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleOpen = () => {
    console.log('[ExportButton] Opening export modal');
    setIsOpen(true);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleClose = () => {
    console.log('[ExportButton] Closing export modal');
    setIsOpen(false);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleExportClick = async () => {
    console.log('[ExportButton] Export clicked', {
      format: selectedFormat,
      type: selectedType,
      audience: selectedAudience,
      dateRange,
    });

    if (!validateSelection()) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await callExportAPI();

      if ('error' in response) {
        displayError(response.error);
        return;
      }

      displaySuccess(response);
      setTimeout(handleClose, 2000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Export failed';
      displayError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const validateSelection = (): boolean => {
    console.log('[ExportButton] Validating selection');

    if (!selectedFormat) {
      setErrorMessage('Please select an export format');
      return false;
    }

    if (!selectedType) {
      setErrorMessage('Please select an export type');
      return false;
    }

    if (!dateRange.startDate || !dateRange.endDate) {
      setErrorMessage('Invalid date range provided');
      return false;
    }

    return true;
  };

  const callExportAPI = async (): Promise<
    ExportCreationResponse | ExportErrorResponse
  > => {
    console.log('[ExportButton] Calling export API');

    const requestBody = {
      format: selectedFormat,
      exportType: selectedType,
      startDate: dateRange.startDate.toISOString(),
      endDate: dateRange.endDate.toISOString(),
      includedMetrics: includedMetrics || [],
      audience: (selectedFormat === 'pdf' || selectedFormat === 'html' || selectedFormat === 'report') 
        ? selectedAudience 
        : undefined,
    };

    const response = await fetch('/api/analytics/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[ExportButton] API error:', data);
      return { error: data.error || 'Export failed' };
    }

    console.log('[ExportButton] Export created successfully:', data.exportId);
    return data;
  };

  const displaySuccess = (response: ExportCreationResponse) => {
    console.log('[ExportButton] Displaying success', response.exportId);

    setSuccessMessage(`Export created: ${response.fileName}`);

    if (onExportCreated) {
      onExportCreated(response.exportId, response.downloadUrl);
    }

    window.open(response.downloadUrl, '_blank');
  };

  const displayError = (error: string) => {
    console.error('[ExportButton] Displaying error:', error);

    setErrorMessage(error);

    if (onError) {
      onError(error);
    }
  };

  if (!isOpen) {
    return (
      <Button variant={variant} size={size} onClick={handleOpen}>
        <Download className="mr-2 h-4 w-4" />
        {label}
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 bg-background">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Export Analytics Data</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-secondary rounded"
            disabled={isLoading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Select format and data type to export. File will expire in 7 days.
        </p>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Date Range</label>
            <div className="text-sm text-muted-foreground">
              {dateRange.startDate.toLocaleDateString()} -{' '}
              {dateRange.endDate.toLocaleDateString()}
            </div>
          </div>

          <ExportFormatSelector
            selectedFormat={selectedFormat}
            onChange={setSelectedFormat}
          />

          {(selectedFormat === 'pdf' || selectedFormat === 'html' || selectedFormat === 'report') && (
            <AudienceSelector
              selectedAudience={selectedAudience}
              onChange={setSelectedAudience}
              disabled={isLoading}
            />
          )}

          <ExportTypeSelector
            selectedType={selectedType}
            onChange={setSelectedType}
          />

          {errorMessage && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive rounded-lg">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">{errorMessage}</p>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <p className="text-sm text-green-600">{successMessage}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleExportClick} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
