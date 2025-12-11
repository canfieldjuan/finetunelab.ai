/**
 * Centralized Logging Infrastructure
 *
 * Provides structured logging with:
 * - Multiple log levels (debug, info, warn, error)
 * - Named loggers per component
 * - Timestamps and context
 * - Console and optional file output
 * - Production-ready format
 *
 * @module lib/logging
 * @created 2025-01-31
 */

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  logger: string;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
}

/**
 * Global log level filter
 * Only log entries at or above this level will be output
 */
let globalLogLevel: LogLevel = LogLevel.INFO;

/**
 * Set the global log level
 *
 * @param level - Minimum log level to output
 */
export function setLogLevel(level: LogLevel): void {
  globalLogLevel = level;
}

/**
 * Logger class for component-specific logging
 */
export class Logger {
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log an error message
   */
  error(message: string, context?: Record<string, unknown> | Error): void {
    if (context instanceof Error) {
      this.log(LogLevel.ERROR, message, undefined, context);
    } else {
      this.log(LogLevel.ERROR, message, context);
    }
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): void {
    // Skip if below global log level
    if (level < globalLogLevel) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      logger: this.name,
      message,
      context,
      error,
    };

    this.output(logEntry);
  }

  /**
   * Output log entry to console
   */
  private output(entry: LogEntry): void {
    const levelName = LogLevel[entry.level];
    const prefix = `[${entry.timestamp}] [${levelName}] [${entry.logger}]`;

    // Format message
    let fullMessage = `${prefix} ${entry.message}`;

    // Add context if present
    if (entry.context && Object.keys(entry.context).length > 0) {
      fullMessage += ` ${JSON.stringify(entry.context)}`;
    }

    // Add error if present
    if (entry.error) {
      fullMessage += `\n  Error: ${entry.error.message}`;
      if (entry.error.stack) {
        fullMessage += `\n  Stack: ${entry.error.stack}`;
      }
    }

    // Output based on level
    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(fullMessage);
        break;
      case LogLevel.WARN:
        console.warn(fullMessage);
        break;
      case LogLevel.INFO:
        console.info(fullMessage);
        break;
      case LogLevel.DEBUG:
        console.debug(fullMessage);
        break;
    }
  }
}

/**
 * Create a new logger instance
 *
 * @param name - Name of the logger (usually component or service name)
 * @returns Logger instance
 *
 * @example
 * ```typescript
 * import { createLogger } from '@/lib/logging';
 *
 * const logger = createLogger('Step1ModelSelection');
 * logger.info('Component mounted');
 * logger.error('Failed to fetch models', { error: 'Network error' });
 * ```
 */
export function createLogger(name: string): Logger {
  return new Logger(name);
}
