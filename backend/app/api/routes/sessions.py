from datetime import datetime
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import get_current_user
from app.core.supabase import get_supabase_client


router = APIRouter()


# ============================================
# PRE-SESSION DATA MODELS
# ============================================

class PreSessionInput(BaseModel):
    # A. Context & Environment
    session_environment: str
    planned_duration: int
    partner_status: str
    crowdedness: int
    # B. Systemic Recovery & Lifestyle
    sleep_quality: int
    sleep_hours: Optional[float] = None
    stress_level: int
    fueling_status: Optional[str] = None
    hydration_feel: Optional[str] = None
    skin_condition: Optional[str] = None
    finger_tendon_health: int
    doms_locations: Optional[List[str]] = []
    doms_severity: Optional[int] = 1
    menstrual_phase: Optional[str] = None
    # C. Intent & Psych
    motivation: int
    primary_goal: Optional[str] = None
    # D. Physical Readiness (Biofeedback)
    warmup_rpe: Optional[str] = None
    warmup_compliance: Optional[str] = None
    upper_body_power: Optional[int] = None
    shoulder_integrity: Optional[int] = None
    leg_springiness: Optional[int] = None
    finger_strength: Optional[int] = None


# ============================================
# POST-SESSION DATA MODELS
# ============================================

class StrengthMetricEntry(BaseModel):
    exercise: str
    value: str
    unit: str


class PostSessionInput(BaseModel):
    # A. Objective Performance
    hardest_grade_sent: str
    hardest_grade_attempted: Optional[str] = None
    volume_estimation: str
    strength_metrics: Optional[List[StrengthMetricEntry]] = []
    dominant_style: str
    # B. Subjective Experience
    rpe: int
    session_density: Optional[str] = None
    intra_session_fueling: Optional[str] = None
    # C. Failure Analysis
    limiting_factors: Optional[List[str]] = []
    flash_pump: Optional[bool] = False
    # D. Health & Injury Update
    new_pain_location: Optional[str] = None
    new_pain_severity: Optional[int] = 0
    fingers_stiffer_than_usual: Optional[bool] = False
    skin_status_post: Optional[str] = None
    doms_severity_post: Optional[int] = 5
    finger_power_post: Optional[int] = 5
    shoulder_mobility_post: Optional[int] = 5
    # E. The Learning Loop
    prediction_error: Optional[int] = 0


# ============================================
# SESSION MODELS
# ============================================

class SessionCreate(BaseModel):
    session_date: str
    session_type: str
    location: Optional[str] = None
    pre_session: Optional[PreSessionInput] = None


class ClimbCreate(BaseModel):
    route_name: Optional[str] = None
    grade: str
    style: Optional[str] = None
    attempts: int = 1
    completed: bool = False
    beta_notes: Optional[str] = None


# ============================================
# ENDPOINTS
# ============================================

@router.post("/sessions")
async def create_session(
    session: SessionCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new climbing session with pre-session data."""
    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Determine if outdoor based on session environment
    is_outdoor = False
    planned_duration_minutes = 90
    
    if session.pre_session:
        is_outdoor = 'outdoor' in session.pre_session.session_environment
        planned_duration_minutes = session.pre_session.planned_duration

    # Create the climbing_sessions record
    session_data = {
        "user_id": user_id,
        "session_type": session.session_type,
        "location": session.location,
        "is_outdoor": is_outdoor,
        "started_at": datetime.utcnow().isoformat(),
        "planned_duration_minutes": planned_duration_minutes,
        "status": "active",
        # Store in JSONB for backward compatibility
        "pre_session_data": session.pre_session.model_dump() if session.pre_session else {},
        # Also store key metrics in dedicated columns for easy querying
        "energy_level": session.pre_session.sleep_quality if session.pre_session else None,
        "motivation": session.pre_session.motivation if session.pre_session else None,
        "sleep_quality": session.pre_session.sleep_quality if session.pre_session else None,
        "stress_level": session.pre_session.stress_level if session.pre_session else None,
    }

    result = supabase.table("climbing_sessions").insert(session_data).execute()

    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create session")

    new_session = result.data[0]
    session_id = new_session["id"]

    # Also insert into the pre_session_data table for normalized storage
    if session.pre_session:
        pre_data = {
            "session_id": session_id,
            "user_id": user_id,
            # A. Context & Environment
            "session_environment": session.pre_session.session_environment,
            "planned_duration": session.pre_session.planned_duration,
            "partner_status": session.pre_session.partner_status,
            "crowdedness": session.pre_session.crowdedness,
            # B. Systemic Recovery & Lifestyle
            "sleep_quality": session.pre_session.sleep_quality,
            "sleep_hours": session.pre_session.sleep_hours,
            "stress_level": session.pre_session.stress_level,
            "fueling_status": session.pre_session.fueling_status,
            "hydration_feel": session.pre_session.hydration_feel,
            "skin_condition": session.pre_session.skin_condition,
            "finger_tendon_health": session.pre_session.finger_tendon_health,
            "doms_locations": session.pre_session.doms_locations,
            "doms_severity": session.pre_session.doms_severity,
            "menstrual_phase": session.pre_session.menstrual_phase,
            # C. Intent & Psych
            "motivation": session.pre_session.motivation,
            "primary_goal": session.pre_session.primary_goal,
            # D. Physical Readiness
            "warmup_rpe": session.pre_session.warmup_rpe,
            "warmup_compliance": session.pre_session.warmup_compliance,
            "upper_body_power": session.pre_session.upper_body_power,
            "shoulder_integrity": session.pre_session.shoulder_integrity,
            "leg_springiness": session.pre_session.leg_springiness,
            "finger_strength": session.pre_session.finger_strength,
        }

        try:
            supabase.table("pre_session_data").insert(pre_data).execute()
        except Exception as e:
            # Log but don't fail - the session was created successfully
            print(f"Warning: Failed to insert pre_session_data: {e}")

    return new_session


@router.patch("/sessions/{session_id}/complete")
async def complete_session(
    session_id: str,
    post_session: PostSessionInput,
    current_user: dict = Depends(get_current_user),
):
    """Complete a climbing session with post-session data."""
    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Calculate actual duration
    session_result = (
        supabase.table("climbing_sessions")
        .select("started_at, planned_duration_minutes")
        .eq("id", session_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )

    if not session_result.data:
        raise HTTPException(status_code=404, detail="Session not found")

    started_at = datetime.fromisoformat(session_result.data["started_at"].replace("Z", "+00:00"))
    ended_at = datetime.utcnow()
    actual_duration = int((ended_at - started_at).total_seconds() / 60)

    # Convert strength_metrics to JSON-serializable format
    strength_metrics_json = [m.model_dump() for m in post_session.strength_metrics] if post_session.strength_metrics else []

    # Update climbing_sessions with post-session data
    update_data = {
        "ended_at": ended_at.isoformat(),
        "actual_duration_minutes": actual_duration,
        "status": "completed",
        # Store in JSONB for backward compatibility
        "post_session_data": {
            **post_session.model_dump(),
            "strength_metrics": strength_metrics_json,
        },
        # Also store key metrics in dedicated columns
        "session_rpe": post_session.rpe,
    }

    result = (
        supabase.table("climbing_sessions")
        .update(update_data)
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")

    # Also insert into the post_session_data table for normalized storage
    post_data = {
        "session_id": session_id,
        "user_id": user_id,
        # A. Objective Performance
        "hardest_grade_sent": post_session.hardest_grade_sent,
        "hardest_grade_attempted": post_session.hardest_grade_attempted,
        "volume_estimation": post_session.volume_estimation,
        "strength_metrics": strength_metrics_json,
        "dominant_style": post_session.dominant_style,
        # B. Subjective Experience
        "rpe": post_session.rpe,
        "session_density": post_session.session_density,
        "intra_session_fueling": post_session.intra_session_fueling,
        # C. Failure Analysis
        "limiting_factors": post_session.limiting_factors,
        "flash_pump": post_session.flash_pump,
        # D. Health & Injury Update
        "new_pain_location": post_session.new_pain_location,
        "new_pain_severity": post_session.new_pain_severity,
        "fingers_stiffer_than_usual": post_session.fingers_stiffer_than_usual,
        "skin_status_post": post_session.skin_status_post,
        "doms_severity_post": post_session.doms_severity_post,
        "finger_power_post": post_session.finger_power_post,
        "shoulder_mobility_post": post_session.shoulder_mobility_post,
        # E. Learning Loop
        "prediction_error": post_session.prediction_error,
    }

    try:
        supabase.table("post_session_data").insert(post_data).execute()
    except Exception as e:
        # Log but don't fail - the session was completed successfully
        print(f"Warning: Failed to insert post_session_data: {e}")

    # Trigger async ML task to update user model
    try:
        from workers.tasks.ml_tasks import update_user_model
        update_user_model.delay(user_id)
    except Exception as e:
        print(f"Warning: Failed to trigger ML task: {e}")

    return result.data[0]


@router.get("/sessions")
async def get_sessions(
    limit: int = 20,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
):
    """Get user's climbing sessions."""
    supabase = get_supabase_client()

    result = (
        supabase.table("climbing_sessions")
        .select("*")
        .eq("user_id", current_user["id"])
        .order("started_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    return result.data


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get a specific climbing session with all related data."""
    supabase = get_supabase_client()

    # Get the session
    session_result = (
        supabase.table("climbing_sessions")
        .select("*")
        .eq("id", session_id)
        .eq("user_id", current_user["id"])
        .single()
        .execute()
    )

    if not session_result.data:
        raise HTTPException(status_code=404, detail="Session not found")

    session = session_result.data

    # Get pre-session data from normalized table
    pre_result = (
        supabase.table("pre_session_data")
        .select("*")
        .eq("session_id", session_id)
        .single()
        .execute()
    )

    # Get post-session data from normalized table
    post_result = (
        supabase.table("post_session_data")
        .select("*")
        .eq("session_id", session_id)
        .single()
        .execute()
    )

    return {
        **session,
        "pre_session_normalized": pre_result.data if pre_result.data else None,
        "post_session_normalized": post_result.data if post_result.data else None,
    }


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a climbing session."""
    supabase = get_supabase_client()

    # Delete will cascade to pre_session_data and post_session_data due to FK constraints
    result = (
        supabase.table("climbing_sessions")
        .delete()
        .eq("id", session_id)
        .eq("user_id", current_user["id"])
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"message": "Session deleted successfully"}


@router.post("/sessions/{session_id}/climbs")
async def add_climb(
    session_id: str,
    climb: ClimbCreate,
    current_user: dict = Depends(get_current_user),
):
    """Add a climb to a session."""
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
