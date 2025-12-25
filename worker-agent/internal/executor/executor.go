package executor

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/finetunelab/worker-agent/pkg/api"
)

// Executor handles command execution
type Executor struct {
	tradingService *TradingService
}

// New creates a new executor
func New() *Executor {
	return &Executor{
		tradingService: NewTradingService(),
	}
}

// Execute executes a command and returns the result
func (e *Executor) Execute(ctx context.Context, cmd api.Command) api.CommandResult {
	log.Printf("[Executor] Executing command: %s (ID: %s)", cmd.CommandType, cmd.ID)

	// Set timeout from command
	timeout := time.Duration(cmd.TimeoutSeconds) * time.Second
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	// Track start time
	startTime := time.Now()

	// Execute based on command type
	var result api.CommandResult
	switch cmd.CommandType {
	case api.CommandStartTrading:
		result = e.executeStartTrading(ctx, cmd)
	case api.CommandStopTrading:
		result = e.executeStopTrading(ctx, cmd)
	case api.CommandUpdateConfig:
		result = e.executeUpdateConfig(ctx, cmd)
	case api.CommandRestartAgent:
		result = e.executeRestartAgent(ctx, cmd)
	case api.CommandCollectDiag:
		result = e.executeCollectDiagnostics(ctx, cmd)
	default:
		result = api.CommandResult{
			CommandID: cmd.ID,
			Status:    "error",
			Error:     fmt.Sprintf("Unknown command type: %s", cmd.CommandType),
			Timestamp: time.Now().Unix(),
		}
	}

	// Add execution time
	executionTime := time.Since(startTime)
	if result.Data == nil {
		result.Data = make(map[string]interface{})
	}
	result.Data["execution_time_ms"] = executionTime.Milliseconds()

	log.Printf("[Executor] Command %s completed: %s (duration: %v)", cmd.ID, result.Status, executionTime)

	return result
}

// executeStartTrading starts the trading service
func (e *Executor) executeStartTrading(ctx context.Context, cmd api.Command) api.CommandResult {
	log.Println("[Executor] Starting trading...")

	// Extract params
	configPath, _ := cmd.Params["config"].(string)

	// Start trading
	if err := e.tradingService.Start(ctx, configPath); err != nil {
		return api.CommandResult{
			CommandID: cmd.ID,
			Status:    "failed",
			Error:     fmt.Sprintf("Failed to start trading: %v", err),
			Timestamp: time.Now().Unix(),
		}
	}

	return api.CommandResult{
		CommandID: cmd.ID,
		Status:    "completed",
		Output:    "Trading started successfully",
		Data: map[string]interface{}{
			"trading_status": "active",
			"config":         configPath,
		},
		Timestamp: time.Now().Unix(),
	}
}

// executeStopTrading stops the trading service
func (e *Executor) executeStopTrading(ctx context.Context, cmd api.Command) api.CommandResult {
	log.Println("[Executor] Stopping trading...")

	// Stop trading
	if err := e.tradingService.Stop(ctx); err != nil {
		return api.CommandResult{
			CommandID: cmd.ID,
			Status:    "failed",
			Error:     fmt.Sprintf("Failed to stop trading: %v", err),
			Timestamp: time.Now().Unix(),
		}
	}

	return api.CommandResult{
		CommandID: cmd.ID,
		Status:    "completed",
		Output:    "Trading stopped successfully",
		Data: map[string]interface{}{
			"trading_status": "stopped",
		},
		Timestamp: time.Now().Unix(),
	}
}

// executeUpdateConfig updates the agent configuration
func (e *Executor) executeUpdateConfig(ctx context.Context, cmd api.Command) api.CommandResult {
	log.Println("[Executor] Updating config...")

	// TODO: Implement config update logic
	// For now, just acknowledge
	return api.CommandResult{
		CommandID: cmd.ID,
		Status:    "completed",
		Output:    "Config update acknowledged (not yet implemented)",
		Data: map[string]interface{}{
			"params": cmd.Params,
		},
		Timestamp: time.Now().Unix(),
	}
}

// executeRestartAgent restarts the agent
func (e *Executor) executeRestartAgent(ctx context.Context, cmd api.Command) api.CommandResult {
	log.Println("[Executor] Restart agent requested...")

	// TODO: Implement graceful restart
	// For now, just acknowledge
	return api.CommandResult{
		CommandID: cmd.ID,
		Status:    "completed",
		Output:    "Agent restart acknowledged (requires manual restart for now)",
		Timestamp: time.Now().Unix(),
	}
}

// executeCollectDiagnostics collects diagnostic information
func (e *Executor) executeCollectDiagnostics(ctx context.Context, cmd api.Command) api.CommandResult {
	log.Println("[Executor] Collecting diagnostics...")

	// Collect diagnostics
	diagnostics := map[string]interface{}{
		"trading_status":  e.tradingService.GetStatus(),
		"trading_uptime":  e.tradingService.GetUptime(),
		"command_history": "not_implemented",
		"system_info":     "not_implemented",
	}

	return api.CommandResult{
		CommandID: cmd.ID,
		Status:    "completed",
		Output:    "Diagnostics collected",
		Data:      diagnostics,
		Timestamp: time.Now().Unix(),
	}
}
