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

