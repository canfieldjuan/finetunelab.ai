package agent

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"

	"gopkg.in/yaml.v3"
)

// Config represents the worker agent configuration
type Config struct {
	// API Configuration
	APIKey  string `yaml:"api_key"`
	BaseURL string `yaml:"base_url"`

	// Worker Information
	WorkerID string `yaml:"worker_id,omitempty"` // Set after registration
	Hostname string `yaml:"hostname"`
	Version  string `yaml:"version"`

	// Behavior
	HeartbeatIntervalSeconds int      `yaml:"heartbeat_interval_seconds"`
	MaxConcurrency           int      `yaml:"max_concurrency"`
	Capabilities             []string `yaml:"capabilities"`

	// Logging
	LogLevel string `yaml:"log_level"` // debug, info, warn, error
	LogFile  string `yaml:"log_file"`

	// Trading (application-specific)
	TradingEnabled bool   `yaml:"trading_enabled"`
	TradingConfig  string `yaml:"trading_config,omitempty"`
}

// DefaultConfig returns a config with sensible defaults
func DefaultConfig() *Config {
	hostname, _ := os.Hostname()
	if hostname == "" {
		hostname = "unknown"
	}

	return &Config{
		BaseURL:                  "https://app.finetunelab.ai",
		Hostname:                 hostname,
		Version:                  "0.1.0",
		HeartbeatIntervalSeconds: 30,
		MaxConcurrency:           1,
		Capabilities:             []string{"metrics", "trading"},
		LogLevel:                 "info",
		LogFile:                  "",
		TradingEnabled:           false,
	}
}

// LoadConfig loads configuration from a YAML file
func LoadConfig(path string) (*Config, error) {
	// Start with defaults
	cfg := DefaultConfig()

	// Read file
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	// Parse YAML
	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	// Validate
	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("invalid config: %w", err)
	}

	return cfg, nil
}

// SaveConfig saves configuration to a YAML file
func (c *Config) SaveConfig(path string) error {
	// Marshal to YAML
	data, err := yaml.Marshal(c)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	// Ensure directory exists
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	// Write file
	if err := os.WriteFile(path, data, 0600); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}

// Validate checks if the configuration is valid
func (c *Config) Validate() error {
	if c.APIKey == "" {
		return fmt.Errorf("api_key is required")
	}

	if c.BaseURL == "" {
		return fmt.Errorf("base_url is required")
	}

	if c.HeartbeatIntervalSeconds < 5 {
		return fmt.Errorf("heartbeat_interval_seconds must be at least 5")
	}

	if c.MaxConcurrency < 1 {
		return fmt.Errorf("max_concurrency must be at least 1")
	}

	return nil
}

// GetConfigPath returns the default config file path for the current platform
func GetConfigPath() string {
	switch runtime.GOOS {
	case "windows":
		appData := os.Getenv("APPDATA")
		if appData == "" {
			appData = filepath.Join(os.Getenv("USERPROFILE"), "AppData", "Roaming")
		}
		return filepath.Join(appData, "FineTuneLab", "worker-agent", "config.yaml")
	case "darwin":
		home := os.Getenv("HOME")
		return filepath.Join(home, "Library", "Application Support", "FineTuneLab", "worker-agent", "config.yaml")
	default: // linux
		configHome := os.Getenv("XDG_CONFIG_HOME")
		if configHome == "" {
			home := os.Getenv("HOME")
			configHome = filepath.Join(home, ".config")
		}
		return filepath.Join(configHome, "finetunelab", "worker-agent", "config.yaml")
	}
}

// GetLogPath returns the default log file path for the current platform
func GetLogPath() string {
	switch runtime.GOOS {
	case "windows":
		appData := os.Getenv("LOCALAPPDATA")
		if appData == "" {
			appData = filepath.Join(os.Getenv("USERPROFILE"), "AppData", "Local")
		}
		return filepath.Join(appData, "FineTuneLab", "worker-agent", "logs", "agent.log")
	case "darwin":
		home := os.Getenv("HOME")
		return filepath.Join(home, "Library", "Logs", "FineTuneLab", "worker-agent", "agent.log")
	default: // linux
		home := os.Getenv("HOME")
		return filepath.Join(home, ".local", "share", "finetunelab", "worker-agent", "logs", "agent.log")
	}
}
