from typing import List, Union

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer


class EmbeddingRequest(BaseModel):
  input: Union[str, List[str]]
  model: str = "mxbai-embed-large"


class EmbeddingData(BaseModel):
  object: str = "embedding"
  embedding: List[float]
  index: int


class EmbeddingResponse(BaseModel):
  object: str = "list"
  data: List[EmbeddingData]
  model: str


app = FastAPI(title="Embedding Service (mxbai)", version="0.1.0")

_models = {}


def get_model(name: str) -> SentenceTransformer:
  """
  Lazy-load and cache SentenceTransformer models by name.

  By default we use `mxbai-embed-large`, but the API accepts a `model`
  field for future flexibility.
  """
  if name not in _models:
    try:
      _models[name] = SentenceTransformer(name)
    except Exception as exc:
      raise RuntimeError(f"Failed to load embedding model '{name}': {exc}")
  return _models[name]


@app.post("/v1/embeddings", response_model=EmbeddingResponse)
async def create_embedding(req: EmbeddingRequest) -> EmbeddingResponse:
  """
  OpenAI-compatible embeddings endpoint implemented locally.

  Request body:
    {
      "input": "some text"  OR  ["text1", "text2", ...],
      "model": "mxbai-embed-large"
    }

  Response body:
    {
      "object": "list",
      "model": "mxbai-embed-large",
      "data": [
        { "object": "embedding", "embedding": [...], "index": 0 },
        ...
      ]
    }
  """
  model_name = req.model or "mxbai-embed-large"
  try:
    model = get_model(model_name)
  except RuntimeError as e:
    raise HTTPException(status_code=500, detail=str(e))

  if isinstance(req.input, str):
    inputs = [req.input]
  else:
    inputs = req.input

  try:
    vectors = model.encode(inputs, normalize_embeddings=True)
  except Exception as exc:
    raise HTTPException(status_code=500, detail=f"Embedding failed: {exc}")

  data = [
    EmbeddingData(embedding=v.tolist(), index=i)
    for i, v in enumerate(vectors)
  ]

  return EmbeddingResponse(object="list", data=data, model=model_name)


@app.get("/healthz")
async def health() -> dict:
  return {"status": "ok"}


