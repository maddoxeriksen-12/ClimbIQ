# ClimbIQ Reranker Service (bge-reranker-v2-m3)

This service provides a simple HTTP API for re-ranking documents given a query,
using a cross-encoder model (default: `BAAI/bge-reranker-v2-m3`). It is designed
to be deployed on Railway and called from the ClimbIQ backend `RAGService`.

## API

### `POST /rerank`

Request body:

```json
{
  "query": "Why did we recommend an extended warmup for low sleep V6 bouldering?",
  "documents": [
    "Rule: High ACWR safety cap ...",
    "Explanation template: Low sleep -> extended warmup ...",
    "Scenario: 32-year-old climber, low sleep, limit bouldering ..."
  ]
}
```

Response:

```json
{
  "scores": [0.92, 0.87, 0.31]
}
```

The list of scores is aligned with the input `documents` array (same length).

## Deploying to Railway

1. **Create a new service**

   - In the Railway dashboard, create a new project or open your existing ClimbIQ project.
   - Click **New Service → Deploy from GitHub** and select this repository.
   - When prompted for the root directory, choose `reranker-service/`.

2. **Configure environment**

   Set the following environment variables in the Railway service:

   - `RERANKER_MODEL` (optional)  
     - Default: `BAAI/bge-reranker-v2-m3`
   - `PYTHONUNBUFFERED=1`

   Make sure the service exposes port `8000` (the Dockerfile sets `PORT=8000` and uvicorn listens on that port).

3. **Connect the backend**

In your backend (FastAPI / `app` service on Railway), set:

- `RERANKER_URL` to the public URL of this service, e.g.:

```bash
RERANKER_URL=https://your-reranker-service.up.railway.app/rerank
```

The backend `RAGService` will call this URL when re-ranking candidates.

4. **Deploy**

- Push your changes to GitHub (`main` branch for this repo).
- Railway will automatically build and deploy the `reranker-service` using the provided `Dockerfile`.


