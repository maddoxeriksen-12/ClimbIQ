#!/bin/bash
# Dagster Startup Script
# Supports running either the webserver or daemon based on DAGSTER_MODE env var

set -e

# Default mode is "all" to run both webserver and daemon
MODE=${DAGSTER_MODE:-all}
PORT=${PORT:-3000}
WORKSPACE_FILE="/app/dagster_pipeline/workspace.yaml"

echo "Starting Dagster in $MODE mode..."
echo "Using workspace: $WORKSPACE_FILE"

if [ "$MODE" = "daemon" ]; then
    echo "Running Dagster Daemon (sensors, schedules, run monitoring)"
    exec dagster-daemon run -w $WORKSPACE_FILE
elif [ "$MODE" = "webserver" ]; then
    echo "Running Dagster Webserver on port $PORT"
    exec dagster-webserver -h 0.0.0.0 -p $PORT -w $WORKSPACE_FILE
elif [ "$MODE" = "all" ]; then
    echo "Running both Webserver and Daemon"
    # Start daemon in background with workspace
    dagster-daemon run -w $WORKSPACE_FILE &
    DAEMON_PID=$!
    echo "Daemon started with PID: $DAEMON_PID"
    # Give daemon time to start
    sleep 2
    # Start webserver in foreground
    exec dagster-webserver -h 0.0.0.0 -p $PORT -w $WORKSPACE_FILE
else
    echo "Unknown mode: $MODE"
    echo "Valid modes: webserver, daemon, all"
    exit 1
fi

