from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import get_current_user
from app.core.supabase import get_supabase_client


router = APIRouter()


class PreSessionInput(BaseModel):
  energy_level: int
  motivation: int
  stress_level: int
  sleep_quality: int
  sleep_hours: float
  soreness: dict = {}
  notes: Optional[str] = None


class PostSessionInput(BaseModel):
  performance_rating: int
  energy_level: int
  satisfaction: int
  notes: Optional[str] = None
  total_climbs: Optional[int] = None
  highest_grade_attempted: Optional[str] = None
  highest_grade_sent: Optional[str] = None


class SessionCreate(BaseModel):
  session_date: date
  session_type: str
  location: Optional[str] = None
  pre_session: PreSessionInput


class ClimbCreate(BaseModel):
  route_name: Optional[str] = None
  grade: str
  style: Optional[str] = None
  attempts: int = 1
  completed: bool = False
  beta_notes: Optional[str] = None


@router.post("/sessions")
async def create_session(
  session: SessionCreate,
  current_user: dict = Depends(get_current_user),
):
  supabase = get_supabase_client()

  data = {
    "user_id": current_user["id"],
    "session_date": str(session.session_date),
    "session_type": session.session_type,
    "location": session.location,
    "pre_energy_level": session.pre_session.energy_level,
    "pre_motivation": session.pre_session.motivation,
    "pre_stress_level": session.pre_session.stress_level,
    "pre_sleep_quality": session.pre_session.sleep_quality,
    "pre_sleep_hours": session.pre_session.sleep_hours,
    "pre_soreness": session.pre_session.soreness,
    "pre_notes": session.pre_session.notes,
  }

  result = supabase.table("climbing_sessions").insert(data).execute()

  if not result.data:
    raise HTTPException(status_code=400, detail="Failed to create session")

  return result.data[0]


@router.patch("/sessions/{session_id}/complete")
async def complete_session(
  session_id: str,
  post_session: PostSessionInput,
  current_user: dict = Depends(get_current_user),
):
  supabase = get_supabase_client()

  data = {
    "post_performance_rating": post_session.performance_rating,
    "post_energy_level": post_session.energy_level,
    "post_satisfaction": post_session.satisfaction,
    "post_notes": post_session.notes,
    "total_climbs": post_session.total_climbs,
    "highest_grade_attempted": post_session.highest_grade_attempted,
    "highest_grade_sent": post_session.highest_grade_sent,
  }

  result = (
    supabase.table("climbing_sessions")
    .update(data)
    .eq("id", session_id)
    .eq("user_id", current_user["id"])
    .execute()
  )

  if not result.data:
    raise HTTPException(status_code=404, detail="Session not found")

  # Trigger async ML task to update user model
  from workers.tasks.ml_tasks import update_user_model

  update_user_model.delay(current_user["id"])

  return result.data[0]


@router.get("/sessions")
async def get_sessions(
  limit: int = 20,
  offset: int = 0,
  current_user: dict = Depends(get_current_user),
):
  supabase = get_supabase_client()

  result = (
    supabase.table("climbing_sessions")
    .select("*")
    .eq("user_id", current_user["id"])
    .order("session_date", desc=True)
    .range(offset, offset + limit - 1)
    .execute()
  )

  return result.data


@router.post("/sessions/{session_id}/climbs")
async def add_climb(
  session_id: str,
  climb: ClimbCreate,
  current_user: dict = Depends(get_current_user),
):
  supabase = get_supabase_client()

  # Verify session belongs to user
  session = (
    supabase.table("climbing_sessions")
    .select("id")
    .eq("id", session_id)
    .eq("user_id", current_user["id"])
    .single()
    .execute()
  )

  if not session.data:
    raise HTTPException(status_code=404, detail="Session not found")

  data = {
    "session_id": session_id,
    "user_id": current_user["id"],
    **climb.model_dump(),
  }

  result = supabase.table("climbs").insert(data).execute()
  return result.data[0]


