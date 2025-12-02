from supabase import Client, create_client

from app.core.config import settings


def get_supabase_client() -> Client:
  """Service-role Supabase client for backend operations."""
  return create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_ROLE_KEY,
  )


def get_supabase_client_with_token(access_token: str) -> Client:
  """Client authenticated as a specific user via access token."""
  client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_ANON_KEY,
  )
  client.auth.set_session(access_token, "")
  return client


