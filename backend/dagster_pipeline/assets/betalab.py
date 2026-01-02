"""BetaLab assets.

- expert_case_embeddings_backfill: index curated expert cases into rag_knowledge_embeddings
- expert_priors_batch_update: conservative, batch expert priors derived from curated cases

Only curated expert cases are allowed to affect these assets.
"""

from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Dict

import httpx
from dagster import AssetExecutionContext, MetadataValue, Output, asset

from ..resources import SupabaseResource


def _iso_week_label(dt: datetime) -> str:
    y, w, _ = dt.isocalendar()
    return f"{y}-W{w:02d}"


@asset(
    group_name="betalab",
    description="Index curated expert cases into rag_knowledge_embeddings (object_type=expert_case)",
    compute_kind="python",
)
def expert_case_embeddings_backfill(
    context: AssetExecutionContext,
    supabase: SupabaseResource,
) -> Output[int]:
    client = supabase.client

    base_url = os.getenv("EMBEDDING_API_BASE", "http://embedding-service:8000")
    model = os.getenv("RAG_EMBEDDING_MODEL", "mxbai-embed-large")
    embedding_path = os.getenv("EMBEDDING_API_PATH", "/v1/embeddings")

    def embed(text: str) -> list[float]:
        text = (text or "").strip() or "empty"
        resp = httpx.post(
            f"{base_url.rstrip('/')}{embedding_path}",
            json={"input": text, "model": model},
            timeout=30.0,
        )
        resp.raise_for_status()
        vec = resp.json()["data"][0]["embedding"]
        if len(vec) != 1536:
            raise ValueError(f"Expected 1536-dim embedding, got {len(vec)}")
        return vec

    def replace_embedding(object_id: str, content: str) -> None:
        try:
            (
                client.table("rag_knowledge_embeddings")
                .delete()
                .eq("object_type", "expert_case")
                .eq("object_table", "expert_library_curated")
                .eq("object_id", object_id)
                .execute()
            )
        except Exception:
            pass

        client.table("rag_knowledge_embeddings").insert(
            {
                "object_type": "expert_case",
                "object_table": "expert_library_curated",
                "object_id": object_id,
                "content": content,
                "embedding": embed(content),
            }
        ).execute()

    res = (
        client.table("expert_library_curated")
        .select(
            "curated_case_id,action_id,planned_workout,planned_dose_features,rationale_tags,predicted_outcomes,created_at"
        )
        .order("created_at", desc=True)
        .limit(2000)
        .execute()
    )

    total = 0
    for row in res.data or []:
        cid = row.get("curated_case_id")
        if not cid:
            continue
        planned = row.get("planned_workout") or {}
        dose = row.get("planned_dose_features") or {}
        rationale = row.get("rationale_tags") or {}
        predicted = row.get("predicted_outcomes") or {}

        content = (
            f"Curated expert case action_id={row.get('action_id')} "
            f"session_type={planned.get('session_type')} time_cap_min={planned.get('time_cap_min')} "
            f"dose={dose} rationale={rationale} predicted={predicted} planned_workout={planned}"
        )

        try:
            replace_embedding(str(cid), content)
            total += 1
        except Exception as e:
            context.log.warning(f"Failed to embed curated_case_id={cid}: {e}")

    return Output(
        total,
        metadata={
            "embedded": total,
            "model": model,
        },
    )


@asset(
    group_name="betalab",
    description="Weekly, conservative expert priors update from curated expert cases (versioned)",
    compute_kind="python",
    deps=["expert_case_embeddings_backfill"],
)
def expert_priors_batch_update(
    context: AssetExecutionContext,
    supabase: SupabaseResource,
) -> Output[Dict[str, Any]]:
    client = supabase.client

    # Load curated cases (dose features only)
    res = (
        client.table("expert_library_curated")
        .select("planned_workout,planned_dose_features,created_at")
        .order("created_at", desc=False)
        .limit(5000)
        .execute()
    )
    rows = res.data or []

    if not rows:
        return Output({"status": "no_data", "n_cases": 0}, metadata={"n_cases": 0})

    # Aggregate by session_type
    by_type: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        planned = r.get("planned_workout") or {}
        st = str(planned.get("session_type") or "unknown")
        dose = r.get("planned_dose_features") or {}

        hi = float(((dose.get("totals") or {}).get("hi_attempts")) or 0)
        tut = float(((dose.get("totals") or {}).get("tut_minutes")) or 0)
        vol = float(((dose.get("summary") or {}).get("volume_score")) or 0)
        fat = float(((dose.get("summary") or {}).get("fatigue_cost")) or 0)

        bucket = by_type.setdefault(
            st,
            {
                "n": 0,
                "sum_hi": 0.0,
                "sum_tut": 0.0,
                "sum_vol": 0.0,
                "sum_fat": 0.0,
            },
        )
        bucket["n"] += 1
        bucket["sum_hi"] += hi
        bucket["sum_tut"] += tut
        bucket["sum_vol"] += vol
        bucket["sum_fat"] += fat

    # Conservative shrinkage toward global mean
    total_n = sum(v["n"] for v in by_type.values())
    global_hi = sum(v["sum_hi"] for v in by_type.values()) / max(1, total_n)
    global_tut = sum(v["sum_tut"] for v in by_type.values()) / max(1, total_n)
    global_vol = sum(v["sum_vol"] for v in by_type.values()) / max(1, total_n)
    global_fat = sum(v["sum_fat"] for v in by_type.values()) / max(1, total_n)

    w0 = 100.0  # large anchor weight => conservative
    priors: Dict[str, Any] = {
        "version": "v1",
        "generated_at": datetime.utcnow().isoformat(),
        "anchor": {
            "hi_attempts": round(global_hi, 4),
            "tut_minutes": round(global_tut, 4),
            "volume_score": round(global_vol, 4),
            "fatigue_cost": round(global_fat, 4),
            "w0": w0,
        },
        "by_session_type": {},
    }

    for st, agg in by_type.items():
        n = float(agg["n"])
        mu_hi = agg["sum_hi"] / max(1.0, n)
        mu_tut = agg["sum_tut"] / max(1.0, n)
        mu_vol = agg["sum_vol"] / max(1.0, n)
        mu_fat = agg["sum_fat"] / max(1.0, n)

        shrink = lambda mu, anchor: (w0 * anchor + n * mu) / (w0 + n)

        priors["by_session_type"][st] = {
            "n": int(n),
            "mean": {
                "hi_attempts": round(shrink(mu_hi, global_hi), 4),
                "tut_minutes": round(shrink(mu_tut, global_tut), 4),
                "volume_score": round(shrink(mu_vol, global_vol), 4),
                "fatigue_cost": round(shrink(mu_fat, global_fat), 4),
            },
        }

    # Only publish if we have enough curated cases.
    min_cases = 20
    if total_n < min_cases:
        return Output(
            {"status": "insufficient_data", "n_cases": total_n, "min_cases": min_cases},
            metadata={"n_cases": total_n, "min_cases": min_cases},
        )

    version_label = _iso_week_label(datetime.utcnow())

    # Flip previous current to false (best-effort)
    try:
        client.table("expert_priors_versions").update({"is_current": False}).eq("is_current", True).execute()
    except Exception:
        pass

    ins = (
        client.table("expert_priors_versions")
        .insert(
            {
                "version_label": version_label,
                "is_current": True,
                "n_curated_cases": int(total_n),
                "source_window": {
                    "min_created_at": rows[0].get("created_at"),
                    "max_created_at": rows[-1].get("created_at"),
                },
                "shrinkage_config": {"anchor": "global_curated_mean", "w0": w0, "min_cases": min_cases},
                "priors_json": priors,
                "notes": "Auto-generated from curated expert cases (BetaLab).",
            }
        )
        .execute()
    )

    inserted = (ins.data or [None])[0]

    return Output(
        {"status": "ok", "version_label": version_label, "n_cases": total_n, "id": inserted.get("expert_priors_version_id") if inserted else None},
        metadata={
            "version_label": version_label,
            "n_cases": int(total_n),
            "session_types": MetadataValue.json({k: v["n"] for k, v in by_type.items()}),
        },
    )
