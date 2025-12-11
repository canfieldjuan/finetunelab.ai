'use client';

import React from 'react';

export interface ValidationResult {
  errors: string[];
  warnings: string[];
  isValid: boolean;
}

interface ValidationSummaryProps {
  validation: ValidationResult;
  onSubmit?: () => void;
  submitLabel?: string;
  disabled?: boolean;
}

export function ValidationSummary({ 
  validation, 
  onSubmit, 
  submitLabel = 'Start Training',
  disabled 
}: ValidationSummaryProps) {
  const { errors, warnings } = validation;
  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Validation Status</h3>

      {hasErrors && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <h4 className="text-sm font-semibold text-red-900 flex items-center mb-2">
            <span className="mr-2 text-lg">&#10060;</span>
            Errors ({errors.length})
          </h4>
          <ul className="space-y-1">
            {errors.map((error, idx) => (
              <li key={idx} className="text-sm text-red-800 ml-6">
                &bull; {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasWarnings && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
          <h4 className="text-sm font-semibold text-amber-900 flex items-center mb-2">
            <span className="mr-2 text-lg">&#9888;</span>
            Warnings ({warnings.length})
          </h4>
          <ul className="space-y-1">
            {warnings.map((warning, idx) => (
              <li key={idx} className="text-sm text-amber-800 ml-6">
                &bull; {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!hasErrors && !hasWarnings && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center text-sm text-green-800">
            <span className="mr-2 text-lg">&#9989;</span>
            <span className="font-medium">All validations passed</span>
          </div>
        </div>
      )}

      {onSubmit && (
        <div className="space-y-2">
          <button
            onClick={onSubmit}
            disabled={disabled || hasErrors}
            className={`w-full px-4 py-3 rounded-md font-medium text-white transition-colors ${
              disabled || hasErrors
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {hasErrors ? 'Fix errors to continue' : submitLabel}
          </button>

          {hasWarnings && !hasErrors && (
            <p className="text-xs text-center text-amber-700">
              You can proceed with warnings, but please review them first.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
