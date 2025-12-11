'use client';

import React from 'react';
import type { ModelInfo } from './ModelSelector';

export type DataStrategy = 'standard' | 'chat';

interface DataStrategySelectorProps {
  strategy: DataStrategy;
  onChange: (strategy: DataStrategy) => void;
  selectedModel?: ModelInfo;
  disabled?: boolean;
}

export function DataStrategySelector({ 
  strategy, 
  onChange, 
  selectedModel, 
  disabled 
}: DataStrategySelectorProps) {
  const chatDisabled = !selectedModel?.supportsChatTemplate;

  const handleStrategyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value as DataStrategy);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-900">
        Data Strategy <span className="text-red-500">*</span>
      </h3>

      <div className="space-y-3">
        <label className={`flex items-start p-3 border rounded-md cursor-pointer ${
          chatDisabled 
            ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60' 
            : 'bg-white border-gray-300 hover:border-blue-500'
        }`}>
          <input
            type="radio"
            value="chat"
            checked={strategy === 'chat'}
            onChange={handleStrategyChange}
            disabled={disabled || chatDisabled}
            className="mt-1 mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
          />
          <div className="flex-1">
            <div className="font-medium text-gray-900">Chat Format</div>
            <div className="text-sm text-gray-600 mt-1">
              Uses message-based format with roles (user, assistant)
            </div>
            {chatDisabled && selectedModel && (
              <div className="mt-2 text-xs text-amber-700 flex items-center">
                <span className="mr-1">&#9888;</span>
                Not supported by {selectedModel.displayName}
              </div>
            )}
          </div>
        </label>

        <label className="flex items-start p-3 border border-gray-300 rounded-md cursor-pointer bg-white hover:border-blue-500">
          <input
            type="radio"
            value="standard"
            checked={strategy === 'standard'}
            onChange={handleStrategyChange}
            disabled={disabled}
            className="mt-1 mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
          />
          <div className="flex-1">
            <div className="font-medium text-gray-900">Standard Format</div>
            <div className="text-sm text-gray-600 mt-1">
              Uses plain text format (works with all models)
            </div>
          </div>
        </label>
      </div>

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
        <div className="text-sm font-medium text-blue-900 mb-2">
          {strategy === 'chat' ? 'Chat Format Example:' : 'Standard Format Example:'}
        </div>
        <pre className="text-xs text-blue-800 bg-blue-100 p-2 rounded overflow-x-auto">
          {strategy === 'chat' ? (
`{
  "messages": [
    {"role": "user", "content": "Question here"},
    {"role": "assistant", "content": "Answer here"}
  ]
}`
          ) : (
`{
  "text": "Question: ... Answer: ..."
}`
          )}
        </pre>
      </div>
    </div>
  );
}
