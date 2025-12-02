from celery import Celery

from app.core.config import settings


celery_app = Celery(
  "climbiq",
  broker=settings.REDIS_URL,
  backend=settings.REDIS_URL,
  include=[
    "workers.tasks.ml_tasks",
    "workers.tasks.notification_tasks",
  ],
)

celery_app.conf.update(
  task_serializer="json",
  accept_content=["json"],
  result_serializer="json",
  timezone="UTC",
  enable_utc=True,
  task_routes={
    "workers.tasks.ml_tasks.*": {"queue": "ml"},
    "workers.tasks.notification_tasks.*": {"queue": "notifications"},
  },
)


