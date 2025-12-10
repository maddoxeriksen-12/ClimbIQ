import os
from datetime import datetime

import httpx
from celery import shared_task

from app.core.supabase import get_supabase_client

EMBEDDING_BASE_URL = os.getenv("EMBEDDING_API_BASE", "").rstrip("/")
EMBEDDING_PATH = os.getenv("EMBEDDING_API_PATH", "/v1/embeddings")
EMBEDDING_MODEL = os.getenv("RAG_EMBEDDING_MODEL", "mxbai-embed-large")

def _build_session_text(session: dict, pre: dict | None, post: dict | None, stage: str) -> str:
    parts: list[str] = []

    parts.append(f"session_type={session.get('session_type')}")
    if session.get("is_outdoor"):
        parts.append("environment=outdoor")
    else:
        parts.append("environment=indoor")

    # Pre-session features
    if pre:
        parts.append(f"primary_goal={pre.get('primary_goal')}")
        parts.append(f"sleep_quality={pre.get('sleep_quality')}")
        parts.append(f"sleep_hours={pre.get('sleep_hours')}")
        parts.append(f"stress_level={pre.get('stress_level')}")
        parts.append(f"energy_level={session.get('energy_level')}")
        parts.append(f"motivation={pre.get('motivation')}")
        parts.append(f"finger_tendon_health={pre.get('finger_tendon_health')}")
        parts.append(f"doms_severity={pre.get('doms_severity')}")

    # Post-session features (only for post stage)
    if stage == "post" and post:
        parts.append(f"hardest_grade_sent={post.get('hardest_grade_sent')}")
        parts.append(f"volume_estimation={post.get('volume_estimation')}")
        parts.append(f"rpe={post.get('rpe')}")
        parts.append(f"doms_severity_post={post.get('doms_severity_post')}")
        parts.append(f"finger_power_post={post.get('finger_power_post')}")
        parts.append(f"shoulder_mobility_post={post.get('shoulder_mobility_post')}")
        parts.append(f"session_quality={session.get('session_quality')}")

    return " | ".join(str(p) for p in parts if p is not None)

async def _fetch_embedding_async(text: str) -> list[float]:
    if not EMBEDDING_BASE_URL:
        raise RuntimeError("EMBEDDING_API_BASE not configured")
    url = f"{EMBEDDING_BASE_URL}{EMBEDDING_PATH}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            url,
            json={"input": text, "model": EMBEDDING_MODEL},
        )
        resp.raise_for_status()
        data = resp.json()
        return data["data"][0]["embedding"]

@shared_task
def generate_session_embedding(session_id: str, stage: str = "post") -> None:
    """
    Asynchronously generate an embedding for a session and store it in user_session_embeddings.
    stage: 'pre' -> pre-session only; 'post' -> combined pre+post.
    """
    import asyncio

    supabase = get_supabase_client()

    # Load session
    ses_res = (
        supabase.table("climbing_sessions")
        .select("*")
        .eq("id", session_id)
        .single()
        .execute()
    )
    session = ses_res.data
    if not session:
        return

    user_id = session["user_id"]

    # Load normalized pre/post rows (if present)
    pre = (
        supabase.table("pre_session_data")
        .select("*")
        .eq("session_id", session_id)
        .single()
        .execute()
        .data
    )
    post = (
        supabase.table("post_session_data")
        .select("*")
        .eq("session_id", session_id)
        .single()
        .execute()
        .data
    ) if stage == "post" else None

    text = _build_session_text(session, pre, post, stage)
    if not text:
        return

    # Get embedding from embedding-service
    try:
        embedding = asyncio.run(_fetch_embedding_async(text))
    except Exception as e:
        # Log and bail, don't break the main flow
        print(f"[generate_session_embedding] failed for {session_id} ({stage}): {e}")
        return

    # Outcome quality for post-stage; null for pre
    outcome_quality = session.get("session_quality") if stage == "post" else None

    # Upsert into user_session_embeddings
    payload = {
        "session_id": session_id,
        "user_id": user_id,
        "session_embedding": embedding,
        "embedding_stage": stage,
        "outcome_quality": outcome_quality,
    }

    supabase.table("user_session_embeddings") \
        .upsert(payload, on_conflict="user_id,session_id,embedding_stage") \
        .execute()


@shared_task
def update_user_model(user_id: str) -> None:
    """
    Update user's personalized model based on their session history.
    This task recalculates deviations from population priors and updates model_outputs.
    """
    supabase = get_supabase_client()

    # Count user's completed sessions
    sessions_result = (
        supabase.table("climbing_sessions")
        .select("id, session_quality, sleep_quality, energy_level, motivation, stress_level, session_rpe")
        .eq("user_id", user_id)
        .eq("status", "completed")
        .not_.is_("session_quality", "null")
        .execute()
    )

    sessions = sessions_result.data or []
    n_sessions = len(sessions)

    if n_sessions < 3:
        # Not enough data to personalize
        phase = "cold_start"
        shrinkage = 0.95  # Heavily weight population priors
    elif n_sessions < 10:
        phase = "learning"
        shrinkage = 0.7
    else:
        phase = "personalized"
        shrinkage = 0.3

    # Calculate simple variable deviations from session data
    variable_deviations = {}
    
    if n_sessions > 0:
        # Calculate mean quality and how it relates to inputs
        qualities = [s.get("session_quality", 5) for s in sessions if s.get("session_quality")]
        sleep_scores = [s.get("sleep_quality", 5) for s in sessions if s.get("sleep_quality")]
        energy_scores = [s.get("energy_level", 5) for s in sessions if s.get("energy_level")]
        
        if qualities:
            avg_quality = sum(qualities) / len(qualities)
            variable_deviations["avg_session_quality"] = avg_quality
        
        if sleep_scores and qualities and len(sleep_scores) == len(qualities):
            # Simple correlation proxy: does low sleep correlate with low quality for this user?
            low_sleep_sessions = [(s, q) for s, q in zip(sleep_scores, qualities) if s <= 5]
            high_sleep_sessions = [(s, q) for s, q in zip(sleep_scores, qualities) if s > 5]
            
            if low_sleep_sessions and high_sleep_sessions:
                avg_low_sleep_quality = sum(q for _, q in low_sleep_sessions) / len(low_sleep_sessions)
                avg_high_sleep_quality = sum(q for _, q in high_sleep_sessions) / len(high_sleep_sessions)
                # Deviation: how much does sleep affect THIS user vs population
                variable_deviations["sleep_sensitivity"] = avg_high_sleep_quality - avg_low_sleep_quality

    # Calculate a simple recovery index based on recent session density
    recent_sessions = (
        supabase.table("climbing_sessions")
        .select("started_at, session_rpe")
        .eq("user_id", user_id)
        .eq("status", "completed")
        .order("started_at", desc=True)
        .limit(7)
        .execute()
    ).data or []

    recovery_index = 1.0
    if len(recent_sessions) >= 3:
        # High session density + high RPE = lower recovery index
        avg_rpe = sum(s.get("session_rpe", 5) for s in recent_sessions) / len(recent_sessions)
        recovery_index = max(0.5, 1.0 - (avg_rpe - 5) * 0.1)

    # Upsert into model_outputs
    model_data = {
        "user_id": user_id,
        "coefficients": {},  # Placeholder for Bayesian coefficients
        "confidence_intervals": {},
        "sessions_included": n_sessions,
        "phase": phase,
        "shrinkage_factor": shrinkage,
        "last_trained_at": datetime.utcnow().isoformat(),
        "model_version": "v1.0",
        "recovery_index": recovery_index,
        "variable_deviations": variable_deviations,
    }

    supabase.table("model_outputs") \
        .upsert(model_data, on_conflict="user_id") \
        .execute()

    print(f"[update_user_model] Updated model for user {user_id}: phase={phase}, sessions={n_sessions}")