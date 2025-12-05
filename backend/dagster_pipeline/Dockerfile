# Dagster Pipeline Dockerfile - Standalone
# Build context: backend/dagster_pipeline (Railway root directory)
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install (paths relative to dagster_pipeline/)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all dagster_pipeline code to /app/dagster_pipeline/
COPY . /app/dagster_pipeline/

# Set environment variables
ENV DAGSTER_HOME=/app/dagster_home
ENV PYTHONPATH=/app
RUN mkdir -p $DAGSTER_HOME

# Create dagster.yaml config
RUN printf 'run_coordinator:\n  module: dagster.core.run_coordinator\n  class: QueuedRunCoordinator\n\nrun_launcher:\n  module: dagster.core.launcher\n  class: DefaultRunLauncher\n' > $DAGSTER_HOME/dagster.yaml

# Copy and setup startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose the Dagster webserver port
EXPOSE 3000

# Default mode is webserver, can be changed via DAGSTER_MODE env var
ENV DAGSTER_MODE=webserver

CMD ["/app/start.sh"]

