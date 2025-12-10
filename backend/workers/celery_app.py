from celery import Celery
from celery.schedules import crontab

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
  # Celery Beat schedule for periodic tasks
  beat_schedule={
    # Process embedding jobs every 30 seconds
    "process-embedding-jobs": {
      "task": "workers.tasks.ml_tasks.process_embedding_jobs",
      "schedule": 30.0,  # every 30 seconds
      "args": (10,),  # batch_size
      "options": {"queue": "ml"},
    },
    # Retry failed embedding jobs every 5 minutes
    "retry-failed-embedding-jobs": {
      "task": "workers.tasks.ml_tasks.retry_failed_embedding_jobs",
      "schedule": 300.0,  # every 5 minutes
      "options": {"queue": "ml"},
    },
  },
)


