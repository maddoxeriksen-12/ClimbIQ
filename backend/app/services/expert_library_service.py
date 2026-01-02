from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from supabase import Client

from app.services.supabase_guard import SupabaseWriteGuard


DEFAULT_RUBRIC_THRESHOLDS: Dict[str, float] = {
    "safety": 0.70,
    "goal_fit": 0.60,
    "constraint_fit": 0.60,
    "internal_consistency": 0.60,
    # novelty is informational (no hard threshold)
}


@dataclass
class PromotionResult:
    case_id: str
    is_curated: bool


class ExpertLibraryService:
    """Expert library service with raw→curated gating.

    Writes ONLY to:
      expert_library_raw, expert_offline_eval_runs, expert_library_curated

    Reads from:
      expert_recommendations, expert_library_raw/curated
    """

    def __init__(self, supabase: Client):
        self.supabase = supabase
        self._guard = SupabaseWriteGuard(
            supabase,
            allowed_write_tables={
                "expert_library_raw",
                "expert_offline_eval_runs",
                "expert_library_curated",
            },
        )

    def list_raw_cases(
        self,
        *,
        limit: int = 50,
        rubric_status: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        q = (
            self.supabase.table("expert_library_raw")
            .select("case_id,expert_rec_id,episode_id,t_index,action_id,created_at,coach_id,rubric_status")
            .order("created_at", desc=True)
            .limit(limit)
        )
        if rubric_status:
            q = q.eq("rubric_status", rubric_status)
        res = q.execute()
        rows = res.data or []

        # Match frontend expected shape (expert_rec_id primary)
        return [
            {
                "expert_rec_id": r["expert_rec_id"],
                "episode_id": r.get("episode_id"),
                "t_index": r.get("t_index"),
                "action_id": r.get("action_id"),
                "created_at": r.get("created_at"),
                "coach_id": r.get("coach_id"),
                "rubric_status": r.get("rubric_status", "needs_review"),
            }
            for r in rows
        ]

    def _passes_gate(self, rubric_scores: Dict[str, float], thresholds: Dict[str, float]) -> bool:
        for k, thr in thresholds.items():
            if float(rubric_scores.get(k, 0.0) or 0.0) < float(thr):
                return False
        return True

    def promote_case_to_curated(
        self,
        *,
        expert_rec_id: str,
        rubric_scores: Dict[str, float],
        rubric_version: str,
        curated_by: str,
        curation_notes: Optional[str] = None,
    ) -> PromotionResult:
        # Load raw case
        raw_case = (
            self.supabase.table("expert_library_raw")
            .select("*")
            .eq("expert_rec_id", expert_rec_id)
            .single()
            .execute()
        ).data

        if not raw_case:
            raise RuntimeError("Raw case not found for expert_rec_id")

        thresholds = DEFAULT_RUBRIC_THRESHOLDS
        passed = self._passes_gate(rubric_scores, thresholds)

        # record eval run
        self._guard.table("expert_offline_eval_runs").insert(
            {
                "expert_rec_id": expert_rec_id,
                "raw_case_id": raw_case["case_id"],
                "rubric_version": rubric_version or "v1",
                "rubric_scores": rubric_scores,
                "passed_gate": passed,
                "gate_thresholds": thresholds,
                "evaluator_notes": curation_notes,
                "evaluated_by": curated_by,
            }
        ).execute()

        # update rubric status
        self._guard.table("expert_library_raw").update(
            {"rubric_status": "approved" if passed else "rejected"}
        ).eq("case_id", raw_case["case_id"]).execute()

        if not passed:
            return PromotionResult(case_id=str(raw_case["case_id"]), is_curated=False)

        # insert curated
        cur = self._guard.table("expert_library_curated").insert(
            {
                "raw_case_id": raw_case["case_id"],
                "expert_rec_id": raw_case["expert_rec_id"],
                "action_id": raw_case["action_id"],
                "planned_workout": raw_case["planned_workout"],
                "planned_dose_features": raw_case["planned_dose_features"],
                "rationale_tags": raw_case.get("rationale_tags") or {},
                "predicted_outcomes": raw_case.get("predicted_outcomes") or {},
                "is_curated": True,
                "curated_by": curated_by,
                "curation_notes": curation_notes,
                "rubric_version": rubric_version or "v1",
            }
        ).execute()

        if not cur.data:
            raise RuntimeError("Failed to insert curated case")

        # Enqueue expert-case embedding update (best-effort).
        try:
            from workers.tasks.ml_tasks import index_curated_expert_case_embedding

            index_curated_expert_case_embedding.delay(str(cur.data[0]["curated_case_id"]))
        except Exception:
            pass

        return PromotionResult(case_id=str(cur.data[0]["curated_case_id"]), is_curated=True)

    def search_cases(
        self,
        *,
        q: str,
        curated_only: bool = True,
        limit: int = 25,
    ) -> List[Dict[str, Any]]:
        query = q.strip()
        if not query:
            return []

        if curated_only:
            tbl = self.supabase.table("expert_library_curated")
            sel = "curated_case_id,action_id,planned_workout,planned_dose_features,rationale_tags,predicted_outcomes,is_curated,curated_at,created_at"
            base = tbl.select(sel)
            base = base.ilike("action_id", f"%{query}%")
            res = base.order("created_at", desc=True).limit(limit).execute()
            rows = res.data or []
            return [
                {
                    "case_id": r["curated_case_id"],
                    "action_id": r.get("action_id"),
                    "planned_workout": r.get("planned_workout"),
                    "planned_dose_features": r.get("planned_dose_features"),
                    "rationale_tags": r.get("rationale_tags") or {},
                    "predicted_outcomes": r.get("predicted_outcomes") or {},
                    "is_curated": True,
                    "curated_at": r.get("curated_at"),
                    "created_at": r.get("created_at"),
                }
                for r in rows
            ]

        tbl = self.supabase.table("expert_library_raw")
        sel = "case_id,action_id,planned_workout,planned_dose_features,rationale_tags,predicted_outcomes,created_at,rubric_status"
        base = tbl.select(sel)
        base = base.ilike("action_id", f"%{query}%")
        res = base.order("created_at", desc=True).limit(limit).execute()
        rows = res.data or []
        return [
            {
                "case_id": r["case_id"],
                "action_id": r.get("action_id"),
                "planned_workout": r.get("planned_workout"),
                "planned_dose_features": r.get("planned_dose_features"),
                "rationale_tags": r.get("rationale_tags") or {},
                "predicted_outcomes": r.get("predicted_outcomes") or {},
                "is_curated": False,
                "curated_at": None,
                "created_at": r.get("created_at"),
            }
            for r in rows
        ]

    def export_priors(self) -> Dict[str, Any]:
        """Export conservative pseudo-count style priors from curated library.

        This is intentionally minimal v1; a batch job will own true updates.
        """

        res = (
            self.supabase.table("expert_library_curated")
            .select("action_id,planned_dose_features")
            .order("created_at", desc=True)
            .limit(500)
            .execute()
        )
        rows = res.data or []

        # Example: aggregate average dose features
        totals = {
            "count": len(rows),
            "avg_hi_attempts": 0.0,
            "avg_tut_minutes": 0.0,
            "avg_volume_score": 0.0,
            "avg_fatigue_cost": 0.0,
        }
        if not rows:
            return totals

        for r in rows:
            df = r.get("planned_dose_features") or {}
            totals["avg_hi_attempts"] += float(((df.get("totals") or {}).get("hi_attempts")) or 0)
            totals["avg_tut_minutes"] += float(((df.get("totals") or {}).get("tut_minutes")) or 0)
            totals["avg_volume_score"] += float(((df.get("summary") or {}).get("volume_score")) or 0)
            totals["avg_fatigue_cost"] += float(((df.get("summary") or {}).get("fatigue_cost")) or 0)

        n = float(len(rows))
        totals["avg_hi_attempts"] = round(totals["avg_hi_attempts"] / n, 4)
        totals["avg_tut_minutes"] = round(totals["avg_tut_minutes"] / n, 4)
        totals["avg_volume_score"] = round(totals["avg_volume_score"] / n, 4)
        totals["avg_fatigue_cost"] = round(totals["avg_fatigue_cost"] / n, 4)

        return totals
