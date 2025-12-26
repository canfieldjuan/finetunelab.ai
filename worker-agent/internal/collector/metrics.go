package collector

import (
	"log"
	"time"

	"github.com/finetunelab/worker-agent/pkg/api"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
)

// MetricsCollector collects system metrics
type MetricsCollector struct {
	lastNetStats *net.IOCountersStat
	lastNetTime  time.Time
}

// NewMetricsCollector creates a new metrics collector
func NewMetricsCollector() *MetricsCollector {
	return &MetricsCollector{}
}

// Collect collects current system metrics
func (mc *MetricsCollector) Collect() (*api.MetricsSnapshot, error) {
	metrics := &api.MetricsSnapshot{}

	// Collect CPU percentage
	cpuPercent, err := cpu.Percent(time.Second, false)
	if err != nil {
		log.Printf("[Metrics] Warning: Failed to get CPU: %v", err)
	} else if len(cpuPercent) > 0 {
		metrics.CPUPercent = cpuPercent[0]
	}

	// Collect memory
	vmem, err := mem.VirtualMemory()
	if err != nil {
		log.Printf("[Metrics] Warning: Failed to get memory: %v", err)
	} else {
		metrics.MemoryUsedMB = vmem.Used / 1024 / 1024
		metrics.MemoryTotalMB = vmem.Total / 1024 / 1024
	}

	// Collect disk usage (root partition)
	diskStats, err := disk.Usage("/")
	if err != nil {
		log.Printf("[Metrics] Warning: Failed to get disk: %v", err)
	} else {
		_ = diskStats // Store in metrics if needed
		// Note: api.MetricsSnapshot doesn't have disk fields yet
		// TODO: Add disk fields to MetricsSnapshot type
	}

	// Collect network stats
	netStats, err := net.IOCounters(false)
	if err != nil {
		log.Printf("[Metrics] Warning: Failed to get network: %v", err)
	} else if len(netStats) > 0 {
		currentStats := netStats[0]

		// Calculate delta if we have previous stats
		if mc.lastNetStats != nil {
			timeDelta := time.Since(mc.lastNetTime).Seconds()
			if timeDelta > 0 {
				sentDelta := currentStats.BytesSent - mc.lastNetStats.BytesSent
				recvDelta := currentStats.BytesRecv - mc.lastNetStats.BytesRecv

				// Convert to MB/s, then multiply by time to get total MB in period
				_ = float64(sentDelta) / 1024 / 1024 / timeDelta
				_ = float64(recvDelta) / 1024 / 1024 / timeDelta

				// Note: api.MetricsSnapshot doesn't have network fields yet
				// TODO: Add network fields to MetricsSnapshot type
			}
		}

		// Store current stats for next collection
		mc.lastNetStats = &currentStats
		mc.lastNetTime = time.Now()
	}

	return metrics, nil
}

// CollectWithTrading collects metrics including trading status
func (mc *MetricsCollector) CollectWithTrading(tradingStatus string, activeTrades int) (*api.MetricsSnapshot, error) {
	metrics, err := mc.Collect()
	if err != nil {
		return nil, err
	}

	metrics.TradingStatus = tradingStatus
	metrics.ActiveTrades = activeTrades

	return metrics, nil
}
