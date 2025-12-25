package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/finetunelab/worker-agent/pkg/api"
)

// HTTPClient handles HTTP communication with the SaaS API
type HTTPClient struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

// NewHTTPClient creates a new HTTP client
func NewHTTPClient(baseURL, apiKey string) *HTTPClient {
	return &HTTPClient{
		baseURL: baseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Register registers the worker with the SaaS
func (c *HTTPClient) Register(req *api.RegisterRequest) (*api.RegisterResponse, error) {
	url := fmt.Sprintf("%s/api/workers/register", c.baseURL)

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("registration failed: %s (status %d)", string(body), resp.StatusCode)
	}

	var registerResp api.RegisterResponse
	if err := json.NewDecoder(resp.Body).Decode(&registerResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &registerResp, nil
}

// Heartbeat sends a heartbeat to the SaaS
func (c *HTTPClient) Heartbeat(workerID string, req *api.HeartbeatRequest) (*api.HeartbeatResponse, error) {
	url := fmt.Sprintf("%s/api/workers/%s/heartbeat", c.baseURL, workerID)

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-API-Key", c.apiKey)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("heartbeat failed: %s (status %d)", string(body), resp.StatusCode)
	}

	var heartbeatResp api.HeartbeatResponse
	if err := json.NewDecoder(resp.Body).Decode(&heartbeatResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &heartbeatResp, nil
}

// SendMetrics sends metrics to the SaaS (future implementation)
func (c *HTTPClient) SendMetrics(batch *api.MetricsBatch) error {
	// TODO: Implement metrics ingestion endpoint call
	return nil
}

// SendCommandResult sends command execution result
func (c *HTTPClient) SendCommandResult(commandID string, result *api.CommandResult) error {
	url := fmt.Sprintf("%s/api/workers/commands/%s/result", c.baseURL, commandID)

	body, err := json.Marshal(result)
	if err != nil {
		return fmt.Errorf("failed to marshal result: %w", err)
	}

	httpReq, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-API-Key", c.apiKey)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("send result failed: %s (status %d)", string(body), resp.StatusCode)
	}

	return nil
}
