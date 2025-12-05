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

# Lazy import streaming router to avoid crashing if dependencies are missing
streaming_router = None
try:
    from .streaming import router as streaming_router
except ImportError as e:
    import logging
    logging.getLogger(__name__).warning(f"Streaming router not available: {e}")

__all__ = ["RecommendationEngine", "streaming_router"]

