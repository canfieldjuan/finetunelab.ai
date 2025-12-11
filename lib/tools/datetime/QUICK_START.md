# DateTime Tool - Quick Start Guide

**For developers who need to use the tool immediately.**

## What It Does

Handles date and time operations: get current time, convert timezones, calculate dates, measure durations, and display relative time.

## Import

```typescript
import datetimeTool from '@/lib/tools/datetime';
```

## 6 Actions

### 1. Get Current Time

```typescript
const result = await datetimeTool.execute({
  action: 'current',
  timezone: 'America/New_York'  // Optional, defaults to UTC
});
// Returns: { utc, timestamp, local, formatted: { date, time, dayOfWeek, month, year } }
```

### 2. Convert Timezones

```typescript
const result = await datetimeTool.execute({
  action: 'convert',
  fromTimezone: 'America/New_York',
  toTimezone: 'Europe/London',
  dateTime: '2025-10-22T15:00:00Z'  // Optional, defaults to now
});
// Returns: { from: { timezone, time }, to: { timezone, time }, utc }
```

### 3. Format Date

```typescript
const result = await datetimeTool.execute({
  action: 'format',
  dateTime: '2025-10-22T15:00:00Z',
  timezone: 'UTC'  // Optional
});
// Returns: { formatted, iso, timestamp }
```

### 4. Calculate Dates

```typescript
// Add time
const result = await datetimeTool.execute({
  action: 'calculate',
  calculationAction: 'add',  // or 'subtract'
  dateTime: '2025-10-22T12:00:00Z',
  amount: 7,
  unit: 'days',  // 'days', 'hours', 'minutes', 'seconds'
  timezone: 'UTC'  // Optional
});
// Returns: { original, result, action, amount, unit }
```

### 5. Time Difference

```typescript
const result = await datetimeTool.execute({
  action: 'diff',
  startDateTime: '2025-10-01T00:00:00Z',
  endDateTime: '2025-10-22T00:00:00Z',
  unit: 'days'  // 'days', 'hours', 'minutes', 'seconds'
});
// Returns: { start, end, diff, unit }
```

### 6. Relative Time

```typescript
const result = await datetimeTool.execute({
  action: 'relative',
  dateTime: '2025-10-20T12:00:00Z',
  baseDate: '2025-10-22T12:00:00Z',  // Optional, defaults to now
  timezone: 'UTC'  // Optional
});
// Returns: { date, baseDate, relative: "2 days ago", timezone, formatted }
```

## Common Patterns

### Schedule Future Event

```typescript
// Get current time
const now = await datetimeTool.execute({
  action: 'current',
  timezone: 'UTC'
});

// Add 7 days
const future = await datetimeTool.execute({
  action: 'calculate',
  calculationAction: 'add',
  dateTime: now.utc,
  amount: 7,
  unit: 'days'
});

console.log('Event date:', future.result);
```

### Display Time Ago

```typescript
const relative = await datetimeTool.execute({
  action: 'relative',
  dateTime: postTimestamp
});

console.log(`Posted ${relative.relative}`);
// Output: "Posted 2 hours ago"
```

### Calculate Duration

```typescript
const duration = await datetimeTool.execute({
  action: 'diff',
  startDateTime: sessionStart,
  endDateTime: sessionEnd,
  unit: 'hours'
});

console.log(`Session: ${duration.diff} hours`);
```

### Multi-Timezone Display

```typescript
const timezones = ['America/New_York', 'Europe/London', 'Asia/Tokyo'];

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

## Input Format

**Date/Time Strings:** Must be ISO 8601 format
- `2025-10-22T12:00:00Z` (UTC)
- `2025-10-22T12:00:00-04:00` (With offset)
- `2025-10-22T12:00:00` (Local)

**Timezones:** Use IANA identifiers
- ✅ `America/New_York`, `Europe/London`, `Asia/Tokyo`
- ❌ `EST`, `GMT`, `JST` (ambiguous abbreviations)

## Key Limits

- **Date Range:** -271821 to 275760 (JavaScript Date limits)
- **Precision:** Milliseconds (not microseconds)
- **Calendar:** Gregorian only
- **Business Days:** Not supported (use external library)

## Error Handling

```typescript
try {
  const result = await datetimeTool.execute({
    action: 'calculate',
    calculationAction: 'add',
    dateTime: '2025-10-22T12:00:00Z',
    amount: 7,
    unit: 'days'
  });
} catch (error) {
  console.error('Operation failed:', error.message);
  // Common errors:
  // - "Invalid timezone"
  // - "Invalid date/time string"
  // - "Both fromTimezone and toTimezone are required"
  // - "dateTime is required for calculate"
}
```

## Quick Tips

1. **Always use ISO 8601** for date/time strings
2. **Use IANA identifiers** for timezones (not abbreviations)
3. **Timezone is optional** for most actions (defaults to UTC)
4. **Relative time is automatic** - returns human-friendly strings
5. **Negative differences** are valid (endDateTime before startDateTime)

## Need More Details?

See full documentation: `/lib/tools/datetime/README.md`

## Test It

```bash
npx tsx lib/tools/datetime/test-relative.ts
```
