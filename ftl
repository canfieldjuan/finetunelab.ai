#!/bin/bash
# ftl - Fine-Tune Labs CLI
# Manages all project servers: Neo4j, Graphiti, Training Server, Next.js
# Version: 1.0.0

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Paths (relative to script location)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GRAPHITI_MAIN_DIR="$SCRIPT_DIR/graphiti-main"
GRAPHITI_WRAPPER_DIR="$SCRIPT_DIR/graphiti-wrapper"
TRAINING_DIR="$SCRIPT_DIR/lib/training"
GRAPHITI_LOG="/tmp/graphiti-wrapper.log"
TRAINING_LOG="$TRAINING_DIR/training_server.log"

# Print functions
print_header() {
    echo -e "${BLUE}==================================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}==================================================${NC}"
}

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "${YELLOW}[i]${NC} $1"
}

print_service() {
    local service=$1
    local status=$2
    local details=$3

    if [ "$status" = "running" ]; then
        echo -e "  ${GREEN}●${NC} ${CYAN}$service${NC} - ${GREEN}running${NC} $details"
    else
        echo -e "  ${RED}○${NC} ${CYAN}$service${NC} - ${RED}stopped${NC}"
    fi
}

# Check if service is running
is_neo4j_running() {
    sudo docker ps --filter "name=neo4j" --format "{{.Names}}" 2>/dev/null | grep -q "neo4j"
}

is_graphiti_running() {
    pgrep -f "python.*main.py" > /dev/null 2>&1
}

is_training_running() {
    pgrep -f "training_server.py" > /dev/null 2>&1
}

is_nextjs_running() {
    pgrep -f "next dev" > /dev/null 2>&1
}

# Start services
start_neo4j() {
    echo -e "${BLUE}Starting Neo4j database...${NC}"

    if is_neo4j_running; then
        print_info "Neo4j is already running"
        return 0
    fi

    cd "$GRAPHITI_MAIN_DIR"

    if [ ! -f ".env" ]; then
        print_info "Creating .env file for Neo4j..."
        cat > .env << 'EOF'
OPENAI_API_KEY=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
NEO4J_PORT=7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password123
EOF
    fi

    sudo docker compose up -d neo4j
    print_status "Neo4j started"

    # Wait for health check
    echo -n "Waiting for Neo4j to become healthy"
    for i in {1..30}; do
        if sudo docker ps | grep neo4j | grep -q "healthy"; then
            echo ""
            print_status "Neo4j is healthy"
            return 0
        fi
        echo -n "."
        sleep 1
    done

    echo ""
    print_error "Neo4j did not become healthy in time"
    return 1
}

start_graphiti() {
    echo -e "${BLUE}Starting Graphiti wrapper...${NC}"

    if is_graphiti_running; then
        print_info "Graphiti is already running"
        return 0
    fi

    cd "$GRAPHITI_WRAPPER_DIR"

    # Check virtual environment
    if [ ! -d "venv" ]; then
        print_info "Creating virtual environment..."
        python3 -m venv venv
        source venv/bin/activate
        pip install --quiet fastapi uvicorn pydantic pydantic-settings graphiti-core
    fi

    # Clear old log
    > "$GRAPHITI_LOG"

    # Start in background
    source venv/bin/activate && python main.py > "$GRAPHITI_LOG" 2>&1 &
    sleep 3

    if curl -s http://localhost:8001/health | grep -q "healthy"; then
        print_status "Graphiti wrapper started (port 8001)"
    else
        print_error "Graphiti failed to start - check logs with: ftl logs graphiti"
        return 1
    fi
}

start_training() {
    echo -e "${BLUE}Starting training server...${NC}"

    if is_training_running; then
        print_info "Training server is already running"
        return 0
    fi

    cd "$SCRIPT_DIR"

    # Start in background, redirect to log file
    python3 lib/training/training_server.py > "$TRAINING_LOG" 2>&1 &
    sleep 3

    if is_training_running; then
        print_status "Training server started (port 8000)"
    else
        print_error "Training server failed to start - check logs with: ftl logs training"
        return 1
    fi
}

start_nextjs() {
    echo -e "${BLUE}Starting Next.js web UI...${NC}"

    if is_nextjs_running; then
        print_info "Next.js is already running"
        return 0
    fi

    cd "$SCRIPT_DIR"

    # Start in background
    npm run dev > /dev/null 2>&1 &
    sleep 4

    if is_nextjs_running; then
        print_status "Next.js started (port 3000)"
    else
        print_error "Next.js failed to start"
        return 1
    fi
}

# Stop services
stop_neo4j() {
    if is_neo4j_running; then
        cd "$GRAPHITI_MAIN_DIR"
        sudo docker compose down
        print_status "Neo4j stopped"
    else
        print_info "Neo4j is not running"
    fi
}

stop_graphiti() {
    if is_graphiti_running; then
        pkill -f "python.*main.py"
        print_status "Graphiti stopped"
    else
        print_info "Graphiti is not running"
    fi
}

stop_training() {
    if is_training_running; then
        pkill -f "training_server.py"
        print_status "Training server stopped"
    else
        print_info "Training server is not running"
    fi
}

stop_nextjs() {
    if is_nextjs_running; then
        pkill -f "next dev"
        print_status "Next.js stopped"
    else
        print_info "Next.js is not running"
    fi
}

# Command handlers
cmd_start() {
    print_header "Starting Fine-Tune Labs"
    echo ""

    start_neo4j
    echo ""
    start_graphiti
    echo ""
    start_training
    echo ""
    start_nextjs

    echo ""
    print_header "All Services Started!"
    echo ""
    echo -e "${CYAN}Service URLs:${NC}"
    echo -e "  Web UI:          ${GREEN}http://localhost:3000${NC}"
    echo -e "  Training API:    ${GREEN}http://localhost:8000${NC}"
    echo -e "  Graphiti API:    ${GREEN}http://localhost:8001${NC}"
    echo -e "  Neo4j Browser:   ${GREEN}http://localhost:7474${NC}"
    echo ""
    echo -e "${CYAN}Check status:${NC} ${YELLOW}ftl status${NC}"
    echo -e "${CYAN}View logs:${NC}    ${YELLOW}ftl logs [neo4j|graphiti|training|web]${NC}"
    echo ""
}

cmd_stop() {
    print_header "Stopping Fine-Tune Labs"
    echo ""

    stop_nextjs
    stop_training
    stop_graphiti
    stop_neo4j

    echo ""
    print_status "All services stopped"
    echo ""
}

cmd_restart() {
    cmd_stop
    sleep 2
    cmd_start
}

cmd_status() {
    print_header "Fine-Tune Labs Status"
    echo ""

    # Check each service
    if is_neo4j_running; then
        container_id=$(sudo docker ps --filter "name=neo4j" --format "{{.ID}}")
        print_service "Neo4j Database" "running" "(http://localhost:7474)"
    else
        print_service "Neo4j Database" "stopped"
    fi

    if is_graphiti_running; then
        pid=$(pgrep -f "python.*main.py")
        print_service "Graphiti Wrapper" "running" "(PID: $pid, port 8001)"
    else
        print_service "Graphiti Wrapper" "stopped"
    fi

    if is_training_running; then
        pid=$(pgrep -f "training_server.py")
        print_service "Training Server" "running" "(PID: $pid, port 8000)"
    else
        print_service "Training Server" "stopped"
    fi

    if is_nextjs_running; then
        pids=$(pgrep -f "next dev" | tr '\n' ' ')
        print_service "Next.js Web UI" "running" "(port 3000)"
    else
        print_service "Next.js Web UI" "stopped"
    fi

    echo ""
}

cmd_logs() {
    local service=$1

    if [ -z "$service" ]; then
        echo -e "${RED}Error: Please specify a service${NC}"
        echo ""
        echo "Usage: ftl logs [neo4j|graphiti|training|web]"
        echo ""
        echo "Examples:"
        echo "  ftl logs neo4j      - View Neo4j container logs"
        echo "  ftl logs graphiti   - View Graphiti wrapper logs"
        echo "  ftl logs training   - View training server logs"
        echo "  ftl logs web        - View Next.js logs (follow live)"
        exit 1
    fi

    case $service in
        neo4j)
            echo -e "${CYAN}Showing Neo4j logs (last 50 lines)...${NC}"
            echo ""
            sudo docker logs --tail 50 graphiti-main_neo4j_1 2>&1
            ;;
        graphiti)
            if [ -f "$GRAPHITI_LOG" ]; then
                echo -e "${CYAN}Showing Graphiti logs (last 50 lines)...${NC}"
                echo ""
                tail -50 "$GRAPHITI_LOG"
            else
                print_error "Graphiti log file not found: $GRAPHITI_LOG"
            fi
            ;;
        training)
            if [ -f "$TRAINING_LOG" ]; then
                echo -e "${CYAN}Showing Training Server logs (last 50 lines)...${NC}"
                echo ""
                tail -50 "$TRAINING_LOG"
            else
                print_error "Training log file not found: $TRAINING_LOG"
            fi
            ;;
        web)
            if is_nextjs_running; then
                pid=$(pgrep -f "next dev" | head -1)
                echo -e "${CYAN}Following Next.js logs (Ctrl+C to exit)...${NC}"
                echo ""
                tail -f /proc/$pid/fd/1 2>/dev/null || echo "Could not access Next.js logs"
            else
                print_error "Next.js is not running"
            fi
            ;;
        *)
            echo -e "${RED}Unknown service: $service${NC}"
            echo "Valid services: neo4j, graphiti, training, web"
            exit 1
            ;;
    esac
}

cmd_help() {
    echo -e "${CYAN}ftl${NC} - Fine-Tune Labs CLI"
    echo ""
    echo "Usage: ftl <command> [options]"
    echo ""
    echo "Commands:"
    echo -e "  ${GREEN}start${NC}              Start all services (Neo4j, Graphiti, Training, Web)"
    echo -e "  ${GREEN}stop${NC}               Stop all services"
    echo -e "  ${GREEN}restart${NC}            Restart all services"
    echo -e "  ${GREEN}status${NC}             Show status of all services"
    echo -e "  ${GREEN}logs${NC} <service>     View logs for a specific service"
    echo -e "  ${GREEN}help${NC}               Show this help message"
    echo ""
    echo "Services for logs command:"
    echo "  neo4j              Neo4j database container logs"
    echo "  graphiti           Graphiti wrapper server logs"
    echo "  training           Training server logs"
    echo "  web                Next.js web UI logs (live follow)"
    echo ""
    echo "Examples:"
    echo "  ftl start          Start all services"
    echo "  ftl status         Check which services are running"
    echo "  ftl logs training  View training server logs"
    echo "  ftl restart        Restart everything"
    echo ""
}

# Main command router
main() {
    if [ $# -eq 0 ]; then
        cmd_help
        exit 0
    fi

    case $1 in
        start)
            cmd_start
            ;;
        stop)
            cmd_stop
            ;;
        restart)
            cmd_restart
            ;;
        status)
            cmd_status
            ;;
        logs)
            cmd_logs "$2"
            ;;
        help|--help|-h)
            cmd_help
            ;;
        *)
            echo -e "${RED}Unknown command: $1${NC}"
            echo ""
            cmd_help
            exit 1
            ;;
    esac
}

main "$@"
