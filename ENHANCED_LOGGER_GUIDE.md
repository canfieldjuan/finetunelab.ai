# Enhanced Logger - Quick Reference

## What's New? 📊

The logger now captures **much more diagnostic data** automatically:

### New Features
1. ✅ **Stack Traces** - Automatic stack traces on all ERROR logs
2. ✅ **Performance Metrics** - Timestamps with `performance.now()` for timing analysis
3. ✅ **Browser Context** - Captures user agent and current URL
4. ✅ **Session Tracking** - Unique session ID for correlating logs
5. ✅ **Persistent Storage** - Logs saved to localStorage (up to 1000 entries)
6. ✅ **Log History** - Query and export logs for debugging
7. ✅ **Statistics** - Get error rates and log distribution

---

## Quick Start

### Basic Usage (unchanged)
```typescript
import { log } from '@/lib/utils/logger';

log.error('API', 'Request failed', { status: 500, endpoint: '/api/models' });
log.debug('Chat', 'Message sent', { messageId: 'abc123' });
```

### New: Export Logs for Bug Reports
```javascript
// In browser console:
import { configureLogger } from '@/lib/utils/logger';

// Download all logs as JSON file
configureLogger.downloadLogs('my-bug-report.json');

// Or copy to clipboard
console.log(configureLogger.exportLogs());
```

### New: View Log History
```javascript
// Get all logs
configureLogger.getHistory();

// Get only errors
configureLogger.getErrorLogs();

// Get logs from specific module
configureLogger.getLogsByModule('BatchTesting');

// Get statistics
configureLogger.getStats();
// Returns: { total: 1234, byLevel: {...}, byModule: {...}, errorRate: 2.5 }
```

---

## Log Entry Structure

Each log now includes:
```typescript
{
  timestamp: "2025-10-29T10:30:45.123Z",
  level: "ERROR",
  module: "API",
  message: "Request failed",
  data: { status: 500, endpoint: "/api/models" },
  
  // NEW: Additional context
  sessionId: "session_1730199045123_abc123xyz",
  performanceNow: 12345.678,              // Milliseconds since page load
  userAgent: "Mozilla/5.0...",            // Browser info
  url: "http://localhost:3000/chat",      // Current page
  stackTrace: "at fetch (...)\nat..."     // Stack trace (errors only)
}
```

---

## Configuration

### Enable/Disable Features
```javascript
import { configureLogger } from '@/lib/utils/logger';

// Enable stack traces (on by default in dev)
configureLogger.enableStackTraces(true);

// Enable performance tracking (on by default)
configureLogger.enablePerformance(true);

// Enable log persistence to localStorage (on by default in dev)
configureLogger.enablePersistence(true);

// Enable timestamps in console output
configureLogger.enableTimestamps(true);
```

### Presets
```javascript
// Production mode: INFO level, stack traces, persistence
configureLogger.productionMode();

// Development mode: DEBUG level, all features
configureLogger.developmentMode();

// Verbose mode: TRACE level, all features + timestamps
configureLogger.verboseMode();

// Errors only
configureLogger.onlyErrors();
```

---

## Debugging Workflows

### When Something Breaks
1. **Check browser console** - Look for ERROR logs with stack traces
2. **Export logs** - `configureLogger.downloadLogs('bug-report.json')`
3. **Check error rate** - `configureLogger.getStats()` to see if error rate is high
4. **Filter by module** - `configureLogger.getLogsByModule('API')` to focus

### Performance Analysis
```javascript
// Get all logs with performance metrics
const logs = configureLogger.getHistory();

// Filter to specific operation
const testLogs = logs.filter(l => 
  l.module === 'BatchTesting' && 
  l.message.includes('test started')
);

// Calculate time between events
const startLog = testLogs[0];
const endLog = testLogs[1];
const duration = endLog.performanceNow - startLog.performanceNow;
console.log(`Test took ${duration}ms`);
```

### Session Correlation
```javascript
// All logs from current session
const logs = configureLogger.getHistory();
const sessionId = logs[0]?.sessionId;

// Share this ID in bug reports to correlate logs
console.log('My session:', sessionId);
```

---

## Storage Management

### Check Storage Usage
```javascript
const stats = configureLogger.getStats();
console.log(`${stats.total} logs stored`);

// Max: 1000 logs (oldest are auto-deleted)
```

### Clear Old Logs
```javascript
// Clear all stored logs
configureLogger.clearHistory();

// Disable persistence to stop storing
configureLogger.enablePersistence(false);
```

---

## Examples

### Error with Full Context
```typescript
try {
  const response = await fetch('/api/models');
  if (!response.ok) {
    log.error('API', 'Failed to fetch models', {
      status: response.status,
      statusText: response.statusText,
      url: response.url
    });
  }
} catch (err) {
  log.error('API', 'Network error', { error: err });
  // Automatic stack trace captured!
}
```

### Performance Tracking
```typescript
log.debug('BatchTesting', 'Starting batch test', { modelId, benchmarkId });
// ... test runs ...
log.debug('BatchTesting', 'Batch test completed', { testRunId, duration: '5s' });

// Later, analyze timing:
const logs = configureLogger.getLogsByModule('BatchTesting');
const start = logs.find(l => l.message.includes('Starting'));
const end = logs.find(l => l.message.includes('completed'));
console.log(`Total time: ${end.performanceNow - start.performanceNow}ms`);
```

### Export for Bug Report
```typescript
// User reports a bug
configureLogger.downloadLogs(`bug-report-${Date.now()}.json`);

// File contains:
// - All recent logs (up to 1000)
// - Session ID
// - Browser info
// - Stack traces for errors
// - Performance metrics
// - Timestamps
```

---

## Browser Console Helpers

```javascript
// Quick stats
configureLogger.getStats()

// See all errors
configureLogger.getErrorLogs()

// Download logs
configureLogger.downloadLogs()

// Clear history
configureLogger.clearHistory()

// Change log level
configureLogger.setLevel(0)  // ERROR only
configureLogger.setLevel(3)  // DEBUG (default dev)
configureLogger.setLevel(4)  // TRACE (very verbose)
```

---

## What Data is Captured?

### Always Captured
- ✅ Log level (ERROR, WARN, INFO, DEBUG, TRACE)
- ✅ Module name
- ✅ Message
- ✅ Custom data object
- ✅ Timestamp (ISO 8601)
- ✅ Session ID

### When Enabled (default ON in dev)
- ✅ Stack trace (errors only)
- ✅ Performance timestamp (ms since page load)
- ✅ User agent string
- ✅ Current URL

### Storage
- ✅ Last 1000 logs in localStorage
- ✅ Survives page refresh
- ✅ Cleared on `clearHistory()` or manually

---

## Migration Status

**Completed:**
- ✅ Chat.tsx (103 logs)
- ✅ BatchTesting.tsx (26 logs)

**Next:**
- ⏳ AnomalyFeed.tsx (22 logs)
- ⏳ ModelSelector.tsx (5 logs)
- ⏳ Quick wins: DatasetList, Pricing, ModelCard (16 logs)

Total migrated: **129 of ~300 logs (43%)**
