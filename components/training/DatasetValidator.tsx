'use client';

import React, { useState, useMemo } from 'react';
import type { DataStrategy } from './DataStrategySelector';
import type { EnhancedDatasetStats } from '@/lib/training/dataset.types';
import { computeEnhancedStats, type EnhancedStatsResult } from '@/lib/training/dataset-cost-estimator';

export interface DatasetExample {
  [key: string]: unknown;
}

interface DatasetValidatorProps {
  dataset: DatasetExample[] | null;
  onChange: (dataset: DatasetExample[] | null) => void;
  expectedStrategy: DataStrategy;
  disabled?: boolean;
  enhancedStats?: EnhancedDatasetStats | null;
  epochs?: number; // For cost estimation
}

export function detectDatasetFormat(dataset: DatasetExample[]): DataStrategy {
  if (!dataset || dataset.length === 0) {
    return 'standard';
  }

  const firstExample = dataset[0];

  if ('messages' in firstExample && Array.isArray(firstExample.messages)) {
    return 'chat';
  } else if ('text' in firstExample) {
    return 'standard';
  }

  return 'standard';
}

export function DatasetValidator({
  dataset,
  onChange,
  expectedStrategy,
  disabled,
  enhancedStats: externalEnhancedStats,
  epochs = 3
}: DatasetValidatorProps) {
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Compute enhanced stats automatically when dataset changes
  const computedStats = useMemo<EnhancedStatsResult | null>(() => {
    if (!dataset || dataset.length === 0) {
      return null;
    }
    return computeEnhancedStats(dataset, epochs);
  }, [dataset, epochs]);

  // Use external stats if provided, otherwise use computed stats
  const enhancedStats = externalEnhancedStats || computedStats;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      onChange(null);
      setUploadError(null);
      return;
    }

    setUploadError(null);

    try {
      const text = await file.text();
      let parsed: DatasetExample[];

      if (file.name.endsWith('.jsonl')) {
        const lines = text.trim().split('\n').filter(line => line.trim());
        parsed = lines.map(line => JSON.parse(line));
      } else {
        parsed = JSON.parse(text);
      }

      if (!Array.isArray(parsed)) {
        setUploadError('Dataset must be an array of examples');
        onChange(null);
        return;
      }

      onChange(parsed);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setUploadError(`Failed to parse file: ${errorMsg}`);
      onChange(null);
    }
  };

  const detectedFormat = dataset ? detectDatasetFormat(dataset) : null;
  const formatMismatch = detectedFormat && detectedFormat !== expectedStrategy;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-900">
        Dataset <span className="text-red-500">*</span>
      </h3>

      <div>
        <input
          type="file"
          accept=".json,.jsonl"
          onChange={handleFileUpload}
          disabled={disabled}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-gray-500">
          Upload JSON or JSONL file with training examples
        </p>
      </div>

      {uploadError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center text-sm text-red-800">
            <span className="mr-2 text-lg">&#10060;</span>
            <span>{uploadError}</span>
          </div>
        </div>
      )}

      {dataset && (
        <>
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center text-gray-700">
              <span className="mr-1">&#128202;</span>
              <span className="font-medium">{dataset.length}</span>
              <span className="ml-1">examples</span>
            </div>
            <div className="flex items-center text-gray-700">
              <span className="mr-1">Format:</span>
              <span className="font-medium">{detectedFormat}</span>
            </div>
          </div>

          {formatMismatch && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
              <div className="flex items-start space-x-2">
                <span className="text-amber-600 text-lg">&#9888;</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900">Format Mismatch</p>
                  <p className="text-sm text-amber-800 mt-1">
                    Dataset is <strong>{detectedFormat}</strong> format but strategy is set to{' '}
                    <strong>{expectedStrategy}</strong>. 
                  </p>
                  <p className="text-xs text-amber-700 mt-2">
                    Either change the strategy to match your dataset, or convert your dataset to the expected format.
                  </p>
                </div>
              </div>
            </div>
          )}

          {dataset.length < 10 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
              <div className="flex items-start space-x-2">
                <span className="text-amber-600 text-lg">&#9888;</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900">Small Dataset</p>
                  <p className="text-sm text-amber-800 mt-1">
                    Only {dataset.length} examples. Recommend at least 10 for meaningful training.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Statistics Display */}
          {enhancedStats && (
            <div className="space-y-3">
              {/* Token Statistics */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">Token Statistics</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-blue-700">Total:</span>{' '}
                    <span className="font-medium">{enhancedStats.token_count_total.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Avg:</span>{' '}
                    <span className="font-medium">{Math.round(enhancedStats.token_count_avg)}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Min:</span>{' '}
                    <span className="font-medium">{enhancedStats.token_count_min}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Max:</span>{' '}
                    <span className="font-medium">{enhancedStats.token_count_max}</span>
                  </div>
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  Tokenizer: {enhancedStats.tokenizer_used}
                </p>
              </div>

              {/* Quality Score */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-900">Quality Score</h4>
                  <span className={`text-lg font-bold ${
                    enhancedStats.quality_score >= 80 ? 'text-green-600' :
                    enhancedStats.quality_score >= 60 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {enhancedStats.quality_score}/100
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      enhancedStats.quality_score >= 80 ? 'bg-green-500' :
                      enhancedStats.quality_score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${enhancedStats.quality_score}%` }}
                  />
                </div>
                {enhancedStats.quality_issues && (
                  <div className="mt-2 text-xs text-gray-600 space-y-1">
                    {enhancedStats.quality_issues.empty_examples > 0 && (
                      <p>&#8226; {enhancedStats.quality_issues.empty_examples} empty examples</p>
                    )}
                    {enhancedStats.quality_issues.malformed_examples > 0 && (
                      <p>&#8226; {enhancedStats.quality_issues.malformed_examples} malformed examples</p>
                    )}
                    {enhancedStats.quality_issues.alternation_errors > 0 && (
                      <p>&#8226; {enhancedStats.quality_issues.alternation_errors} role alternation errors</p>
                    )}
                    {enhancedStats.quality_issues.duplicate_count > 0 && (
                      <p>&#8226; {enhancedStats.quality_issues.duplicate_count} duplicate examples</p>
                    )}
                  </div>
                )}
              </div>

              {/* Outlier Detection */}
              {enhancedStats.outliers && enhancedStats.outliers.count > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <div className="flex items-start space-x-2">
                    <span className="text-amber-600 text-lg">&#9888;</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-900">
                        {enhancedStats.outliers.count} Outlier{enhancedStats.outliers.count > 1 ? 's' : ''} Detected
                      </p>
                      <p className="text-xs text-amber-800 mt-1">
                        Examples with unusual token counts (method: {enhancedStats.outliers.method.toUpperCase()})
                      </p>
                      {enhancedStats.outliers.indices.length <= 5 && (
                        <p className="text-xs text-amber-700 mt-1">
                          Indices: {enhancedStats.outliers.indices.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Cost Estimate */}
              {enhancedStats.cost_estimate && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <h4 className="text-sm font-semibold text-green-900 mb-2">Estimated Training Cost</h4>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-green-800">
                      <span className="font-medium">{enhancedStats.cost_estimate.provider}</span>
                      <span className="text-xs ml-2">({enhancedStats.cost_estimate.epochs} epochs)</span>
                    </div>
                    <span className="text-lg font-bold text-green-700">
                      ${enhancedStats.cost_estimate.estimated_cost.toFixed(2)} {enhancedStats.cost_estimate.currency}
                    </span>
                  </div>
                  {enhancedStats.cost_estimate.estimated_hours && (
                    <p className="text-xs text-green-600 mt-1">
                      Est. time: ~{enhancedStats.cost_estimate.estimated_hours} hours
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">
              Preview (first {Math.min(3, dataset.length)} examples):
            </h4>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {dataset.slice(0, 3).map((example, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-gray-50 border border-gray-200 rounded-md"
                >
                  <div className="text-xs font-semibold text-gray-600 mb-2">
                    Example {idx + 1}:
                  </div>
                  <pre className="text-xs text-gray-800 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(example, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
