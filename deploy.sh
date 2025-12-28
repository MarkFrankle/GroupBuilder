#!/bin/bash
# Quick deployment script for Google Cloud Run

set -e  # Exit on error

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI not found. Please install it first:"
    echo "https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Get project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo "Error: No GCP project set. Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo "Deploying to project: $PROJECT_ID"
echo ""

# Prompt for environment variables if not set
if [ -z "$UPSTASH_REDIS_REST_URL" ]; then
    read -p "Enter UPSTASH_REDIS_REST_URL: " UPSTASH_REDIS_REST_URL
fi

if [ -z "$UPSTASH_REDIS_REST_TOKEN" ]; then
    read -sp "Enter UPSTASH_REDIS_REST_TOKEN: " UPSTASH_REDIS_REST_TOKEN
    echo ""
fi

# Optional: CORS origins
read -p "Enter frontend URL (default: https://group-builder.netlify.app): " FRONTEND_URL
FRONTEND_URL=${FRONTEND_URL:-https://group-builder.netlify.app}

# Build container
echo ""
echo "Building container image..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/groupbuilder-api .

# Deploy to Cloud Run
echo ""
echo "Deploying to Cloud Run..."
gcloud run deploy groupbuilder-api \
  --image gcr.io/$PROJECT_ID/groupbuilder-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 4 \
  --timeout 300 \
  --max-instances 10 \
  --set-env-vars "UPSTASH_REDIS_REST_URL=$UPSTASH_REDIS_REST_URL,UPSTASH_REDIS_REST_TOKEN=$UPSTASH_REDIS_REST_TOKEN,CORS_ORIGINS=$FRONTEND_URL"

echo ""
echo "Deployment complete!"
echo ""
echo "Your API is available at:"
gcloud run services describe groupbuilder-api --region us-central1 --format="value(status.url)"
