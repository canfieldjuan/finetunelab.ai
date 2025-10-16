# System Monitor Tool - Implementation Plan

**Date:** October 13, 2025  
**Tool #:** 7 of 7 (FINAL TOOL)  
**Status:** Planning  

---

## Overview

The **System Monitor Tool** provides comprehensive monitoring of system health, resource usage, and performance metrics across the LLM Evaluation Platform.

---

## Core Features

### 1. Health Checks
- Database connectivity and status
- API endpoint availability
- Service dependencies (Supabase, external APIs)
- Overall system health score

### 2. Resource Monitoring
- Database statistics (table sizes, row counts, query performance)
- Storage usage (conversations, messages, evaluations)
- Active connections and sessions
- Rate limiting and quotas

### 3. Performance Metrics
- Average response times
- Request throughput
- Tool execution times
- Error rates and types
- Cache hit/miss rates

### 4. Alert System
- Configurable thresholds
- Warning and critical alerts
- Performance degradation detection
- Anomaly detection

---

## Operations

### Operation 1: `health_check`
**Purpose:** Check overall system health and service availability

**Returns:**
```typescript
{
  status: 'healthy' | 'degraded' | 'unhealthy',
  score: number, // 0-100
  services: {
    database: { status: 'up' | 'down', latency: number },
    api: { status: 'up' | 'down', latency: number },
    tools: { available: number, total: number }
  },
  timestamp: string
}
```

### Operation 2: `resource_usage`
**Purpose:** Monitor resource consumption and storage

**Returns:**
```typescript
{
  database: {
    totalSize: string,
    tableStats: [{
      name: string,
      rowCount: number,
      size: string,
      indexSize: string
    }]
  },
  storage: {
    conversations: number,
    messages: number,
    evaluations: number,
    tools: number
  },
  performance: {
    activeConnections: number,
    slowQueries: number
  }
}
```

### Operation 3: `performance_metrics`
**Purpose:** Analyze performance over time period

**Parameters:**
- `period`: 'hour' | 'day' | 'week' | 'month'
- `metric_type`: 'response_time' | 'throughput' | 'errors' | 'all'

**Returns:**
```typescript
{
  period: string,
  metrics: {
    avgResponseTime: number,
    requestCount: number,
    errorRate: number,
    toolExecutions: {
      total: number,
      successful: number,
      failed: number,
      avgDuration: number
    }
  },
  trends: {
    responseTime: 'improving' | 'degrading' | 'stable',
    throughput: 'increasing' | 'decreasing' | 'stable'
  }
}
```

### Operation 4: `get_alerts`
**Purpose:** Retrieve active alerts and warnings

**Returns:**
```typescript
{
  critical: [{
    type: string,
    message: string,
    threshold: number,
    current: number,
    timestamp: string
  }],
  warnings: [{
    type: string,
    message: string,
    threshold: number,
    current: number,
    timestamp: string
  }],
  info: [{
    type: string,
    message: string
  }]
}
```

---

## Database Schema (If Needed)

### Table: `system_metrics` (optional - for historical tracking)
```sql
CREATE TABLE IF NOT EXISTS system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL,
  metric_value JSONB NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_metrics_type ON system_metrics(metric_type);
CREATE INDEX idx_system_metrics_time ON system_metrics(recorded_at);
```

---

## Implementation Files

### 1. `/lib/tools/system-monitor/types.ts`
- SystemHealth interface
- ResourceUsage interface
- PerformanceMetrics interface
- Alert interfaces
- MetricsOptions interface

### 2. `/lib/tools/system-monitor/config.ts`
- Health check thresholds
- Alert thresholds
- Performance baselines
- Monitoring intervals

### 3. `/lib/tools/system-monitor/monitor.service.ts`
- checkHealth() - System health checks
- getResourceUsage() - Resource consumption
- getPerformanceMetrics() - Performance analysis
- getAlerts() - Active alerts
- Helper functions for metrics calculation

### 4. `/lib/tools/system-monitor/index.ts`
- Tool definition
- 4 operations
- Parameter validation
- Integration with monitor service

---

## Configuration Thresholds

```typescript
{
  health: {
    healthyScore: 90,
    degradedScore: 70,
    maxLatency: 1000 // ms
  },
  performance: {
    maxResponseTime: 3000, // ms
    minThroughput: 10, // req/min
    maxErrorRate: 0.05 // 5%
  },
  resources: {
    maxDbSize: 10 * 1024 * 1024 * 1024, // 10GB
    maxConnections: 100,
    warnTableSize: 100000 // rows
  },
  alerts: {
    criticalErrorRate: 0.1, // 10%
    criticalResponseTime: 5000, // 5s
    criticalDbSize: 0.9 // 90% of max
  }
}
```

---

## Security Considerations

- ✅ No sensitive data exposure
- ✅ Read-only operations (no system modifications)
- ✅ User-scoped metrics where applicable
- ✅ Rate limiting to prevent abuse
- ✅ No API keys required

---

## Integration Points

1. **Database:** Direct Supabase queries for stats
2. **Tool Registry:** Check tool availability
3. **Tool Executions:** Analyze execution history
4. **Messages:** Track response times
5. **Evaluations:** Quality correlation with performance

---

## Testing Checklist

- [ ] Health check returns accurate status
- [ ] Resource usage calculates correctly
- [ ] Performance metrics show trends
- [ ] Alerts trigger at thresholds
- [ ] All operations handle errors gracefully
- [ ] No performance impact on system
- [ ] User permissions enforced

---

## Success Criteria

1. ✅ All 4 operations implemented
2. ✅ Accurate system health reporting
3. ✅ Performance metrics calculation
4. ✅ Alert system functional
5. ✅ Integrated with tool registry
6. ✅ Documentation complete

---

## Next Steps

1. Create types.ts
2. Create config.ts
3. Create monitor.service.ts
4. Create index.ts
5. Register in registry.ts
6. Test all operations
7. Create completion document

---

**Let's build the final tool!** 🏁
