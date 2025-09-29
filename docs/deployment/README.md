# Grafity Deployment Guide

This guide covers all aspects of deploying Grafity in different environments, from local development to production Kubernetes clusters.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Monitoring Setup](#monitoring-setup)
- [CI/CD Pipeline](#ci-cd-pipeline)
- [Troubleshooting](#troubleshooting)

## Overview

Grafity supports multiple deployment methods:

- **Local Development**: Direct Node.js execution with external databases
- **Docker**: Containerized deployment with Docker Compose
- **Kubernetes**: Production-ready orchestrated deployment
- **Cloud**: Platform-specific deployments (AWS, GCP, Azure)

## Prerequisites

### Required Tools

- **Node.js** 18+ (for local development)
- **Docker** 20.10+ and **Docker Compose** 3.8+
- **kubectl** (for Kubernetes deployments)
- **kustomize** (for Kubernetes manifest management)

### Required Services

- **Neo4j** 5+ (graph database)
- **Redis** 7+ (caching and sessions)

## Local Development

### 1. Environment Setup

```bash
# Clone the repository
git clone https://github.com/your-org/grafity.git
cd grafity

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env.local
```

### 2. Database Setup

**Neo4j:**
```bash
# Using Docker
docker run -d \
  --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  -e NEO4J_PLUGINS='["apoc"]' \
  neo4j:5-community
```

**Redis:**
```bash
# Using Docker
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:7-alpine
```

### 3. Configuration

Update `.env.local`:

```env
NODE_ENV=development
PORT=4000
LOG_LEVEL=debug

# Database connections
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=dev-secret-key
JWT_EXPIRES_IN=7d

# Features
RATE_LIMIT_ENABLED=false
METRICS_ENABLED=true
```

### 4. Running the Application

```bash
# Development mode with hot reload
npm run dev

# Production build
npm run build
npm start

# Run tests
npm test
npm run test:e2e
```

## Docker Deployment

### 1. Production Deployment

```bash
# Build and start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f grafity
```

### 2. Development Mode

```bash
# Use development overrides
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Enable hot reload and debugging
docker-compose exec grafity npm run dev
```

### 3. Testing Mode

```bash
# Run tests in containers
docker-compose -f docker-compose.yml -f docker-compose.test.yml up --profile test
```

### 4. Monitoring Stack

```bash
# Start with monitoring services
docker-compose --profile monitoring up -d

# Access services:
# - Grafity: http://localhost:4000
# - Grafana: http://localhost:3000 (admin/grafity-admin-password)
# - Prometheus: http://localhost:9090
# - Neo4j: http://localhost:7474
```

## Kubernetes Deployment

### 1. Prerequisites

```bash
# Ensure cluster access
kubectl cluster-info

# Install required tools
# - kubectl
# - kustomize
# - helm (optional)
```

### 2. Environment-Specific Deployment

**Staging:**
```bash
# Deploy to staging
./scripts/deploy.sh staging latest

# Check deployment status
kubectl get pods -n grafity-staging
```

**Production:**
```bash
# Deploy to production
./scripts/deploy.sh production v1.0.0

# Verify deployment
kubectl get all -n grafity
```

### 3. Manual Deployment

```bash
# Create secrets first
kubectl create secret generic grafity-secrets \
  --from-literal=JWT_SECRET='your-jwt-secret' \
  --from-literal=NEO4J_PASSWORD='your-neo4j-password' \
  -n grafity

# Deploy using kustomize
kubectl apply -k k8s/production/
```

### 4. Scaling

```bash
# Scale application replicas
kubectl scale deployment grafity-app --replicas=5 -n grafity

# Check scaling status
kubectl get hpa -n grafity
```

## Monitoring Setup

### 1. Prometheus Configuration

The monitoring stack includes:
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Visualization dashboards
- **AlertManager**: Alert routing and management

### 2. Available Dashboards

1. **Grafity Overview**: Application performance metrics
2. **Infrastructure**: System resource monitoring
3. **Business Metrics**: Analysis performance and usage

### 3. Key Metrics

**Application Metrics:**
- `http_requests_total`: Request count by method/route/status
- `http_request_duration_seconds`: Request latency histograms
- `grafity_analysis_queue_length`: Analysis job queue size
- `grafity_analysis_duration_seconds`: Analysis processing time

**System Metrics:**
- `process_resident_memory_bytes`: Application memory usage
- `nodejs_heap_size_used_bytes`: Node.js heap memory
- `up`: Service availability

### 4. Alerts

Critical alerts are configured for:
- Application downtime
- High error rates (>5%)
- Slow response times (>2s)
- Database connectivity issues
- High resource usage

## CI/CD Pipeline

### 1. GitHub Actions Workflows

**Main Workflow** (`.github/workflows/ci.yml`):
- Code quality checks (linting, security)
- Unit and integration tests
- E2E tests with Playwright
- Performance tests with K6
- Docker image building
- Deployment to staging/production

**Security Workflow** (`.github/workflows/security.yml`):
- Dependency scanning
- SAST analysis with CodeQL
- Container vulnerability scanning
- Secret detection

**Release Workflow** (`.github/workflows/release.yml`):
- Automated versioning
- Release notes generation
- npm package publishing
- Docker image tagging

### 2. Deployment Process

1. **Pull Request**: Runs tests and security scans
2. **Merge to Develop**: Deploys to staging
3. **Merge to Main**: Deploys to production
4. **Git Tag**: Creates release and publishes packages

### 3. Environment Configuration

**Staging:**
- Reduced resource limits
- Debug logging enabled
- Rate limiting disabled
- Auto-deployment on develop branch

**Production:**
- Full resource allocation
- Info-level logging
- Security features enabled
- Manual deployment approval

## Troubleshooting

### Common Issues

**1. Application Won't Start**
```bash
# Check logs
docker-compose logs grafity
kubectl logs -l app=grafity -n grafity

# Verify environment variables
kubectl describe configmap grafity-config -n grafity
```

**2. Database Connection Issues**
```bash
# Test Neo4j connectivity
kubectl exec -it neo4j-pod -n grafity -- cypher-shell -u neo4j -p password "RETURN 1"

# Test Redis connectivity
kubectl exec -it redis-pod -n grafity -- redis-cli ping
```

**3. Performance Issues**
```bash
# Check resource usage
kubectl top pods -n grafity

# Review metrics in Grafana
# http://localhost:3000/d/grafity-overview
```

**4. Memory Leaks**
```bash
# Generate heap dump
kubectl exec grafity-pod -n grafity -- npm run heap-dump

# Analyze with Node.js memory profiler
node --inspect-brk dist/server.js
```

### Health Checks

**Application Health:**
```bash
curl http://localhost:4000/health
```

**Database Health:**
```bash
curl http://localhost:4000/api/health/neo4j
curl http://localhost:4000/api/health/redis
```

**Metrics Endpoint:**
```bash
curl http://localhost:4000/metrics
```

### Log Analysis

**Application Logs:**
```bash
# Docker
docker-compose logs -f grafity

# Kubernetes
kubectl logs -f deployment/grafity-app -n grafity

# Aggregated logs with grep
kubectl logs -l app=grafity -n grafity | grep ERROR
```

### Backup and Recovery

**Neo4j Backup:**
```bash
kubectl exec neo4j-pod -n grafity -- neo4j-admin database dump --to-path=/backups neo4j
```

**Redis Backup:**
```bash
kubectl exec redis-pod -n grafity -- redis-cli BGSAVE
```

## Support

For additional support:
- Check the [FAQ](../FAQ.md)
- Review [Architecture Documentation](../architecture/)
- Submit issues on [GitHub](https://github.com/your-org/grafity/issues)
- Contact the team at support@grafity.dev