'use client';

import React, { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { DatasetFormat } from '@/lib/training/dataset.types';

interface FormatExample {
  format: DatasetFormat;
  name: string;
  description: string;
  usedFor: string[];
  example: string;
  requiredFields: string[];
}

const FORMAT_EXAMPLES: FormatExample[] = [
  {
    format: 'chatml',
    name: 'ChatML Format',
    description: 'Messages with role and content fields',
    usedFor: ['SFT'],
    requiredFields: ['messages (array)', 'role (system/user/assistant)', 'content (string)'],
    example: `[
  {
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "What is machine learning?"},
      {"role": "assistant", "content": "Machine learning is a subset of AI..."}
    ]
  },
  {
    "messages": [
      {"role": "user", "content": "Explain recursion"},
      {"role": "assistant", "content": "Recursion is when a function calls itself..."}
    ]
  }
]`
  },
  {
    format: 'sharegpt',
    name: 'ShareGPT Format',
    description: 'Conversations array with human/gpt exchanges',
    usedFor: ['SFT'],
    requiredFields: ['conversations (array)', 'from (human/gpt)', 'value (string)'],
    example: `[
  {
    "conversations": [
      {"from": "human", "value": "What is Python?"},
      {"from": "gpt", "value": "Python is a high-level programming language..."}
    ]
  },
  {
    "conversations": [
      {"from": "human", "value": "Explain variables"},
      {"from": "gpt", "value": "Variables are containers for storing data values..."}
    ]
  }
]`
  },
  {
    format: 'alpaca',
    name: 'Alpaca Format',
    description: 'Instruction-following format with input/output',
    usedFor: ['SFT'],
    requiredFields: ['instruction (string)', 'input (string)', 'output (string)'],
    example: `[
  {
    "instruction": "Translate the following English text to French",
    "input": "Hello, how are you?",
    "output": "Bonjour, comment allez-vous?"
  },
  {
    "instruction": "Summarize the following article",
    "input": "Machine learning is a method of data analysis...",
    "output": "ML automates analytical model building using data."
  }
]`
  },
  {
    format: 'dpo',
    name: 'DPO Format',
    description: 'Preference pairs with chosen and rejected responses',
    usedFor: ['DPO', 'ORPO'],
    requiredFields: ['prompt (string)', 'chosen (string)', 'rejected (string)'],
    example: `[
  {
    "prompt": "Explain what photosynthesis is",
    "chosen": "Photosynthesis is the process by which plants convert light energy into chemical energy...",
    "rejected": "Photosynthesis is when plants eat sunlight."
  },
  {
    "prompt": "What is the capital of France?",
    "chosen": "The capital of France is Paris, which is also its largest city...",
    "rejected": "Paris."
  }
]`
  },
  {
    format: 'rlhf',
    name: 'RLHF Format',
    description: 'Prompt/response pairs with optional reward scores',
    usedFor: ['RLHF'],
    requiredFields: ['prompt (string)', 'response (string)', 'reward (number, optional)'],
    example: `[
  {
    "prompt": "Write a haiku about coding",
    "response": "Lines of code flow\\nBugs emerge then disappear\\nSoftware takes its form",
    "reward": 0.95
  },
  {
    "prompt": "Explain async/await in JavaScript",
    "response": "Async/await is syntactic sugar for Promises...",
    "reward": 0.87
  }
]`
  },
  {
    format: 'openorca',
    name: 'OpenOrca Format',
    description: 'System prompt with question and response',
    usedFor: ['SFT'],
    requiredFields: ['system_prompt (string)', 'question (string)', 'response (string)'],
    example: `[
  {
    "system_prompt": "You are an AI assistant. Provide detailed answers.",
    "question": "What is Docker?",
    "response": "Docker is a platform for developing, shipping, and running applications in containers..."
  },
  {
    "system_prompt": "You are a helpful coding assistant.",
    "question": "How do I create a React component?",
    "response": "To create a React component, you can use function or class syntax..."
  }
]`
  },
  {
    format: 'unnatural',
    name: 'Unnatural Instructions',
    description: 'Instruction with multiple input/output instances',
    usedFor: ['SFT'],
    requiredFields: ['instruction (string)', 'instances (array of input/output pairs)'],
    example: `[
  {
    "instruction": "Reverse the given string",
    "instances": [
      {"input": "hello", "output": "olleh"},
      {"input": "world", "output": "dlrow"}
    ]
  },
  {
    "instruction": "Convert to uppercase",
    "instances": [
      {"input": "hello", "output": "HELLO"},
      {"input": "test", "output": "TEST"}
    ]
  }
]`
  },
  {
    format: 'jsonl',
    name: 'JSONL Format',
    description: 'Generic JSON Lines with text field',
    usedFor: ['SFT'],
    requiredFields: ['text (string)'],
    example: `[
  {"text": "### Instruction: Explain recursion\\n### Response: Recursion is when a function calls itself..."},
  {"text": "### Instruction: What is a loop?\\n### Response: A loop is a programming construct that repeats a block of code..."}
]`
  }
];

interface DatasetFormatExamplesProps {
  selectedFormat?: DatasetFormat;
  compact?: boolean;
}

export function DatasetFormatExamples({ selectedFormat }: DatasetFormatExamplesProps) {
  const [expandedFormat, setExpandedFormat] = useState<DatasetFormat | null>(selectedFormat || null);
  const [copiedFormat, setCopiedFormat] = useState<DatasetFormat | null>(null);

  const formatsToShow = selectedFormat
    ? FORMAT_EXAMPLES.filter(f => f.format === selectedFormat)
    : FORMAT_EXAMPLES;

  const handleCopy = async (format: DatasetFormat, example: string) => {
    try {
      await navigator.clipboard.writeText(example);
      setCopiedFormat(format);
      setTimeout(() => setCopiedFormat(null), 2000);
    } catch (err) {
      console.error('[DatasetFormatExamples] Copy failed:', err);
    }
  };

  const toggleExpand = (format: DatasetFormat) => {
    setExpandedFormat(expandedFormat === format ? null : format);
  };

  return (
    <div className="space-y-3">
      {!selectedFormat && (
        <div className="text-sm text-gray-700 mb-4">
          <p className="font-semibold mb-2">Dataset Format Examples</p>
          <p className="text-gray-600">Click on a format to see an example structure. Each format is compatible with specific training methods.</p>
        </div>
      )}

      {formatsToShow.map((formatEx) => {
        const isExpanded = expandedFormat === formatEx.format;
        const isCopied = copiedFormat === formatEx.format;

        return (
          <div
            key={formatEx.format}
            className="border border-gray-200 rounded-md overflow-hidden"
          >
            {/* Header */}
            <button
              onClick={() => toggleExpand(formatEx.format)}
              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{formatEx.name}</span>
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                    {formatEx.format.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{formatEx.description}</p>
                <div className="flex gap-2 mt-2">
                  {formatEx.usedFor.map(method => (
                    <span
                      key={method}
                      className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded"
                    >
                      {method}
                    </span>
                  ))}
                </div>
              </div>
              <div className="ml-4">
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                )}
              </div>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="px-4 py-3 bg-white border-t border-gray-200">
                {/* Required Fields */}
                <div className="mb-3">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Required Fields:</p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {formatEx.requiredFields.map((field, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="mr-2">•</span>
                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{field}</code>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Example Code */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-700">Example:</p>
                    <button
                      onClick={() => handleCopy(formatEx.format, formatEx.example)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                    >
                      {isCopied ? (
                        <>
                          <Check className="h-4 w-4 text-green-600" />
                          <span className="text-green-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-3 bg-gray-900 text-gray-100 rounded-md text-xs overflow-x-auto">
                    <code>{formatEx.example}</code>
                  </pre>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

console.log('[DatasetFormatExamples] Dataset format examples component loaded');
