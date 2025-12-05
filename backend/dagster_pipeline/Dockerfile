# Dagster Pipeline Dockerfile - Standalone
# Build context: backend/dagster_pipeline (Railway root directory)
# Version: 2025-12-05-v2 - Force rebuild with daemon support
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

# Create dagster.yaml config with workspace reference
RUN echo 'run_coordinator:' > $DAGSTER_HOME/dagster.yaml && \
    echo '  module: dagster.core.run_coordinator' >> $DAGSTER_HOME/dagster.yaml && \
    echo '  class: QueuedRunCoordinator' >> $DAGSTER_HOME/dagster.yaml && \
    echo '' >> $DAGSTER_HOME/dagster.yaml && \
    echo 'run_launcher:' >> $DAGSTER_HOME/dagster.yaml && \
    echo '  module: dagster.core.launcher' >> $DAGSTER_HOME/dagster.yaml && \
    echo '  class: DefaultRunLauncher' >> $DAGSTER_HOME/dagster.yaml

# Copy workspace.yaml to DAGSTER_HOME
COPY workspace.yaml $DAGSTER_HOME/workspace.yaml

# Copy and setup startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose the Dagster webserver port
EXPOSE 3000

# Default mode is "all" to run both webserver and daemon
ENV DAGSTER_MODE=all

CMD ["/app/start.sh"]

