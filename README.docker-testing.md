# Docker Testing Guide for Grafity Nx React Plugin

This guide explains how to test the `@grafity/nx-react` plugin locally using Docker.

## Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose)
- At least 4GB of available RAM for Docker
- 5GB of free disk space

## Quick Start

```bash
# Run all tests
./scripts/test-docker.sh all

# Run specific test suites
./scripts/test-docker.sh unit         # Nx plugin unit tests
./scripts/test-docker.sh integration  # Integration tests with sample React app
./scripts/test-docker.sh browser      # Browser-based visual tests
```

## Test Suites

### 1. Unit Tests (Nx Plugin)

Tests the `@grafity/nx-react` plugin in isolation:

```bash
./scripts/test-docker.sh unit
```

**What it tests:**
- Plugin compilation (TypeScript to JavaScript)
- Jest unit tests with code coverage
- Type checking and linting

**Output:**
- Test results in console
- Coverage reports in `test-logs/`

### 2. Integration Tests (Sample React App)

Tests the plugin executors on the sample React app:

```bash
./scripts/test-docker.sh integration
```

**What it tests:**
- `demo:analyze` - Analyzes 13 React components
- `demo:visualize` - Generates interactive HTML visualization
- `demo:patterns` - Detects React patterns and anti-patterns

**Output:**
- Analysis results in `dist/analysis/`
- Visualizations in `dist/visualizations/`
- Pattern detection reports

### 3. Browser Tests (Visual Validation)

Tests generated visualizations in a browser environment:

```bash
./scripts/test-docker.sh browser
```

**What it tests:**
- Visual rendering of generated HTML/SVG
- Interactive component tree navigation
- Graph layout and styling

**Requirements:**
- Playwright installed in container (auto-configured)
- Test specs in `tests/browser/`

## Docker Compose Architecture

### Services

#### `grafity-plugin-test`
- **Purpose:** Run unit tests on the Nx plugin
- **Base Image:** `node:18-alpine`
- **Stage:** `tester` (from Dockerfile)
- **Volumes:**
  - Plugin source code (read-only)
  - Test results and coverage reports

#### `grafity-integration-test`
- **Purpose:** Run plugin executors on sample React app
- **Base Image:** `node:18-alpine`
- **Stage:** `builder` (from Dockerfile)
- **Volumes:**
  - Full workspace (read-write for analysis output)
  - Visualization and analysis outputs

#### `grafity-browser-test`
- **Purpose:** Visual testing with Playwright
- **Base Image:** `mcr.microsoft.com/playwright`
- **Volumes:**
  - Generated visualizations (read-only)
  - Browser test specs

### Volumes

- `test-results`: Jest test results
- `coverage-reports`: Code coverage reports
- `viz-output`: Generated visualizations (HTML/SVG)
- `analysis-output`: Component analysis JSON files

## Manual Docker Commands

If you prefer to run Docker commands manually:

```bash
# Build and run unit tests
docker compose -f docker-compose.test.yml up --build grafity-plugin-test

# Build and run integration tests
docker compose -f docker-compose.test.yml --profile integration up --build grafity-integration-test

# Run browser tests (requires visualizations to exist)
docker compose -f docker-compose.test.yml --profile browser up grafity-browser-test

# Cleanup
docker compose -f docker-compose.test.yml down -v
```

## Viewing Test Outputs

### Coverage Reports

```bash
# After running unit tests
docker compose -f docker-compose.test.yml run --rm grafity-plugin-test sh -c "cat /app/coverage/lcov-report/index.html" > coverage.html
open coverage.html
```

### Visualization Outputs

```bash
# After running integration tests
ls -la dist/visualizations/
open dist/visualizations/component-tree.html
```

### Analysis Results

```bash
# After running integration tests
cat dist/analysis/sample-react-app-analysis.json | jq .
```

## Continuous Integration

The Docker test setup is CI-ready:

```yaml
# Example GitHub Actions workflow
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Docker tests
        run: ./scripts/test-docker.sh all
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./test-logs/coverage/lcov.info
```

## Troubleshooting

### Out of Memory Errors

Increase Docker Desktop memory allocation:
- Docker Desktop → Settings → Resources → Memory
- Recommended: 4GB minimum, 8GB preferred

### Permission Errors

If you encounter permission errors with volumes:

```bash
# Add user to docker group (Linux)
sudo usermod -aG docker $USER
newgrp docker

# Or run with sudo (not recommended for security)
sudo ./scripts/test-docker.sh all
```

### Stale Containers

Clean up Docker environment:

```bash
# Remove all Grafity containers and volumes
docker compose -f docker-compose.test.yml down -v

# Prune Docker system (careful!)
docker system prune -af --volumes
```

### Build Failures

Force rebuild without cache:

```bash
docker compose -f docker-compose.test.yml build --no-cache
```

## Integration with Nx MCP

The test suite can be enhanced with Nx MCP for AI-powered testing:

```bash
# Analyze test results with Claude Code
npx @nx/mcp analyze-tests --project=grafity-react

# Get AI suggestions for failing tests
npx @nx/mcp suggest-fixes --test-failures=test-logs/unit-tests-*.log
```

## Performance Metrics

Expected test durations on standard hardware:

- **Unit Tests:** 30-60 seconds
- **Integration Tests:** 2-4 minutes
- **Browser Tests:** 1-2 minutes
- **All Tests:** 4-7 minutes

## Next Steps

1. **Add E2E Tests:** Extend browser tests to include user interaction scenarios
2. **Performance Testing:** Add load testing for large React codebases
3. **MCP Integration:** Add AI-powered test analysis and suggestions
4. **CI/CD Pipeline:** Integrate with GitHub Actions, GitLab CI, or Jenkins

## Additional Resources

- [Nx Testing Documentation](https://nx.dev/recipes/testing)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Grafity Architecture](./CLAUDE.md)
- [Nx MCP Integration](https://github.com/anthropics/nx-mcp)