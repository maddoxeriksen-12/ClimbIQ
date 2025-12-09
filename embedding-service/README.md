# ClimbIQ Embedding Service (`mxbai-embed-large`)

This service hosts the `mxbai-embed-large` sentence-transformer locally and exposes
an **OpenAI-compatible** `/v1/embeddings` endpoint. It is designed to run on
Railway and be called from the Dagster `rag_knowledge_embeddings_backfill` asset
without sending any user data to third-party APIs.

## API

### `POST /v1/embeddings`

Request body:

```json
{
  "input": "text to embed or [\"text1\", \"text2\"]",
  "model": "mxbai-embed-large"
}
```

Response body:

```json
{
  "object": "list",
  "model": "mxbai-embed-large",
  "data": [
    { "object": "embedding", "embedding": [0.1, 0.2, ...], "index": 0 }
  ]
}
```

### `GET /healthz`

Simple health check endpoint:

```json
{ "status": "ok" }
```

## Deploying on Railway

1. **Create a new service**

   - In Railway, create a new project or open your existing ClimbIQ project.
   - Click **New Service → Deploy from GitHub** and select this repository
     (`maddoxeriksen-12/ClimbIQ`).
   - When prompted for the root directory, choose `embedding-service/`.

2. **Resources**

   `mxbai-embed-large` is a moderately sized model. Recommended Railway plan:

   - CPU: 2+ cores
   - RAM: 4–8 GB

3. **Environment variables**

   No API keys are required. You can optionally set:

   - `MODEL_NAME` (defaults to `mxbai-embed-large`) if you want to experiment
     with different embedding models compatible with `sentence-transformers`.

4. **Connect Dagster / backend**

   In your **Dagster pipeline / RAG environment**, set:

   ```bash
   EMBEDDING_API_BASE=http://embedding-service:8000
   RAG_EMBEDDING_MODEL=mxbai-embed-large
   ```

   - When running on Railway with multiple services in the same project, the
     internal hostname is often the service name (e.g. `http://<service-name>:8000`).
     Adjust `EMBEDDING_API_BASE` accordingly based on your Railway networking.

   The asset `rag_knowledge_embeddings_backfill` will call:

   ```text
   POST $EMBEDDING_API_BASE/v1/embeddings
   ```

   with JSON `{ "input": "...", "model": "mxbai-embed-large" }` to obtain
   embeddings for priors, rules, templates, and scenarios.


