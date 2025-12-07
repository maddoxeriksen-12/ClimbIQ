# Ollama Service for ClimbIQ Explanations
# Uses a small, efficient model for template filling and summarization

FROM ollama/ollama:latest

# Set environment variables for runtime
ENV OLLAMA_HOST=0.0.0.0
ENV OLLAMA_ORIGINS=*

# Pre-pull the model during build so it's baked into the image
# Use a shell script approach for better reliability
RUN bash -c '\
    echo "Starting Ollama server for model pull..." && \
    ollama serve &\
    SERVER_PID=$! && \
    echo "Waiting for Ollama to be ready..." && \
    for i in $(seq 1 30); do \
        if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then \
            echo "Ollama is ready!" && \
            break; \
        fi; \
        echo "Waiting... ($i/30)"; \
        sleep 2; \
    done && \
    echo "Pulling phi3:mini model..." && \
    ollama pull phi3:mini && \
    echo "Model pull complete!" && \
    ollama list && \
    kill $SERVER_PID 2>/dev/null || true \
'

# Copy startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Expose the Ollama API port
EXPOSE 11434

# Health check - generous timing for CPU inference
HEALTHCHECK --interval=30s --timeout=30s --start-period=120s --retries=5 \
  CMD curl -f http://localhost:11434/api/tags || exit 1

CMD ["/start.sh"]
