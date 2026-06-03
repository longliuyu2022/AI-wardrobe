from datetime import UTC, datetime

from fastapi import APIRouter

router = APIRouter()


@router.get("/health", tags=["health"])
def health_check() -> dict:
    return {
        "status": "ok",
        "version": "0.1.0",
        "time": datetime.now(UTC).isoformat(),
    }
