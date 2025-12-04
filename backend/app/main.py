from contextlib import asynccontextmanager

import redis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health, recommendations, sessions, webhooks
from app.api.routes.expert_capture import router as expert_capture_router
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

# CORS - Allow all origins for now to debug
app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=False,  # Must be False when using "*" for origins
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
app.include_router(
  expert_capture_router,
  prefix=settings.API_V1_PREFIX,
  tags=["Expert Capture"],
)


