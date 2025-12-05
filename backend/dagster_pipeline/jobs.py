"""
Dagster Jobs for ClimbIQ Pipeline

Defines jobs that can be triggered manually or by sensors.
"""

from dagster import define_asset_job, AssetSelection


# Job to run the full prior extraction pipeline
prior_extraction_job = define_asset_job(
    name="prior_extraction_job",
    description="Extract coefficient signals from expert reviews and update population priors",
    selection=AssetSelection.groups("expert_capture"),
    tags={
        "dagster/max_retries": "2",
        "pipeline": "expert_capture",
    },
)


# Job to only extract signals (without writing to DB)
signal_extraction_job = define_asset_job(
    name="signal_extraction_job",
    description="Extract and aggregate coefficient signals without updating the database",
    selection=AssetSelection.assets(
        "extracted_coefficient_signals",
        "expert_derived_priors",
        "blended_population_priors",
    ),
    tags={
        "pipeline": "expert_capture",
        "mode": "dry_run",
    },
)


# Job to run nightly model training
nightly_training_job = define_asset_job(
    name="nightly_training_job",
    description="Train hierarchical Bayesian model for all users with sufficient session data",
    selection=AssetSelection.groups("model_training"),
    tags={
        "dagster/max_retries": "1",
        "pipeline": "model_training",
        "schedule": "nightly",
    },
)


# Job to run model training for specific users (can be triggered manually)
user_model_training_job = define_asset_job(
    name="user_model_training_job",
    description="Train model for users - can be triggered when user completes a session",
    selection=AssetSelection.assets(
        "training_data",
        "trained_model",
    ),
    tags={
        "pipeline": "model_training",
        "trigger": "on_demand",
    },
)


# Job to compute population statistics
population_stats_job = define_asset_job(
    name="population_stats_job",
    description="Compute population-level statistics for z-score comparisons",
    selection=AssetSelection.assets(
        "training_data",
        "population_statistics",
    ),
    tags={
        "pipeline": "model_training",
    },
)

