# FineTuneLab Worker Agent

Downloadable worker agent for Windows and macOS that connects to FineTuneLab SaaS platform.

## Features

- **Outbound-only connections** (HTTPS + WebSocket) - no inbound ports required
- **Secure authentication** using worker API keys
- **System metrics collection** (CPU, memory, disk, network)
- **Remote command execution** (start/stop trading, config updates)
- **Auto-reconnect** on network issues
- **Cross-platform** (Windows, macOS, Linux)

## Installation

### Prerequisites

- Go 1.21+ (for building from source)
- Worker API key from FineTuneLab dashboard

### Build from Source

```bash
# Clone repository
git clone https://github.com/finetunelab/finetunelab.ai.git
cd finetunelab.ai/worker-agent

# Build
make build

# Or build for specific platform
make build-windows
make build-macos
make build-linux
```

### Install Pre-built Binary

Download the latest release for your platform from the [releases page](https://github.com/finetunelab/finetunelab.ai/releases).

## Configuration

### Initialize Config

```bash
./worker-agent -init
```

This creates a config file at:
- **Windows**: `%APPDATA%\FineTuneLab\worker-agent\config.yaml`
- **macOS**: `~/Library/Application Support/FineTuneLab/worker-agent/config.yaml`
- **Linux**: `~/.config/finetunelab/worker-agent/config.yaml`

### Edit Config

Open the config file and set your API key:

```yaml
# API Configuration
api_key: "wak_your_api_key_here"  # Get from FineTuneLab dashboard
base_url: "https://app.finetunelab.ai"

# Worker Information
hostname: "my-trading-server"
version: "0.1.0"

# Behavior
heartbeat_interval_seconds: 30
max_concurrency: 1
capabilities:
  - metrics
  - trading

# Logging
log_level: "info"
log_file: ""  # Empty = stdout

# Trading
trading_enabled: false
```

## Usage

### Start Agent

```bash
./worker-agent
```

### Start with Custom Config

```bash
./worker-agent -config /path/to/config.yaml
```

### Show Version

```bash
./worker-agent -version
```

## Architecture

```
┌─────────────────┐           ┌─────────────────┐
│  Worker Agent   │  HTTPS    │  FineTuneLab    │
│  (Your PC)      │◄─────────►│     SaaS        │
│                 │ WebSocket │                 │
└─────────────────┘           └─────────────────┘
      Outbound only               Cloud
```

### Components

- **Agent**: Main orchestrator
- **HTTP Client**: Registration, heartbeat, metrics
- **WebSocket Client**: Real-time command channel (future)
- **Metrics Collector**: System and app metrics
- **Command Executor**: Execute commands from SaaS
- **Config Manager**: Configuration persistence

### Security

- **API Key Authentication**: Worker-scoped API keys
- **HMAC Signatures**: Commands signed by server, verified by agent
- **TLS 1.3**: All communication encrypted
- **No Inbound Ports**: Agent initiates all connections
- **Minimal Permissions**: Runs as non-admin user

## Development

### Project Structure

```
worker-agent/
├── cmd/
│   └── agent/           # Main entry point
├── internal/
│   ├── agent/           # Agent logic and config
│   ├── auth/            # Authentication
│   ├── client/          # HTTP and WebSocket clients
│   ├── collector/       # Metrics collection
│   ├── executor/        # Command execution
│   └── platform/        # Platform-specific code
├── pkg/
│   └── api/             # Shared API types
├── configs/             # Example configs
├── scripts/             # Build and deploy scripts
└── installer/           # Installer configs
    ├── windows/         # NSIS installer
    └── macos/           # .pkg installer
```

### Build Commands

```bash
# Build for current platform
make build

# Build for all platforms
make build-all

# Run tests
make test

# Run linter
make lint

# Clean build artifacts
make clean
```

## Troubleshooting

### Agent won't start

1. Check config file exists and has valid API key
2. Check network connectivity to `app.finetunelab.ai`
3. Check logs (see log_file in config)

### Can't connect to SaaS

1. Verify API key is active in dashboard
2. Check firewall allows outbound HTTPS
3. Try manual heartbeat: `curl -X POST https://app.finetunelab.ai/api/workers/{workerId}/heartbeat`

### Commands not executing

1. Check worker status in dashboard shows "online"
2. Verify command signature (server-side issue)
3. Check agent logs for execution errors

## Support

- Documentation: https://docs.finetunelab.ai/worker-agent
- Issues: https://github.com/finetunelab/finetunelab.ai/issues
- Email: support@finetunelab.ai

## License

Copyright © 2025 FineTuneLab. All rights reserved.
