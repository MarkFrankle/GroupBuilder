# Code Style and Conventions

## TypeScript/React (Frontend)

### Configuration
- **TypeScript**: Strict mode enabled
- **Target**: ES5
- **Module**: ESNext
- **JSX**: react-jsx

### Style Guidelines
- Use **functional components** with hooks (React 18.3)
- **Type annotations** for all function parameters and return types
- **Strict null checks** enabled
- **Path aliases**: Use `@/*` for imports from `src/`
- **Component naming**: PascalCase for components
- **File naming**: PascalCase for component files (.tsx)

### Linting
- ESLint with `react-app` preset
- **Max warnings**: 0 (enforced in npm scripts)
- Run: `npm run lint`

### Styling
- **Tailwind CSS** utility-first approach
- **Radix UI** for accessible primitives
- **CVA** (class-variance-authority) for component variants
- **clsx** and **tailwind-merge** for conditional classes

### Code Organization
```
src/
├── pages/         # Route components
├── components/    # Reusable UI components
├── utils/         # Helper functions
├── config/        # Configuration
├── constants/     # Constants
└── styles/        # Global styles
```

## Python (Backend & Assignment Logic)

### Configuration
- **Python version**: 3.10+
- **Package manager**: Poetry
- **Type checking**: MyPy (assignment_logic)
- **Formatting**: Black (default settings)
- **Linting**: Flake8 (assignment_logic)

### Style Guidelines
- Follow **PEP 8** conventions
- Use **Black** for automatic formatting (line length: 88)
- **Type hints** for all function parameters and return types
- **Docstrings** for public APIs (not mandatory for internal functions)
- **Snake_case** for variables and functions
- **PascalCase** for classes

### API Conventions (FastAPI)
- Use **Pydantic** models for request/response validation
- **Type hints** on all endpoint functions
- **Async/await** for async operations
- **Dependency injection** for shared resources
- **Router-based organization** for endpoints

### Assignment Logic
- **Constraint Programming** with OR-Tools CP-SAT
- Extensive **pytest** test coverage
- **Type checking** with MyPy enforced
- Focus on **performance** and **correctness**

### Code Organization
```
api/src/api/
├── main.py        # FastAPI app
├── routers/       # Route handlers
└── utils/         # Helper functions

assignment_logic/src/assignment_logic/
├── group_builder.py   # CP-SAT model
├── api_handler.py     # API wrapper
└── tests/            # Test suite
```

## General Conventions

### Naming
- **Constants**: UPPER_SNAKE_CASE
- **Variables**: camelCase (TS), snake_case (Python)
- **Functions**: camelCase (TS), snake_case (Python)
- **Classes**: PascalCase (both)
- **Private members**: prefix with `_` (Python)

### Comments
- Write **self-documenting code** first
- Add comments for **complex logic** or **non-obvious decisions**
- Avoid **redundant comments** that just restate the code

### Testing
- **Frontend**: Jest + React Testing Library
- **Backend**: pytest with coverage
- **Assignment Logic**: pytest with comprehensive test suite
- Aim for **high coverage** on critical paths

### Git Commits
- Use **conventional commits** format when possible
- Clear, descriptive commit messages
- Reference issue numbers where applicable