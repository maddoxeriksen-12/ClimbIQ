from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple

from supabase import Client

from app.services.action_id import normalized_action_object


@dataclass(frozen=True)
class StoredArtifactRefs:
    planned_workout_id: str
    dose_features_id: str
    rationale_id: str
    predicted_outcomes_id: str


class RecommendationRunStore:
    """Persist Top‑K recommendation runs and normalized artifacts."""

    def __init__(self, supabase: Client):
        self.supabase = supabase

    def upsert_planned_workout(
        self,
        *,
        action_id: str,
        planned_workout: Dict[str, Any],
        schema_version: str = "1.0",
    ) -> str:
        normalized = normalized_action_object(planned_workout)

        res = (
            self.supabase.table("planned_workout")
            .upsert(
                {
                    "action_id": action_id,
                    "schema_version": schema_version,
                    "planned_workout_json": planned_workout,
                    "normalized_hash_input_json": normalized,
                },
                on_conflict="action_id",
            )
            .select("planned_workout_id")
            .single()
            .execute()
        )
        if not res.data:
            raise RuntimeError("Failed to upsert planned_workout")
        return str(res.data["planned_workout_id"])

    def insert_dose_features(self, *, planned_workout_id: str, features_json: Dict[str, Any], version: str = "1.0") -> str:
        res = (
            self.supabase.table("dose_features")
            .insert(
                {
                    "planned_workout_id": planned_workout_id,
                    "version": version,
                    "features_json": features_json,
                }
            )
            .select("dose_features_id")
            .single()
            .execute()
        )
        if not res.data:
            raise RuntimeError("Failed to insert dose_features")
        return str(res.data["dose_features_id"])

    def insert_rationale(self, *, rationale: Dict[str, Any], notes: Optional[str] = None) -> str:
        res = (
            self.supabase.table("rationale")
            .insert(
                {
                    "tags_json": rationale.get("tags") or {},
                    "signals_json": rationale.get("signals") or {},
                    "risks_json": rationale.get("risks") or {},
                    "notes": notes,
                }
            )
            .select("rationale_id")
            .single()
            .execute()
        )
        if not res.data:
            raise RuntimeError("Failed to insert rationale")
        return str(res.data["rationale_id"])

    def insert_predicted_outcomes(self, *, predicted_outcomes: Dict[str, Any], version: str = "1.0") -> str:
        res = (
            self.supabase.table("predicted_outcomes")
            .insert(
                {
                    "version": version,
                    "outcomes_json": predicted_outcomes,
                }
            )
            .select("predicted_outcomes_id")
            .single()
            .execute()
        )
        if not res.data:
            raise RuntimeError("Failed to insert predicted_outcomes")
        return str(res.data["predicted_outcomes_id"])

    def insert_run(
        self,
        *,
        user_id: str,
        user_state: Dict[str, Any],
        goal_context: Optional[Dict[str, Any]] = None,
        model_versions: Optional[Dict[str, Any]] = None,
        # legacy convenience
        action_id: Optional[str] = None,
        planned_workout_json: Optional[Dict[str, Any]] = None,
        planned_dose_features_json: Optional[Dict[str, Any]] = None,
    ) -> str:
        res = (
            self.supabase.table("session_recommendation_runs")
            .insert(
                {
                    "user_id": user_id,
                    "session_id": None,
                    "user_state": user_state,
                    "goal_context": goal_context or {},
                    "action_id": action_id,
                    "planned_workout": planned_workout_json,
                    "planned_dose_features": planned_dose_features_json,
                    "evidence_bundle": {},
                    "candidate_plans": [],
                    "candidate_scores": [],
                    "model_versions": model_versions or {},
                }
            )
            .select("run_id")
            .single()
            .execute()
        )
        if not res.data:
            raise RuntimeError("Failed to insert session_recommendation_runs")
        return str(res.data["run_id"])

    def store_candidate_artifacts(
        self,
        *,
        action_id: str,
        planned_workout: Dict[str, Any],
        planned_dose_features: Dict[str, Any],
        rationale: Dict[str, Any],
        predicted_outcomes: Dict[str, Any],
    ) -> StoredArtifactRefs:
        planned_workout_id = self.upsert_planned_workout(action_id=action_id, planned_workout=planned_workout)
        dose_features_id = self.insert_dose_features(planned_workout_id=planned_workout_id, features_json=planned_dose_features)
        rationale_id = self.insert_rationale(rationale=rationale)
        predicted_outcomes_id = self.insert_predicted_outcomes(predicted_outcomes=predicted_outcomes)
        return StoredArtifactRefs(
            planned_workout_id=planned_workout_id,
            dose_features_id=dose_features_id,
            rationale_id=rationale_id,
            predicted_outcomes_id=predicted_outcomes_id,
        )

    def insert_candidates(
        self,
        *,
        run_id: str,
        candidates: Sequence[Dict[str, Any]],
    ) -> None:
        # candidates: list of dicts with rank, action_id, refs, score_total, score_components
        rows: List[Dict[str, Any]] = []
        for c in candidates:
            rows.append(
                {
                    "run_id": run_id,
                    "rank": int(c["rank"]),
                    "action_id": c.get("action_id"),
                    "planned_workout_id": c.get("planned_workout_id"),
                    "dose_features_id": c.get("dose_features_id"),
                    "predicted_outcomes_id": c.get("predicted_outcomes_id"),
                    "rationale_id": c.get("rationale_id"),
                    "score_total": c.get("score_total"),
                    "score_components": c.get("score_components") or {},
                }
            )

        if not rows:
            return

        self.supabase.table("session_recommendation_candidates").insert(rows).execute()

    def update_final_selection(
        self,
        *,
        run_id: str,
        final_action_id: str,
        refs: StoredArtifactRefs,
    ) -> None:
        self.supabase.table("session_recommendation_runs").update(
            {
                "final_action_id": final_action_id,
                "final_planned_workout_id": refs.planned_workout_id,
                "final_dose_features_id": refs.dose_features_id,
                "final_predicted_outcomes_id": refs.predicted_outcomes_id,
                "final_rationale_id": refs.rationale_id,
            }
        ).eq("run_id", run_id).execute()

