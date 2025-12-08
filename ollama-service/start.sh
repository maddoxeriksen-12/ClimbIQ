#!/bin/bash
set -e

MODEL="${OLLAMA_MODEL:-phi3:mini}"

# Respect Railway/Heroku-style PORT if provided, otherwise default to 11434
PORT="${PORT:-11434}"

echo "Starting Ollama service with model: $MODEL on port ${PORT}"

# Ensure Ollama binds to the correct host:port for the platform healthcheck
export OLLAMA_HOST="0.0.0.0:${PORT}"

# Start Ollama in the background
ollama serve &
OLLAMA_PID=$!

# Wait for Ollama to be ready
echo "Waiting for Ollama to start..."
for i in {1..30}; do
    if curl -s "http://localhost:${PORT}/api/tags" > /dev/null 2>&1; then
        echo "Ollama is ready!"
        break
    fi
    sleep 1
done

# Verify model is available (pre-baked in image, but check anyway)
if ollama list | grep -q "$MODEL"; then
    echo "Model $MODEL is available"
else
    echo "Warning: Model $MODEL not found, pulling..."
    ollama pull "$MODEL"
fi

echo "Ollama service ready on port ${PORT}"

# Keep the container running
wait $OLLAMA_PID
