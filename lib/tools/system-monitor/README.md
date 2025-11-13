# System Monitor Tool

A comprehensive system monitoring solution for the web-ui application, providing real-time health checks, resource monitoring, performance analytics, and intelligent insights.

## Version

**v1.4.0** (Released: October 21, 2025)

## Features

### Core Monitoring
- **Health Checks:** Monitor database, API, tools, and system resources
- **Resource Usage:** Track database size, storage, and performance stats
- **Performance Metrics:** Analyze response times, throughput, and error rates
- **System Information:** CPU, memory, and disk metrics via OS-level monitoring

### Advanced Analytics
- **Dynamic Thresholding:** Statistical analysis of 30-day historical data for adaptive alerts
- **Log Analysis:** Pattern-based detection of 8 critical error types
- **User Activity Correlation:** Links user behavior patterns to performance changes

### Intelligent Insights
- Weighted health scoring (Database: 25%, API: 20%, Tools: 20%, System: 35%)
- Trend analysis with historical comparisons
- Activity pattern recognition (increasing/stable/decreasing)
- Performance correlation strength assessment (strong/moderate/weak/none)
- Actionable recommendations based on data patterns

## Operations

### 1. health_check
Returns overall system health with weighted scoring.

**Parameters:** None

**Returns:**
```typescript
{
  status: 'healthy' | 'degraded' | 'unhealthy',
  score: number, // 0-100
  services: {
    database: { status, latency, message },
    api: { status, latency, message },
    tools: { available, total, enabled, disabled }
  },
  timestamp: string,
  issues?: string[]
}
```

### 2. resource_usage
Retrieves database, storage, and performance statistics.

**Parameters:** None

**Returns:**
```typescript
{
  database: { totalSize, tableStats, connectionInfo },
  storage: { available, used, usagePercent },
  performance: { avgResponseTime, requestsPerMinute },
  timestamp: string
}
```

### 3. performance_metrics
Analyzes performance over a specified period.

**Parameters:**
- `period` (optional): 'hour' | 'day' | 'week' | 'month' | 'all' (default: 'day')
- `metricType` (optional): 'response_time' | 'throughput' | 'errors' | 'all'
- `includeDetails` (optional): boolean

**Returns:**
```typescript
{
  period: string,
  summary: { avgDuration, totalExecutions, successRate, errorRate },
  breakdown?: ToolExecutionMetrics[],
  trends: { responseTime, throughput, errorRate },
  timestamp: string
}
```

### 4. get_alerts
Fetches current alerts using dynamic thresholds.

**Parameters:** None

**Returns:**
```typescript
{
  critical: Alert[],
  warnings: Alert[],
  info: InfoMessage[],
  systemStatus: 'healthy' | 'degraded' | 'critical',
  timestamp: string
}
```

### 5. get_system_info
Retrieves OS-level CPU, memory, and disk information.

**Parameters:** None

**Returns:**
```typescript
{
  cpu: { manufacturer, brand, cores, speed, load, temperature },
  memory: { total, used, free, usagePercent, swapTotal, swapUsed, swapFree },
  disk: { total, used, free, usagePercent, filesystems: [...] },
  timestamp: string
}
```

### 6. analyze_logs
Detects critical errors in application logs.

**Parameters:**
- `periodHours` (optional): number (default: 1)

**Returns:**
```typescript
{
  source: string,
  periodHours: number,
  totalEntries: number,
  errorsByLevel: { critical, error, warning, info },
  criticalErrors: LogEntry[],
  commonPatterns: Array<{ pattern, count, severity }>,
  timestamp: string
}
```

### 7. user_activity_correlation
Correlates user activity with system performance.

**Parameters:**
- `periodHours` (optional): number (default: 24)

**Returns:**
```typescript
{
  userActivity: {
    activeUsers: number,
    totalSessions: number,
    avgSessionDuration: number,
    toolExecutionsPerUser: number,
    peakActivityHour: number,
    activityTrend: 'increasing' | 'stable' | 'decreasing',
    periodCovered: string
  },
  performanceImpact: {
    correlationStrength: 'strong' | 'moderate' | 'weak' | 'none',
    avgResponseTimeChange: number,
    errorRateChange: number,
    insights: string[]
  }
}
```

## Usage Example

```typescript
import { systemMonitorTool } from './lib/tools/system-monitor';

// Check system health
const health = await systemMonitorTool.execute({ operation: 'health_check' });
console.log(`System health: ${health.data.status} (score: ${health.data.score})`);

// Get performance metrics for the last week
const metrics = await systemMonitorTool.execute({
  operation: 'performance_metrics',
  period: 'week',
  includeDetails: true
});

// Analyze logs for the last 6 hours
const logAnalysis = await systemMonitorTool.execute({
  operation: 'analyze_logs',
  periodHours: 6
});

// Correlate user activity with performance
const correlation = await systemMonitorTool.execute({
  operation: 'user_activity_correlation',
  periodHours: 24
});
console.log(`Correlation: ${correlation.data.performanceImpact.correlationStrength}`);
console.log(`Insights: ${correlation.data.performanceImpact.insights.join(', ')}`);
```

## Configuration

The tool is configured via `config.ts`:

```typescript
{
  enabled: true,
  defaultPeriod: 'day',
  health: {
    checkInterval: 60000, // 1 minute
    alertThresholds: {
      cpu: { warning: 70, critical: 90 },
      memory: { warning: 80, critical: 90 },
      disk: { warning: 80, critical: 90 },
      latency: { warning: 1000, critical: 5000 }
    }
  },
  performance: {
    sampleSize: 1000,
    retentionDays: 30
  }
}
```

## Architecture

### Service Layer
```
SystemMonitorService
├── SystemInformationService (OS metrics via systeminformation)
├── DynamicThresholdService (statistical threshold calculation)
├── LogAnalysisService (error pattern detection)
└── UserActivityService (activity correlation analysis)
```

### Data Sources
- **Supabase PostgreSQL:** tool_executions table, RPC functions
- **systeminformation:** CPU, memory, disk metrics
- **Tool Registry:** Tool availability and status
- **Application Logs:** Error patterns (extensible)

## Dependencies

- `systeminformation` (v5.x): OS-level metrics
- `@supabase/supabase-js`: Database client
- TypeScript 4.x+: Type safety

## Error Handling

The tool implements comprehensive error handling:
- Graceful degradation when services are unavailable
- Fallback to default values when data is insufficient
- Detailed error logging for troubleshooting
- Type-safe error messages

## Performance

- **Threshold Caching:** 1-hour TTL reduces database queries
- **Efficient Queries:** Optimized SQL with proper indexing
- **Singleton Pattern:** Service instances reused across calls
- **Statistical Sampling:** 10,000 most recent executions for analysis

## Development

### Adding New Operations

1. Add operation name to the `enum` in `index.ts`
2. Add case handler in the `switch` statement
3. Implement logic in appropriate service
4. Update types in `types.ts` if needed
5. Update version and description
6. Add tests

### Modifying Thresholds

Edit the statistical formulas in `threshold.service.ts`:

```typescript
// Current: mean + 1σ for warning, mean + 2σ for critical
warning: mean + stdDev,
critical: mean + 2 * stdDev
```

### Extending Log Analysis

Add new patterns to `log-analysis.service.ts`:

```typescript
const errorPatterns = [
  { pattern: /your_regex_here/i, severity: 'critical' as const },
  // ...
];
```

## Testing

See `ENHANCEMENT_SUMMARY.md` for detailed testing recommendations.

## Change Log

### v1.4.0 (October 21, 2025)
- Added user activity correlation (Phase 3, Task 3.3)
- New operation: `user_activity_correlation`
- Activity trend analysis and performance correlation

### v1.3.0 (October 21, 2025)
- Added log analysis (Phase 3, Task 3.2)
- New operation: `analyze_logs`
- 8 critical error patterns

### v1.2.0 (October 21, 2025)
- Added system-level monitoring (Phase 2)
- New operation: `get_system_info`
- OS metrics: CPU, memory, disk

### v1.1.0 (October 20, 2025)
- Fixed database stats, metrics breakdown, trend analysis (Phase 1)
- Added comprehensive debug logging
- Real data instead of 'N/A' placeholders

### v1.0.0
- Initial incomplete implementation

## License

Part of the web-ui application.

## Support

For issues, feature requests, or questions, see the project documentation or contact the development team.
