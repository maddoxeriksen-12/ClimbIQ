"""
Recommendations module for ClimbIQ.

Contains the Bayesian recommendation engine that uses:
- Population priors (literature + expert-derived)
- Expert rules (safety, interaction, performance)
"""

from .recommendation_engine import RecommendationEngine

__all__ = ["RecommendationEngine"]

