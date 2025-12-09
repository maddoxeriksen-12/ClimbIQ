import os
from typing import List

from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import CrossEncoder

app = new_app = FastAPI(title="ClimbIQ Reranker", version="0.1.0")


class RerankRequest(BaseModel):
    query: str
    documents: List[str]


class RerankResponse(BaseModel):
    scores: List[float]


_model = None


def get_model() -> CrossEncoder:
    global _model
    if _model is None:
        model_name = os.getenv("RERANKER_MODEL", "BAAI/bge-reranker-v2-m3")
        _model = CrossEncoder(model_name)
    return _model


@app.post("/rerank", response_model=RerankResponse)
def rerank(payload: RerankRequest) -> RerankResponse:
    """
    Score each candidate document for relevance to the query.

    Returns a list of scores (higher = more relevant), same length as documents.
    """
    if not payload.documents:
        return RerankResponse(scores=[])

    model = get_model()
    pairs = [(payload.query, doc) for doc in payload.documents]
    scores = model.predict(pairs).tolist()
    return RerankResponse(scores=scores)


@app.get("/health")
def health():
    return {"status": "ok"}


