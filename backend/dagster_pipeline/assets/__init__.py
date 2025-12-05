"""Dagster Assets for ClimbIQ Pipeline"""

from .expert_capture import (
    extracted_coefficient_signals,
    expert_derived_priors,
    blended_population_priors,
    updated_population_priors_table,
)

from .model_training import (
    training_data,
    trained_model,
    population_statistics,
)

__all__ = [
    # Expert capture assets
    "extracted_coefficient_signals",
    "expert_derived_priors", 
    "blended_population_priors",
    "updated_population_priors_table",
    # Model training assets
    "training_data",
    "trained_model",
    "population_statistics",
]

