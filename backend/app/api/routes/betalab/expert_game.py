from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import get_current_user
from app.core.supabase import get_supabase_client
from app.services.expert_game_service import ExpertGameService


router = APIRouter(prefix="/betalab/game", tags=["BetaLab Game"])


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


class SubmitRecommendationRequest(BaseModel):
    episode_id: str
    t_index: int
    scenario_state_id: str

    planned_workout: Dict[str, Any]
    rationale_tags: Optional[Dict[str, Any]] = None
    noticed_signals: Optional[Dict[str, Any]] = None
    avoided_risks: Optional[Dict[str, Any]] = None
    predicted_outcomes: Optional[Dict[str, Any]] = None
    confidence: Optional[float] = 0.7


class AdvanceEpisodeRequest(BaseModel):
    episode_id: str


@router.post("/start_episode")
async def start_episode(current_user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    _require_coach(current_user["id"])
    svc = ExpertGameService(get_supabase_client())
    try:
        res = svc.start_episode(coach_id=current_user["id"], coach_role="coach")
        return {"episode": res.episode, "state": res.state}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/state")
async def get_state(
    episode_id: str,
    t: int,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_coach(current_user["id"])
    svc = ExpertGameService(get_supabase_client())
    try:
        return svc.get_state(episode_id=episode_id, t_index=t)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/submit_recommendation")
async def submit_recommendation(
    req: SubmitRecommendationRequest,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_coach(current_user["id"])
    svc = ExpertGameService(get_supabase_client())
    try:
        return svc.submit_recommendation(
            coach_id=current_user["id"],
            coach_role="coach",
            episode_id=req.episode_id,
            t_index=req.t_index,
            scenario_state_id=req.scenario_state_id,
            planned_workout=req.planned_workout,
            rationale_tags=req.rationale_tags,
            noticed_signals=req.noticed_signals,
            avoided_risks=req.avoided_risks,
            predicted_outcomes=req.predicted_outcomes,
            confidence=float(req.confidence or 0.7),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/advance_episode")
async def advance_episode(
    req: AdvanceEpisodeRequest,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_coach(current_user["id"])
    svc = ExpertGameService(get_supabase_client())
    try:
        return svc.advance_episode(episode_id=req.episode_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/score_episode")
async def score_episode(
    episode_id: str,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_coach(current_user["id"])

    # Minimal v1 scoring: counts + basic summaries.
    supabase = get_supabase_client()
    recs = (
        supabase.table("expert_recommendations")
        .select("expert_rec_id")
        .eq("episode_id", episode_id)
        .execute()
    ).data or []

    posts = (
        supabase.table("sim_observations")
        .select("payload_json")
        .eq("episode_id", episode_id)
        .eq("stage", "post")
        .execute()
    ).data or []

    qualities = []
    for p in posts:
        try:
            qualities.append(float((p.get("payload_json") or {}).get("session_quality") or 0))
        except Exception:
            pass

    return {
        "episode_id": episode_id,
        "n_recommendations": len(recs),
        "n_posts": len(posts),
        "avg_session_quality": (sum(qualities) / len(qualities)) if qualities else None,
    }
