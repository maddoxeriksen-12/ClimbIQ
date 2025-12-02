import modal

app = modal.App("climbiq-ml")

# Base image with ML dependencies
ml_image = (
  modal.Image.debian_slim()
  .pip_install(
    "pandas",
    "numpy",
    "scikit-learn",
    "dowhy",
    "econml",
    "mlflow",
    "supabase",
  )
)


@app.function(
  image=ml_image,
  gpu="T4",
  timeout=600,
  secrets=[modal.Secret.from_name("climbiq-secrets")],
)
def train_ensemble_model(user_id: str) -> dict:
  """
  Train more complex ensemble causal model on GPU.
  Used for users with large amounts of data.
  """
  import os

  import mlflow
  import numpy as np
  import pandas as pd
  from econml.dml import CausalForestDML
  from sklearn.ensemble import GradientBoostingRegressor
  from supabase import create_client

  supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
  )

  sessions = (
    supabase.table("climbing_sessions")
    .select("*")
    .eq("user_id", user_id)
    .execute()
  )

  nutrition = (
    supabase.table("nutrition_logs")
    .select("*")
    .eq("user_id", user_id)
    .execute()
  )

  df = _prepare_training_data(sessions.data, nutrition.data)

  if len(df) < 30:
    return {"status": "insufficient_data", "rows": len(df)}

  Y = df["post_performance_rating"].values
  T = df["pre_sleep_hours"].values
  X = df[["days_rest", "sessions_last_7d"]].values
  W = df[
    ["pre_energy_level", "pre_stress_level", "calories_pre_session"]
  ].values

  est = CausalForestDML(
    model_y=GradientBoostingRegressor(n_estimators=200),
    model_t=GradientBoostingRegressor(n_estimators=200),
    n_estimators=500,
    random_state=42,
  )
  est.fit(Y, T, X=X, W=W)

  effects = est.effect(X)

  mlflow.set_tracking_uri(os.environ.get("MLFLOW_TRACKING_URI", "mlruns"))
  with mlflow.start_run():
    mlflow.log_param("user_id", user_id)
    mlflow.log_param("training_samples", len(df))
    mlflow.log_metric("mean_treatment_effect", float(effects.mean()))
    mlflow.log_metric("effect_std", float(effects.std()))
    mlflow.sklearn.log_model(est, "causal_forest")

  return {
    "status": "success",
    "user_id": user_id,
    "training_samples": len(df),
    "mean_effect": float(effects.mean()),
    "effect_std": float(effects.std()),
  }


def _prepare_training_data(
  sessions: list,
  nutrition: list,
) -> "pd.DataFrame":  # type: ignore[name-defined]
  """Combine sessions and nutrition into training dataset."""
  import pandas as pd

  df = pd.DataFrame(sessions)
  nutrition_df = pd.DataFrame(nutrition)

  if df.empty:
    return df

  df["session_date"] = pd.to_datetime(df["session_date"])
  df = df.sort_values("session_date")

  df["days_rest"] = df["session_date"].diff().dt.days.fillna(0)
  df["sessions_last_7d"] = df["session_date"].apply(
    lambda x: (
      (df["session_date"] >= x - pd.Timedelta(days=7))
      & (df["session_date"] < x)
    ).sum(),
  )

  if not nutrition_df.empty:
    nutrition_df["logged_at"] = pd.to_datetime(nutrition_df["logged_at"])

    daily_nutrition = (
      nutrition_df.groupby(nutrition_df["logged_at"].dt.date)
      .agg(
        {
          "calories": "sum",
          "protein_grams": "sum",
        }
      )
      .reset_index()
    )
    daily_nutrition.columns = [
      "date",
      "calories_pre_session",
      "protein_pre_session",
    ]

    df["date"] = df["session_date"].dt.date
    df = df.merge(daily_nutrition, on="date", how="left")
    df["calories_pre_session"] = df["calories_pre_session"].fillna(0)
  else:
    df["calories_pre_session"] = 0

  df = df.dropna(subset=["post_performance_rating"])
  return df


@app.function(image=ml_image, schedule=modal.Cron("0 5 * * *"))
def scheduled_batch_training():
  """
  Daily scheduled job to retrain models for power users.
  """
  import os

  from supabase import create_client

  supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
  )

  users = (
    supabase.table("profiles")
    .select("id")
    .eq("subscription_tier", "elite")
    .execute()
  )

  results = []
  for user in users.data:
    result = train_ensemble_model.remote(user["id"])
    results.append(result)

  return results


