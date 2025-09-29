#!/bin/bash

# Grafity Kubernetes Deployment Script
# Usage: ./scripts/deploy.sh [staging|production] [image-tag]

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="${1:-staging}"
IMAGE_TAG="${2:-latest}"
NAMESPACE="grafity"
KUSTOMIZE_DIR="k8s"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if required tools are installed
check_prerequisites() {
    print_status "Checking prerequisites..."

    local missing_tools=()

    if ! command -v kubectl &> /dev/null; then
        missing_tools+=("kubectl")
    fi

    if ! command -v kustomize &> /dev/null; then
        missing_tools+=("kustomize")
    fi

    if ! command -v docker &> /dev/null; then
        missing_tools+=("docker")
    fi

    if [ ${#missing_tools[@]} -ne 0 ]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        exit 1
    fi

    print_success "All prerequisites satisfied"
}

# Function to validate environment
validate_environment() {
    if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
        print_error "Invalid environment: $ENVIRONMENT. Must be 'staging' or 'production'"
        exit 1
    fi

    if [ "$ENVIRONMENT" = "staging" ]; then
        NAMESPACE="grafity-staging"
    fi

    print_status "Deploying to: $ENVIRONMENT"
    print_status "Namespace: $NAMESPACE"
    print_status "Image tag: $IMAGE_TAG"
}

# Function to check cluster connectivity
check_cluster() {
    print_status "Checking Kubernetes cluster connectivity..."

    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster. Please check your kubeconfig."
        exit 1
    fi

    local cluster_info=$(kubectl config current-context)
    print_success "Connected to cluster: $cluster_info"

    # Confirm production deployment
    if [ "$ENVIRONMENT" = "production" ]; then
        echo
        print_warning "⚠️  You are about to deploy to PRODUCTION!"
        print_warning "Cluster: $cluster_info"
        print_warning "Namespace: $NAMESPACE"
        echo
        read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirmation

        if [ "$confirmation" != "yes" ]; then
            print_error "Deployment cancelled by user"
            exit 1
        fi
    fi
}

# Function to create namespace if it doesn't exist
create_namespace() {
    print_status "Ensuring namespace exists..."

    if kubectl get namespace "$NAMESPACE" &> /dev/null; then
        print_success "Namespace $NAMESPACE already exists"
    else
        kubectl create namespace "$NAMESPACE"
        print_success "Created namespace: $NAMESPACE"
    fi
}

# Function to check if secrets exist
check_secrets() {
    print_status "Checking for required secrets..."

    local secrets=("grafity-secrets" "neo4j-auth")
    local missing_secrets=()

    for secret in "${secrets[@]}"; do
        if ! kubectl get secret "$secret" -n "$NAMESPACE" &> /dev/null; then
            missing_secrets+=("$secret")
        fi
    done

    if [ ${#missing_secrets[@]} -ne 0 ]; then
        print_warning "Missing secrets: ${missing_secrets[*]}"
        print_warning "Please create these secrets before deploying:"
        echo
        for secret in "${missing_secrets[@]}"; do
            echo "kubectl create secret generic $secret -n $NAMESPACE --from-literal=..."
        done
        echo
        read -p "Continue anyway? (y/N): " continue_deploy
        if [[ "$continue_deploy" != "y" && "$continue_deploy" != "Y" ]]; then
            exit 1
        fi
    else
        print_success "All required secrets found"
    fi
}

# Function to update image tag in kustomization
update_image_tag() {
    local kustomize_file="$KUSTOMIZE_DIR/$ENVIRONMENT/kustomization.yaml"

    if [ -f "$kustomize_file" ]; then
        print_status "Updating image tag to: $IMAGE_TAG"

        # Use kustomize to set the image tag
        cd "$KUSTOMIZE_DIR/$ENVIRONMENT"
        kustomize edit set image "grafity:$IMAGE_TAG"
        cd - > /dev/null

        print_success "Image tag updated in kustomization"
    else
        print_error "Kustomization file not found: $kustomize_file"
        exit 1
    fi
}

# Function to validate Kubernetes manifests
validate_manifests() {
    print_status "Validating Kubernetes manifests..."

    local kustomize_dir="$KUSTOMIZE_DIR/$ENVIRONMENT"

    if ! kustomize build "$kustomize_dir" > /tmp/grafity-manifests.yaml; then
        print_error "Failed to build manifests with kustomize"
        exit 1
    fi

    if ! kubectl apply --dry-run=client -f /tmp/grafity-manifests.yaml > /dev/null; then
        print_error "Manifest validation failed"
        exit 1
    fi

    print_success "Manifests validated successfully"
}

# Function to deploy to Kubernetes
deploy() {
    print_status "Deploying to Kubernetes..."

    local kustomize_dir="$KUSTOMIZE_DIR/$ENVIRONMENT"

    # Apply the manifests
    if ! kubectl apply -k "$kustomize_dir"; then
        print_error "Deployment failed"
        exit 1
    fi

    print_success "Manifests applied successfully"
}

# Function to wait for deployment to be ready
wait_for_deployment() {
    print_status "Waiting for deployments to be ready..."

    local deployments=("grafity-app" "neo4j" "redis")

    for deployment in "${deployments[@]}"; do
        print_status "Waiting for $deployment..."

        if kubectl wait --for=condition=available --timeout=600s "deployment/$deployment" -n "$NAMESPACE"; then
            print_success "$deployment is ready"
        else
            print_error "$deployment failed to become ready"
            return 1
        fi
    done

    print_success "All deployments are ready"
}

# Function to run smoke tests
run_smoke_tests() {
    print_status "Running smoke tests..."

    # Get the service URL
    local service_url
    if [ "$ENVIRONMENT" = "production" ]; then
        service_url="https://grafity.yourdomain.com"
    else
        service_url="https://grafity-staging.yourdomain.com"
    fi

    # Test health endpoint
    if curl -f "$service_url/health" > /dev/null 2>&1; then
        print_success "Health check passed"
    else
        print_warning "Health check failed - service might still be starting"
    fi

    # Test metrics endpoint
    if curl -f "$service_url/metrics" > /dev/null 2>&1; then
        print_success "Metrics endpoint accessible"
    else
        print_warning "Metrics endpoint not accessible"
    fi
}

# Function to show deployment status
show_status() {
    print_status "Deployment Status:"
    echo

    kubectl get pods -n "$NAMESPACE" -l app=grafity
    echo
    kubectl get services -n "$NAMESPACE" -l app=grafity
    echo
    kubectl get ingress -n "$NAMESPACE" -l app=grafity
    echo

    print_success "Deployment completed successfully!"

    if [ "$ENVIRONMENT" = "production" ]; then
        echo
        print_status "Production URL: https://grafity.yourdomain.com"
        print_status "Grafana: https://grafity.yourdomain.com:3000"
        print_status "Prometheus: https://grafity.yourdomain.com:9090"
    else
        echo
        print_status "Staging URL: https://grafity-staging.yourdomain.com"
    fi
}

# Function to rollback deployment
rollback() {
    print_status "Rolling back deployment..."

    kubectl rollout undo deployment/grafity-app -n "$NAMESPACE"

    if wait_for_deployment; then
        print_success "Rollback completed successfully"
    else
        print_error "Rollback failed"
        exit 1
    fi
}

# Main deployment flow
main() {
    echo "🚀 Grafity Kubernetes Deployment"
    echo "=================================="
    echo

    check_prerequisites
    validate_environment
    check_cluster
    create_namespace
    check_secrets
    update_image_tag
    validate_manifests
    deploy

    if wait_for_deployment; then
        run_smoke_tests
        show_status
    else
        print_error "Deployment failed. Do you want to rollback? (y/N)"
        read -p "" should_rollback
        if [[ "$should_rollback" == "y" || "$should_rollback" == "Y" ]]; then
            rollback
        fi
        exit 1
    fi
}

# Handle script arguments
case "${3:-deploy}" in
    "rollback")
        rollback
        ;;
    "status")
        show_status
        ;;
    *)
        main
        ;;
esac