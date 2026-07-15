"""Thin OpenAI client wrapper with graceful degradation."""
from __future__ import annotations

from ..config import get_settings


def is_enabled() -> bool:
    return bool(get_settings().openai_api_key)


def complete(system: str, user: str, max_tokens: int = 600, temperature: float = 0.7) -> str | None:
    """Returns generated text, or None if OpenAI is unavailable/errors."""
    settings = get_settings()
    if not settings.openai_api_key:
        return None
    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.openai_api_key)
        resp = client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception:
        return None
