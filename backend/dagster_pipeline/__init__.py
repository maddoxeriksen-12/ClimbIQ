"""
Dagster Pipeline for ClimbIQ Expert Capture System

This pipeline handles:
- Extraction of coefficient signals from expert scenario reviews
- Aggregation of expert-derived priors using meta-analysis
- Blending expert priors with literature priors
- Updating population_priors table for the recommendation engine
"""

from .definitions import defs

__all__ = ["defs"]

