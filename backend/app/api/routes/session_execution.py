"""
Session Execution Routes - Layer 4 of 5-Layer Architecture

Handles:
- Session execution state tracking
- Phase advancement
- Session completion
"""

from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import get_current_user
from app.core.supabase import get_supabase_client


router = APIRouter(prefix="/session-execution", tags=["Session Execution"])


# ============================================
# MODELS
# ============================================

class StartExecutionInput(BaseModel):
    """Input for starting session execution tracking."""
    session_id: str
    plan: dict  # The structured plan from recommendation


class ExecutionState(BaseModel):
    """Current execution state."""
    session_id: str
    current_phase: str
    current_block_index: int
    pain_level: Optional[int] = None
    energy_update: Optional[int] = None
    branches_taken: List[dict] = []
    original_plan: dict
    current_plan: dict
    completion_status: str


# ============================================
# ENDPOINTS
# ============================================

@router.post("/start")
async def start_execution(
    input_data: StartExecutionInput,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Start tracking session execution.
    Called when user begins a session with a recommended plan.
    """
    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Verify session belongs to user
    session_check = (
        supabase.table("climbing_sessions")
        .select("id, user_id")
        .eq("id", input_data.session_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )

    if not session_check.data:
        raise HTTPException(status_code=404, detail="Session not found")

    # Call the database function to start execution
    try:
        result = supabase.rpc(
            "start_session_execution",
            {
                "p_session_id": input_data.session_id,
                "p_user_id": user_id,
                "p_plan": input_data.plan,
            }
        ).execute()

        execution_id = result.data

        return {
            "execution_id": execution_id,
            "session_id": input_data.session_id,
            "current_phase": "warmup",
            "message": "Session execution tracking started",
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to start execution: {str(e)}")


@router.post("/{session_id}/advance-phase")
async def advance_phase(
    session_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Advance to the next phase of the session.
    warmup -> main -> cooldown -> completed
    """
    supabase = get_supabase_client()
    user_id = current_user["id"]

    # Verify session belongs to user
    session_check = (
        supabase.table("session_execution_state")
        .select("id, user_id, current_phase")
        .eq("session_id", session_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )

    if not session_check.data:
        raise HTTPException(status_code=404, detail="Execution state not found")

    # Call the database function to advance phase
    try:
        result = supabase.rpc(
            "advance_session_phase",
            {"p_session_id": session_id}
        ).execute()

        new_phase = result.data

        return {
            "session_id": session_id,
            "previous_phase": session_check.data["current_phase"],
            "new_phase": new_phase,
            "message": f"Advanced to {new_phase}" if new_phase != "completed" else "Session completed!",
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to advance phase: {str(e)}")


@router.post("/{session_id}/end")
async def end_execution(
    session_id: str,
    status: str = "completed_normal",
    reason: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    End session execution with a status.

    Status options:
    - completed_normal: Session finished as planned
    - completed_early: User chose to end early (no issues)
    - aborted_pain: Ended due to pain
    - aborted_fatigue: Ended due to excessive fatigue
    - aborted_other: Ended for other reason
    """
    supabase = get_supabase_client()
    user_id = current_user["id"]

    valid_statuses = [
        "completed_normal",
        "completed_early",
        "aborted_pain",
        "aborted_fatigue",
        "aborted_other",
    ]

    if status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )

    # Verify session belongs to user
    session_check = (
        supabase.table("session_execution_state")
        .select("id")
        .eq("session_id", session_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )

    if not session_check.data:
        raise HTTPException(status_code=404, detail="Execution state not found")

    # Call the database function to end session
    try:
        supabase.rpc(
            "end_session_execution",
            {
                "p_session_id": session_id,
                "p_status": status,
                "p_reason": reason,
            }
        ).execute()

        return {
            "session_id": session_id,
            "status": status,
            "reason": reason,
            "message": "Session execution ended",
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to end execution: {str(e)}")


@router.get("/{session_id}/state")
async def get_execution_state(
    session_id: str,
    current_user: dict = Depends(get_current_user),
) -> ExecutionState:
    """
    Get current execution state for a session.
    """
    supabase = get_supabase_client()
    user_id = current_user["id"]

    result = (
        supabase.table("session_execution_state")
        .select("*")
        .eq("session_id", session_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Execution state not found")

    data = result.data
    return ExecutionState(
        session_id=data["session_id"],
        current_phase=data["current_phase"],
        current_block_index=data["current_block_index"],
        pain_level=data.get("pain_level"),
        energy_update=data.get("energy_update"),
        branches_taken=data.get("branches_taken", []),
        original_plan=data["original_plan"],
        current_plan=data["current_plan"],
        completion_status=data["completion_status"],
    )
