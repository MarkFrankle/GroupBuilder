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

Env vars live in three places, each serving a different build/runtime system:

**Netlify env vars** (frontend build-time, baked into JS bundle):
- `CI` — treats warnings as errors
- `REACT_APP_API_BASE_URL` — Cloud Run backend URL
- `REACT_APP_FIREBASE_API_KEY`, `REACT_APP_FIREBASE_AUTH_DOMAIN`, `REACT_APP_FIREBASE_PROJECT_ID`

**GitHub Actions secrets** (CI + backend deploy, injected into Cloud Run at deploy time):
- `GCP_PROJECT_ID`, `GCP_SA_KEY` — for gcloud auth during deploy
- `FIREBASE_PROJECT_ID` — passed to Cloud Run as env var
- `RESEND_API_KEY`, `FROM_EMAIL`, `FRONTEND_URL` — email service config (Resend)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — rate limiting
- `CORS_ORIGINS` — allowed frontend origins
- `REQUIRE_PERSISTENT_STORAGE` — feature flag

**Local dev** (`api/.env`, gitignored): `FIREBASE_SERVICE_ACCOUNT_PATH=../firebase-service-account.json`, `FIREBASE_PROJECT_ID=group-builder-backend`, plus emulator host vars. The service account JSON lives at repo root (gitignored).

**Important:** GitHub Actions secrets become Cloud Run env vars only after a deploy. Updating a secret doesn't affect the running revision — you must redeploy.

## Gotchas

- `gcloud config set project group-builder-backend` — easy to forget if you have other GCP projects
- Cloud Run scales to 0 with no traffic — no logs doesn't mean it's broken, just idle
- Netlify secrets scanner flags `REACT_APP_*` vars baked into JS bundles — these are expected for CRA apps
