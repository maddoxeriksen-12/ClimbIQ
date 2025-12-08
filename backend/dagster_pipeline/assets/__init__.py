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

from .learning_loop import (
    prediction_accuracy_tracking,
    updated_user_deviations,
    acwr_refresh,
    user_fatigue_tracking,
    prediction_stats,
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
    # Learning loop assets (Layer 5)
    "prediction_accuracy_tracking",
    "updated_user_deviations",
    "acwr_refresh",
    "user_fatigue_tracking",
    "prediction_stats",
]

