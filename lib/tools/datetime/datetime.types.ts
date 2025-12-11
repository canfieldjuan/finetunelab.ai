// DateTime Tool - Type Definitions
// Phase 1: Date Math & Relative Time Types
// Date: October 21, 2025

/**
 * Date calculation expression
 * Examples: "now + 3 weeks", "2024-01-01 - 15 days"
 */
export interface DateCalculation {
  expression: string;
  baseDate?: string;
}

/**
 * Result of date calculation
 */
export interface CalculationResult {
  result: string; // ISO 8601
  timestamp: number;
  formatted: string;
  expression: string;
  debug: {
    parsedOperation: string;
    parsedValue: number;
    parsedUnit: string;
  };
}

/**
 * Duration between two dates
 */
export interface DurationResult {
  milliseconds: number;
  seconds: number;
  minutes: number;
  hours: number;
  days: number;
  weeks: number;
  months: number;
  years: number;
  humanReadable: string;
  isPast: boolean;
}

/**
 * Relative time result
 */
export interface RelativeTimeResult {
  date: string; // ISO 8601
  relative: string; // "2 hours ago"
  fromNow: string; // "in 5 minutes"
}
