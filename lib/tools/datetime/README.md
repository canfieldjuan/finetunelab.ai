# DateTime Tool - Documentation

**Version:** 2.1.0
**Date:** October 22, 2025
**Location:** `/lib/tools/datetime`

## Table of Contents

- [Overview](#overview)
- [What It Does](#what-it-does)
- [Architecture](#architecture)
- [Actions](#actions)
- [How to Use](#how-to-use)
- [When to Use](#when-to-use)
- [When NOT to Use](#when-not-to-use)
- [Configuration](#configuration)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Overview

The **DateTime Tool** provides comprehensive date and time operations including timezone conversions, date arithmetic, time differences, and human-friendly relative time descriptions. Built on `date-fns` and `date-fns-tz` libraries, it offers robust, type-safe date/time manipulation.

### Key Features

- **Current Time**: Get current date/time in any timezone
- **Timezone Conversion**: Convert between any IANA timezones
- **Date Formatting**: Format dates with locale support
- **Date Arithmetic**: Add or subtract time (days, hours, minutes, seconds)
- **Time Differences**: Calculate duration between dates
- **Relative Time**: Human-friendly descriptions ("2 hours ago", "in 5 minutes")
- **Timezone Validation**: Automatic validation of timezone strings
- **Comprehensive Error Handling**: Clear error messages with context

---

## What It Does

The DateTime tool enables you to:

1. **Get Current Time** - Retrieve current date/time with timezone awareness
2. **Convert Timezones** - Transform time between any IANA timezones
3. **Format Dates** - Customize date/time display with locale options
4. **Calculate Dates** - Add or subtract time from any date
5. **Measure Differences** - Calculate time between two dates
6. **Describe Relatively** - Generate human-readable time descriptions

### Data Flow

```
Input (ISO 8601 or timezone)
    ↓
DateTime Service (date-fns operations)
    ↓
Formatted Output (locale-aware, timezone-specific)
```

---

## Architecture

### File Structure

```
lib/tools/datetime/
├── index.ts                       # Tool definition and action router
├── datetime.service.ts            # Core service with date/time operations
├── datetime.config.ts             # Configuration and feature flags
├── datetime.types.ts              # TypeScript type definitions
├── test-relative.ts               # Test suite for relative action
├── datetime-v2-test.ts            # Test suite for v2.0.0 features
├── DATETIME_EVALUATION.md         # Initial evaluation and enhancement plan
├── ENHANCEMENT_COMPLETE.md        # v2.1.0 completion documentation
└── README.md                      # This file
```

### Component Responsibilities

**`index.ts`** - Tool Definition
- Defines tool interface for LLM/API consumption
- Routes actions to service methods
- Validates required parameters
- Formats error responses

**`datetime.service.ts`** - Service Layer
- Implements all date/time operations
- Uses date-fns for calculations
- Handles timezone validation
- Manages error handling

**`datetime.config.ts`** - Configuration
- Default timezone (UTC)
- Locale settings (en-US)
- Feature flags (conversion, formatting)
- Environment variable overrides

**`datetime.types.ts`** - Type Definitions
- `DateCalculation`: Calculation expressions
- `CalculationResult`: Calculation response
- `DurationResult`: Duration breakdown
- `RelativeTimeResult`: Relative time response

---

## Actions

### 1. Current Action

Get current date and time in specified timezone.

**Parameters:**
```typescript
{
  action: 'current',
  timezone?: string  // Optional, defaults to UTC
}
```

**Returns:**
```typescript
{
  utc: string,              // ISO 8601 UTC
  timezone: string,         // Requested timezone
  timestamp: number,        // Unix timestamp (ms)
  local: string,            // Localized string
  formatted: {
    date: string,           // "10/22/2025"
    time: string,           // "3:45:30 PM"
    dayOfWeek: string,      // "Tuesday"
    month: string,          // "October"
    year: string            // "2025"
  }
}
```

**Example:**
```typescript
const result = await datetimeTool.execute({
  action: 'current',
  timezone: 'America/New_York'
});

// Returns:
// {
//   utc: "2025-10-22T15:45:30.123Z",
//   timezone: "America/New_York",
//   timestamp: 1729611930123,
//   local: "10/22/2025, 11:45:30 AM",
//   formatted: {
//     date: "10/22/2025",
//     time: "11:45:30 AM",
//     dayOfWeek: "Tuesday",
//     month: "October",
//     year: "2025"
//   }
// }
```

**Use Cases:**
- Display current time to users
- Get timestamps for logging
- Show time in user's timezone
- Generate date-stamped reports

---

### 2. Convert Action

Convert time between timezones.

**Parameters:**
```typescript
{
  action: 'convert',
  fromTimezone: string,     // Required: Source timezone
  toTimezone: string,       // Required: Target timezone
  dateTime?: string         // Optional: ISO 8601 (defaults to now)
}
```

**Returns:**
```typescript
{
  from: {
    timezone: string,
    time: string
  },
  to: {
    timezone: string,
    time: string
  },
  utc: string
}
```

**Example:**
```typescript
const result = await datetimeTool.execute({
  action: 'convert',
  fromTimezone: 'America/New_York',
  toTimezone: 'Europe/London',
  dateTime: '2025-10-22T15:00:00Z'
});

// Returns:
// {
//   from: {
//     timezone: "America/New_York",
//     time: "10/22/2025, 11:00:00 AM"
//   },
//   to: {
//     timezone: "Europe/London",
//     time: "10/22/2025, 4:00:00 PM"
//   },
//   utc: "2025-10-22T15:00:00.000Z"
// }
```

**Use Cases:**
- Schedule international meetings
- Display event times for global users
- Convert timestamps for distributed teams
- Show business hours across timezones

**Supported Timezones:**
All IANA timezone identifiers:
- `UTC`
- `America/New_York`, `America/Los_Angeles`, `America/Chicago`
- `Europe/London`, `Europe/Paris`, `Europe/Berlin`
- `Asia/Tokyo`, `Asia/Shanghai`, `Asia/Dubai`
- `Australia/Sydney`, `Pacific/Auckland`
- [Full list](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)

---

### 3. Format Action

Format date/time with custom options.

**Parameters:**
```typescript
{
  action: 'format',
  dateTime: string,                        // Required: ISO 8601
  timezone?: string,                       // Optional: Timezone for display
  // formatOptions passed internally
}
```

**Returns:**
```typescript
{
  formatted: string,
  iso: string,
  timestamp: number
}
```

**Example:**
```typescript
const result = await datetimeTool.execute({
  action: 'format',
  dateTime: '2025-10-22T15:00:00Z',
  timezone: 'America/New_York'
});

// Returns:
// {
//   formatted: "10/22/2025, 11:00:00 AM",
//   iso: "2025-10-22T15:00:00.000Z",
//   timestamp: 1729608000000
// }
```

**Use Cases:**
- Display dates in consistent format
- Localize date/time for users
- Format dates for reports
- Convert ISO timestamps to readable strings

---

### 4. Calculate Action

Add or subtract time from a date.

**Parameters:**
```typescript
{
  action: 'calculate',
  calculationAction: 'add' | 'subtract',   // Required: Operation
  dateTime: string,                        // Required: ISO 8601
  amount: number,                          // Required: Quantity
  unit: 'days' | 'hours' | 'minutes' | 'seconds',  // Required: Unit
  timezone?: string                        // Optional: Display timezone
}
```

**Returns:**
```typescript
{
  original: string,
  result: string,
  action: 'add' | 'subtract',
  amount: number,
  unit: string
}
```

**Example 1: Add Time**
```typescript
const result = await datetimeTool.execute({
  action: 'calculate',
  calculationAction: 'add',
  dateTime: '2025-10-22T12:00:00Z',
  amount: 3,
  unit: 'days',
  timezone: 'UTC'
});

// Returns:
// {
//   original: "10/22/2025, 12:00:00 PM",
//   result: "10/25/2025, 12:00:00 PM",
//   action: "add",
//   amount: 3,
//   unit: "days"
// }
```

**Example 2: Subtract Time**
```typescript
const result = await datetimeTool.execute({
  action: 'calculate',
  calculationAction: 'subtract',
  dateTime: '2025-10-22T12:00:00Z',
  amount: 48,
  unit: 'hours',
  timezone: 'America/New_York'
});

// Returns:
// {
//   original: "10/22/2025, 8:00:00 AM",
//   result: "10/20/2025, 8:00:00 AM",
//   action: "subtract",
//   amount: 48,
//   unit: "hours"
// }
```

**Use Cases:**
- Calculate due dates
- Schedule future events
- Determine deadlines
- Build timelines
- Compute delivery estimates
- Set reminder times

**Supported Units:**
- `days`: 24-hour periods
- `hours`: 60-minute periods
- `minutes`: 60-second periods
- `seconds`: Base unit

---

### 5. Diff Action

Calculate difference between two dates.

**Parameters:**
```typescript
{
  action: 'diff',
  startDateTime: string,                   // Required: ISO 8601
  endDateTime: string,                     // Required: ISO 8601
  unit: 'days' | 'hours' | 'minutes' | 'seconds',  // Required: Unit
  timezone?: string                        // Optional: Display timezone
}
```

**Returns:**
```typescript
{
  start: string,
  end: string,
  diff: number,
  unit: string
}
```

**Example 1: Days Difference**
```typescript
const result = await datetimeTool.execute({
  action: 'diff',
  startDateTime: '2025-10-01T00:00:00Z',
  endDateTime: '2025-10-22T00:00:00Z',
  unit: 'days'
});

// Returns:
// {
//   start: "10/1/2025, 12:00:00 AM",
//   end: "10/22/2025, 12:00:00 AM",
//   diff: 21,
//   unit: "days"
// }
```

**Example 2: Hours Difference**
```typescript
const result = await datetimeTool.execute({
  action: 'diff',
  startDateTime: '2025-10-22T08:00:00Z',
  endDateTime: '2025-10-22T14:30:00Z',
  unit: 'hours'
});

// Returns:
// {
//   start: "10/22/2025, 8:00:00 AM",
//   end: "10/22/2025, 2:30:00 PM",
//   diff: 6,
//   unit: "hours"
// }
```

**Use Cases:**
- Measure elapsed time
- Calculate age or duration
- Track time between events
- Determine session length
- Compute processing time
- Calculate billing hours

**Note:** Difference can be negative if endDateTime is before startDateTime.

---

### 6. Relative Action

Get human-friendly time description.

**Parameters:**
```typescript
{
  action: 'relative',
  dateTime: string,         // Required: ISO 8601
  baseDate?: string,        // Optional: Base date (defaults to now)
  timezone?: string         // Optional: Display timezone
}
```

**Returns:**
```typescript
{
  date: string,             // ISO 8601 of target date
  baseDate: string,         // ISO 8601 of base date
  relative: string,         // Human-friendly description
  timezone: string,         // Timezone used
  formatted: string         // Full formatted date
}
```

**Example 1: Past Date**
```typescript
const past = new Date();
past.setHours(past.getHours() - 2);

const result = await datetimeTool.execute({
  action: 'relative',
  dateTime: past.toISOString()
});

// Returns:
// {
//   date: "2025-10-22T11:45:30.000Z",
//   baseDate: "2025-10-22T13:45:30.000Z",
//   relative: "about 2 hours ago",
//   timezone: "UTC",
//   formatted: "Oct 22, 2025, 11:45:30 AM"
// }
```

**Example 2: Future Date**
```typescript
const future = new Date();
future.setDate(future.getDate() + 7);

const result = await datetimeTool.execute({
  action: 'relative',
  dateTime: future.toISOString()
});

// Returns:
// {
//   relative: "in 7 days",
//   ...
// }
```

**Example 3: Custom Base Date**
```typescript
const result = await datetimeTool.execute({
  action: 'relative',
  dateTime: '2025-01-01T00:00:00Z',
  baseDate: '2025-01-15T00:00:00Z'
});

// Returns:
// {
//   relative: "14 days ago",  // Relative to Jan 15
//   ...
// }
```

**Relative Time Examples:**
- `"less than 5 seconds ago"`
- `"about 1 minute ago"`
- `"about 2 hours ago"`
- `"yesterday"`
- `"5 days ago"`
- `"about 1 month ago"`
- `"in 5 minutes"`
- `"in about 3 hours"`
- `"in 2 days"`

**Use Cases:**
- Display post timestamps ("posted 2 hours ago")
- Show file modification times
- Display last login time
- Format notification times
- Show comment age
- Display event recency

---

## How to Use

### Installation

The tool is integrated into FineTune Lab. Dependencies already installed:
- `date-fns@4.1.0`
- `date-fns-tz@3.2.0`

### Basic Usage

```typescript
import datetimeTool from '@/lib/tools/datetime';

// Get current time
const current = await datetimeTool.execute({
  action: 'current',
  timezone: 'America/New_York'
});

// Add 7 days to a date
const future = await datetimeTool.execute({
  action: 'calculate',
  calculationAction: 'add',
  dateTime: '2025-10-22T12:00:00Z',
  amount: 7,
  unit: 'days'
});

// Get relative time
const relative = await datetimeTool.execute({
  action: 'relative',
  dateTime: '2025-10-20T12:00:00Z'
});
```

### Common Workflows

**Workflow 1: Schedule Future Event**
```typescript
// Step 1: Get current time
const now = await datetimeTool.execute({
  action: 'current',
  timezone: 'UTC'
});

// Step 2: Calculate event time (7 days from now)
const eventTime = await datetimeTool.execute({
  action: 'calculate',
  calculationAction: 'add',
  dateTime: now.utc,
  amount: 7,
  unit: 'days'
});

// Step 3: Convert to user's timezone
const localTime = await datetimeTool.execute({
  action: 'convert',
  fromTimezone: 'UTC',
  toTimezone: 'America/New_York',
  dateTime: eventTime.result
});

console.log(`Event scheduled for: ${localTime.to.time}`);
```

**Workflow 2: Display Time Ago**
```typescript
// Get post timestamp
const postDate = '2025-10-20T14:30:00Z';

// Get relative time
const relative = await datetimeTool.execute({
  action: 'relative',
  dateTime: postDate
});

console.log(`Posted ${relative.relative}`);
// Output: "Posted 2 days ago"
```

**Workflow 3: Calculate Duration**
```typescript
// Session start and end times
const start = '2025-10-22T09:00:00Z';
const end = '2025-10-22T14:30:00Z';

// Calculate duration in hours
const duration = await datetimeTool.execute({
  action: 'diff',
  startDateTime: start,
  endDateTime: end,
  unit: 'hours'
});

console.log(`Session lasted ${duration.diff} hours`);
// Output: "Session lasted 5 hours"
```

**Workflow 4: Multi-Timezone Meeting Scheduler**
```typescript
// Meeting time in NYC
const meetingTime = '2025-10-25T14:00:00Z';

// Convert to multiple timezones
const timezones = ['America/Los_Angeles', 'Europe/London', 'Asia/Tokyo'];

for (const tz of timezones) {
  const converted = await datetimeTool.execute({
    action: 'convert',
    fromTimezone: 'UTC',
    toTimezone: tz,
    dateTime: meetingTime
  });

  console.log(`${tz}: ${converted.to.time}`);
}
```

---

## When to Use

### ✅ Use DateTime Tool When:

1. **Timezone Operations**
   - Converting between timezones
   - Displaying time for global users
   - Scheduling across time zones

2. **Date Calculations**
   - Adding/subtracting time
   - Calculating deadlines
   - Scheduling future events

3. **Time Measurements**
   - Finding duration between dates
   - Measuring elapsed time
   - Tracking time differences

4. **Display Formatting**
   - Showing "time ago" format
   - Localizing dates for users
   - Formatting timestamps

5. **Time-Based Logic**
   - Checking if date is past/future
   - Validating date ranges
   - Building timelines

---

## When NOT to Use

### ❌ Do NOT Use DateTime Tool When:

1. **Business Day Calculations**
   - **Limitation:** No awareness of weekends/holidays
   - **Alternative:** Use Phase 2 enhancement (planned) or external library
   - **Why:** Tool only handles calendar days

2. **Natural Language Parsing**
   - **Limitation:** Cannot parse "tomorrow", "next Friday", etc.
   - **Alternative:** Use Phase 3 enhancement (planned) or chrono-node
   - **Why:** Requires ISO 8601 strings

3. **Complex Recurring Events**
   - **Limitation:** No recurrence rule support
   - **Alternative:** Use rrule library
   - **Why:** Tool designed for single date operations

4. **High-Precision Timing**
   - **Limitation:** Millisecond precision, not microseconds
   - **Alternative:** Use performance.now() or process.hrtime()
   - **Why:** JavaScript Date limitations

5. **Historical Date Accuracy**
   - **Limitation:** Doesn't account for historical timezone changes
   - **Alternative:** Use moment-timezone with historical data
   - **Why:** date-fns uses current timezone rules

6. **Custom Calendar Systems**
   - **Limitation:** Gregorian calendar only
   - **Alternative:** Specialized libraries for lunar, Hebrew, etc.
   - **Why:** Built on JavaScript Date (Gregorian)

7. **Very Old or Future Dates**
   - **Limitation:** JavaScript Date range (-271821 to 275760)
   - **Alternative:** BigInt-based date libraries
   - **Why:** Date object limitations

---

## Configuration

### Default Configuration

Location: `datetime.config.ts`

```typescript
export const datetimeConfig = {
  enabled: true,
  defaultTimezone: 'UTC',
  locale: 'en-US',
  includeMilliseconds: false,
  includeTimezone: true,
  enableConversion: true,
  enableFormatting: true
};
```

### Environment Variables

Override defaults with environment variables:

```bash
# .env file
DATETIME_LOCALE=en-US                    # Locale for formatting
DATETIME_INCLUDE_MS=false                # Include milliseconds in output
DATETIME_INCLUDE_TZ=true                 # Include timezone in output
DATETIME_ENABLE_CONVERSION=true          # Enable timezone conversion
DATETIME_ENABLE_FORMATTING=true          # Enable date formatting
```

### Customizing Configuration

To change configuration:

1. Edit `/lib/tools/datetime/datetime.config.ts`
2. Update desired values
3. Restart application

**Example: Change Default Timezone**
```typescript
export const datetimeConfig = {
  // ... other settings
  defaultTimezone: 'America/New_York',  // Changed from UTC
};
```

**Example: Disable Timezone Conversion**
```typescript
export const datetimeConfig = {
  // ... other settings
  enableConversion: false,  // Disable convert action
};
```

---

## Testing

### Running Tests

**Test Relative Action:**
```bash
npx tsx lib/tools/datetime/test-relative.ts
```

**Test v2.0.0 Features:**
```bash
npx tsx lib/tools/datetime/datetime-v2-test.ts
```

### Test Coverage

**Tested Actions:**
- ✅ Current time in multiple timezones
- ✅ Timezone conversions
- ✅ Date formatting
- ✅ Add time calculations
- ✅ Subtract time calculations
- ✅ Time differences (days, hours, minutes, seconds)
- ✅ Relative time (past, future, custom base)
- ✅ Backward compatibility

### Manual Testing

For custom testing scenarios:

```typescript
import datetimeTool from './index';

// Test your specific use case
const result = await datetimeTool.execute({
  action: 'calculate',
  calculationAction: 'add',
  dateTime: '2025-01-01T00:00:00Z',
  amount: 30,
  unit: 'days'
});

console.log('Result:', result);
```

---

## Troubleshooting

### Common Errors

**Error: "Invalid timezone"**

**Cause:** Provided timezone string is not a valid IANA identifier

**Solution:**
```typescript
// ❌ BAD: Invalid timezone
await datetimeTool.execute({
  action: 'current',
  timezone: 'EST'  // Ambiguous abbreviation
});

// ✅ GOOD: Valid IANA timezone
await datetimeTool.execute({
  action: 'current',
  timezone: 'America/New_York'
});
```

**Valid Format:** Use full IANA identifiers from [this list](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)

---

**Error: "Invalid date/time string"**

**Cause:** Provided date string is not valid ISO 8601 format

**Solution:**
```typescript
// ❌ BAD: Invalid format
await datetimeTool.execute({
  action: 'calculate',
  dateTime: '10/22/2025'  // US date format
});

// ✅ GOOD: ISO 8601 format
await datetimeTool.execute({
  action: 'calculate',
  dateTime: '2025-10-22T12:00:00Z'
});
```

**Valid Formats:**
- `2025-10-22T12:00:00Z` (UTC)
- `2025-10-22T12:00:00-04:00` (With offset)
- `2025-10-22T12:00:00` (Local, no timezone)

---

**Error: "Both fromTimezone and toTimezone are required"**

**Cause:** Convert action missing required parameters

**Solution:**
```typescript
// ❌ BAD: Missing toTimezone
await datetimeTool.execute({
  action: 'convert',
  fromTimezone: 'UTC'
});

// ✅ GOOD: Both timezones provided
await datetimeTool.execute({
  action: 'convert',
  fromTimezone: 'UTC',
  toTimezone: 'America/New_York'
});
```

---

**Error: "dateTime is required for calculate"**

**Cause:** Calculate action missing required dateTime parameter

**Solution:**
```typescript
// ❌ BAD: Missing dateTime
await datetimeTool.execute({
  action: 'calculate',
  calculationAction: 'add',
  amount: 5,
  unit: 'days'
});

// ✅ GOOD: dateTime provided
await datetimeTool.execute({
  action: 'calculate',
  calculationAction: 'add',
  dateTime: '2025-10-22T12:00:00Z',
  amount: 5,
  unit: 'days'
});
```

---

### Debug Logging

Enable debug output to troubleshoot issues:

```typescript
// Service includes console.debug statements
// Example output:
[DateTime Tool] Action: relative
[DateTime] Relative time requested: { dateTime: '...', baseDate: '...', timezone: 'UTC' }
[DateTime] Calculating relative time from 2025-10-22... to 2025-10-20...
```

**View Logs:**
- Browser console (client-side)
- Server logs (API usage)
- Test output (during testing)

---

## Version History

### Version 2.1.0 (Current)
- Added `relative` action for human-friendly time descriptions
- Enhanced debug logging
- Comprehensive test suite

### Version 2.0.0
- Added `calculate` action for date arithmetic
- Added `diff` action for time differences
- Enhanced error handling
- Full date-fns integration

### Version 1.0.0
- Initial release
- `current`, `convert`, `format` actions
- Timezone validation
- Configuration system

---

## Future Enhancements

### Phase 2: Business Days & Holidays (Planned)
- `isBusinessDay` action
- `nextBusinessDay` action
- `addBusinessDays` action
- Holiday API integration

**Estimated Effort:** ~2 hours
**Status:** Not yet implemented

### Phase 3: Natural Language (Planned)
- Parse "tomorrow at 3pm"
- Parse "next Friday"
- `createReminder` action

**Estimated Effort:** ~3 hours
**Status:** Not yet implemented

---

## Support

For issues, questions, or contributions:

1. **Documentation:** This README and related .md files in `/lib/tools/datetime`
2. **Code:** Review `index.ts` and `datetime.service.ts`
3. **Tests:** Run test files or create custom tests
4. **Logs:** Check debug output for operation details

---

## References

- **Tool Definition:** `/lib/tools/datetime/index.ts`
- **Service Implementation:** `/lib/tools/datetime/datetime.service.ts`
- **Configuration:** `/lib/tools/datetime/datetime.config.ts`
- **Type Definitions:** `/lib/tools/datetime/datetime.types.ts`
- **Enhancement Docs:** `/lib/tools/datetime/ENHANCEMENT_COMPLETE.md`
- **date-fns Documentation:** https://date-fns.org/
- **IANA Timezones:** https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

---

**Last Updated:** October 22, 2025
**Maintained By:** FineTune Lab Development Team
**Version:** 2.1.0
