"""
Recommendations module for ClimbIQ.

Contains the Bayesian recommendation engine that uses:
- Population priors (literature + expert-derived)
- Expert rules (safety, interaction, performance)

Endpoints:
- POST /recommendations/pre-session - Non-streaming recommendations
- POST /recommendations/pre-session/stream - SSE streaming recommendations
"""

from .recommendation_engine import RecommendationEngine
from .streaming import router as streaming_router

__all__ = ["RecommendationEngine", "streaming_router"]

