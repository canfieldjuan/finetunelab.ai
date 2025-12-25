.PHONY: build build-all build-windows build-macos build-linux test lint clean

# Binary name
BINARY_NAME=worker-agent
VERSION=0.1.0

# Build directory
BUILD_DIR=build

# Go build flags
LDFLAGS=-ldflags "-X main.version=$(VERSION) -s -w"

# Default target
all: build

# Build for current platform
build:
	@echo "Building for current platform..."
	@mkdir -p $(BUILD_DIR)
	go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME) ./cmd/agent
	@echo "Build complete: $(BUILD_DIR)/$(BINARY_NAME)"

# Build for all platforms
build-all: build-windows build-macos build-linux

# Build for Windows
build-windows:
	@echo "Building for Windows (amd64)..."
	@mkdir -p $(BUILD_DIR)/windows
	GOOS=windows GOARCH=amd64 go build $(LDFLAGS) -o $(BUILD_DIR)/windows/$(BINARY_NAME).exe ./cmd/agent
	@echo "Build complete: $(BUILD_DIR)/windows/$(BINARY_NAME).exe"

# Build for macOS (Intel + Apple Silicon)
build-macos:
	@echo "Building for macOS (amd64)..."
	@mkdir -p $(BUILD_DIR)/macos-amd64
	GOOS=darwin GOARCH=amd64 go build $(LDFLAGS) -o $(BUILD_DIR)/macos-amd64/$(BINARY_NAME) ./cmd/agent
	@echo "Build complete: $(BUILD_DIR)/macos-amd64/$(BINARY_NAME)"

	@echo "Building for macOS (arm64)..."
	@mkdir -p $(BUILD_DIR)/macos-arm64
	GOOS=darwin GOARCH=arm64 go build $(LDFLAGS) -o $(BUILD_DIR)/macos-arm64/$(BINARY_NAME) ./cmd/agent
	@echo "Build complete: $(BUILD_DIR)/macos-arm64/$(BINARY_NAME)"

# Build for Linux
build-linux:
	@echo "Building for Linux (amd64)..."
	@mkdir -p $(BUILD_DIR)/linux
	GOOS=linux GOARCH=amd64 go build $(LDFLAGS) -o $(BUILD_DIR)/linux/$(BINARY_NAME) ./cmd/agent
	@echo "Build complete: $(BUILD_DIR)/linux/$(BINARY_NAME)"

# Run tests
test:
	@echo "Running tests..."
	go test -v -race -coverprofile=coverage.out ./...
	@echo "Coverage report:"
	go tool cover -func=coverage.out

# Run linter
lint:
	@echo "Running linter..."
	golangci-lint run ./...

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf $(BUILD_DIR)
	rm -f coverage.out
	@echo "Clean complete"

# Install dependencies
deps:
	@echo "Installing dependencies..."
	go mod download
	go mod verify

# Format code
fmt:
	@echo "Formatting code..."
	go fmt ./...

# Run agent locally (for development)
run:
	@echo "Running agent..."
	go run ./cmd/agent -config configs/config.example.yaml

# Initialize example config
init-config:
	@echo "Initializing example config..."
	@mkdir -p configs
	go run ./cmd/agent -init -config configs/config.example.yaml || true
	@echo "Example config created at: configs/config.example.yaml"
