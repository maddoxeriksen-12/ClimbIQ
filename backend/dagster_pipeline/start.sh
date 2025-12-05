#!/bin/bash
# Dagster Startup Script
# Supports running either the webserver or daemon based on DAGSTER_MODE env var

set -e

# Default mode is "all" to run both webserver and daemon
MODE=${DAGSTER_MODE:-all}
PORT=${PORT:-3000}
WORKSPACE_FILE="${DAGSTER_HOME}/workspace.yaml"

echo "=========================================="
echo "Starting Dagster in $MODE mode..."
echo "DAGSTER_HOME: $DAGSTER_HOME"
echo "PYTHONPATH: $PYTHONPATH"
echo "Workspace file: $WORKSPACE_FILE"
echo "=========================================="

# Verify workspace file exists
if [ ! -f "$WORKSPACE_FILE" ]; then
    echo "ERROR: Workspace file not found at $WORKSPACE_FILE"
    ls -la $DAGSTER_HOME/
    exit 1
fi

if [ "$MODE" = "daemon" ]; then
    echo "Running Dagster Daemon (sensors, schedules, run monitoring)"
    exec dagster-daemon run -w $WORKSPACE_FILE
elif [ "$MODE" = "webserver" ]; then
    echo "Running Dagster Webserver on port $PORT"
    exec dagster-webserver -h 0.0.0.0 -p $PORT -w $WORKSPACE_FILE
elif [ "$MODE" = "all" ]; then
    echo "Running both Webserver and Daemon"
    
    # Start daemon in background with workspace
    echo "Starting daemon..."
    dagster-daemon run -w $WORKSPACE_FILE &
    DAEMON_PID=$!
    echo "Daemon started with PID: $DAEMON_PID"
    
    # Give daemon time to initialize
    sleep 3
    
    # Check if daemon is still running
    if ps -p $DAEMON_PID > /dev/null; then
        echo "Daemon is running successfully"
    else
        echo "WARNING: Daemon may have crashed, check logs"
    fi
    
    # Start webserver in foreground
    echo "Starting webserver on port $PORT..."
    exec dagster-webserver -h 0.0.0.0 -p $PORT -w $WORKSPACE_FILE
else
    echo "Unknown mode: $MODE"
    echo "Valid modes: webserver, daemon, all"
    exit 1
fi

