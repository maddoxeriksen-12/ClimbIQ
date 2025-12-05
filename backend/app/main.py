from contextlib import asynccontextmanager
import logging

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

# Try to import streaming recommendations router
try:
    from app.api.routes.recommendations.streaming import router as streaming_router
    logger.info("✅ Successfully imported streaming recommendations router")
    STREAMING_AVAILABLE = True
except Exception as e:
    logger.error(f"❌ Failed to import streaming router: {e}")
    streaming_router = None
    STREAMING_AVAILABLE = False


@asynccontextmanager
async def lifespan(app: FastAPI):
  # Startup - Redis is optional
  if settings.REDIS_URL:
      try:
          import redis
          app.state.redis = redis.from_url(settings.REDIS_URL)
          logger.info("✅ Redis connected")
      except Exception as e:
          logger.warning(f"⚠️ Redis connection failed: {e}")
          app.state.redis = None
  else:
      logger.warning("⚠️ REDIS_URL not set, running without Redis")
      app.state.redis = None
  
  yield
  
  # Shutdown
  if hasattr(app.state, 'redis') and app.state.redis:
      try:
          app.state.redis.close()
      except Exception:
          pass


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

if STREAMING_AVAILABLE and streaming_router:
    app.include_router(
      streaming_router,
      prefix=f"{settings.API_V1_PREFIX}/recommendations",
      tags=["Recommendations Streaming"],
    )
    logger.info("✅ Streaming recommendations router registered")
else:
    logger.warning("⚠️ Streaming recommendations router not available")


