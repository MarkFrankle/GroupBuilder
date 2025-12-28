# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install poetry
RUN pip install poetry==1.8.2

# Copy assignment_logic package first (dependency)
COPY assignment_logic/ /app/assignment_logic/

# Copy API files
COPY api/pyproject.toml api/poetry.lock /app/

# Install dependencies (no dev dependencies, no virtualenv in container)
RUN poetry config virtualenvs.create false \
    && poetry install --no-dev --no-interaction --no-ansi

# Copy API source code
COPY api/src/ /app/src/

# Expose port 8080 (Cloud Run default)
EXPOSE 8080

# Set environment variables
ENV PORT=8080
ENV PYTHONUNBUFFERED=1

# Run with uvicorn (single worker for Cloud Run autoscaling)
CMD exec uvicorn src.api.main:app --host 0.0.0.0 --port ${PORT} --workers 1
