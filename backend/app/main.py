from contextlib import asynccontextmanager
import logging

import redis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from app.api.routes import health, recommendations, sessions, webhooks
from app.core.config import settings

# Try to import expert_capture with error handling
try:
    from app.api.routes.expert_capture import router as expert_capture_router
    logger.info("✅ Successfully imported expert_capture router")
    EXPERT_CAPTURE_AVAILABLE = True
except Exception as e:
    logger.error(f"❌ Failed to import expert_capture router: {e}")
    expert_capture_router = None
    EXPERT_CAPTURE_AVAILABLE = False


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
if EXPERT_CAPTURE_AVAILABLE and expert_capture_router:
    app.include_router(
      expert_capture_router,
      prefix=settings.API_V1_PREFIX,
      tags=["Expert Capture"],
    )
    logger.info("✅ Expert Capture router registered")
else:
    logger.warning("⚠️ Expert Capture router not available")


