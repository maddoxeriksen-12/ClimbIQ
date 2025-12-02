from __future__ import annotations

import os
from typing import Dict

import pandas as pd
from dagster import Output, asset
from supabase import create_client


@asset(
  deps=["user_features", "causal_models"],
  description="Materialize updated recommendations for all eligible users",
)
def recommendations(
  user_features: pd.DataFrame,
  causal_models: Dict[str, dict],
) -> Output[int]:
  """
  Use precomputed features and causal models to write recommendation rows
  into the Supabase `recommendations` table.
  """
  supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
  )

  written = 0

  for _, row in user_features.iterrows():
    user_id = row["user_id"]

    # Only generate if we have a causal model for this user
    if user_id not in causal_models:
      continue

    title = "Optimize your sleep before climbing"
    description = (
      "Our causal model suggests that better sleep is associated with "
      "improved climbing performance for you."
    )

    rec = {
      "user_id": user_id,
      "recommendation_type": "pre_session",
      "title": title,
      "description": description,
      "reasoning": causal_models[user_id].get("estimate_str"),
      "model_version": "v1.0.0",
    }

    result = supabase.table("recommendations").insert(rec).execute()
    if result.data:
      written += len(result.data)

  return Output(written, metadata={"recommendations_written": written})


