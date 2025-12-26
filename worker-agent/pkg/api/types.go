// Package api provides shared types for worker-agent API communication
package api

// CommandType represents the type of command that can be executed
type CommandType string

const (
	// CommandStartTrading starts the trading engine
	CommandStartTrading CommandType = "start_trading"
	// CommandStopTrading stops the trading engine
	CommandStopTrading CommandType = "stop_trading"
	// CommandUpdateConfig updates worker configuration
	CommandUpdateConfig CommandType = "update_config"
	// CommandRestartAgent restarts the worker agent
	CommandRestartAgent CommandType = "restart_agent"
	// CommandCollectDiag collects diagnostic information
	CommandCollectDiag CommandType = "collect_diagnostics"
)

// Command represents a command sent from the SaaS to the worker
type Command struct {
	ID             string                 `json:"id"`
	CommandType    CommandType            `json:"command_type"`
	Params         map[string]interface{} `json:"params"`
	Signature      string                 `json:"signature"`
	TimeoutSeconds int                    `json:"timeout_seconds"`
	CreatedAt      string                 `json:"created_at"`
}

// CommandResult represents the result of command execution
type CommandResult struct {
	CommandID string                 `json:"command_id"`
	Status    string                 `json:"status"` // success, error, timeout
	Output    string                 `json:"output,omitempty"`
	Error     string                 `json:"error,omitempty"`
	Data      map[string]interface{} `json:"data,omitempty"`
	Timestamp int64                  `json:"timestamp"`
}

// RegisterRequest is sent to register a worker with the SaaS
type RegisterRequest struct {
	APIKey       string            `json:"api_key"`
	Hostname     string            `json:"hostname"`
	Platform     string            `json:"platform"` // windows, darwin, linux
	Version      string            `json:"version"`
	Capabilities []string          `json:"capabilities,omitempty"`
	Metadata     map[string]string `json:"metadata,omitempty"`
}

// RegisterResponse is returned after successful registration
type RegisterResponse struct {
	WorkerID                 string `json:"worker_id"`
	WebSocketURL             string `json:"websocket_url"`
	HeartbeatIntervalSeconds int    `json:"heartbeat_interval_seconds"`
	MaxConcurrency           int    `json:"max_concurrency"`
}

// HeartbeatRequest is sent periodically to update worker status
type HeartbeatRequest struct {
	Status      string                 `json:"status,omitempty"` // online, error
	CurrentLoad int                    `json:"current_load,omitempty"`
	Metrics     *MetricsSnapshot       `json:"metrics,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// HeartbeatResponse contains pending commands for the worker
type HeartbeatResponse struct {
	OK              bool      `json:"ok"`
	PendingCommands []Command `json:"pending_commands"`
}

// MetricsSnapshot represents system and application metrics at a point in time
type MetricsSnapshot struct {
	CPUPercent     float64 `json:"cpu_percent,omitempty"`
	MemoryUsedMB   uint64  `json:"memory_used_mb,omitempty"`
	MemoryTotalMB  uint64  `json:"memory_total_mb,omitempty"`
	TradingStatus  string  `json:"trading_status,omitempty"`
	ActiveTrades   int     `json:"active_trades,omitempty"`
}

// MetricsBatch represents a batch of metrics to send
type MetricsBatch struct {
	WorkerID string            `json:"worker_id"`
	Metrics  []MetricsSnapshot `json:"metrics"`
}

// WSMessage represents a WebSocket message
type WSMessage struct {
	Type string      `json:"type"` // command, heartbeat, heartbeat_ack, command_result
	Data interface{} `json:"data,omitempty"`
}
