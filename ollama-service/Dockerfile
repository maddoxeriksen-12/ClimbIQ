# Ollama Service for ClimbIQ Explanations
# Uses a small, efficient model for template filling and summarization

FROM ollama/ollama:latest

# Set environment variables
ENV OLLAMA_HOST=0.0.0.0
ENV OLLAMA_ORIGINS=*

# Pre-pull the model during build so it's baked into the image
# This avoids download time on container startup
RUN ollama serve & \
    sleep 5 && \
    ollama pull phi3:mini && \
    pkill ollama

# Copy startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Expose the Ollama API port
EXPOSE 11434

# Health check - increased start-period for CPU inference warmup
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
  CMD curl -f http://localhost:11434/api/tags || exit 1

CMD ["/start.sh"]
