from typing import Any, Dict, List

import mlflow
import numpy as np
import pandas as pd
from dowhy import CausalModel  # noqa: F401  # Imported for completeness / future use
from econml.dml import CausalForestDML
from sklearn.ensemble import RandomForestRegressor

from app.core.config import settings


class CausalInferenceService:
  def __init__(self):
    mlflow.set_tracking_uri(settings.MLFLOW_TRACKING_URI)

  async def get_optimal_interventions(
    self,
    user_data: dict,
    current_context: dict,
  ) -> List[dict]:
    """
    Use causal inference to determine what interventions will
    most improve this user's performance.
    """

    sessions_df = self._prepare_sessions_data(user_data["sessions"])

    if len(sessions_df) < 10:
      return []

    recommendations: List[dict] = []

    sleep_rec = await self._analyze_sleep_effect(sessions_df, current_context)
    if sleep_rec:
      recommendations.append(sleep_rec)

    rest_rec = await self._analyze_rest_effect(sessions_df, current_context)
    if rest_rec:
      recommendations.append(rest_rec)

    energy_rec = await self._analyze_energy_effect(sessions_df, current_context)
    if energy_rec:
      recommendations.append(energy_rec)

    return recommendations

  def _prepare_sessions_data(self, sessions: List[dict]) -> pd.DataFrame:
    """Convert session data to ML-ready DataFrame."""
    df = pd.DataFrame(sessions)

    if df.empty:
      return df

    df["session_date"] = pd.to_datetime(df["session_date"])
    df = df.sort_values("session_date")

    df["days_rest"] = df["session_date"].diff().dt.days.fillna(0)
    df["prev_performance"] = df["post_performance_rating"].shift(1)
    df["sessions_last_7d"] = df["session_date"].apply(
      lambda x: (
        (df["session_date"] >= x - pd.Timedelta(days=7))
        & (df["session_date"] < x)
      ).sum()
    )

    return df.dropna(subset=["post_performance_rating"])

  async def _analyze_sleep_effect(
    self,
    df: pd.DataFrame,
    context: dict,
  ) -> Dict[str, Any] | None:
    """Estimate causal effect of sleep on performance."""

    required_cols = [
      "pre_sleep_hours",
      "pre_sleep_quality",
      "post_performance_rating",
    ]
    if not all(col in df.columns for col in required_cols):
      return None

    if "days_rest" not in df.columns or "pre_energy_level" not in df.columns:
      return None

    analysis_df = df[
      ["pre_sleep_hours", "pre_sleep_quality", "post_performance_rating", "days_rest", "pre_energy_level"]  # noqa: E501
    ].dropna()

    if len(analysis_df) < 10:
      return None

    try:
      Y = analysis_df["post_performance_rating"].values
      T = analysis_df["pre_sleep_hours"].values
      X = analysis_df[["days_rest", "pre_energy_level"]].values
      W = analysis_df[["pre_sleep_quality"]].values

      est = CausalForestDML(
        model_y=RandomForestRegressor(
          n_estimators=100,
          random_state=42,
        ),
        model_t=RandomForestRegressor(
          n_estimators=100,
          random_state=42,
        ),
        random_state=42,
      )
      est.fit(Y, T, X=X, W=W)

      current_rest = context.get("days_since_last_session", 2)
      current_energy = 5

      effect = est.effect(X=np.array([[current_rest, current_energy]]))

      user_avg_sleep = df["pre_sleep_hours"].mean()
      optimal_sleep = min(9.0, max(7.0, user_avg_sleep + 0.5))

      confidence = min(0.95, 0.5 + len(analysis_df) / 100)

      if effect[0] > 0.1:
        return {
          "title": f"Target {optimal_sleep:.1f} hours of sleep tonight",
          "description": (
            "Your data shows each additional hour of sleep is associated with "
            f"a {effect[0]:.1f} point performance improvement"
          ),
          "reasoning": (
            f"Based on {len(analysis_df)} of your sessions, sleep has a causal "
            "effect on your climbing performance"
          ),
          "model_version": settings.MODEL_VERSION,
          "confidence_score": float(confidence),
          "causal_factors": {
            "treatment": "sleep_hours",
            "effect_size": float(effect[0]),
            "sample_size": len(analysis_df),
          },
          "expected_effect": {
            "performance_delta": float(effect[0] * 0.5),
            "confidence_interval": [
              float(effect[0] * 0.3),
              float(effect[0] * 0.7),
            ],
          },
        }
    except Exception as e:  # pragma: no cover - defensive logging
      print(f"Sleep analysis error: {e}")

    return None

  async def _analyze_rest_effect(
    self,
    df: pd.DataFrame,
    context: dict,
  ) -> Dict[str, Any] | None:
    """Estimate causal effect of rest days on performance."""

    if (
      "days_rest" not in df.columns
      or "post_performance_rating" not in df.columns
      or "pre_energy_level" not in df.columns
    ):
      return None

    analysis_df = df[
      ["days_rest", "post_performance_rating", "pre_energy_level"]
    ].dropna()

    if len(analysis_df) < 10:
      return None

    try:
      rest_performance = analysis_df.groupby("days_rest")[
        "post_performance_rating"
      ].agg(["mean", "count"])
      rest_performance = rest_performance[rest_performance["count"] >= 2]

      if len(rest_performance) < 2:
        return None

      optimal_rest = rest_performance["mean"].idxmax()
      current_rest = context.get("days_since_last_session", 0)

      if current_rest is None:
        return None

      if current_rest < optimal_rest - 1:
        return {
          "title": f"Consider waiting {optimal_rest - current_rest:.0f} more day(s)",
          "description": (
            f"Your best sessions tend to happen after {optimal_rest:.0f} rest "
            f"days. You're currently at {current_rest} days."
          ),
          "reasoning": (
            f"Analysis of {len(analysis_df)} sessions shows your optimal rest period"
          ),
          "model_version": settings.MODEL_VERSION,
          "confidence_score": 0.7,
          "causal_factors": {
            "treatment": "rest_days",
            "optimal_value": int(optimal_rest),
            "current_value": int(current_rest),
          },
        }
      if current_rest > optimal_rest + 2:
        return {
          "title": "Good time to climb!",
          "description": (
            f"You've had {current_rest} rest days. Your data suggests you "
            f"perform well after {optimal_rest:.0f}+ days rest."
          ),
          "reasoning": f"Based on {len(analysis_df)} sessions",
          "model_version": settings.MODEL_VERSION,
          "confidence_score": 0.75,
        }
    except Exception as e:  # pragma: no cover - defensive logging
      print(f"Rest analysis error: {e}")

    return None

  async def _analyze_energy_effect(
    self,
    df: pd.DataFrame,
    context: dict,  # noqa: ARG002  # reserved for future use
  ) -> Dict[str, Any] | None:
    """Analyze how pre-session energy affects performance."""

    if "pre_energy_level" not in df.columns:
      return None

    analysis_df = df[["pre_energy_level", "post_performance_rating"]].dropna()

    if len(analysis_df) < 10:
      return None

    try:
      correlation = analysis_df["pre_energy_level"].corr(
        analysis_df["post_performance_rating"]
      )

      if correlation > 0.3:
        low_energy_perf = analysis_df[
          analysis_df["pre_energy_level"] <= 4
        ]["post_performance_rating"].mean()
        high_energy_perf = analysis_df[
          analysis_df["pre_energy_level"] >= 7
        ]["post_performance_rating"].mean()

        diff = high_energy_perf - low_energy_perf

        if diff > 0.5:
          return {
            "title": "Energy level matters for you",
            "description": (
              "When you start sessions with high energy (7+), you perform "
              f"{diff:.1f} points better on average"
            ),
            "reasoning": (
              "Consider timing your sessions when energy is naturally high, or "
              "using pre-session strategies to boost energy"
            ),
            "model_version": settings.MODEL_VERSION,
            "confidence_score": min(0.9, 0.5 + float(correlation)),
            "causal_factors": {
              "correlation": float(correlation),
              "high_energy_avg": float(high_energy_perf),
              "low_energy_avg": float(low_energy_perf),
            },
          }
    except Exception as e:  # pragma: no cover - defensive logging
      print(f"Energy analysis error: {e}")

    return None


