from fastapi import APIRouter


router = APIRouter()


@router.get("/")
async def root():
  return {"status": "healthy", "service": "climbiq-api"}


@router.get("/health")
async def health_check():
  return {"status": "healthy", "service": "climbiq-api"}


@router.get("/debug/modules")
async def debug_modules():
  """Debug endpoint to check which modules are loaded"""
  modules = {
    "expert_capture": False,
    "grok_service": False,
  }
  
  try:
    from app.api.routes.expert_capture import router as ec_router
    modules["expert_capture"] = True
  except Exception as e:
    modules["expert_capture_error"] = str(e)
  
  try:
    from app.api.routes.expert_capture.grok_service import generate_scenarios_with_grok
    modules["grok_service"] = True
  except Exception as e:
    modules["grok_service_error"] = str(e)
  
  return modules


