\"\"\"Backfill normalized recommendation tables from legacy JSONB runs.

This is an optional migration helper during the dual-write window.

Usage:
  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python3 backend/scripts/backfill_recommendation_runs.py
\"\"\"

from __future__ import annotations

import os
from typing import Any, Dict

from supabase import create_client

from app.services.action_id import compute_action_id
from app.services.dose_features import compute_planned_dose_features
from app.services.recommendation_run_store import RecommendationRunStore
from app.services.workout_schemas import validate_planned_workout


def main() -> None:
    url = os.getenv(\"SUPABASE_URL\", \"\")
    key = os.getenv(\"SUPABASE_SERVICE_ROLE_KEY\", \"\") or os.getenv(\"SUPABASE_SERVICE_KEY\", \"\")
    if not url or not key:
        raise SystemExit(\"Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY)\")

    supabase = create_client(url, key)
    store = RecommendationRunStore(supabase)

    # Pull runs that have legacy planned_workout but no final_planned_workout_id
    runs = (
        supabase.table(\"session_recommendation_runs\")
        .select(\"run_id,action_id,planned_workout,planned_dose_features,final_planned_workout_id\")
        .is_(\"final_planned_workout_id\", \"null\")
        .not_.is_(\"planned_workout\", \"null\")
        .order(\"created_at\", desc=False)
        .limit(2000)
        .execute()
    ).data or []

    updated = 0
    for r in runs:
        run_id = r[\"run_id\"]
        planned = r.get(\"planned_workout\") or {}
        if not isinstance(planned, dict):
            continue

        try:
            validate_planned_workout(planned)
        except Exception:
            continue

        action_id = r.get(\"action_id\") or compute_action_id(planned)
        dose = r.get(\"planned_dose_features\") or compute_planned_dose_features(planned)

        refs = store.store_candidate_artifacts(
            action_id=action_id,
            planned_workout=planned,
            planned_dose_features=dose,
            rationale={\"tags\": {\"backfilled\": True}, \"signals\": {}, \"risks\": {}},
            predicted_outcomes={\"version\": \"1.0\", \"predicted_quality\": None, \"confidence\": None},
        )

        store.update_final_selection(run_id=run_id, final_action_id=action_id, refs=refs)
        updated += 1

    print({\"backfilled_runs\": updated, \"scanned\": len(runs)})


if __name__ == \"__main__\":
    main()

