"""
Dagster Definitions for ClimbIQ Pipeline

This module defines all the assets, jobs, sensors, and resources
for the expert capture and model training systems.
"""

from dagster import Definitions, load_assets_from_modules, EnvVar

from . import assets
from .resources import SupabaseResource, LiteraturePriorsResource
from .jobs import (
    prior_extraction_job,
    signal_extraction_job,
    nightly_training_job,
    user_model_training_job,
    population_stats_job,
)
from .sensors import (
    new_consensus_sensor,
    stale_priors_sensor,
    urgent_consensus_sensor,
    nightly_training_sensor,
    session_completion_sensor,
)


# Load all assets from the assets module
all_assets = load_assets_from_modules([assets])


# Define all resources
resources = {
    "supabase": SupabaseResource(
        url=EnvVar("SUPABASE_URL"),
        key=EnvVar("SUPABASE_SERVICE_KEY"),
    ),
    "literature_priors": LiteraturePriorsResource(),
}


# Create the Dagster Definitions object
defs = Definitions(
    assets=all_assets,
    jobs=[
        # Expert capture jobs
        prior_extraction_job,
        signal_extraction_job,
        # Model training jobs
        nightly_training_job,
        user_model_training_job,
        population_stats_job,
    ],
    sensors=[
        # Expert capture sensors
        new_consensus_sensor,
        stale_priors_sensor,
        urgent_consensus_sensor,
        # Model training sensors
        nightly_training_sensor,
        session_completion_sensor,
    ],
    resources=resources,
)

