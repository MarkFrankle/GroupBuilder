# GroupBuilder Deployment Guide

This guide covers deploying GroupBuilder to production using Google Cloud Run for the backend API and Netlify for the frontend.

## Architecture

- **Frontend**: Static React app hosted on Netlify
- **Backend API**: FastAPI on Google Cloud Run (serverless, pay-per-use)
- **Session Storage**: Upstash Redis (serverless Redis)
- **Container Registry**: Google Artifact Registry

## Prerequisites

1. Google Cloud account with billing enabled
2. `gcloud` CLI installed ([Install Guide](https://cloud.google.com/sdk/docs/install))
3. Netlify account (free tier works)
4. Upstash account for Redis (free tier works)

## Backend Deployment (Google Cloud Run)

### 1. Initial Google Cloud Setup

```bash
# Login to Google Cloud
gcloud auth login

# Set your project ID (use existing or create at console.cloud.google.com)
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### 2. Create Artifact Registry Repository

```bash
# Create a Docker repository in Artifact Registry
gcloud artifacts repositories create groupbuilder \
  --repository-format=docker \
  --location=us-central1 \
  --description="GroupBuilder API container images"

# Configure permissions for Cloud Build
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)')
gcloud artifacts repositories add-iam-policy-binding groupbuilder \
  --location=us-central1 \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```

### 3. Set Up Upstash Redis

1. Go to [upstash.com](https://upstash.com) and create a free account
2. Create a new Redis database (Global for best latency)
3. Copy the REST API credentials:
   - **UPSTASH_REDIS_REST_URL**: `https://your-db.upstash.io`
   - **UPSTASH_REDIS_REST_TOKEN**: Your token

### 4. Store Secrets in Secret Manager

```bash
# Store the Redis token securely
echo -n "YOUR_UPSTASH_REDIS_REST_TOKEN" | gcloud secrets create upstash-redis-token --data-file=-

# Grant Cloud Run service account access to the secret
gcloud secrets add-iam-policy-binding upstash-redis-token \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 5. Build and Deploy

From the project root directory:

```bash
# Build the container image
gcloud builds submit --tag us-central1-docker.pkg.dev/YOUR_PROJECT_ID/groupbuilder/api .

# Deploy to Cloud Run
gcloud run deploy groupbuilder-api \
  --image us-central1-docker.pkg.dev/YOUR_PROJECT_ID/groupbuilder/api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 4 \
  --timeout 300 \
  --max-instances 10 \
  --set-env-vars "UPSTASH_REDIS_REST_URL=YOUR_UPSTASH_URL,CORS_ORIGINS=https://group-builder.netlify.app" \
  --set-secrets "UPSTASH_REDIS_REST_TOKEN=upstash-redis-token:latest"
```

**Important**: Replace `YOUR_PROJECT_ID` and `YOUR_UPSTASH_URL` with your actual values.

### 6. Note Your API URL

After deployment, you'll get a URL like:
```
https://groupbuilder-api-XXXXXXXXXX.us-central1.run.app
```

Save this URL - you'll need it for the frontend configuration.

### 7. Optional: Set Up SendGrid Email

If you want email functionality:

```bash
# Store SendGrid API key in Secret Manager
echo -n "YOUR_SENDGRID_API_KEY" | gcloud secrets create sendgrid-api-key --data-file=-
gcloud secrets add-iam-policy-binding sendgrid-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Update the service with email configuration
gcloud run services update groupbuilder-api \
  --region us-central1 \
  --set-env-vars "FROM_EMAIL=noreply@yourdomain.com,FRONTEND_URL=https://group-builder.netlify.app" \
  --set-secrets "SENDGRID_API_KEY=sendgrid-api-key:latest"
```

## Frontend Deployment (Netlify)

### 1. Deploy to Netlify

**Option A: Connect Git Repository (Recommended)**

1. Go to [netlify.com](https://netlify.com) and sign in
2. Click "Add new site" → "Import an existing project"
3. Connect your GitHub repository
4. Configure build settings:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/build`
5. Add environment variable:
   - Go to **Site settings** → **Environment variables**
   - Key: `REACT_APP_API_BASE_URL`
   - Value: `https://groupbuilder-api-XXXXXXXXXX.us-central1.run.app`
6. Click "Deploy site"

**Option B: Manual Deploy**

```bash
cd frontend

# Install Netlify CLI
npm install -g netlify-cli

# Build the frontend
npm run build

# Deploy
netlify deploy --prod --dir=build
```

### 2. Update CORS

Once you have your Netlify URL (e.g., `https://group-builder.netlify.app`), update the backend CORS settings if needed:

```bash
gcloud run services update groupbuilder-api \
  --region us-central1 \
  --set-env-vars "CORS_ORIGINS=https://group-builder.netlify.app"
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

For occasional use (10-20 assignments/month), costs are typically **under $0.20/month**.

### Upstash Redis
- Free tier: 10,000 commands/day
- Sufficient for moderate production use

### Netlify
- Free tier: Unlimited personal/hobby sites
- 100GB bandwidth/month (more than enough)

**Total estimated cost: $0-1/month** for moderate usage

## Testing the Deployment

```bash
# Test the API health
curl https://groupbuilder-api-XXXXXXXXXX.us-central1.run.app/

# Test with a simple GET request
curl https://groupbuilder-api-XXXXXXXXXX.us-central1.run.app/api/assignments/
```

Visit your Netlify URL and test the full upload → assignment flow.

## Updating the Deployment

### Backend Updates

```bash
# Rebuild and redeploy (from project root)
gcloud builds submit --tag us-central1-docker.pkg.dev/YOUR_PROJECT_ID/groupbuilder/api .

gcloud run deploy groupbuilder-api \
  --image us-central1-docker.pkg.dev/YOUR_PROJECT_ID/groupbuilder/api \
  --platform managed \
  --region us-central1
```

### Frontend Updates

If using Netlify Git integration, just push to your main branch and it auto-deploys. Otherwise:

```bash
cd frontend
npm run build
netlify deploy --prod --dir=build
```

## Monitoring

View logs and metrics:

```bash
# View recent logs
gcloud run logs read groupbuilder-api --region us-central1 --limit 50

# Follow logs in real-time
gcloud run logs tail groupbuilder-api --region us-central1

# Or use Cloud Console
# https://console.cloud.google.com/run
```

### Solver Performance Metrics

Logs include detailed solver metrics:
```
Solver [20p/4t/6s]: FEASIBLE in 120.03s | Deviation: 840 | Branches: 1,264,698 | Conflicts: 736,141
```

- **[20p/4t/6s]**: Problem size (participants/tables/sessions)
- **FEASIBLE/OPTIMAL**: Solution quality
- **Deviation**: Total constraint deviation (lower is better)
- **Branches**: Search tree nodes explored
- **Conflicts**: Solver conflicts encountered

## Troubleshooting

### Issue: Container build fails with path dependency error

**Error**: `Path /assignment_logic for assignment-logic does not exist`

**Solution**: The Dockerfile correctly handles the path dependency by copying `assignment_logic/` to `/assignment_logic/` and installing it via Poetry. Ensure you're running the build from the project root directory.

### Issue: CORS errors in frontend

**Symptoms**: Network errors when uploading files or fetching results

**Solution**: Verify CORS_ORIGINS includes your Netlify URL:
```bash
gcloud run services describe groupbuilder-api \
  --region us-central1 \
  --format="value(spec.template.spec.containers[0].env)" | grep CORS
```

Update if needed:
```bash
gcloud run services update groupbuilder-api \
  --region us-central1 \
  --set-env-vars "CORS_ORIGINS=https://group-builder.netlify.app"
```

### Issue: Solver timeouts on large problems

**Current**: 120s timeout with 4 vCPUs (good UX sweet spot for most use cases)

**For larger problems**: Consider adding a "beefiness slider" in the frontend that allows users to opt into longer solve times.

**Temporary workaround**: Update timeout for specific large runs:
```bash
gcloud run services update groupbuilder-api \
  --region us-central1 \
  --timeout 300
```

### Issue: Module import errors

**Error**: `ModuleNotFoundError: No module named 'api'`

**Solution**: The Dockerfile sets `PYTHONPATH=/app/src` which allows imports like `from api.routers import...` to work correctly. Ensure the Dockerfile hasn't been modified incorrectly.

### Issue: Cold starts (first request slow)

**Symptoms**: First request takes 5-10 seconds

**Solution**: This is normal for serverless - the container is starting up. For production with frequent use, consider adding minimum instances (costs more):
```bash
gcloud run services update groupbuilder-api \
  --region us-central1 \
  --min-instances 1
```

## Performance Tuning

Current optimized configuration:
- **4 vCPUs**: Parallel search with 4 workers
- **2 GiB memory**: More than sufficient (typically uses ~400MB)
- **120s timeout**: Good UX balance for most problems
- **Symmetry breaking**: Reduces search space by ~40%
- **Optimized solver parameters**: Tuned for Cloud Run

### Memory Optimization

Since actual usage is ~20% of allocated memory, you can reduce costs:
```bash
gcloud run services update groupbuilder-api \
  --region us-central1 \
  --memory 1Gi
```

### Future Enhancements

- **Beefiness slider**: Let users choose solve time (30s, 120s, 300s)
- **Result caching**: Cache assignments for identical participant lists
- **Progressive solving**: Return intermediate results while optimizing

## Security Best Practices

1. **Secrets**: All sensitive data (Redis tokens, SendGrid keys) stored in Secret Manager
2. **Environment variables**: Never commit `.env` files to git
3. **TLS**: Upstash Redis uses TLS by default
4. **Authentication**: Consider adding authentication for production use
5. **IAM**: Review Cloud Run and Secret Manager IAM permissions regularly
6. **CORS**: Only allow trusted frontend domains

## Local Development

Test the production Docker container locally:

```bash
# Build
docker build -t groupbuilder-api .

# Run with environment variables
docker run -p 8080:8080 \
  -e UPSTASH_REDIS_REST_URL=https://your-db.upstash.io \
  -e UPSTASH_REDIS_REST_TOKEN=your_token \
  -e CORS_ORIGINS=http://localhost:3000 \
  groupbuilder-api

# Test
curl http://localhost:8080/api/assignments/
```

Or use the development setup:
```bash
# Backend
cd api
poetry install
poetry run uvicorn src.api.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm start
```

## Support

For issues or questions:
- Check Cloud Run logs: `gcloud run logs read groupbuilder-api --region us-central1`
- Review this deployment guide
- Check GitHub issues
