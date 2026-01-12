# Task Completion Checklist

When completing a coding task in GroupBuilder, follow this checklist to ensure quality and consistency:

## 1. Code Quality

### TypeScript/React (Frontend)
- [ ] **Type safety**: All functions have proper type annotations
- [ ] **Linting**: Run `npm run lint` (must pass with 0 warnings)
- [ ] **No console errors**: Check browser console for errors
- [ ] **Component structure**: Follow functional component patterns
- [ ] **Accessibility**: Ensure Radix UI patterns are maintained

### Python (Backend/Assignment Logic)
- [ ] **Type hints**: All function parameters and return types annotated
- [ ] **Formatting**: Run `poetry run black src/` (if in assignment_logic)
- [ ] **Linting**: Run `poetry run flake8 src/` (if in assignment_logic)
- [ ] **Type checking**: Run `poetry run mypy src/` (if in assignment_logic)

## 2. Testing

### Frontend
- [ ] **Manual testing**: Test the feature in the browser
- [ ] **User interactions**: Verify forms, buttons, navigation work correctly
- [ ] **Responsive design**: Check mobile/tablet layouts if UI changed
- [ ] **Error states**: Test error handling and edge cases

### Backend
- [ ] **Run tests**: `cd api && poetry run pytest tests/ -v`
- [ ] **Coverage check**: `poetry run pytest tests/ -v --cov` (if significant logic changes)
- [ ] **API testing**: Test endpoints manually or with httpx

### Assignment Logic
- [ ] **Run full test suite**: `cd assignment_logic && poetry run pytest tests/ -v`
- [ ] **Test coverage**: Ensure new logic has corresponding tests
- [ ] **Performance**: Verify solver performance hasn't degraded

## 3. Integration Testing

- [ ] **End-to-end flow**: Test complete user journey (upload → generate → view results)
- [ ] **API connectivity**: Ensure frontend correctly calls backend
- [ ] **Error handling**: Test failure scenarios (invalid Excel, solver timeout, etc.)

## 4. Documentation

- [ ] **Code comments**: Add comments for complex/non-obvious logic
- [ ] **README updates**: Update README.md if user-facing features changed
- [ ] **API docs**: Update endpoint documentation if API changed
- [ ] **Memory files**: Update Serena memory files if significant architecture changes

## 5. Git Hygiene

- [ ] **Clean commits**: Commit messages are clear and descriptive
- [ ] **Branch naming**: Use descriptive branch names
- [ ] **No secrets**: Ensure no API keys or credentials in code
- [ ] **Gitignore**: Verify build artifacts, .env, etc. are ignored

## 6. Performance & Security

- [ ] **No performance regressions**: Changes don't slow down critical paths
- [ ] **Security review**: No SQL injection, XSS, or other OWASP vulnerabilities
- [ ] **Input validation**: User inputs are properly validated
- [ ] **Error messages**: Don't leak sensitive information in errors

## 7. Deployment Readiness (if applicable)

### Frontend (Netlify)
- [ ] **Build succeeds**: `npm run build` completes without errors
- [ ] **Environment variables**: Check if new env vars needed
- [ ] **Build output**: Verify build size is reasonable

### Backend (Fly.io)
- [ ] **Dependencies updated**: `poetry.lock` is up to date
- [ ] **Environment variables**: Document any new required env vars
- [ ] **Migrations**: Any database/storage schema changes handled

## Quick Reference Commands

```bash
# Frontend checks
cd frontend
npm run lint
npm test
npm run build

# Backend checks  
cd api
poetry run pytest tests/ -v

# Assignment logic checks
cd assignment_logic
poetry run black src/
poetry run flake8 src/
poetry run mypy src/
poetry run pytest tests/ -v
```

## Notes

- **Not all items apply to every task**: Use judgment
- **Critical paths**: Pay extra attention to assignment generation, data validation, file upload
- **User experience**: Always test as if you're the end user
- **Ask for help**: If unsure about any step, ask the user or check documentation