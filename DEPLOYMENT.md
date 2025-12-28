# GroupBuilder Deployment Guide

This guide covers deploying GroupBuilder to production using Google Cloud Run for the backend API and Netlify for the frontend.

## Architecture

- **Frontend**: Static React app hosted on Netlify
- **Backend API**: FastAPI on Google Cloud Run (serverless, pay-per-use)
- **Session Storage**: Upstash Redis (serverless Redis)

## Prerequisites

1. Google Cloud account with billing enabled
2. `gcloud` CLI installed ([Install Guide](https://cloud.google.com/sdk/docs/install))
3. Docker installed locally (for testing)
4. Netlify account (free tier works)
5. Upstash account for Redis (free tier works)

## Backend Deployment (Google Cloud Run)

### 1. Initial Setup

```bash
# Login to Google Cloud
gcloud auth login

# Set your project ID (create one at console.cloud.google.com if needed)
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### 2. Set Up Upstash Redis

1. Go to [upstash.com](https://upstash.com) and create a free account
2. Create a new Redis database (Global for best latency)
3. Copy the connection details (you'll need `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`)

### 3. Build and Deploy

From the project root directory:

```bash
# Build the container image (from project root)
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/groupbuilder-api .

# Deploy to Cloud Run
gcloud run deploy groupbuilder-api \
  --image gcr.io/YOUR_PROJECT_ID/groupbuilder-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 4 \
  --timeout 300 \
  --max-instances 10 \
  --set-env-vars "UPSTASH_REDIS_REST_URL=YOUR_UPSTASH_URL,UPSTASH_REDIS_REST_TOKEN=YOUR_UPSTASH_TOKEN,CORS_ORIGINS=https://group-builder.netlify.app"
```

**Important**: Replace `YOUR_PROJECT_ID`, `YOUR_UPSTASH_URL`, and `YOUR_UPSTASH_TOKEN` with your actual values.

### 4. Optional: Set Up SendGrid Email

If you want email functionality:

```bash
gcloud run services update groupbuilder-api \
  --region us-central1 \
  --set-env-vars "SENDGRID_API_KEY=YOUR_KEY,FROM_EMAIL=noreply@yourdomain.com,FRONTEND_URL=https://group-builder.netlify.app"
```

### 5. Note Your API URL

After deployment, you'll get a URL like:
```
https://groupbuilder-api-xxxxx-uc.a.run.app
```

Save this URL - you'll need it for the frontend configuration.

## Frontend Deployment (Netlify)

### 1. Update Frontend API URL

In `frontend/src/pages/LandingPage.tsx`, update the API URL:

```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://groupbuilder-api-xxxxx-uc.a.run.app'
```

Or create a `.env.production` file in the `frontend/` directory:

```bash
VITE_API_URL=https://groupbuilder-api-xxxxx-uc.a.run.app
```

### 2. Deploy to Netlify

**Option A: Connect Git Repository (Recommended)**

1. Go to [netlify.com](https://netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Connect your GitHub repository
4. Configure build settings:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/dist`
5. Add environment variable:
   - Key: `VITE_API_URL`
   - Value: `https://groupbuilder-api-xxxxx-uc.a.run.app`
6. Click "Deploy"

**Option B: Manual Deploy**

```bash
cd frontend

# Install Netlify CLI
npm install -g netlify-cli

# Build the frontend
npm run build

# Deploy
netlify deploy --prod --dir=dist
```

### 3. Update CORS

Once you have your Netlify URL (e.g., `https://group-builder.netlify.app`), update the backend CORS settings:

```bash
gcloud run services update groupbuilder-api \
  --region us-central1 \
  --set-env-vars "CORS_ORIGINS=https://group-builder.netlify.app,https://YOUR-NETLIFY-SITE.netlify.app"
```

## Cost Estimates

### Google Cloud Run (Backend)
- **CPU time**: $0.00002400/vCPU-second
- **Memory**: $0.00000250/GiB-second
- **Requests**: Free for first 2 million/month

**Example**: 50 assignments/month @ 2 min each with 4 vCPU:
- CPU: 50 × 120s × 4 vCPU × $0.000024 = **$0.58/month**
- Memory: 50 × 120s × 2 GiB × $0.0000025 = **$0.03/month**
- **Total: ~$0.60/month**

### Upstash Redis
- Free tier: 10,000 commands/day
- Sufficient for development and moderate production use

### Netlify
- Free tier: Unlimited personal/hobby sites
- 100GB bandwidth/month (more than enough)

**Total estimated cost: $0-5/month** for moderate usage

## Testing the Deployment

```bash
# Test the API health
curl https://groupbuilder-api-xxxxx-uc.a.run.app/api/assignments/

# Should return session storage info
```

Visit your Netlify URL and test the full upload → assignment flow.

## Updating the Deployment

### Backend Updates

```bash
# Rebuild and redeploy (from project root)
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/groupbuilder-api .
gcloud run deploy groupbuilder-api \
  --image gcr.io/YOUR_PROJECT_ID/groupbuilder-api \
  --platform managed \
  --region us-central1
```

### Frontend Updates

If using Netlify Git integration, just push to your main branch. Otherwise:

```bash
cd frontend
npm run build
netlify deploy --prod --dir=dist
```

## Monitoring

View logs and metrics:

```bash
# View recent logs
gcloud run logs read groupbuilder-api --region us-central1 --limit 50

# Or use Cloud Console
# https://console.cloud.google.com/run
```

## Troubleshooting

### Issue: Solver timeouts
**Solution**: Increase timeout and CPU:
```bash
gcloud run services update groupbuilder-api \
  --region us-central1 \
  --timeout 600 \
  --cpu 4 \
  --memory 4Gi
```

### Issue: CORS errors
**Solution**: Verify CORS_ORIGINS includes your frontend URL:
```bash
gcloud run services describe groupbuilder-api --region us-central1 --format="value(spec.template.spec.containers[0].env)"
```

### Issue: Cold starts (first request slow)
**Solution**: Add minimum instances (costs more):
```bash
gcloud run services update groupbuilder-api \
  --region us-central1 \
  --min-instances 1
```

## Performance Tuning

For faster solving on Cloud Run:

1. **Use 4 vCPU** (default in commands above)
2. **Set timeout to 300s** (5 minutes) for complex problems
3. **Monitor solver performance** in logs
4. **Consider caching** results for identical participant lists

## Security

1. Keep environment variables (Redis tokens, SendGrid keys) secret
2. Never commit `.env` files
3. Use Upstash TLS endpoints
4. Review Cloud Run IAM permissions regularly

## Alternative: Local Docker Testing

Test the Docker container locally before deploying:

```bash
# Build
docker build -t groupbuilder-api -f api/Dockerfile .

# Run locally
docker run -p 8080:8080 \
  -e UPSTASH_REDIS_REST_URL=your_url \
  -e UPSTASH_REDIS_REST_TOKEN=your_token \
  groupbuilder-api

# Test
curl http://localhost:8080/api/assignments/
```
