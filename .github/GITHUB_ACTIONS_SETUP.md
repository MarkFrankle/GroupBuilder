# GitHub Actions Auto-Deploy Setup

This guide explains how to set up automatic Cloud Run deployments when you merge to the `main` branch.

## Overview

The workflow `.github/workflows/deploy-backend.yml` automatically:
1. Builds the Docker container
2. Pushes it to Google Container Registry (GCR)
3. Deploys to Cloud Run with all environment variables

This triggers on any push to `main` that affects:
- `api/**`
- `assignment_logic/**`
- `Dockerfile`
- `.dockerignore`
- The workflow file itself

## Required GitHub Secrets

You need to configure these secrets in your GitHub repository:

### 1. Navigate to Secrets Settings

1. Go to your repository: https://github.com/MarkFrankle/GroupBuilder
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** for each secret below

### 2. Create Service Account Key

First, create a service account with deployment permissions:

```bash
# Set your project ID
PROJECT_ID="your-project-id"

# Create service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Deployment" \
  --project=$PROJECT_ID

# Grant necessary permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Create and download key
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions@${PROJECT_ID}.iam.gserviceaccount.com

# Display the key (copy this entire JSON output)
cat github-actions-key.json

# IMPORTANT: Delete the file after copying
rm github-actions-key.json
```

### 3. Add GitHub Secrets

Add each of these secrets in GitHub Settings → Secrets and variables → Actions:

#### `GCP_PROJECT_ID`
Your Google Cloud project ID (e.g., `groupbuilder-prod-12345`)

#### `GCP_SA_KEY`
The entire JSON content from the service account key file you created above.
Paste the full JSON including the curly braces.

#### `UPSTASH_REDIS_REST_URL`
Your Upstash Redis REST URL (e.g., `https://your-db.upstash.io`)
Get this from: https://console.upstash.com/

#### `UPSTASH_REDIS_REST_TOKEN`
Your Upstash Redis REST token
Get this from: https://console.upstash.com/

#### `FRONTEND_URL`
Your Netlify frontend URL (e.g., `https://group-builder.netlify.app`)
This is used for CORS configuration.

#### `FROM_EMAIL` (Optional)
Email address for SendGrid "from" field (e.g., `noreply@yourdomain.com`)
Only needed if using email functionality.

#### `SENDGRID_API_KEY` (Optional)
Your SendGrid API key for sending emails
Only needed if using email functionality.
Get this from: https://app.sendgrid.com/settings/api_keys

## Testing the Workflow

Once secrets are configured:

1. Make a small change to the backend code (e.g., update a comment in `api/src/api/main.py`)
2. Commit and push to a feature branch
3. Create a pull request to `main`
4. Merge the PR
5. Watch the deployment:
   - Go to **Actions** tab in GitHub
   - Click on the latest workflow run
   - Monitor the build and deploy steps

## Workflow Behavior

- **Triggers**: Only on pushes to `main` that change backend files
- **Duration**: Typically 3-5 minutes (build + deploy)
- **Image Tags**: Uses git SHA for versioning + `latest` tag
- **Region**: Deploys to `us-central1`
- **Resources**: 2Gi memory, 4 vCPUs, 300s timeout

## Troubleshooting

### "Permission denied" errors

The service account needs these roles:
- `roles/run.admin` - Deploy to Cloud Run
- `roles/storage.admin` - Push to GCR
- `roles/iam.serviceAccountUser` - Act as service account

Re-run the permission commands above if needed.

### "Image not found" errors

Make sure Cloud Build API is enabled:
```bash
gcloud services enable cloudbuild.googleapis.com --project=$PROJECT_ID
```

### Environment variables not updating

The workflow sets env vars on every deploy. If you change a secret value:
1. Update the GitHub secret
2. Trigger a new deploy (push to main or manually re-run the workflow)

### Manual workflow trigger

To manually trigger a deployment without code changes:
1. Go to **Actions** tab
2. Select **Deploy Backend to Cloud Run**
3. Click **Run workflow**
4. Choose the `main` branch

## Cost Implications

- **GitHub Actions**: 2,000 free minutes/month (this uses ~5 min/deploy)
- **Cloud Build**: Free tier: 120 build-minutes/day (this uses ~2 min/build)
- **GCR Storage**: $0.026/GB-month (image is ~500MB = ~$0.01/month)
- **Cloud Run**: Pay per use (see DEPLOYMENT.md)

**Total CI/CD cost: $0-1/month** for typical usage.

## Security Best Practices

1. **Never commit the service account key file** - It's in `.gitignore`
2. **Rotate keys periodically** - Create new key, update secret, delete old key
3. **Minimal permissions** - Service account only has deployment permissions
4. **Audit logs** - Review Cloud Run deployment logs regularly

## Disabling Auto-Deploy

To temporarily disable:
1. Go to `.github/workflows/deploy-backend.yml`
2. Comment out or delete the workflow file
3. Commit and push

Or disable in GitHub:
1. **Settings** → **Actions** → **General**
2. Toggle workflow permissions or disable Actions

## Manual Deployment

The `deploy.sh` script still works for manual deployments:
```bash
./deploy.sh
```

## Comparison to deploy.sh

| Feature | deploy.sh | GitHub Actions |
|---------|-----------|----------------|
| Trigger | Manual | Automatic on merge |
| Environment | Local machine | GitHub servers |
| Secrets | Environment vars | GitHub Secrets |
| Consistency | Depends on local setup | Always same environment |
| Audit | No logs | Full workflow logs |
