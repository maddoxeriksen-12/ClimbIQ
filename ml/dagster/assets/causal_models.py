from __future__ import annotations

import os
from typing import Dict

import mlflow
import pandas as pd
from dagster import Output, asset


@asset(
  deps=["user_features"],
  description="Train/update causal models for users with sufficient data",
)
def causal_models(user_features: pd.DataFrame) -> Output[Dict[str, dict]]:
  """
  Train personalized causal models for each user, based on feature summary.
  """
  mlflow.set_tracking_uri(os.environ.get("MLFLOW_TRACKING_URI", "mlruns"))

  models: Dict[str, dict] = {}

  eligible_users = user_features[user_features["total_sessions"] >= 15]

  with mlflow.start_run(run_name="causal_model_batch"):
    for _, user_row in eligible_users.iterrows():
      user_id = user_row["user_id"]

      try:
        model = _train_user_model(user_id)
        models[user_id] = model
        mlflow.log_metric(f"user_{str(user_id)[:8]}_trained", 1)
      except Exception as e:  # pragma: no cover - defensive logging
        mlflow.log_metric(f"user_{str(user_id)[:8]}_failed", 1)
        print(f"Failed to train model for {user_id}: {e}")

    mlflow.log_metric("total_models_trained", len(models))

  return Output(
    models,
    metadata={
      "models_trained": len(models),
      "eligible_users": len(eligible_users),
    },
  )


def _train_user_model(user_id: str) -> dict:
  """Train causal model for a single user."""
  from supabase import create_client
  from dowhy import CausalModel

  supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
  )

  sessions = (
    supabase.table("climbing_sessions")
    .select("*")
    .eq("user_id", user_id)
    .order("session_date")
    .execute()
  )

  df = pd.DataFrame(sessions.data)
  if df.empty:
    raise ValueError("No sessions for user")

  df["days_rest"] = pd.to_datetime(df["session_date"]).diff().dt.days.fillna(0)

  model = CausalModel(
    data=df,
    treatment="pre_sleep_hours",
    outcome="post_performance_rating",
    common_causes=["pre_energy_level", "pre_stress_level", "days_rest"],
  )

  identified = model.identify_effect()
  estimate = model.estimate_effect(
    identified,
    method_name="backdoor.linear_regression",
  )

  return {
    "sample_size": len(df),
    "estimate_str": str(estimate),
  }


