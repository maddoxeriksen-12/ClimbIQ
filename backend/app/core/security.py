from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.supabase import get_supabase_client


security = HTTPBearer()


async def get_current_user(
  credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict:
  """Verify Supabase JWT and return basic user data."""
  token = credentials.credentials
  supabase = get_supabase_client()

  try:
    user_response = supabase.auth.get_user(token)
    if not user_response.user:
      raise HTTPException(status_code=401, detail="Invalid token")

    return {
      "id": user_response.user.id,
      "email": user_response.user.email,
      "token": token,
    }
  except Exception as e:
    raise HTTPException(status_code=401, detail=str(e))


