# Multi-stage Dockerfile for Grafity
# Stage 1: Build dependencies and application
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S grafity -u 1001

# Install system dependencies for building
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl

# Copy package files and lock file
COPY package.json package-lock.json ./
COPY packages/grafity-react/package.json ./packages/grafity-react/

# Install dependencies (including dev dependencies for building)
# Use --legacy-peer-deps to resolve peer dependency conflicts
RUN npm ci --legacy-peer-deps && \
    npm cache clean --force

# Copy source code
COPY . .

# Change ownership to non-root user
RUN chown -R grafity:nodejs /app

# Switch to non-root user
USER grafity

# Build the Nx plugin
RUN npx nx build grafity-react

# Stage 2: Test runner for Nx plugin testing
FROM builder AS tester

# Switch back to root to install test dependencies
USER root

# Ensure all dependencies are available
RUN npm ci

# Switch back to non-root user
USER grafity

# Run Nx plugin tests
RUN npx nx test grafity-react --ci --codeCoverage

# Test plugin executors on sample React app
RUN npx nx run grafity:demo:analyze && \
    npx nx run grafity:demo:visualize && \
    npx nx run grafity:demo:patterns

# Stage 3: Production image
FROM node:18-alpine AS production

# Install security updates
RUN apk upgrade --no-cache && \
    apk add --no-cache \
    dumb-init \
    curl \
    tini

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S grafity -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force && \
    rm -rf /tmp/*

# Copy built application from builder stage
COPY --from=builder --chown=grafity:nodejs /app/dist ./dist
COPY --from=builder --chown=grafity:nodejs /app/public ./public

# Copy configuration files
COPY --chown=grafity:nodejs docker/grafity.config.js ./
COPY --chown=grafity:nodejs docker/healthcheck.js ./

# Create necessary directories
RUN mkdir -p /app/logs /app/tmp && \
    chown -R grafity:nodejs /app

# Switch to non-root user
USER grafity

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node healthcheck.js || exit 1

# Use tini as init system for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["npm", "start"]

# Stage 4: Development image
FROM node:18-alpine AS development

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl \
    bash \
    vim

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S grafity -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci

# Create directories and set ownership
RUN mkdir -p /app/logs /app/tmp && \
    chown -R grafity:nodejs /app

# Switch to non-root user
USER grafity

# Expose ports (main app + debug)
EXPOSE 4000 9229

# Development command with nodemon and debugging
CMD ["npm", "run", "dev"]

# Stage 5: Debug image
FROM development AS debug

USER root

# Install debugging tools
RUN npm install -g node-inspector

USER grafity

# Debug command
CMD ["npm", "run", "debug"]