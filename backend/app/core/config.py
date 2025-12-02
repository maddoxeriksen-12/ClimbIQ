from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
  # App
  APP_NAME: str = "ClimbIQ API"
  DEBUG: bool = False
  API_V1_PREFIX: str = "/api/v1"

  # Supabase
  SUPABASE_URL: str
  SUPABASE_ANON_KEY: str
  SUPABASE_SERVICE_ROLE_KEY: str

  # Redis
  REDIS_URL: str

  # Stripe
  STRIPE_SECRET_KEY: str
  STRIPE_WEBHOOK_SECRET: str
  STRIPE_PRICE_ID_PREMIUM: str

  # ML
  MLFLOW_TRACKING_URI: str = "mlruns"
  MODEL_VERSION: str = "v1.0.0"

  class Config:
    env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
  return Settings()


settings = get_settings()


