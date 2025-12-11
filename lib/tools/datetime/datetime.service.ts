// DateTime Tool - Service Implementation
// Phase 3.2: DateTime operations implementation
// Date: October 10, 2025
// Enhanced: October 21, 2025 - Added calculate and diff actions

import { datetimeConfig } from './datetime.config';
import { 
  add, 
  sub, 
  differenceInDays, 
  differenceInHours, 
  differenceInMinutes,
  differenceInSeconds,
  formatDistanceToNow,
  parseISO,
  isValid
} from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

/**
 * DateTime Service
 * Handles date and time operations
 */
export class DateTimeService {
  private config = datetimeConfig;

  /**
   * Get current date/time information
   */
  async getCurrentDateTime(timezone?: string) {
    const tz = timezone || this.config.defaultTimezone;
    const now = new Date();

    // Validate timezone
    if (!this.isValidTimezone(tz)) {
      throw new Error(`[DateTime] ValidationError: Invalid timezone '${tz}'`);
    }

    return {
      utc: now.toISOString(),
      timezone: tz,
      timestamp: now.getTime(),
      local: now.toLocaleString(this.config.locale, { timeZone: tz }),
      formatted: {
        date: now.toLocaleDateString(this.config.locale, { timeZone: tz }),
        time: now.toLocaleTimeString(this.config.locale, { timeZone: tz }),
        dayOfWeek: now.toLocaleDateString(this.config.locale, { 
          weekday: 'long', 
          timeZone: tz 
        }),
        month: now.toLocaleDateString(this.config.locale, { 
          month: 'long', 
          timeZone: tz 
        }),
        year: now.toLocaleDateString(this.config.locale, { 
          year: 'numeric', 
          timeZone: tz 
        }),
      },
    };
  }

  /**
   * Convert time between timezones
   */
  async convertTimezone(fromTimezone: string, toTimezone: string, dateTime?: string) {
    if (!this.config.enableConversion) {
      throw new Error('[DateTime] ConfigurationError: Timezone conversion is disabled');
    }

    // Validate timezones
    if (!this.isValidTimezone(fromTimezone)) {
      throw new Error(`[DateTime] ValidationError: Invalid source timezone '${fromTimezone}'`);
    }
    if (!this.isValidTimezone(toTimezone)) {
      throw new Error(`[DateTime] ValidationError: Invalid target timezone '${toTimezone}'`);
    }

    const date = dateTime ? new Date(dateTime) : new Date();

    return {
      from: {
        timezone: fromTimezone,
        time: date.toLocaleString(this.config.locale, { timeZone: fromTimezone }),
      },
      to: {
        timezone: toTimezone,
        time: date.toLocaleString(this.config.locale, { timeZone: toTimezone }),
      },
      utc: date.toISOString(),
    };
  }

  /**
   * Format date/time with custom format
   */
  async formatDateTime(dateTime: string, formatOptions: Intl.DateTimeFormatOptions) {
    if (!this.config.enableFormatting) {
      throw new Error('[DateTime] ConfigurationError: DateTime formatting is disabled');
    }

    const date = new Date(dateTime);
    
    if (isNaN(date.getTime())) {
      throw new Error('[DateTime] ValidationError: Invalid date/time string');
    }

    return {
      formatted: date.toLocaleString(this.config.locale, formatOptions),
      iso: date.toISOString(),
      timestamp: date.getTime(),
    };
  }

  /**
   * Calculate date arithmetic operations
   */
  async calculate(action: 'add' | 'subtract', dateTime: string, amount: number, unit: 'days' | 'hours' | 'minutes' | 'seconds', timezone?: string) {
    const tz = timezone || this.config.defaultTimezone;

    // Validate timezone
    if (!this.isValidTimezone(tz)) {
      throw new Error(`[DateTime] ValidationError: Invalid timezone '${tz}'`);
    }

    const date = new Date(dateTime);

    if (isNaN(date.getTime())) {
      throw new Error('[DateTime] ValidationError: Invalid date/time string');
    }

    let resultDate: Date;

    // Perform calculation
    switch (action) {
      case 'add':
        resultDate = add(date, { [unit]: amount });
        break;
      case 'subtract':
        resultDate = sub(date, { [unit]: amount });
        break;
      default:
        throw new Error('[DateTime] ValidationError: Invalid action, use "add" or "subtract"');
    }

    return {
      original: date.toLocaleString(this.config.locale, { timeZone: tz }),
      result: resultDate.toLocaleString(this.config.locale, { timeZone: tz }),
      action,
      amount,
      unit,
    };
  }

  /**
   * Get difference between two date/time values
   */
  async diff(startDateTime: string, endDateTime: string, unit: 'days' | 'hours' | 'minutes' | 'seconds', timezone?: string) {
    const tz = timezone || this.config.defaultTimezone;

    // Validate timezone
    if (!this.isValidTimezone(tz)) {
      throw new Error(`[DateTime] ValidationError: Invalid timezone '${tz}'`);
    }

    const startDate = new Date(startDateTime);
    const endDate = new Date(endDateTime);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('[DateTime] ValidationError: Invalid start or end date/time string');
    }

    let diff: number;

    // Calculate difference
    switch (unit) {
      case 'days':
        diff = differenceInDays(endDate, startDate);
        break;
      case 'hours':
        diff = differenceInHours(endDate, startDate);
        break;
      case 'minutes':
        diff = differenceInMinutes(endDate, startDate);
        break;
      case 'seconds':
        diff = differenceInSeconds(endDate, startDate);
        break;
      default:
        throw new Error('[DateTime] ValidationError: Invalid unit, use "days", "hours", "minutes" or "seconds"');
    }

    return {
      start: startDate.toLocaleString(this.config.locale, { timeZone: tz }),
      end: endDate.toLocaleString(this.config.locale, { timeZone: tz }),
      diff,
      unit,
    };
  }

  /**
   * Get relative time description (e.g., "2 hours ago", "in 5 minutes")
   */
  async relative(dateTime: string, baseDate?: string, timezone?: string) {
    const tz = timezone || this.config.defaultTimezone;

    console.debug('[DateTime] Relative time requested:', { dateTime, baseDate, timezone: tz });

    // Validate timezone
    if (!this.isValidTimezone(tz)) {
      throw new Error(`[DateTime] ValidationError: Invalid timezone '${tz}'`);
    }

    const targetDate = parseISO(dateTime);
    if (!isValid(targetDate)) {
      throw new Error('[DateTime] ValidationError: Invalid date/time string');
    }

    const base = baseDate ? parseISO(baseDate) : new Date();
    if (!isValid(base)) {
      throw new Error('[DateTime] ValidationError: Invalid base date/time string');
    }

    console.debug('[DateTime] Calculating relative time from', base, 'to', targetDate);

    return {
      date: targetDate.toISOString(),
      baseDate: base.toISOString(),
      relative: formatDistanceToNow(targetDate, { addSuffix: true, includeSeconds: true }),
      timezone: tz,
      formatted: formatInTimeZone(targetDate, tz, 'PPpp'),
    };
  }

  /**
   * Validate timezone string
   */
  private isValidTimezone(tz: string): boolean {
    try {
      // Try to use the timezone - will throw if invalid
      new Date().toLocaleString('en-US', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const dateTimeService = new DateTimeService();
