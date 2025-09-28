#!/bin/bash

# Neo4j Docker Control Script

set -e

COMMAND=${1:-help}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

start_neo4j() {
    print_info "Starting Neo4j..."
    docker-compose up -d neo4j

    print_info "Waiting for Neo4j to be ready..."
    sleep 5

    # Wait for Neo4j to be ready (max 30 seconds)
    for i in {1..30}; do
        if docker-compose exec -T neo4j neo4j status 2>/dev/null | grep -q "running"; then
            print_status "Neo4j is ready!"
            print_info "Neo4j Browser: http://localhost:7474"
            print_info "Bolt URL: bolt://localhost:7687"
            print_info "Username: neo4j"
            print_info "Password: grafity123"
            return 0
        fi
        echo -n "."
        sleep 1
    done

    print_error "Neo4j failed to start within 30 seconds"
    return 1
}

stop_neo4j() {
    print_info "Stopping Neo4j..."
    docker-compose stop neo4j
    print_status "Neo4j stopped"
}

restart_neo4j() {
    stop_neo4j
    start_neo4j
}

status_neo4j() {
    if docker-compose ps neo4j | grep -q "Up"; then
        print_status "Neo4j is running"
        docker-compose ps neo4j
    else
        print_error "Neo4j is not running"
        return 1
    fi
}

logs_neo4j() {
    docker-compose logs -f neo4j
}

shell_neo4j() {
    print_info "Opening Neo4j shell..."
    docker-compose exec neo4j cypher-shell -u neo4j -p grafity123
}

clear_neo4j() {
    print_info "Clearing all Neo4j data..."
    read -p "Are you sure? This will delete ALL data! (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose exec -T neo4j cypher-shell -u neo4j -p grafity123 \
            --database neo4j \
            "MATCH (n) DETACH DELETE n" 2>/dev/null
        print_status "All data cleared"
    else
        print_info "Cancelled"
    fi
}

backup_neo4j() {
    BACKUP_DIR="backups"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="${BACKUP_DIR}/neo4j_backup_${TIMESTAMP}.dump"

    mkdir -p ${BACKUP_DIR}

    print_info "Creating backup to ${BACKUP_FILE}..."
    docker-compose exec -T neo4j neo4j-admin database dump neo4j \
        --to-stdout > ${BACKUP_FILE}

    print_status "Backup created: ${BACKUP_FILE}"
}

import_sample_data() {
    print_info "Importing sample graph data..."

    # Create sample Cypher script
    cat > /tmp/sample_data.cypher << 'EOF'
// Clear existing data
MATCH (n) DETACH DELETE n;

// Create sample code nodes
CREATE (app:Node:CodeNode {
    id: 'app-main',
    type: 'code',
    label: 'App',
    codeType: 'component',
    filePath: 'src/App.tsx',
    language: 'typescript'
})
CREATE (router:Node:CodeNode {
    id: 'router-main',
    type: 'code',
    label: 'Router',
    codeType: 'component',
    filePath: 'src/Router.tsx',
    language: 'typescript'
})
CREATE (api:Node:CodeNode {
    id: 'api-service',
    type: 'code',
    label: 'APIService',
    codeType: 'class',
    filePath: 'src/services/api.ts',
    language: 'typescript'
})
CREATE (auth:Node:CodeNode {
    id: 'auth-service',
    type: 'code',
    label: 'AuthService',
    codeType: 'class',
    filePath: 'src/services/auth.ts',
    language: 'typescript'
});

// Create business nodes
CREATE (feature1:Node:BusinessNode {
    id: 'feature-login',
    type: 'business',
    label: 'User Login Feature',
    businessType: 'feature',
    priority: 'high'
})
CREATE (feature2:Node:BusinessNode {
    id: 'feature-dashboard',
    type: 'business',
    label: 'Dashboard Feature',
    businessType: 'feature',
    priority: 'medium'
});

// Create relationships
CREATE (app)-[:EDGE {id: 'e1', type: 'imports', weight: 1.0}]->(router)
CREATE (app)-[:EDGE {id: 'e2', type: 'uses', weight: 0.9}]->(api)
CREATE (router)-[:EDGE {id: 'e3', type: 'uses', weight: 0.8}]->(auth)
CREATE (api)-[:EDGE {id: 'e4', type: 'depends_on', weight: 0.7}]->(auth)
CREATE (feature1)-[:EDGE {id: 'e5', type: 'implements', weight: 1.0, bidirectional: true}]->(auth)
CREATE (feature2)-[:EDGE {id: 'e6', type: 'implements', weight: 1.0, bidirectional: true}]->(app);

// Return counts
MATCH (n:Node) RETURN count(n) as nodeCount;
MATCH ()-[r:EDGE]->() RETURN count(r) as edgeCount;
EOF

    docker cp /tmp/sample_data.cypher grafity-neo4j:/tmp/sample_data.cypher

    docker-compose exec -T neo4j cypher-shell -u neo4j -p grafity123 \
        --database neo4j \
        --file /tmp/sample_data.cypher

    print_status "Sample data imported"
    print_info "View in browser: http://localhost:7474"
    print_info "Run query: MATCH (n) RETURN n LIMIT 50"
}

show_help() {
    echo "Neo4j Docker Control Script"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start       Start Neo4j container"
    echo "  stop        Stop Neo4j container"
    echo "  restart     Restart Neo4j container"
    echo "  status      Show Neo4j status"
    echo "  logs        Show Neo4j logs (follow mode)"
    echo "  shell       Open Cypher shell"
    echo "  clear       Clear all data (CAUTION!)"
    echo "  backup      Create a backup"
    echo "  import      Import sample data"
    echo "  help        Show this help"
    echo ""
    echo "Connection Info:"
    echo "  Browser:  http://localhost:7474"
    echo "  Bolt:     bolt://localhost:7687"
    echo "  Username: neo4j"
    echo "  Password: grafity123"
}

# Main command handling
case "$COMMAND" in
    start)
        start_neo4j
        ;;
    stop)
        stop_neo4j
        ;;
    restart)
        restart_neo4j
        ;;
    status)
        status_neo4j
        ;;
    logs)
        logs_neo4j
        ;;
    shell)
        shell_neo4j
        ;;
    clear)
        clear_neo4j
        ;;
    backup)
        backup_neo4j
        ;;
    import)
        import_sample_data
        ;;
    help|*)
        show_help
        ;;
esac