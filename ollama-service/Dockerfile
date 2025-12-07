# Ollama Service for ClimbIQ Explanations
# Uses a small, efficient model for template filling and summarization

FROM ollama/ollama:latest

# Set environment variables
ENV OLLAMA_HOST=0.0.0.0
ENV OLLAMA_ORIGINS=*

# Create startup script that pulls the model and starts Ollama
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Expose the Ollama API port
EXPOSE 11434

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:11434/api/tags || exit 1

CMD ["/start.sh"]
