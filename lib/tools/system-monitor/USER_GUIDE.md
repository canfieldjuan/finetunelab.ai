# System Monitor Tool - User Guide

**Version:** 1.4.0
**Date:** October 22, 2025
**Location:** `/lib/tools/system-monitor`

## Quick Overview

The **System Monitor Tool** provides comprehensive monitoring of application and system health, including database performance, OS-level resources (CPU, memory, disk), log analysis, and user activity correlation.

---

## What It Does

**7 Operations:**
1. **health_check** - Overall system health score
2. **resource_usage** - Database and storage statistics
3. **performance_metrics** - Tool execution metrics over time
4. **get_alerts** - Active critical alerts and warnings
5. **get_system_info** - CPU, memory, and disk metrics
6. **analyze_logs** - Error pattern detection in logs
7. **user_activity_correlation** - Activity vs performance analysis

---

## Quick Start

```typescript
import { systemMonitorTool } from '@/lib/tools/system-monitor';

// Check system health
const health = await systemMonitorTool.execute({
  operation: 'health_check'
});

console.log('Status:', health.data.status);  // healthy/degraded/unhealthy
console.log('Score:', health.data.score);    // 0-100
```

---

## Operations

### 1. Health Check

Get overall system health with weighted scoring.

```typescript
const result = await systemMonitorTool.execute({
  operation: 'health_check'
});

// Returns:
{
  success: true,
  data: {
    status: 'healthy' | 'degraded' | 'unhealthy',
    score: 85,  // 0-100
    services: {
      database: { status: 'up', latency: 45 },
      api: { status: 'up', latency: 120 },
      tools: { available: 13, total: 13, enabled: 13 }
    },
    timestamp: '2025-10-22T12:00:00Z',
    issues: []
  }
}
```

**Health Scoring:**
- Database: 25%
- API: 20%
- Tools: 20%
- System Resources: 35%

**Status Thresholds:**
- Healthy: Score ≥ 90
- Degraded: 70 ≤ Score < 90
- Unhealthy: Score < 70

---

### 2. Resource Usage

Database and storage statistics.

```typescript
const result = await systemMonitorTool.execute({
  operation: 'resource_usage'
});

// Returns:
{
  success: true,
  data: {
    database: {
      totalSize: '2.4 GB',
      tableStats: [
        {
          name: 'messages',
          rowCount: 15420,
          size: '1.2 GB',
          indexSize: '250 MB'
        }
      ],
      connectionInfo: {
        active: 5,
        idle: 10,
        max: 100
      }
    },
    storage: {
      conversations: 342,
      messages: 15420,
      evaluations: 8934,
      toolExecutions: 25678,
      users: 45
    },
    performance: {
      slowQueries: 12,
      avgQueryTime: 145,
      cacheHitRate: 0.85
    }
  }
}
```

---

### 3. Performance Metrics

Tool execution metrics over time.

```typescript
const result = await systemMonitorTool.execute({
  operation: 'performance_metrics',
  period: 'day',  // hour, day, week, month, all
  metricType: 'all',  // response_time, throughput, errors, all
  includeDetails: true
});

// Returns:
{
  success: true,
  data: {
    period: 'day',
    metrics: {
      avgResponseTime: 245,
      requestCount: 1250,
      errorRate: 0.02,
      successRate: 0.98,
      toolExecutions: {
        total: 856,
        successful: 840,
        failed: 16,
        avgDuration: 320,
        byTool: {
          'dataset_manager': { executions: 145, avgDuration: 280 }
        }
      }
    },
    trends: {
      responseTime: 'improving',
      throughput: 'stable',
      errorRate: 'improving'
    }
  }
}
```

---

### 4. Get Alerts

Active critical alerts and warnings.

```typescript
const result = await systemMonitorTool.execute({
  operation: 'get_alerts'
});

// Returns:
{
  success: true,
  data: {
    critical: [
      {
        type: 'error_rate',
        message: 'Error rate exceeded critical threshold',
        threshold: 0.1,
        current: 0.15,
        severity: 'critical',
        recommendations: ['Check recent deployments', 'Review error logs']
      }
    ],
    warnings: [],
    info: [],
    summary: {
      totalCritical: 1,
      totalWarnings: 0,
      systemStatus: 'degraded'
    }
  }
}
```

**Alert Thresholds:**

| Metric | Warning | Critical |
|--------|---------|----------|
| Error Rate | 5% | 10% |
| Response Time | 3s | 5s |
| DB Usage | 75% | 90% |
| Connections | 75% | 90% |

---

### 5. Get System Info

OS-level CPU, memory, and disk metrics.

```typescript
const result = await systemMonitorTool.execute({
  operation: 'get_system_info'
});

// Returns:
{
  success: true,
  data: {
    cpu: {
      manufacturer: 'Intel',
      brand: 'Core i7-9750H',
      cores: 12,
      physicalCores: 6,
      speed: 2.6,
      currentLoad: 45.3
    },
    memory: {
      total: 17179869184,  // 16 GB in bytes
      used: 8589934592,    // 8 GB
      free: 8589934592,
      usagePercent: 50.0
    },
    disk: {
      total: 512110190592,  // 512 GB
      used: 256055095296,   // 256 GB
      free: 256055095296,
      usagePercent: 50.0,
      filesystems: [
        {
          mount: '/',
          type: 'ext4',
          size: 512110190592,
          usePercent: 50.0
        }
      ]
    }
  }
}
```

---

### 6. Analyze Logs

Error pattern detection in application logs.

```typescript
const result = await systemMonitorTool.execute({
  operation: 'analyze_logs',
  periodHours: 1  // Default: 1 hour
});

// Returns:
{
  success: true,
  data: {
    totalLogEntries: 1520,
    errorCount: 8,
    warningCount: 23,
    criticalErrorCount: 2,
    errorPatterns: [
      {
        pattern: 'Database connection failed',
        count: 5,
        severity: 'critical'
      }
    ],
    topErrors: ['TypeError', 'Database timeout'],
    periodCovered: '1 hour',
    insights: ['Critical database connectivity issues detected']
  }
}
```

**Error Patterns Detected:**
1. Database connection failures
2. Out of memory (OOM)
3. Stack overflow
4. Authentication failures
5. Permission denied
6. Timeout errors
7. Null pointer/undefined errors
8. Syntax errors

---

### 7. User Activity Correlation

Correlate user activity with performance metrics.

```typescript
const result = await systemMonitorTool.execute({
  operation: 'user_activity_correlation',
  periodHours: 24  // Default: 24 hours
});

// Returns:
{
  success: true,
  data: {
    userActivity: {
      activeUsers: 28,
      totalSessions: 145,
      avgSessionDuration: 1852,  // seconds
      toolExecutionsPerUser: 18.5,
      peakActivityHour: 14,  // 2 PM
      activityTrend: 'increasing'
    },
    performanceImpact: {
      correlationStrength: 'moderate',
      avgResponseTimeChange: 15.3,  // % increase
      errorRateChange: -0.5,  // % decrease
      insights: [
        'Increased user activity correlated with higher response times',
        'Peak activity hour: 2 PM (14:00)'
      ]
    }
  }
}
```

**Correlation Strengths:**
- **Strong:** Activity change > 30% AND performance change > 20%
- **Moderate:** Activity change > 20% AND performance change > 10%
- **Weak:** Activity change > 10% AND performance change > 5%
- **None:** Below weak thresholds

---

## When to Use

### ✅ Use System Monitor When:

1. **Health Monitoring**
   - Check overall system health
   - Verify service availability
   - Monitor resource usage

2. **Performance Tracking**
   - Track tool execution metrics
   - Identify slow operations
   - Monitor throughput and error rates

3. **Capacity Planning**
   - Monitor database growth
   - Track resource consumption
   - Plan for scaling

4. **Troubleshooting**
   - Investigate performance issues
   - Analyze error patterns
   - Correlate activity with problems

5. **Alert Management**
   - Get critical alerts
   - Monitor threshold violations
   - Track system degradation

---

## When NOT to Use

### ❌ Do NOT Use System Monitor When:

1. **Real-Time Streaming Required**
   - **Limitation:** Polling-based, not event-driven
   - **Alternative:** Use WebSockets or Server-Sent Events
   - **Why:** Operations take 200-500ms

2. **Fine-Grained Application Profiling**
   - **Limitation:** High-level metrics only
   - **Alternative:** Use APM tools (New Relic, Datadog)
   - **Why:** Designed for system-level monitoring

3. **Historical Data Analysis**
   - **Limitation:** Limited to recent data (30 days max)
   - **Alternative:** Use data warehouse with long-term storage
   - **Why:** Focuses on current state and recent trends

4. **Cross-Service Monitoring**
   - **Limitation:** Single application focus
   - **Alternative:** Use distributed tracing (Jaeger, Zipkin)
   - **Why:** Doesn't track requests across services

5. **Custom Alert Actions**
   - **Limitation:** Returns alerts, doesn't send notifications
   - **Alternative:** Build alert handler with webhooks
   - **Why:** Monitoring tool, not notification system

---

## Configuration

Default thresholds in `config.ts`:

```typescript
export const systemMonitorConfig = {
  enabled: true,
  defaultPeriod: 'day',

  health: {
    healthyScore: 90,
    degradedScore: 70,
    maxLatency: 1000  // ms
  },

  performance: {
    maxResponseTime: 3000,  // ms
    minThroughput: 10,  // req/min
    maxErrorRate: 0.05  // 5%
  },

  resources: {
    maxDbSize: 10 * 1024 * 1024 * 1024,  // 10GB
    warnDbSize: 8 * 1024 * 1024 * 1024,  // 8GB
    maxConnections: 100,
    warnConnections: 80
  }
};
```

---

## Setup Required

### Database Migration

**⚠️ IMPORTANT:** Apply before first use:

```sql
-- Run in Supabase SQL Editor
-- File: /lib/tools/system-monitor/migrations/01_create_db_stats_function.sql

CREATE OR REPLACE FUNCTION get_db_stats()
RETURNS TABLE (
  table_name text,
  row_count bigint,
  total_size text,
  table_size text,
  index_size text
) ...
```

**Verify Migration:**
```sql
SELECT * FROM get_db_stats();
```

---

## Troubleshooting

### Issue: "Database stats show 'Error'"

**Cause:** Migration not applied

**Solution:** Run migration SQL from `/migrations/01_create_db_stats_function.sql`

---

### Issue: "System info unavailable"

**Cause:** `systeminformation` package not installed

**Solution:**
```bash
npm install systeminformation@^5.0.0
```

---

### Issue: "Slow health_check operation"

**Cause:** Database query timeout

**Solution:** Check database connectivity and optimize queries

---

## Testing

```bash
# Run tests
cd lib/tools/system-monitor/__tests__
npm test
```

---

## Architecture

```
SystemMonitorService (orchestrator)
├── SystemInformationService (OS metrics)
├── DynamicThresholdService (statistical analysis)
├── LogAnalysisService (error detection)
└── UserActivityService (activity correlation)
```

**Features:**
- **Dynamic Thresholds:** Statistical analysis of 30-day history
- **Caching:** 1-hour TTL on thresholds
- **Graceful Degradation:** Continues working if subsystems fail
- **Comprehensive Logging:** Debug output for troubleshooting

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Oct 13, 2025 | Initial implementation |
| 1.1.0 | Oct 20, 2025 | Fixed stubs, added DB stats |
| 1.2.0 | Oct 21, 2025 | Added OS-level monitoring |
| 1.3.0 | Oct 21, 2025 | Added log analysis |
| 1.4.0 | Oct 21, 2025 | Added user activity correlation |

---

## Support

- **Full Documentation:** `/lib/tools/system-monitor/README.md`
- **Evaluation Report:** `/lib/tools/system-monitor/EVALUATION_REPORT.md`
- **Enhancement Summary:** `/lib/tools/system-monitor/ENHANCEMENT_SUMMARY.md`

---

**Last Updated:** October 22, 2025
**Maintained By:** FineTune Lab Development Team
