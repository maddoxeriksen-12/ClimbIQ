#!/bin/bash
# Dagster Startup Script
# Supports running either the webserver or daemon based on DAGSTER_MODE env var

set -e

# Default mode is webserver
MODE=${DAGSTER_MODE:-webserver}
PORT=${PORT:-3000}

echo "Starting Dagster in $MODE mode..."

if [ "$MODE" = "daemon" ]; then
    echo "Running Dagster Daemon (sensors, schedules, run monitoring)"
    exec dagster-daemon run
elif [ "$MODE" = "webserver" ]; then
    echo "Running Dagster Webserver on port $PORT"
    exec dagster-webserver -h 0.0.0.0 -p $PORT -m dagster_pipeline
elif [ "$MODE" = "all" ]; then
    echo "Running both Webserver and Daemon (development mode)"
    # Start daemon in background
    dagster-daemon run &
    # Start webserver in foreground
    exec dagster-webserver -h 0.0.0.0 -p $PORT -m dagster_pipeline
else
    echo "Unknown mode: $MODE"
    echo "Valid modes: webserver, daemon, all"
    exit 1
fi

