from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import get_current_user
from app.core.supabase import get_supabase_client
from app.services.expert_library_service import ExpertLibraryService


router = APIRouter(prefix="/betalab/library", tags=["BetaLab Library"])


def _require_coach(user_id: str) -> None:
    supabase = get_supabase_client()
    prof = (
        supabase.table("profiles")
        .select("role")
        .eq("id", user_id)
        .single()
        .execute()
    ).data
    if not prof or prof.get("role") != "coach":
        raise HTTPException(status_code=403, detail="Coach access required")


class PromoteCaseRequest(BaseModel):
    expert_rec_id: str
    rubric_scores: Dict[str, float]
    rubric_version: Optional[str] = "v1"
    curation_notes: Optional[str] = None


@router.get("/raw_cases")
async def raw_cases(
    limit: int = 50,
    rubric_status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    _require_coach(current_user["id"])
    svc = ExpertLibraryService(get_supabase_client())
    try:
        return svc.list_raw_cases(limit=limit, rubric_status=rubric_status)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/promote_case_to_curated")
async def promote_case_to_curated(
    req: PromoteCaseRequest,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_coach(current_user["id"])
    svc = ExpertLibraryService(get_supabase_client())
    try:
        res = svc.promote_case_to_curated(
            expert_rec_id=req.expert_rec_id,
            rubric_scores=req.rubric_scores,
            rubric_version=req.rubric_version or "v1",
            curated_by=current_user["id"],
            curation_notes=req.curation_notes,
        )
        return {"case_id": res.case_id, "is_curated": res.is_curated}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/search_cases")
async def search_cases(
    q: str,
    curated_only: bool = True,
    limit: int = 25,
    current_user: dict = Depends(get_current_user),
):
    _require_coach(current_user["id"])
    svc = ExpertLibraryService(get_supabase_client())
    try:
        return svc.search_cases(q=q, curated_only=curated_only, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/export_priors")
async def export_priors(current_user: dict = Depends(get_current_user)):
    _require_coach(current_user["id"])
    svc = ExpertLibraryService(get_supabase_client())
    try:
        return svc.export_priors()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
