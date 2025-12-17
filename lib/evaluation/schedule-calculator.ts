// Schedule Calculator - Pure utility functions for calculating next run times
// Created: 2025-12-16
// Purpose: Support scheduled evaluation timing calculations
// Dependencies: date-fns, date-fns-tz (already installed)

import { add, addHours, startOfDay, startOfWeek, isAfter } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import type { ScheduleType } from '../batch-testing/types';

/**
 * Calculate the next run time for a scheduled evaluation
 *
 * @param scheduleType - Type of schedule ('hourly' | 'daily' | 'weekly' | 'custom')
 * @param timezone - IANA timezone (e.g., 'America/New_York', 'UTC')
 * @param fromTime - Starting time (defaults to current time)
 * @param cronExpression - Cron expression (required for 'custom' schedule type)
 * @returns Date object representing the next run time in UTC
 *
 * Schedule Rules:
 * - hourly: Next full hour
 * - daily: Next day at 2 AM in user's timezone
 * - weekly: Next Monday at 2 AM in user's timezone
 * - custom: Parse cron expression (simplified - only supports specific patterns)
 *
 * @example
 * // Calculate next hourly run
 * const next = calculateNextRun('hourly', 'UTC');
 *
 * @example
 * // Calculate next daily run at 2 AM Eastern
 * const next = calculateNextRun('daily', 'America/New_York');
 */
export function calculateNextRun(
  scheduleType: ScheduleType,
  timezone: string,
  fromTime?: Date,
  cronExpression?: string
): Date {
  const now = fromTime || new Date();

  // Convert current time to user's timezone for calculations
  const zonedNow = toZonedTime(now, timezone);

  let nextRunZoned: Date;

  switch (scheduleType) {
    case 'hourly': {
      // Next full hour
      nextRunZoned = addHours(zonedNow, 1);
      nextRunZoned.setMinutes(0, 0, 0);
      break;
    }

    case 'daily': {
      // Next day at 2 AM
      let nextDay = add(startOfDay(zonedNow), { days: 1, hours: 2 });

      // If current time is before 2 AM today, use today at 2 AM
      const todayAt2AM = add(startOfDay(zonedNow), { hours: 2 });
      if (!isAfter(zonedNow, todayAt2AM)) {
        nextDay = todayAt2AM;
      }

      nextRunZoned = nextDay;
      break;
    }

    case 'weekly': {
      // Next Monday at 2 AM (week starts on Monday in ISO 8601)
      const nextMonday = startOfWeek(add(zonedNow, { weeks: 1 }), { weekStartsOn: 1 });
      nextRunZoned = add(nextMonday, { hours: 2 });

      // If current time is before next Monday 2 AM this week, use this Monday
      const thisMonday = add(startOfWeek(zonedNow, { weekStartsOn: 1 }), { hours: 2 });
      if (!isAfter(zonedNow, thisMonday)) {
        nextRunZoned = thisMonday;
      }

      break;
    }

    case 'custom': {
      if (!cronExpression) {
        throw new Error('cronExpression is required for custom schedule type');
      }

      // Simplified cron parser - supports only common patterns
      // Format: "minute hour day month weekday"
      // Examples: "0 2 * * *" = daily at 2 AM
      //           "0 * * * *" = every hour
      //           "0 2 * * 1" = every Monday at 2 AM

      nextRunZoned = parseSimpleCron(cronExpression, zonedNow);
      break;
    }

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = scheduleType;
      throw new Error(`Unsupported schedule type: ${_exhaustive}`);
    }
  }

  // Convert back to UTC for storage
  return fromZonedTime(nextRunZoned, timezone);
}

/**
 * Check if a scheduled evaluation is due to run
 *
 * @param nextRunAt - Next scheduled run time (UTC)
 * @param currentTime - Current time (defaults to now)
 * @returns true if the schedule is due (nextRunAt <= currentTime)
 *
 * @example
 * const schedule = { next_run_at: '2025-01-15T10:00:00Z', is_active: true };
 * if (isTimeDue(new Date(schedule.next_run_at)) && schedule.is_active) {
 *   // Trigger evaluation
 * }
 */
export function isTimeDue(nextRunAt: Date, currentTime?: Date): boolean {
  const now = currentTime || new Date();
  return nextRunAt.getTime() <= now.getTime();
}

/**
 * Parse simplified cron expression
 * Supports common patterns only - not full cron specification
 *
 * @param cronExpression - Cron string (minute hour day month weekday)
 * @param fromTime - Starting time
 * @returns Next run time
 *
 * Supported patterns:
 * - Every hour: "0 STAR STAR STAR STAR"
 * - Daily at 2 AM: "0 2 STAR STAR STAR"
 * - Every Monday at 2 AM: "0 2 STAR STAR 1"
 * - Every 15 minutes: "STAR_SLASH_15 STAR STAR STAR STAR"
 * (Replace STAR with asterisk and STAR_SLASH with asterisk-slash)
 */
function parseSimpleCron(cronExpression: string, fromTime: Date): Date {
  const parts = cronExpression.trim().split(/\s+/);

  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: ${cronExpression}. Expected 5 parts (minute hour day month weekday)`);
  }

  const [minutePart, hourPart, dayPart, monthPart, weekdayPart] = parts;

  // Handle common patterns

  // Pattern: "0 * * * *" - Every hour
  if (minutePart === '0' && hourPart === '*' && dayPart === '*' && monthPart === '*' && weekdayPart === '*') {
    const next = addHours(fromTime, 1);
    next.setMinutes(0, 0, 0);
    return next;
  }

  // Pattern: "0 H * * *" - Daily at specific hour
  if (minutePart === '0' && hourPart !== '*' && dayPart === '*' && monthPart === '*' && weekdayPart === '*') {
    const targetHour = parseInt(hourPart, 10);
    if (isNaN(targetHour) || targetHour < 0 || targetHour > 23) {
      throw new Error(`Invalid hour in cron expression: ${hourPart}`);
    }

    let nextDay = add(startOfDay(fromTime), { days: 1, hours: targetHour });
    const todayAtHour = add(startOfDay(fromTime), { hours: targetHour });

    if (!isAfter(fromTime, todayAtHour)) {
      nextDay = todayAtHour;
    }

    return nextDay;
  }

  // Pattern: "0 H * * W" - Weekly on specific weekday at specific hour
  if (minutePart === '0' && hourPart !== '*' && dayPart === '*' && monthPart === '*' && weekdayPart !== '*') {
    const targetHour = parseInt(hourPart, 10);
    const targetWeekday = parseInt(weekdayPart, 10);

    if (isNaN(targetHour) || targetHour < 0 || targetHour > 23) {
      throw new Error(`Invalid hour in cron expression: ${hourPart}`);
    }
    if (isNaN(targetWeekday) || targetWeekday < 0 || targetWeekday > 6) {
      throw new Error(`Invalid weekday in cron expression: ${weekdayPart}`);
    }

    // Cron weekday: 0=Sunday, 1=Monday, ...
    // date-fns weekStartsOn: 0=Sunday, 1=Monday, ...
    const daysUntilTarget = (targetWeekday - fromTime.getDay() + 7) % 7 || 7;
    const nextWeekday = add(startOfDay(fromTime), { days: daysUntilTarget, hours: targetHour });

    // If we haven't passed that time today, use today
    if (fromTime.getDay() === targetWeekday) {
      const todayAtHour = add(startOfDay(fromTime), { hours: targetHour });
      if (!isAfter(fromTime, todayAtHour)) {
        return todayAtHour;
      }
    }

    return nextWeekday;
  }

  // Pattern: "*/M * * * *" - Every M minutes
  if (minutePart.startsWith('*/')) {
    const interval = parseInt(minutePart.substring(2), 10);
    if (isNaN(interval) || interval <= 0 || interval > 59) {
      throw new Error(`Invalid minute interval in cron expression: ${minutePart}`);
    }

    const currentMinutes = fromTime.getMinutes();
    const minutesToAdd = interval - (currentMinutes % interval);
    const next = add(fromTime, { minutes: minutesToAdd });
    next.setSeconds(0, 0);
    return next;
  }

  throw new Error(
    `Unsupported cron pattern: ${cronExpression}. ` +
    `Supported patterns: "0 * * * *" (hourly), "0 H * * *" (daily), "0 H * * W" (weekly), "*/M * * * *" (every M minutes)`
  );
}

/**
 * Validate cron expression format
 * Returns true if valid, false otherwise
 */
export function isValidCronExpression(cronExpression: string): boolean {
  if (!cronExpression || typeof cronExpression !== 'string') {
    return false;
  }

  const trimmed = cronExpression.trim();
  if (!trimmed) {
    return false;
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) {
    return false;
  }

  const [minutePart, hourPart, dayPart, monthPart, weekdayPart] = parts;

  // Supported patterns:
  // 1. "0 * * * *" - Hourly (minute 0, any hour)
  // 2. "0 H * * *" - Daily (minute 0, specific hour H)
  // 3. "0 H * * W" - Weekly (minute 0, specific hour H, specific weekday W)
  // 4. "*/M * * * *" - Every M minutes

  // Pattern: Hourly
  if (minutePart === '0' && hourPart === '*' && dayPart === '*' && monthPart === '*' && weekdayPart === '*') {
    return true;
  }

  // Pattern: Daily
  if (minutePart === '0' && dayPart === '*' && monthPart === '*' && weekdayPart === '*') {
    const hour = parseInt(hourPart, 10);
    return !isNaN(hour) && hour >= 0 && hour <= 23;
  }

  // Pattern: Weekly
  if (minutePart === '0' && dayPart === '*' && monthPart === '*') {
    const hour = parseInt(hourPart, 10);
    const weekday = parseInt(weekdayPart, 10);
    return !isNaN(hour) && hour >= 0 && hour <= 23 && !isNaN(weekday) && weekday >= 0 && weekday <= 6;
  }

  // Pattern: Every M minutes
  if (minutePart.startsWith('*/') && hourPart === '*' && dayPart === '*' && monthPart === '*' && weekdayPart === '*') {
    const interval = parseInt(minutePart.substring(2), 10);
    return !isNaN(interval) && interval > 0 && interval <= 59;
  }

  return false;
}

/**
 * Get human-readable description of cron expression
 */
export function describeCronExpression(cronExpression: string): string {
  if (!isValidCronExpression(cronExpression)) {
    return 'Invalid cron expression';
  }

  const [minutePart, hourPart, , , weekdayPart] = cronExpression.trim().split(/\s+/);

  if (minutePart === '0' && hourPart === '*') {
    return 'Every hour at minute 0';
  }

  if (minutePart === '0' && weekdayPart === '*') {
    const hour = parseInt(hourPart, 10);
    return `Every day at ${hour}:00`;
  }

  if (minutePart === '0') {
    const hour = parseInt(hourPart, 10);
    const weekday = parseInt(weekdayPart, 10);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `Every ${days[weekday]} at ${hour}:00`;
  }

  if (minutePart.startsWith('*/')) {
    const interval = parseInt(minutePart.substring(2), 10);
    return `Every ${interval} minutes`;
  }

  return 'Custom schedule';
}
