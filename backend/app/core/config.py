from functools import lru_cache
import os

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
  # App
  APP_NAME: str = "ClimbIQ API"
  DEBUG: bool = False
  API_V1_PREFIX: str = "/api/v1"

  # Supabase - defaults for startup, will fail gracefully if not configured
  SUPABASE_URL: str = ""
  SUPABASE_ANON_KEY: str = ""
  SUPABASE_SERVICE_ROLE_KEY: str = ""

  # Redis - optional, will be None if not set
  REDIS_URL: str = ""

  # Stripe - defaults for startup
  STRIPE_SECRET_KEY: str = ""
  STRIPE_WEBHOOK_SECRET: str = ""
  STRIPE_PRICE_ID_PREMIUM: str = ""

  # ML
  MLFLOW_TRACKING_URI: str = "mlruns"
  MODEL_VERSION: str = "v1.0.0"

  # AI/LLM
  GROK_API_KEY: str = ""

  # Performance & Caching
  RULES_CACHE_TTL_SECONDS: int = 300      # 5 minutes - expert rules cache
  PRIORS_CACHE_TTL_SECONDS: int = 600     # 10 minutes - population priors cache
  MODEL_CACHE_TTL_SECONDS: int = 1800     # 30 minutes - user model outputs cache
  MAX_HISTORY_SESSIONS: int = 50          # Max sessions to load for context
  
  # Recommendations
  RECOMMENDATION_TIMEOUT_SECONDS: int = 10  # SSE streaming timeout
  MIN_SESSIONS_FOR_PERSONALIZATION: int = 10

  class Config:
    env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
  return Settings()


settings = get_settings()


