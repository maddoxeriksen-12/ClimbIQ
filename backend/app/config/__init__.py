"""
Configuration module for ClimbIQ.

Contains literature-based priors, edge case definitions, and other
configuration values used across the application.
"""

from .literature_priors import LITERATURE_PRIORS
from .edge_cases import EDGE_CASE_DIMENSIONS

__all__ = ["LITERATURE_PRIORS", "EDGE_CASE_DIMENSIONS"]

