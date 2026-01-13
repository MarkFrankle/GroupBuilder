# GroupBuilder - Project Overview

## Purpose
GroupBuilder is an automated table assignment optimizer for multi-session interfaith dialogues and seminars. It helps event organizers create balanced, diverse table assignments across multiple sessions using constraint programming.

## Key Features
- Intelligent assignment using Google OR-Tools CP-SAT solver
- Diversity balancing (religion, gender, etc.)
- Couple separation (partners at different tables)
- Multi-session optimization (minimizes repeat pairings)
- Excel-based workflow (upload spreadsheet, download assignments)
- Magic links for bookmarkable results (30-day validity)
- Fast solver (handles 100 participants, 10 tables, 6 sessions in <2 minutes)

## Tech Stack

### Frontend
- **React 18.3** with TypeScript
- **Tailwind CSS** for styling
- **Radix UI** for accessible components
- **React Router 6** for client-side routing
- **CRACO** for custom build config
- Build tool: Create React App with CRACO
- Deployment: Netlify

### Backend
- **FastAPI** (Python 3.10+)
- **Pandas** for Excel file processing
- **Pydantic** for validation
- **Uvicorn/Gunicorn** as ASGI server
- **Poetry** for dependency management
- Deployment: Fly.io

### Assignment Engine
- **Google OR-Tools** CP-SAT solver
- Custom constraint programming model
- Separate module: `assignment_logic`

### Infrastructure
- **Redis/Upstash Redis** (optional) for persistent storage
- **SendGrid** (optional) for email delivery
- Default: In-memory storage (results expire after 30 days)

## Use Cases
- Interfaith dialogue events
- Professional networking mixers
- Educational seminars with discussion groups
- Community building events
- Corporate team building offsites