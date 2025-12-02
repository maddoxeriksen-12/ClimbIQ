from __future__ import annotations

import os
from typing import cast

import pandas as pd
from dagster import Output, asset
from supabase import create_client


@asset(description="Extract and transform user session data into ML features")
def user_features() -> Output[pd.DataFrame]:
  """Daily job to compute features for all active users."""
  supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
  )

  sessions = (
    supabase.table("climbing_sessions")
    .select("*")
    .gte(
      "session_date",
      (pd.Timestamp.now() - pd.Timedelta(days=90)).isoformat(),
    )
    .execute()
  )

  df = pd.DataFrame(sessions.data)

  if df.empty:
    return Output(df, metadata={"row_count": 0})

  features: list[dict] = []

  for user_id, user_df in df.groupby("user_id"):
    user_df = user_df.sort_values("session_date")

    feature_row = {
      "user_id": user_id,
      "total_sessions": len(user_df),
      "avg_performance": user_df["post_performance_rating"].mean(),
      "avg_sleep": user_df["pre_sleep_hours"].mean(),
      "avg_energy": user_df["pre_energy_level"].mean(),
      "sessions_per_week": len(user_df) / 13.0,  # 90 days ≈ 13 weeks
      "performance_trend": _calculate_trend(
        cast(pd.Series, user_df["post_performance_rating"]),
      ),
      "preferred_session_type": (
        user_df["session_type"].mode().iloc[0]
        if len(user_df) > 0
        else None
      ),
    }
    features.append(feature_row)

  feature_df = pd.DataFrame(features)

  return Output(
    feature_df,
    metadata={
      "row_count": len(feature_df),
      "users_processed": len(feature_df),
    },
  )


def _calculate_trend(series: pd.Series) -> float:
  """Calculate simple linear trend proxy."""
  if len(series) < 3:
    return 0.0

  x = range(len(series))
  y = series.fillna(series.mean())

  slope = pd.Series(y).corr(pd.Series(list(x)))
  return float(slope) if not pd.isna(slope) else 0.0


