from fastapi import APIRouter


router = APIRouter()


@router.get("/")
async def root():
  return {"status": "healthy", "service": "climbiq-api"}


@router.get("/health")
async def health_check():
  return {"status": "healthy", "service": "climbiq-api"}


