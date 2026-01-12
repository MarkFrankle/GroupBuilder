# Suggested Commands for GroupBuilder

## Frontend Commands (from `/frontend` directory)

### Development
```bash
cd frontend
npm install              # Install dependencies
npm start                # Start dev server at http://localhost:3000
npm run build           # Production build
npm test                # Run tests
npm run lint            # Run ESLint (max 0 warnings)
```

### Configuration
- TypeScript strict mode enabled
- ESLint config: react-app preset
- Tailwind CSS for styling
- Path alias: `@/*` maps to `src/*`

## Backend API Commands (from `/api` directory)

### Development
```bash
cd api
poetry install                                    # Install dependencies
poetry run uvicorn src.api.main:app --reload    # Start dev server at http://localhost:8000
poetry run pytest tests/ -v                      # Run tests
poetry run pytest tests/ -v --cov               # Run tests with coverage
poetry run black src/                           # Format code
```

### Optional: Redis Setup (for persistent storage)
```bash
# Local Redis with Docker
docker run -d -p 6379:6379 redis:7-alpine

# Configure
cd api
echo 'REDIS_URL=redis://localhost:6379' > .env
```

### Optional: SendGrid Setup (for email delivery)
```bash
cd api
# Add to .env file:
# SENDGRID_API_KEY=your_key
# FROM_EMAIL=noreply@groupbuilder.app
# FRONTEND_URL=https://your-app.netlify.app
```

## Assignment Logic Commands (from `/assignment_logic` directory)

### Development
```bash
cd assignment_logic
poetry install              # Install dependencies
poetry run pytest tests/ -v # Run tests
poetry run black src/       # Format code
poetry run flake8 src/      # Lint code
poetry run mypy src/        # Type check
```

## Git Commands (macOS/Darwin)
```bash
git status                  # Check status
git add .                   # Stage all changes
git commit -m "message"     # Commit changes
git push                    # Push to remote
git pull                    # Pull from remote
git branch                  # List branches
git checkout -b branch-name # Create new branch
```

## System Commands (macOS/Darwin)
```bash
ls -la                      # List files (including hidden)
cd path/to/dir             # Change directory
pwd                        # Print working directory
grep -r "pattern" .        # Search for pattern recursively
find . -name "*.py"        # Find files by name
cat file.txt               # Display file contents
open .                     # Open current directory in Finder
```

## Deployment

### Frontend (Netlify)
- Build command: `cd frontend && npm run build`
- Publish directory: `frontend/build`
- Environment variable: `REACT_APP_API_BASE_URL`

### Backend (Fly.io)
```bash
cd api
fly launch                  # Initialize
fly deploy                  # Deploy
fly secrets set KEY=value   # Set secrets
```