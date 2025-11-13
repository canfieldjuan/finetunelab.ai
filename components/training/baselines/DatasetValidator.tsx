'use client';

import React, { useState } from 'react';
import type { DataStrategy } from './DataStrategySelector';

export interface DatasetExample {
  [key: string]: unknown;
}

interface DatasetValidatorProps {
  dataset: DatasetExample[] | null;
  onChange: (dataset: DatasetExample[] | null) => void;
  expectedStrategy: DataStrategy;
  disabled?: boolean;
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
  disabled 
}: DatasetValidatorProps) {
  const [uploadError, setUploadError] = useState<string | null>(null);

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
