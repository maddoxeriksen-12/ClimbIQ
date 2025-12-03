from contextlib import asynccontextmanager

import redis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health, recommendations, sessions, webhooks
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
  # Startup
  app.state.redis = redis.from_url(settings.REDIS_URL)
  yield
  # Shutdown
  app.state.redis.close()


app = FastAPI(
  title=settings.APP_NAME,
  lifespan=lifespan,
)

# CORS
app.add_middleware(
  CORSMiddleware,
  allow_origins=[
    "http://localhost:5173",
    "https://climbiq.vercel.app",
    "https://climbiqfrontend.vercel.app",
  ],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

# Routes
app.include_router(health.router, tags=["Health"])
app.include_router(
  sessions.router,
  prefix=settings.API_V1_PREFIX,
  tags=["Sessions"],
)
app.include_router(
  recommendations.router,
  prefix=settings.API_V1_PREFIX,
  tags=["Recommendations"],
)
app.include_router(
  webhooks.router,
  prefix=settings.API_V1_PREFIX,
  tags=["Webhooks"],
)


