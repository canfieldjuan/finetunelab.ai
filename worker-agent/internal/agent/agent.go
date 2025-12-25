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
	"github.com/finetunelab/worker-agent/pkg/api"
)

// Agent is the main worker agent
type Agent struct {
	config     *Config
	httpClient *client.HTTPClient
	workerID   string
	ctx        context.Context
	cancel     context.CancelFunc
	wg         sync.WaitGroup
}

// New creates a new worker agent
func New(config *Config) (*Agent, error) {
	// Validate config
	if err := config.Validate(); err != nil {
		return nil, fmt.Errorf("invalid config: %w", err)
	}

	// Create HTTP client
	httpClient := client.NewHTTPClient(config.BaseURL, config.APIKey)

	ctx, cancel := context.WithCancel(context.Background())

	return &Agent{
		config:     config,
		httpClient: httpClient,
		workerID:   config.WorkerID,
		ctx:        ctx,
		cancel:     cancel,
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
	req := &api.HeartbeatRequest{
		Status: "online",
		Metrics: &api.MetricsSnapshot{
			// TODO: Collect real metrics
			CPUPercent:    0.0,
			MemoryUsedMB:  0,
			MemoryTotalMB: 0,
		},
	}

	resp, err := a.httpClient.Heartbeat(a.workerID, req)
	if err != nil {
		return fmt.Errorf("heartbeat request failed: %w", err)
	}

	// Process pending commands
	if len(resp.PendingCommands) > 0 {
		log.Printf("[Agent] Received %d pending command(s)", len(resp.PendingCommands))
		for _, cmd := range resp.PendingCommands {
			log.Printf("[Agent] Pending command: %s (ID: %s)", cmd.CommandType, cmd.ID)
			// TODO: Execute commands
		}
	}

	return nil
}

// Wait blocks until the agent is stopped
func (a *Agent) Wait() {
	a.wg.Wait()
}
