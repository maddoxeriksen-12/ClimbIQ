# Dagster Pipeline Dockerfile - Standalone
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy ONLY Dagster requirements (not the full backend requirements)
COPY dagster_pipeline/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy ONLY the dagster_pipeline module
COPY dagster_pipeline/ /app/dagster_pipeline/

# Set environment variables
ENV DAGSTER_HOME=/app/dagster_home
ENV PYTHONPATH=/app
RUN mkdir -p $DAGSTER_HOME

# Create dagster.yaml config
RUN printf 'run_coordinator:\n  module: dagster.core.run_coordinator\n  class: QueuedRunCoordinator\n\nrun_launcher:\n  module: dagster.core.launcher\n  class: DefaultRunLauncher\n' > $DAGSTER_HOME/dagster.yaml

# Copy and setup startup script
COPY dagster_pipeline/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose the Dagster webserver port
EXPOSE 3000

# Default mode is webserver, can be changed via DAGSTER_MODE env var
ENV DAGSTER_MODE=webserver

CMD ["/app/start.sh"]

