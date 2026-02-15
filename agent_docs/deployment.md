# Deployment

## Backend — Google Cloud Run

- GCP project: `group-builder-backend`
- Service: `groupbuilder-api` in `us-central1`
- URL: `https://groupbuilder-api-14805309006.us-central1.run.app`
- Compute SA: `14805309006-compute@developer.gserviceaccount.com`
- GitHub Actions SA: `github-actions@group-builder-backend.iam.gserviceaccount.com`
- Uses Application Default Credentials (ADC) — no service account JSON in the container
- Deploy: `gcloud config set project group-builder-backend` then `./deploy.sh`, or push to trigger GitHub Actions
- `deploy.sh` and root `Dockerfile` handle the build

## Frontend — Netlify

- Site: `group-builder.netlify.app`
- SPA routing via `frontend/public/_redirects` (`/* /index.html 200`)
- Env vars set in Netlify UI: `REACT_APP_API_BASE_URL`, `REACT_APP_FIREBASE_*`, `CI`
- Firebase client API keys are public project identifiers (not secrets) — uncheck "Contains secret" on Firebase env vars in Netlify, or use `SECRETS_SCAN_OMIT_KEYS`

## API Calls in Prod

- `authenticatedFetch()` in `frontend/src/utils/apiClient.ts` prepends `REACT_APP_API_BASE_URL` to relative `/api/*` paths
- Always use relative paths like `/api/foo` in frontend code — the base URL is resolved at runtime
- Dev: CRA proxy (`frontend/package.json` `"proxy"`) forwards `/api/*` to localhost:8000
- Prod: `REACT_APP_API_BASE_URL` points to Cloud Run

## Environment Setup

**Frontend** (`frontend/.env`, checked in): `REACT_APP_FIREBASE_API_KEY`, `REACT_APP_FIREBASE_AUTH_DOMAIN`, `REACT_APP_FIREBASE_PROJECT_ID`

**Backend** (`api/.env`, gitignored): `FIREBASE_SERVICE_ACCOUNT_PATH=../firebase-service-account.json`, `FIREBASE_PROJECT_ID=group-builder-backend`. The service account JSON lives at repo root (gitignored).

## Gotchas

- `gcloud config set project group-builder-backend` — easy to forget if you have other GCP projects
- Cloud Run scales to 0 with no traffic — no logs doesn't mean it's broken, just idle
- Netlify secrets scanner flags `REACT_APP_*` vars baked into JS bundles — these are expected for CRA apps
