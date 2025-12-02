from dagster import (
  AssetSelection,
  Definitions,
  ScheduleDefinition,
  define_asset_job,
)

from ml.dagster.assets import causal_models, recommendations, user_features

# Jobs
daily_recommendation_job = define_asset_job(
  name="daily_recommendations",
  selection=AssetSelection.all(),
)

# Schedules
daily_schedule = ScheduleDefinition(
  job=daily_recommendation_job,
  cron_schedule="0 6 * * *",  # 6 AM daily
)

defs = Definitions(
  assets=[user_features, causal_models, recommendations],
  jobs=[daily_recommendation_job],
  schedules=[daily_schedule],
)


