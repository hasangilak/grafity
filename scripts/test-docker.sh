#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.test.yml"
LOG_DIR="./test-logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create log directory
mkdir -p "$LOG_DIR"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up Docker containers and volumes..."
    docker compose -f "$COMPOSE_FILE" down -v 2>/dev/null || true
    log_success "Cleanup complete"
}

# Trap errors and cleanup
trap cleanup EXIT

# Main test function
run_tests() {
    local TEST_TYPE=$1

    log_info "Starting Grafity Docker Test Suite - $TEST_TYPE"
    log_info "Timestamp: $TIMESTAMP"
    echo ""

    case $TEST_TYPE in
        "unit")
            log_info "Running Unit Tests (Nx Plugin)"
            docker compose -f "$COMPOSE_FILE" up --build --abort-on-container-exit grafity-plugin-test | tee "$LOG_DIR/unit-tests-$TIMESTAMP.log"
            ;;

        "integration")
            log_info "Running Integration Tests (Sample React App Analysis)"
            docker compose -f "$COMPOSE_FILE" --profile integration up --build --abort-on-container-exit grafity-integration-test | tee "$LOG_DIR/integration-tests-$TIMESTAMP.log"
            ;;

        "browser")
            log_info "Running Browser Tests (Visual Validation)"
            docker compose -f "$COMPOSE_FILE" --profile browser up --build --abort-on-container-exit grafity-browser-test | tee "$LOG_DIR/browser-tests-$TIMESTAMP.log"
            ;;

        "all")
            log_info "Running All Tests"

            # Unit tests
            log_info "Step 1/3: Unit Tests"
            docker compose -f "$COMPOSE_FILE" up --build --abort-on-container-exit grafity-plugin-test | tee "$LOG_DIR/unit-tests-$TIMESTAMP.log"
            log_success "Unit tests completed"
            echo ""

            # Integration tests
            log_info "Step 2/3: Integration Tests"
            docker compose -f "$COMPOSE_FILE" --profile integration up --build --abort-on-container-exit grafity-integration-test | tee "$LOG_DIR/integration-tests-$TIMESTAMP.log"
            log_success "Integration tests completed"
            echo ""

            # Browser tests
            log_info "Step 3/3: Browser Tests"
            docker compose -f "$COMPOSE_FILE" --profile browser up --build --abort-on-container-exit grafity-browser-test | tee "$LOG_DIR/browser-tests-$TIMESTAMP.log"
            log_success "Browser tests completed"
            ;;

        *)
            log_error "Unknown test type: $TEST_TYPE"
            echo "Usage: $0 {unit|integration|browser|all}"
            exit 1
            ;;
    esac
}

# Check Docker availability
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi

    log_success "Docker is available"
}

# Extract test results
extract_results() {
    log_info "Extracting test results..."

    # Copy coverage reports
    docker compose -f "$COMPOSE_FILE" run --rm grafity-plugin-test sh -c "cp -r /app/coverage /test-results/" 2>/dev/null || log_warning "Could not extract coverage reports"

    # Copy visualization outputs
    docker compose -f "$COMPOSE_FILE" run --rm grafity-integration-test sh -c "ls -la /app/dist/visualizations" 2>/dev/null || log_warning "Could not list visualization outputs"

    log_info "Results saved to $LOG_DIR/"
}

# Display summary
display_summary() {
    echo ""
    echo "================================================"
    log_success "Test Suite Complete"
    echo "================================================"
    echo ""
    echo "Logs saved to: $LOG_DIR/"
    echo "Timestamp: $TIMESTAMP"
    echo ""

    if [ -f "$LOG_DIR/unit-tests-$TIMESTAMP.log" ]; then
        echo "Unit Test Log: $LOG_DIR/unit-tests-$TIMESTAMP.log"
    fi

    if [ -f "$LOG_DIR/integration-tests-$TIMESTAMP.log" ]; then
        echo "Integration Test Log: $LOG_DIR/integration-tests-$TIMESTAMP.log"
    fi

    if [ -f "$LOG_DIR/browser-tests-$TIMESTAMP.log" ]; then
        echo "Browser Test Log: $LOG_DIR/browser-tests-$TIMESTAMP.log"
    fi

    echo ""
}

# Main execution
main() {
    local TEST_TYPE=${1:-all}

    check_docker
    run_tests "$TEST_TYPE"
    extract_results
    display_summary
}

# Run main function
main "$@"