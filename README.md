# GroupBuilder

**Automated group assignment optimizer for multi-session events.**

[Live app](https://group-builder.netlify.app) · [Report a bug](https://github.com/MarkFrankle/GroupBuilder/issues)

---

## The Problem

Running multi-session dialogue events — interfaith dinners, community seminars, networking series — requires careful table assignments:

- **Diversity matters**: Each table should have balanced representation across religion, gender, and background
- **Couples need separation**: Partners should sit at different tables to encourage broader dialogue
- **Multiple sessions complicate things**: With 3–6 sessions, manually ensuring people meet new tablemates each time becomes combinatorially complex
- **Time is limited**: Event coordinators are volunteers with limited time for spreadsheet gymnastics

GroupBuilder solves this in seconds using constraint programming.

## What it does

GroupBuilder is a login-gated web application for event organizers. Facilitators sign in with a magic link (no password), join a program, and use the app to manage their participant roster and generate optimized seating assignments.

- **Roster management** — Add and edit participants with name, religion, gender, and partner fields directly in the app; or import from an Excel spreadsheet
- **Intelligent assignment** — CP-SAT constraint solver optimizes table assignments across all sessions simultaneously
- **Diversity balancing** — Even distribution of religions and genders across all tables, every session
- **Couple separation** — Partners automatically seated at different tables
- **Multi-session optimization** — Minimizes repeat pairings across sessions, weighted toward early sessions so people keep meeting new tablemates
- **Seating charts** — Circular table visualization with religion color-coding for each session
- **Print-ready output** — Roster print view formatted for facilitator use
- **Session history** — View and compare prior group assignments
- **Multi-program support** — Admin dashboard for creating programs, managing facilitators, and sending invitations

## How it works

GroupBuilder models table assignment as a **constraint satisfaction problem** using Google OR-Tools CP-SAT. Each participant is assigned to exactly one table per session. Hard constraints enforce balanced table sizes and even distribution of religions and genders; couples are never seated together. The solver then minimizes a weighted objective that penalizes repeat pairings across sessions — weighted toward early sessions so the improvement compounds over time.

Typical solve times range from under a second for small events to around two minutes for large ones (100 participants, 10 tables, 6 sessions). The solver returns the best feasible solution found within a 120-second timeout.

## Tech Stack

### Frontend
- **React 18** + **TypeScript** — type-safe SPA (Create React App + craco)
- **TanStack Query** — data fetching and caching
- **Tailwind CSS** + **shadcn/ui** — styling and accessible components
- **Firebase SDK** — passwordless magic-link authentication
- Deployed on **Netlify**

### Backend
- **FastAPI** — Python web framework
- **Pydantic v2** — request validation
- **Firebase Admin SDK** — token verification, Firestore access
- **Google Cloud Firestore** — primary database (programs, rosters, sessions, results)
- **Pandas** + **openpyxl** — Excel roster import
- **SendGrid** — email delivery for magic links (optional)
- Deployed on **Google Cloud Run**

### Assignment Engine
- **Google OR-Tools CP-SAT** — constraint programming solver
- Custom optimization model in `assignment_logic/` (local Poetry package)

## Project Structure

```
GroupBuilder/
├── frontend/                  # React 18 TypeScript SPA
│   └── src/
│       ├── pages/             # All page components (login, roster, assignments, admin, etc.)
│       ├── components/        # Reusable UI components
│       ├── contexts/          # Auth and program context providers
│       ├── services/          # Firebase client, API client
│       └── App.tsx            # Routing
│
├── api/                       # FastAPI backend
│   └── src/api/
│       ├── routers/           # upload, assignments, roster, admin, invites, user
│       ├── middleware/        # Firebase auth verification
│       ├── services/          # Firestore, email, roster logic
│       └── main.py
│
├── assignment_logic/          # Constraint solver (local Poetry dependency of api/)
│   └── src/assignment_logic/
│       ├── group_builder.py   # CP-SAT model
│       └── api_handler.py     # API wrapper
│
├── agent_docs/                # Developer reference docs
├── Dockerfile                 # Cloud Run container
└── deploy.sh                  # Cloud Run deployment script
```

## Development Setup

GroupBuilder requires a Firebase project for auth and Firestore. Local development without Firebase is not currently supported. See [`agent_docs/deployment.md`](agent_docs/deployment.md) for full environment variable setup.

### Prerequisites
- Node.js 18+, npm
- Python 3.10+, Poetry
- A Firebase project with Authentication (Email link sign-in) and Firestore enabled

### Backend

```bash
cd api
poetry install

cd ../assignment_logic
poetry install

cd ../api
poetry run uvicorn src.api.main:app --reload
# API available at http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
npm start
# App available at http://localhost:3000 (proxies /api → :8000)
```

### Running tests

```bash
# Backend
cd api && poetry run pytest --cov=src --cov-report=term-missing

# Assignment solver
cd assignment_logic && poetry run pytest tests/ -v

# Frontend
cd frontend && CI=true npm test -- --watchAll=false
```

## Deployment

- **Backend:** Google Cloud Run — see [`agent_docs/deployment.md`](agent_docs/deployment.md)
- **Frontend:** Netlify — connected to GitHub, auto-deploys on push to `main`
- **Database:** Google Cloud Firestore

---

*Built for [Building Bridges Together](https://buildingbridgestogether.net), a tri-faith interfaith dialogue nonprofit.*
