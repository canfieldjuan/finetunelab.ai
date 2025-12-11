// System Monitor Tool - Log Analysis Service
// Date: October 21, 2025

/**
 * Log entry from analysis
 */
export interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  timestamp: string;
  source?: string;
  count?: number;
}

/**
 * Log analysis results
 */
export interface LogAnalysis {
  criticalErrors: LogEntry[];
  warnings: LogEntry[];
  errorPatterns: { pattern: string; count: number }[];
  analyzedPeriod: string;
  totalErrors: number;
  totalWarnings: number;
}

/**
 * Service for analyzing application logs and detecting critical issues
 */
export class LogAnalysisService {
  private logger = console;
  private errorPatterns: RegExp[] = [
    /database.*connection.*failed/i,
    /out of memory/i,
    /stack overflow/i,
    /authentication.*failed/i,
    /permission denied/i,
    /timeout.*exceeded/i,
    /null pointer|undefined.*not.*function/i,
    /syntax.*error/i,
  ];

  /**
   * Analyze recent logs for critical issues
   * @param logSource Source of logs (could be file path or service identifier)
   * @param periodHours Number of hours to look back (default: 1)
   */
  async analyzeLogs(
    logSource: string = 'application',
    periodHours: number = 1
  ): Promise<LogAnalysis> {
    this.logger.debug(
      `[LogAnalysis] Analyzing logs from ${logSource} for last ${periodHours} hours...`
    );

    try {
      // In a real implementation, this would read from actual log files or a logging service
      // For now, we'll simulate by capturing console errors that have been logged
      const analysis = this.simulateLogAnalysis(periodHours);

      this.logger.debug(
        `[LogAnalysis] Analysis complete: ${analysis.totalErrors} errors, ${analysis.totalWarnings} warnings`
      );

      return analysis;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('[LogAnalysis] Error analyzing logs:', errorMessage);

      return {
        criticalErrors: [],
        warnings: [],
        errorPatterns: [],
        analyzedPeriod: `Last ${periodHours} hours`,
        totalErrors: 0,
        totalWarnings: 0,
      };
    }
  }

  /**
   * Simulate log analysis (placeholder for real implementation)
   * In production, this would parse actual log files or query a logging service
   */
  private simulateLogAnalysis(periodHours: number): LogAnalysis {
    const now = new Date();
    const criticalErrors: LogEntry[] = [];
    const warnings: LogEntry[] = [];
    const errorPatterns: { pattern: string; count: number }[] = [];

    // In a real implementation, this would:
    // 1. Read log files or query a logging service
    // 2. Parse log entries within the time period
    // 3. Categorize by severity
    // 4. Detect patterns and frequency

    return {
      criticalErrors,
      warnings,
      errorPatterns,
      analyzedPeriod: `Last ${periodHours} hours (${new Date(
        now.getTime() - periodHours * 60 * 60 * 1000
      ).toISOString()} - ${now.toISOString()})`,
      totalErrors: criticalErrors.length,
      totalWarnings: warnings.length,
    };
  }

  /**
   * Check if a log message matches any critical error patterns
   */
  private isCriticalError(message: string): boolean {
    return this.errorPatterns.some((pattern) => pattern.test(message));
  }

  /**
   * Extract common error patterns from log entries
   */
  private extractPatterns(entries: LogEntry[]): { pattern: string; count: number }[] {
    const patternCounts = new Map<string, number>();

    entries.forEach((entry) => {
      const matchedPattern = this.errorPatterns.find((pattern) =>
        pattern.test(entry.message)
      );

      if (matchedPattern) {
        const patternStr = matchedPattern.source;
        patternCounts.set(patternStr, (patternCounts.get(patternStr) || 0) + 1);
      }
    });

    return Array.from(patternCounts.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count);
  }
}
