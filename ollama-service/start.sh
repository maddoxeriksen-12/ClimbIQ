#!/bin/bash
set -e

# Start Ollama in the background
ollama serve &

# Wait for Ollama to be ready
echo "Waiting for Ollama to start..."
until curl -s http://localhost:11434/api/tags > /dev/null 2>&1; do
    sleep 1
done
echo "Ollama is ready!"

# Pull the model if not already present
# Using Phi-3 Mini - excellent for structured tasks, only 2.3GB
MODEL="${OLLAMA_MODEL:-phi3:mini}"
echo "Ensuring model $MODEL is available..."

if ! ollama list | grep -q "$MODEL"; then
    echo "Pulling model $MODEL..."
    ollama pull "$MODEL"
else
    echo "Model $MODEL already present"
fi

echo "Ollama service ready with model: $MODEL"

# Keep the container running
wait
