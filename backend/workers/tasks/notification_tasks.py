# Placeholder for notification tasks
# Add notification-related Celery tasks here as needed

from celery import shared_task


@shared_task
def send_notification(user_id: str, message: str, notification_type: str = "info") -> dict:
    """
    Placeholder task for sending notifications.
    Implement actual notification logic (email, push, etc.) as needed.
    """
    print(f"[send_notification] Would send to {user_id}: {message} (type={notification_type})")
    return {"status": "placeholder", "user_id": user_id}

