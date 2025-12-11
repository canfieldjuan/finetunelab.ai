/**
 * Terminal Formatting Utilities
 * 
 * Pure functions for formatting data for terminal-style display
 * All functions are side-effect free and unit testable
 * 
 * Phase 1: Foundation & Data Layer
 * Date: 2025-11-01
 */

import { ProgressChars, DEFAULT_PROGRESS_CHARS, TREND_ARROWS } from '@/lib/training/terminal-monitor.types';

/**
 * Format milliseconds into human-readable duration
 * @param ms - Milliseconds to format
 * @returns Formatted string like "8h 45m 23s" or "2d 3h 15m"
 * 
 * @example
 * formatDuration(1000) // "1s"
 * formatDuration(60000) // "1m 0s"
 * formatDuration(3661000) // "1h 1m 1s"
 * formatDuration(86400000) // "1d 0h 0m"
 */
export function formatDuration(ms: number): string {
  if (ms < 0) return '0s';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const years = Math.floor(days / 365);
  
  if (years > 0) {
    const remainingDays = days % 365;
    const remainingHours = hours % 24;
    const remainingMinutes = minutes % 60;
    return `${years}y ${remainingDays}d ${remainingHours}h ${remainingMinutes}m`;
  }
  
  if (days > 0) {
    const remainingHours = hours % 24;
    const remainingMinutes = minutes % 60;
    return `${days}d ${remainingHours}h ${remainingMinutes}m`;
  }
  
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
  
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
  
  return `${seconds}s`;
}

/**
 * Format bytes into human-readable size with optional total
 * @param bytes - Number of bytes
 * @param total - Optional total bytes for ratio display
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string like "2.05 GB" or "2.05 / 8.00 GB"
 * 
 * @example
 * formatBytes(1024) // "1.00 KB"
 * formatBytes(2050000000, 8000000000) // "2.05 / 8.00 GB"
 */
export function formatBytes(bytes: number, total?: number, decimals: number = 2): string {
  if (bytes === 0 && !total) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const k = 1024;
  
  // Determine unit based on the larger value
  const maxBytes = total ? Math.max(bytes, total) : bytes;
  const i = Math.floor(Math.log(maxBytes) / Math.log(k));
  const unit = units[Math.min(i, units.length - 1)];
  
  const divisor = Math.pow(k, i);
  const formattedValue = (bytes / divisor).toFixed(decimals);
  
  if (total) {
    const formattedTotal = (total / divisor).toFixed(decimals);
    return `${formattedValue} / ${formattedTotal} ${unit}`;
  }
  
  return `${formattedValue} ${unit}`;
}

/**
 * Format number as percentage
 * @param value - Number between 0 and 1 (or 0-100 if asPercent is true)
 * @param decimals - Number of decimal places (default: 1)
 * @param asPercent - If true, input is already 0-100 (default: false)
 * @returns Formatted percentage like "25.6%"
 * 
 * @example
 * formatPercentage(0.256) // "25.6%"
 * formatPercentage(25.6, 1, true) // "25.6%"
 */
export function formatPercentage(value: number, decimals: number = 1, asPercent: boolean = false): string {
  const percent = asPercent ? value : value * 100;
  return `${percent.toFixed(decimals)}%`;
}

/**
 * Format number with thousand separators
 * @param num - Number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted number like "1,234.56"
 * 
 * @example
 * formatNumber(1234.5678) // "1,234.57"
 * formatNumber(1000000, 0) // "1,000,000"
 */
export function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Calculate trend and format delta
 * @param current - Current value
 * @param previous - Previous value (optional)
 * @returns Object with arrow symbol and formatted delta
 * 
 * @example
 * formatTrend(3.456, 3.579) // { arrow: "▼", delta: "-0.123" }
 * formatTrend(2.834, 2.923) // { arrow: "▼", delta: "-0.089" }
 * formatTrend(5.0, 4.8) // { arrow: "▲", delta: "+0.200" }
 */
export function formatTrend(current: number, previous?: number): { arrow: string; delta: string } {
  if (previous === undefined) {
    return { arrow: TREND_ARROWS.unknown, delta: '' };
  }
  
  const delta = current - previous;
  const threshold = 0.001; // Consider changes < 0.001 as stable
  
  if (Math.abs(delta) < threshold) {
    return { arrow: TREND_ARROWS.stable, delta: delta.toFixed(3) };
  }
  
  const arrow = delta > 0 ? TREND_ARROWS.up : TREND_ARROWS.down;
  const sign = delta > 0 ? '+' : '';
  
  return { arrow, delta: `${sign}${delta.toFixed(3)}` };
}

/**
 * Generate ASCII progress bar
 * @param value - Progress value (0-100)
 * @param width - Width of progress bar in characters
 * @param chars - Optional custom character set
 * @returns ASCII progress bar string like "[█████▒▒▒▒▒]"
 * 
 * @example
 * generateProgressBar(0, 10) // "[          ]"
 * generateProgressBar(50, 10) // "[█████     ]"
 * generateProgressBar(100, 10) // "[██████████]"
 * generateProgressBar(42.5, 20) // "[████████▒          ]"
 */
export function generateProgressBar(
  value: number,
  width: number,
  chars: ProgressChars = DEFAULT_PROGRESS_CHARS
): string {
  const clamped = Math.max(0, Math.min(100, value));
  const fillCount = Math.floor((clamped / 100) * width);
  const emptyCount = width - fillCount - 1; // -1 for potential partial char
  
  // Check if we need a partial character
  const remainder = ((clamped / 100) * width) - fillCount;
  const needsPartial = remainder > 0.25 && fillCount < width;
  
  const filled = chars.filled.repeat(Math.max(0, fillCount));
  const partial = needsPartial ? chars.partial : '';
  const empty = chars.empty.repeat(Math.max(0, emptyCount - (needsPartial ? 1 : 0)));
  
  return `${chars.left}${filled}${partial}${empty}${chars.right}`;
}

/**
 * Truncate string with ellipsis
 * @param str - String to truncate
 * @param maxLength - Maximum length including ellipsis
 * @returns Truncated string like "Very long t..."
 * 
 * @example
 * truncateString("Very long text here", 10) // "Very lo..."
 * truncateString("Short", 10) // "Short"
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Pad string to fixed width
 * @param str - String to pad
 * @param width - Target width
 * @param align - Alignment: 'left', 'right', or 'center'
 * @param char - Padding character (default: space)
 * @returns Padded string
 * 
 * @example
 * padString("Hello", 10, 'left') // "Hello     "
 * padString("Hello", 10, 'right') // "     Hello"
 * padString("Hello", 10, 'center') // "  Hello   "
 */
export function padString(
  str: string,
  width: number,
  align: 'left' | 'right' | 'center' = 'left',
  char: string = ' '
): string {
  if (str.length >= width) return str;
  
  const padding = width - str.length;
  
  if (align === 'left') {
    return str + char.repeat(padding);
  }
  
  if (align === 'right') {
    return char.repeat(padding) + str;
  }
  
  // Center alignment
  const leftPad = Math.floor(padding / 2);
  const rightPad = padding - leftPad;
  return char.repeat(leftPad) + str + char.repeat(rightPad);
}

/**
 * Format timestamp to time string
 * @param timestamp - ISO timestamp or Date object
 * @returns Formatted time like "14:32:15"
 * 
 * @example
 * formatTime("2025-11-01T14:32:15.000Z") // "14:32:15"
 */
export function formatTime(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return date.toLocaleTimeString('en-US', { hour12: false });
}

/**
 * Format large numbers with K/M/B suffixes
 * @param num - Number to format
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted string like "1.2K" or "3.5M"
 * 
 * @example
 * formatCompact(1234) // "1.2K"
 * formatCompact(1500000) // "1.5M"
 * formatCompact(2500000000) // "2.5B"
 */
export function formatCompact(num: number, decimals: number = 1): string {
  if (num < 1000) return num.toString();
  
  const units = ['', 'K', 'M', 'B', 'T'];
  const k = 1000;
  const i = Math.floor(Math.log(num) / Math.log(k));
  
  if (i >= units.length) return num.toExponential(decimals);
  
  return (num / Math.pow(k, i)).toFixed(decimals) + units[i];
}

/**
 * Create ASCII box border
 * @param width - Width of box content area
 * @param style - Border style: 'single' or 'double'
 * @returns Object with top, bottom, and side border strings
 * 
 * @example
 * const box = createBoxBorder(20, 'single');
 * console.log(box.top);    // "┌────────────────────┐"
 * console.log(box.side);   // "│"
 * console.log(box.bottom); // "└────────────────────┘"
 */
export function createBoxBorder(width: number, style: 'single' | 'double' = 'single'): {
  top: string;
  bottom: string;
  side: string;
  horizontal: string;
} {
  const chars = style === 'double' ? {
    topLeft: '╔',
    topRight: '╗',
    bottomLeft: '╚',
    bottomRight: '╝',
    horizontal: '═',
    vertical: '║',
  } : {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
  };
  
  return {
    top: chars.topLeft + chars.horizontal.repeat(width) + chars.topRight,
    bottom: chars.bottomLeft + chars.horizontal.repeat(width) + chars.bottomRight,
    side: chars.vertical,
    horizontal: chars.horizontal,
  };
}

console.log('[TerminalFormat] Formatting utilities loaded');
