package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/finetunelab/worker-agent/internal/agent"
)

const version = "0.1.0"

func main() {
	// Parse flags
	var (
		configPath  = flag.String("config", "", "Path to config file (default: platform-specific)")
		showVersion = flag.Bool("version", false, "Show version and exit")
		initConfig  = flag.Bool("init", false, "Initialize config file with defaults")
	)
	flag.Parse()

	// Show version
	if *showVersion {
		fmt.Printf("FineTuneLab Worker Agent v%s\n", version)
		os.Exit(0)
	}

	// Get config path
	if *configPath == "" {
		*configPath = agent.GetConfigPath()
	}

	// Initialize config
	if *initConfig {
		if err := initializeConfig(*configPath); err != nil {
			log.Fatalf("Failed to initialize config: %v", err)
		}
		fmt.Printf("Config file initialized at: %s\n", *configPath)
		fmt.Println("Please edit the config file and set your API key.")
		os.Exit(0)
	}

	// Load config
	cfg, err := agent.LoadConfig(*configPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v\n\nRun with -init to create a default config file.", err)
	}

	// Setup logging
	if cfg.LogFile != "" {
		logFile, err := os.OpenFile(cfg.LogFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
		if err != nil {
			log.Fatalf("Failed to open log file: %v", err)
		}
		defer logFile.Close()
		log.SetOutput(logFile)
	}

	log.Printf("FineTuneLab Worker Agent v%s", version)
	log.Printf("Config file: %s", *configPath)

	// Create agent
	ag, err := agent.New(cfg)
	if err != nil {
		log.Fatalf("Failed to create agent: %v", err)
	}

	// Start agent
	if err := ag.Start(); err != nil {
		log.Fatalf("Failed to start agent: %v", err)
	}

	// Setup signal handling
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	// Wait for shutdown signal
	sig := <-sigChan
	log.Printf("Received signal: %v", sig)

	// Stop agent
	if err := ag.Stop(); err != nil {
		log.Fatalf("Failed to stop agent: %v", err)
	}

	log.Println("Agent shutdown complete")
}

func initializeConfig(path string) error {
	// Check if file already exists
	if _, err := os.Stat(path); err == nil {
		return fmt.Errorf("config file already exists: %s", path)
	}

	// Create default config
	cfg := agent.DefaultConfig()
	cfg.LogFile = agent.GetLogPath()

	// Save to file
	if err := cfg.SaveConfig(path); err != nil {
		return err
	}

	return nil
}
