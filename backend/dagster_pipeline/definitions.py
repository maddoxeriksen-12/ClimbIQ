"""
Dagster Definitions for ClimbIQ Expert Capture Pipeline

This module defines all the assets, jobs, sensors, and resources
for the expert capture system.
"""

from dagster import Definitions, load_assets_from_modules, EnvVar

from . import assets
from .resources import SupabaseResource, LiteraturePriorsResource
from .jobs import prior_extraction_job, signal_extraction_job
from .sensors import new_consensus_sensor, stale_priors_sensor, urgent_consensus_sensor


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
        prior_extraction_job,
        signal_extraction_job,
    ],
    sensors=[
        new_consensus_sensor,
        stale_priors_sensor,
        urgent_consensus_sensor,
    ],
    resources=resources,
)

