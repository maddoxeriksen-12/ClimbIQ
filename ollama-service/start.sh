#!/bin/bash
set -e

MODEL="${OLLAMA_MODEL:-phi3:mini}"
echo "Starting Ollama service with model: $MODEL"

# Start Ollama in the background
ollama serve &
OLLAMA_PID=$!

# Wait for Ollama to be ready
echo "Waiting for Ollama to start..."
for i in {1..30}; do
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
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

echo "Ollama service ready on port 11434"

# Keep the container running
wait $OLLAMA_PID
