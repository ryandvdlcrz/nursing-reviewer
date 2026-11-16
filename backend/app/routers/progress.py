from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Attempt, CardReview
from app.routers.study import today_ph

router = APIRouter(prefix="/progress", tags=["progress"])


class ResetIn(BaseModel):
    scope: Literal["quiz", "cards", "all"]


class ResetOut(BaseModel):
    attempts_deleted: int = 0
    cards_reset: int = 0


@router.post("/reset", response_model=ResetOut)
def reset_progress(data: ResetIn, db: Session = Depends(get_db)):
    result = ResetOut()

    if data.scope in ("quiz", "all"):
        result.attempts_deleted = (
            db.scalar(select(func.count()).select_from(Attempt)) or 0
        )
        db.execute(delete(Attempt))

    if data.scope in ("cards", "all"):
        outcome = db.execute(
            update(CardReview).values(
                ease=2.5,
                interval_days=0,
                due_date=today_ph(),
                last_reviewed_at=None,
            )
        )
        result.cards_reset = getattr(outcome, "rowcount", 0) or 0

    db.commit()
    return result