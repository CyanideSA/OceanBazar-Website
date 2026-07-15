"""Shared-secret API-key authentication."""
from fastapi import Header, HTTPException, status

from .config import get_settings


async def require_api_key(x_ml_api_key: str | None = Header(default=None)) -> None:
    expected = get_settings().ml_service_api_key
    if not expected:
        # Auth disabled (local dev). Allow.
        return
    if x_ml_api_key != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-ML-API-Key",
        )
