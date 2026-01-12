# Codebase Structure

## Repository Layout

GroupBuilder is a **monorepo** with three main components:

```
GroupBuilder/
├── frontend/              # React TypeScript UI
├── api/                   # FastAPI backend
├── assignment_logic/      # Constraint solver (separate Python package)
├── docs/                  # Documentation
├── .github/              # GitHub workflows
├── README.md             # Main documentation
├── deploy.sh             # Deployment script
└── Dockerfile            # Docker configuration
```

## Frontend (`/frontend`)

React 18.3 + TypeScript application

```
frontend/
├── src/
│   ├── pages/              # Route components
│   │   ├── LandingPage/   # Upload form, config
│   │   └── ResultsPage/   # Assignment display
│   ├── components/         # Reusable UI components
│   │   ├── ui/            # Radix UI wrappers
│   │   └── ...            # Custom components
│   ├── utils/             # Helper functions
│   ├── config/            # Configuration
│   ├── constants/         # Constants
│   ├── styles/            # Global styles
│   ├── App.tsx            # Main routing
│   └── index.tsx          # Entry point
├── public/
│   ├── template.xlsx      # Excel template for users
│   └── ...                # Static assets
├── package.json           # Dependencies & scripts
├── tsconfig.json          # TypeScript config
├── tailwind.config.js     # Tailwind configuration
└── craco.config.js        # Build customization
```

### Key Frontend Files
- **App.tsx**: React Router setup
- **pages/LandingPage**: Upload form, table/session config
- **pages/ResultsPage**: Display assignments with magic links
- **components/ui/**: Shadcn/Radix UI components

## Backend API (`/api`)

FastAPI Python application

```
api/
├── src/api/
│   ├── main.py            # FastAPI app entry point
│   ├── routers/           # Route handlers
│   │   ├── upload.py     # Excel upload endpoint
│   │   └── assignments.py # Assignment generation
│   └── utils/             # Data transformation helpers
├── tests/                 # API tests
├── pyproject.toml         # Poetry dependencies
├── .env.example          # Environment template
└── GroupBuilderTemplate.xlsx
```

### Key Backend Files
- **main.py**: FastAPI app initialization, CORS, middleware
- **routers/**: Endpoint handlers for upload, assignment generation
- **utils/**: Data validation and transformation

### Dependencies
- `fastapi`, `uvicorn`, `gunicorn`
- `pandas`, `openpyxl` (Excel processing)
- `redis`, `upstash-redis` (optional storage)
- `sendgrid`, `jinja2` (optional email)
- `assignment-logic` (local package)

## Assignment Logic (`/assignment_logic`)

Standalone Python package for constraint programming solver

```
assignment_logic/
├── src/assignment_logic/
│   ├── group_builder.py   # CP-SAT constraint model
│   │   └── GroupBuilder class
│   └── api_handler.py     # Wrapper for API calls
├── tests/                 # Comprehensive test suite
│   ├── test_group_builder.py
│   └── ...
└── pyproject.toml         # Poetry dependencies
```

### Key Assignment Logic Files
- **group_builder.py**: Core OR-Tools CP-SAT model
  - Decision variables: `x[participant, table, session]`
  - Hard constraints: balanced tables, couple separation, diversity
  - Optimization: minimize weighted repeat pairings
- **api_handler.py**: Adapter between API and solver

### Dependencies
- `ortools` (Google OR-Tools for CP-SAT solver)

## Documentation (`/docs`)

```
docs/
└── ... (project documentation)
```

## Configuration Files (Root)

- **README.md**: Comprehensive project documentation
- **TEST_SETUP.md**: Testing setup instructions
- **deploy.sh**: Deployment automation
- **Dockerfile**: Docker container configuration
- **.gitignore**: Git ignore rules
- **.dockerignore**: Docker ignore rules

## Key Relationships

1. **API depends on assignment_logic**: 
   - Defined in `api/pyproject.toml`
   - `assignment-logic = {path = "../assignment_logic"}`

2. **Frontend calls API**:
   - API base URL configured via `REACT_APP_API_BASE_URL`
   - Default: `http://localhost:8000` (dev)

3. **Assignment Logic is independent**:
   - Can be tested and developed standalone
   - No dependencies on API or frontend

## Data Flow

```
User uploads Excel
     ↓
Frontend (React) → API (FastAPI) → Assignment Logic (OR-Tools)
     ↑                                      ↓
Results page   ←   API stores result   ←   Solver returns assignments
```

## Development Workflow

1. **Frontend**: `cd frontend && npm start` (port 3000)
2. **Backend**: `cd api && poetry run uvicorn src.api.main:app --reload` (port 8000)
3. **Solver tests**: `cd assignment_logic && poetry run pytest tests/`

Each component can be developed and tested independently.