package agent

import (
	"context"
	"fmt"
	"log"
	"os"
	"runtime"
	"sync"
	"time"

	"github.com/finetunelab/worker-agent/internal/client"
	"github.com/finetunelab/worker-agent/internal/collector"
	"github.com/finetunelab/worker-agent/internal/executor"
	"github.com/finetunelab/worker-agent/pkg/api"
)

// Agent is the main worker agent
type Agent struct {
	config            *Config
	httpClient        *client.HTTPClient
	workerID          string
	executor          *executor.Executor
	metricsCollector  *collector.MetricsCollector
	ctx               context.Context
	cancel            context.CancelFunc
	wg                sync.WaitGroup
}

// New creates a new worker agent
func New(config *Config) (*Agent, error) {
	// Validate config
	if err := config.Validate(); err != nil {
		return nil, fmt.Errorf("invalid config: %w", err)
	}

	// Create HTTP client
	httpClient := client.NewHTTPClient(config.BaseURL, config.APIKey)

	// Create executor
	exec := executor.New()

	// Create metrics collector
	metricsCollector := collector.NewMetricsCollector()

	ctx, cancel := context.WithCancel(context.Background())

	return &Agent{
		config:           config,
		httpClient:       httpClient,
		workerID:         config.WorkerID,
		executor:         exec,
		metricsCollector: metricsCollector,
		ctx:              ctx,
		cancel:           cancel,
	}, nil
}

// Start starts the worker agent
func (a *Agent) Start() error {
	log.Println("[Agent] Starting worker agent...")

	// Register with SaaS if not already registered
	if a.workerID == "" {
		if err := a.register(); err != nil {
			return fmt.Errorf("registration failed: %w", err)
		}
	}

	log.Printf("[Agent] Worker ID: %s", a.workerID)

	// Start heartbeat loop
	a.wg.Add(1)
	go a.heartbeatLoop()

	log.Println("[Agent] Worker agent started successfully")

	return nil
}

// Stop stops the worker agent gracefully
func (a *Agent) Stop() error {
	log.Println("[Agent] Stopping worker agent...")

	// Cancel context
	a.cancel()

	// Wait for goroutines to finish
	done := make(chan struct{})
	go func() {
		a.wg.Wait()
		close(done)
	}()

	// Wait with timeout
	select {
	case <-done:
		log.Println("[Agent] Worker agent stopped successfully")
		return nil
	case <-time.After(10 * time.Second):
		log.Println("[Agent] Worker agent stop timeout - forcing shutdown")
		return fmt.Errorf("shutdown timeout")
	}
}

// register registers the worker with the SaaS
func (a *Agent) register() error {
	log.Println("[Agent] Registering worker with SaaS...")

	hostname, _ := os.Hostname()
	if hostname == "" {
		hostname = a.config.Hostname
	}

	req := &api.RegisterRequest{
		APIKey:       a.config.APIKey,
		Hostname:     hostname,
		Platform:     runtime.GOOS,
		Version:      a.config.Version,
		Capabilities: a.config.Capabilities,
		Metadata: map[string]string{
			"go_version": runtime.Version(),
			"arch":       runtime.GOARCH,
		},
	}

	resp, err := a.httpClient.Register(req)
	if err != nil {
		return fmt.Errorf("registration request failed: %w", err)
	}

	// Save worker ID and other info
	a.workerID = resp.WorkerID
	a.config.WorkerID = resp.WorkerID
	a.config.HeartbeatIntervalSeconds = resp.HeartbeatIntervalSeconds
	a.config.MaxConcurrency = resp.MaxConcurrency

	// Save updated config
	configPath := GetConfigPath()
	if err := a.config.SaveConfig(configPath); err != nil {
		log.Printf("[Agent] Warning: Failed to save config: %v", err)
	}

	log.Printf("[Agent] Registered successfully. Worker ID: %s", a.workerID)

	return nil
}

// heartbeatLoop sends periodic heartbeats
func (a *Agent) heartbeatLoop() {
	defer a.wg.Done()

	interval := time.Duration(a.config.HeartbeatIntervalSeconds) * time.Second
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	log.Printf("[Agent] Starting heartbeat loop (interval: %v)", interval)

	for {
		select {
		case <-a.ctx.Done():
			log.Println("[Agent] Heartbeat loop stopped")
			return
		case <-ticker.C:
			if err := a.sendHeartbeat(); err != nil {
				log.Printf("[Agent] Heartbeat error: %v", err)
			}
		}
	}
}

// sendHeartbeat sends a heartbeat to the SaaS
func (a *Agent) sendHeartbeat() error {
	// Collect metrics
	metrics, err := a.metricsCollector.Collect()
	if err != nil {
		log.Printf("[Agent] Warning: Failed to collect metrics: %v", err)
		metrics = &api.MetricsSnapshot{}
	}

	req := &api.HeartbeatRequest{
		Status:  "online",
		Metrics: metrics,
	}

	resp, err := a.httpClient.Heartbeat(a.workerID, req)
	if err != nil {
		return fmt.Errorf("heartbeat request failed: %w", err)
	}

	// Process pending commands
	if len(resp.PendingCommands) > 0 {
		log.Printf("[Agent] Received %d pending command(s)", len(resp.PendingCommands))
		for _, cmd := range resp.PendingCommands {
			log.Printf("[Agent] Executing command: %s (ID: %s)", cmd.CommandType, cmd.ID)
			// Execute command asynchronously
			go a.executeCommand(cmd)
		}
	}

	return nil
}

// executeCommand executes a command and reports the result
func (a *Agent) executeCommand(cmd api.Command) {
	// Execute command with timeout
	result := a.executor.Execute(a.ctx, cmd)

	// Send result back to SaaS
	if err := a.httpClient.SendCommandResult(cmd.ID, &result); err != nil {
		log.Printf("[Agent] Failed to send command result: %v", err)
		// Retry once after 5 seconds
		time.Sleep(5 * time.Second)
		if err := a.httpClient.SendCommandResult(cmd.ID, &result); err != nil {
			log.Printf("[Agent] Failed to send command result (retry): %v", err)
		}
	}
}

// Wait blocks until the agent is stopped
func (a *Agent) Wait() {
	a.wg.Wait()
}
