from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from google.genai import errors
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import GenerationLog
from app.services.gemini import (
    GeminiBadOutputError,
    GeminiBusyError,
    generate_drafts,
)

router = APIRouter(prefix="/generate", tags=["generate"])

PH_TZ = timezone(timedelta(hours=8))  # Philippines has no daylight saving


class DraftOut(BaseModel):
    question: str
    choices: list[str]
    correct_index: int
    rationale: str


class UsageOut(BaseModel):
    used: int
    limit: int
    remaining: int


class GenerateOut(BaseModel):
    drafts: list[DraftOut]
    usage: UsageOut


def start_of_today() -> datetime:
    now = datetime.now(PH_TZ)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def get_usage(db: Session) -> UsageOut:
    used = (
        db.scalar(
            select(func.count())
            .select_from(GenerationLog)
            .where(GenerationLog.created_at >= start_of_today())
        )
        or 0
    )
    limit = settings.daily_generation_limit
    return UsageOut(used=used, limit=limit, remaining=max(limit - used, 0))


def detect_mime(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


@router.get("/usage", response_model=UsageOut)
def usage(db: Session = Depends(get_db)):
    return get_usage(db)


@router.post("/from-image", response_model=GenerateOut)
def generate_from_image(
    file: UploadFile = File(...),
    num_questions: int = Form(5, ge=1, le=10),
    db: Session = Depends(get_db),
):
    current = get_usage(db)
    if current.remaining <= 0:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Daily generation limit reached. Try again tomorrow.",
        )

    if not settings.gemini_api_key:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "AI generation is not configured"
        )

    max_bytes = settings.max_image_mb * 1024 * 1024
    data = file.file.read(max_bytes + 1)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty file")
    if len(data) > max_bytes:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"Image is larger than {settings.max_image_mb} MB",
        )

    mime_type = detect_mime(data)
    if mime_type is None:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "Only JPEG, PNG, or WEBP images are supported",
        )

    try:
        drafts = generate_drafts(data, mime_type, num_questions)
    except GeminiBusyError:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "The AI is busy right now. Please try again in a minute.",
        )
    except GeminiBadOutputError:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "The AI returned an unreadable answer. Please try again.",
        )
    except errors.APIError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"AI service error ({getattr(exc, 'code', 'unknown')})",
        )

    db.add(GenerationLog())
    db.commit()

    return GenerateOut(
        drafts=[DraftOut(**d.model_dump()) for d in drafts],
        usage=get_usage(db),
    )