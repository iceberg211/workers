#!/bin/bash

# AI API Workers Deployment Script
# This script helps deploy the Cloudflare Workers AI API service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if wrangler is installed
check_wrangler() {
    if ! command -v wrangler &> /dev/null; then
        print_error "Wrangler CLI is not installed. Please install it first:"
        echo "npm install -g wrangler"
        exit 1
    fi
    print_success "Wrangler CLI is installed"
}

# Check if user is logged in to Cloudflare
check_auth() {
    if ! wrangler whoami &> /dev/null; then
        print_error "You are not logged in to Cloudflare. Please run:"
        echo "wrangler login"
        exit 1
    fi
    print_success "Authenticated with Cloudflare"
}

# Install dependencies
install_deps() {
    print_status "Installing dependencies..."
    npm install
    print_success "Dependencies installed"
}

# Type check
type_check() {
    print_status "Running type check..."
    npm run type-check
    print_success "Type check passed"
}

# Set environment variables
set_secrets() {
    print_status "Setting up environment variables..."
    
    # Check if secrets are already set
    if wrangler secret list | grep -q "OPENAI_API_KEY"; then
        print_warning "OPENAI_API_KEY is already set"
    else
        print_status "Setting OPENAI_API_KEY..."
        echo "Please enter your OpenAI API key:"
        read -s OPENAI_KEY
        echo "$OPENAI_KEY" | wrangler secret put OPENAI_API_KEY
        print_success "OPENAI_API_KEY set"
    fi
    
    if wrangler secret list | grep -q "DEEPSEEK_API_KEY"; then
        print_warning "DEEPSEEK_API_KEY is already set"
    else
        print_status "Setting DEEPSEEK_API_KEY..."
        echo "Please enter your DeepSeek API key:"
        read -s DEEPSEEK_KEY
        echo "$DEEPSEEK_KEY" | wrangler secret put DEEPSEEK_API_KEY
        print_success "DEEPSEEK_API_KEY set"
    fi
    
    # Optional: Set CORS origins
    echo "Do you want to set allowed CORS origins? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "Enter allowed origins (comma-separated, or * for all):"
        read -r CORS_ORIGINS
        echo "$CORS_ORIGINS" | wrangler secret put ALLOWED_ORIGINS
        print_success "ALLOWED_ORIGINS set"
    fi
}

# Deploy to staging
deploy_staging() {
    print_status "Deploying to staging environment..."
    wrangler deploy --env staging
    print_success "Deployed to staging"
}

# Deploy to production
deploy_production() {
    print_status "Deploying to production environment..."
    wrangler deploy --env production
    print_success "Deployed to production"
}

# Test deployment
test_deployment() {
    local env=$1
    print_status "Testing $env deployment..."
    
    # Get the worker URL
    local worker_url
    if [ "$env" = "production" ]; then
        worker_url=$(wrangler whoami | grep "Account ID" | awk '{print $3}')
        worker_url="https://ai-api-workers.$worker_url.workers.dev"
    else
        worker_url="https://ai-api-workers-staging.$worker_url.workers.dev"
    fi
    
    # Test health endpoint
    local health_response
    health_response=$(curl -s -X POST "$worker_url/graphql" \
        -H "Content-Type: application/json" \
        -d '{"query":"query { health { healthy providers { name available } } }"}')
    
    if echo "$health_response" | grep -q '"healthy":true'; then
        print_success "$env deployment is healthy"
    else
        print_error "$env deployment health check failed"
        echo "Response: $health_response"
    fi
}

# Main deployment function
main() {
    local environment=${1:-"staging"}
    
    print_status "Starting deployment process for $environment environment..."
    
    # Pre-deployment checks
    check_wrangler
    check_auth
    install_deps
    type_check
    
    # Set secrets if needed
    if [ "$2" = "--setup-secrets" ]; then
        set_secrets
    fi
    
    # Deploy based on environment
    case $environment in
        "staging")
            deploy_staging
            test_deployment "staging"
            ;;
        "production")
            echo "Are you sure you want to deploy to production? (y/n)"
            read -r response
            if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
                deploy_production
                test_deployment "production"
            else
                print_warning "Production deployment cancelled"
                exit 0
            fi
            ;;
        *)
            print_error "Invalid environment: $environment"
            echo "Usage: $0 [staging|production] [--setup-secrets]"
            exit 1
            ;;
    esac
    
    print_success "Deployment completed successfully!"
    print_status "You can test your API at the GraphQL playground"
}

# Run main function with all arguments
main "$@"
