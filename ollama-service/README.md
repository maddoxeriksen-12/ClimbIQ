# ClimbIQ Ollama Service

Self-hosted LLM for privacy-preserving explanation generation.

## Why Self-Host?

ClimbIQ handles sensitive user health data (sleep, stress, injuries). Self-hosting ensures:
- Complete data sovereignty
- No third-party data exposure
- GDPR/privacy compliance
- Predictable costs

## Model Choice

**Phi-3 Mini (3.8B parameters)** - Selected for:
- Excellent structured output (JSON)
- Small memory footprint (~2.3GB)
- Fast inference
- Good at template filling and summarization

Alternative models (set via `OLLAMA_MODEL` env var):
- `llama3.2:3b` - Meta's latest small model
- `mistral:7b` - More capable, needs more RAM
- `qwen2.5:3b` - Strong at structured tasks

## Railway Deployment

1. Create a new service in Railway
2. Connect this directory as source
3. Set environment variables:
   - `OLLAMA_MODEL=phi3:mini` (or your preferred model)
4. Railway will build and deploy automatically

**Resource Requirements:**
- RAM: 4GB minimum (8GB recommended)
- Storage: 5GB for model
- CPU: 2+ cores recommended

## Local Development

```bash
# Run locally with Docker
docker build -t climbiq-ollama .
docker run -p 11434:11434 climbiq-ollama

# Test the endpoint
curl http://localhost:11434/api/generate -d '{
  "model": "phi3:mini",
  "prompt": "Explain why low sleep quality affects climbing performance in 2 sentences.",
  "stream": false
}'
```

## API Usage

The backend's ExplanationService will call:
```
POST http://ollama-service:11434/api/generate
{
  "model": "phi3:mini",
  "prompt": "...",
  "stream": false,
  "format": "json"
}
```

## Cost Estimate

Railway pricing (as of 2024):
- ~$5-20/month for low-traffic hobby use
- ~$50-100/month for production with moderate traffic
- No per-token charges (unlike external APIs)
