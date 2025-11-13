'use client';

/**
 * Keyboard Shortcuts Display Component
 * 
 * Shows available keyboard shortcuts in terminal style
 * Phase 2: ASCII Rendering Components
 * 
 * Date: 2025-11-01
 */

import React from 'react';

export interface ShortcutAction {
  /** Keyboard key */
  key: string;
  /** Action label */
  label: string;
  /** Handler function (for future use) */
  handler?: () => void;
  /** Whether shortcut is disabled */
  disabled?: boolean;
}

export interface KeyboardShortcutsProps {
  /** Array of keyboard shortcuts */
  actions: ShortcutAction[];
  /** Additional CSS classes */
  className?: string;
  /** Show as compact inline list (default: false) */
  compact?: boolean;
}

/**
 * Keyboard Shortcuts Component
 * 
 * Displays available keyboard shortcuts in terminal style
 * 
 * @example
 * <KeyboardShortcuts 
 *   actions={[
 *     { key: 'P', label: 'Pause' },
 *     { key: 'C', label: 'Cancel' },
 *   ]}
 * />
 * // Output: [P] Pause   [C] Cancel
 */
export function KeyboardShortcuts({
  actions,
  className = '',
  compact = true,
}: KeyboardShortcutsProps) {
  if (actions.length === 0) {
    return null;
  }
  
  if (compact) {
    return (
      <div className={`font-mono text-sm ${className}`}>
        <div className="flex flex-wrap gap-4 items-center">
          {actions.map((action, index) => (
            <div
              key={index}
              className={`inline-flex items-center gap-2 ${
                action.disabled ? 'opacity-50' : ''
              }`}
            >
              <span className="px-2 py-0.5 bg-gray-700 text-green-400 rounded border border-gray-600 font-semibold">
                [{action.key}]
              </span>
              <span className="text-gray-300">{action.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  // Non-compact vertical list
  return (
    <div className={`font-mono text-sm ${className}`}>
      <div className="space-y-1">
        {actions.map((action, index) => (
          <div
            key={index}
            className={`flex items-center gap-3 ${
              action.disabled ? 'opacity-50' : ''
            }`}
          >
            <span className="px-2 py-0.5 bg-gray-700 text-green-400 rounded border border-gray-600 font-semibold w-12 text-center">
              [{action.key}]
            </span>
            <span className="text-gray-300">{action.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default KeyboardShortcuts;
