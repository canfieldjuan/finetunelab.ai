// DateTime Tool - Main Export
// Phase 3.3: Tool definition and registration
// Date: October 10, 2025

import { ToolDefinition } from '../types';
import { datetimeConfig } from './datetime.config';
import { dateTimeService } from './datetime.service';

/**
 * DateTime Tool Definition
 */
const datetimeTool: ToolDefinition = {
  name: 'datetime',
  description: 'Get current date and time information, convert between timezones, format dates, perform date calculations (add/subtract), calculate differences between dates, and get relative time descriptions (e.g., "2 hours ago").',
  version: '2.1.0',
  
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Action to perform: "current", "convert", "format", "calculate", "diff", or "relative"',
        enum: ['current', 'convert', 'format', 'calculate', 'diff', 'relative'],
      },
      timezone: {
        type: 'string',
        description: 'Timezone (e.g., "America/New_York", "UTC", "Europe/London")',
      },
      fromTimezone: {
        type: 'string',
        description: 'Source timezone for conversion',
      },
      toTimezone: {
        type: 'string',
        description: 'Target timezone for conversion',
      },
      dateTime: {
        type: 'string',
        description: 'ISO 8601 date/time string (optional, defaults to now)',
      },
      calculationAction: {
        type: 'string',
        description: 'For calculate: "add" or "subtract"',
      },
      amount: {
        type: 'number',
        description: 'For calculate: amount to add/subtract',
      },
      unit: {
        type: 'string',
        description: 'For calculate/diff: "days", "hours", "minutes", or "seconds"',
      },
      startDateTime: {
        type: 'string',
        description: 'For diff: start date/time (ISO 8601)',
      },
      endDateTime: {
        type: 'string',
        description: 'For diff: end date/time (ISO 8601)',
      },
      baseDate: {
        type: 'string',
        description: 'For relative: base date to compare against (ISO 8601, defaults to now)',
      },
    },
    required: ['action'],
  },
  
  config: {
    enabled: datetimeConfig.enabled,
    defaultTimezone: datetimeConfig.defaultTimezone,
  },
  
  /**
   * Execute datetime operation
   */
  async execute(params: Record<string, unknown>, _conversationId?: string, _userId?: string, _supabaseClient?: unknown, _traceContext?: unknown) {
    const action = params.action as string;
    
    if (!action) {
      throw new Error('[DateTime] ValidationError: Action parameter is required');
    }

    console.log(`[DateTime Tool] Action: ${action}`);
    
    try {
      switch (action) {
        case 'current':
          return await dateTimeService.getCurrentDateTime(params.timezone as string);
          
        case 'convert':
          if (!params.fromTimezone || !params.toTimezone) {
            throw new Error('[DateTime] ValidationError: Both fromTimezone and toTimezone are required for conversion');
          }
          return await dateTimeService.convertTimezone(
            params.fromTimezone as string,
            params.toTimezone as string,
            params.dateTime as string
          );
          
        case 'format':
          if (!params.dateTime) {
            throw new Error('[DateTime] ValidationError: dateTime parameter is required for formatting');
          }
          // Basic formatting - users can extend this
          return await dateTimeService.formatDateTime(
            params.dateTime as string,
            { timeZone: params.timezone as string }
          );
          
        case 'calculate':
          console.debug('[DateTime Tool] Calculate action requested:', {
            calculationAction: params.calculationAction,
            dateTime: params.dateTime,
            amount: params.amount,
            unit: params.unit,
          });
          
          if (!params.calculationAction || !params.amount || !params.unit) {
            throw new Error('[DateTime] ValidationError: calculationAction, amount, and unit are required for calculate');
          }
          if (!params.dateTime) {
            throw new Error('[DateTime] ValidationError: dateTime is required for calculate');
          }
          return await dateTimeService.calculate(
            params.calculationAction as 'add' | 'subtract',
            params.dateTime as string,
            params.amount as number,
            params.unit as 'days' | 'hours' | 'minutes' | 'seconds',
            params.timezone as string
          );
          
        case 'diff':
          console.debug('[DateTime Tool] Diff action requested:', {
            startDateTime: params.startDateTime,
            endDateTime: params.endDateTime,
            unit: params.unit,
          });
          
          if (!params.startDateTime || !params.endDateTime || !params.unit) {
            throw new Error('[DateTime] ValidationError: startDateTime, endDateTime, and unit are required for diff');
          }
          return await dateTimeService.diff(
            params.startDateTime as string,
            params.endDateTime as string,
            params.unit as 'days' | 'hours' | 'minutes' | 'seconds',
            params.timezone as string
          );
          
        case 'relative':
          console.debug('[DateTime Tool] Relative action requested:', {
            dateTime: params.dateTime,
            baseDate: params.baseDate,
          });
          
          if (!params.dateTime) {
            throw new Error('[DateTime] ValidationError: dateTime is required for relative');
          }
          return await dateTimeService.relative(
            params.dateTime as string,
            params.baseDate as string,
            params.timezone as string
          );
          
        default:
          throw new Error(`[DateTime] ValidationError: Unknown action '${action}'`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[DateTime Tool] Error: ${message}`);
      throw error;
    }
  },
};

export default datetimeTool;
