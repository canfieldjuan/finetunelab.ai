'use client';

/**
 * ASCII Box Component
 * 
 * Renders content inside a terminal-style box with borders
 * Phase 2: ASCII Rendering Components
 * 
 * Date: 2025-11-01
 */

import React from 'react';
import { createBoxBorder } from '@/lib/utils/terminal-format';

export interface ASCIIBoxProps {
  /** Content to display inside the box */
  children: React.ReactNode;
  /** Title for the box (shown in top border) */
  title?: string;
  /** Border style: single or double lines */
  borderStyle?: 'single' | 'double';
  /** Width of box content area in characters (auto if not specified) */
  width?: number;
  /** Additional CSS classes */
  className?: string;
  /** Padding inside box */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

/**
 * ASCII Box Component
 * 
 * Wraps content in a terminal-style box with Unicode borders
 * 
 * @example
 * <ASCIIBox title="Training Status" borderStyle="double">
 *   <p>Progress: 42%</p>
 * </ASCIIBox>
 */
export function ASCIIBox({
  children,
  title,
  borderStyle = 'single',
  width,
  className = '',
  padding = 'md',
}: ASCIIBoxProps) {
  // Padding classes
  const paddingClasses = {
    none: '',
    sm: 'p-1',
    md: 'p-2',
    lg: 'p-4',
  };
  
  const paddingClass = paddingClasses[padding] || paddingClasses.md;
  
  // If width is specified, create borders
  const borders = width ? createBoxBorder(width - 2, borderStyle) : null;
  
  return (
    <div className={`font-mono text-sm ${className}`}>
      {/* Top border with optional title */}
      {borders && width && (
        <div className="text-gray-500">
          {title ? (
            <div>
              {borderStyle === 'single' ? '┌─ ' : '╔═ '}
              <span className="text-gray-300">{title}</span>
              {' '}
              {borders.horizontal.repeat(
                Math.max(0, width - title.length - 6)
              )}
              {borderStyle === 'single' ? '┐' : '╗'}
            </div>
          ) : (
            <div>{borders.top}</div>
          )}
        </div>
      )}
      
      {/* Content area */}
      <div className={borders ? '' : paddingClass}>
        {borders ? (
          <div className="text-gray-300">
            {/* Split content into lines and add side borders */}
            <div className={paddingClass}>
              {children}
            </div>
          </div>
        ) : (
          <div className="text-gray-300">
            {children}
          </div>
        )}
      </div>
      
      {/* Bottom border */}
      {borders && (
        <div className="text-gray-500">
          {borders.bottom}
        </div>
      )}
    </div>
  );
}

export default ASCIIBox;
