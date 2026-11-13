from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Card, CardReview
from app.services.srs import Rating, schedule

router = APIRouter(prefix="/study", tags=["study"])

PH_TZ = timezone(timedelta(hours=8))  # Philippines has no daylight saving


def today_ph() -> date:
    return datetime.now(PH_TZ).date()


class StudyCardOut(BaseModel):
    id: int
    subject_id: int
    front: str
    back: str
    bookmarked: bool
    ease: float
    interval_days: int
    due_date: date


class DueOut(BaseModel):
    total_due: int
    cards: list[StudyCardOut]


class ReviewIn(BaseModel):
    card_id: int
    rating: Rating


class ReviewOut(BaseModel):
    card_id: int
    ease: float
    interval_days: int
    due_date: date


@router.get("/due", response_model=DueOut)
def get_due_cards(
    subject_id: int | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    today = today_ph()
    conditions = [CardReview.due_date <= today]
    if subject_id is not None:
        conditions.append(Card.subject_id == subject_id)

    total_due = (
        db.scalar(
            select(func.count())
            .select_from(Card)
            .join(CardReview, CardReview.card_id == Card.id)
            .where(*conditions)
        )
        or 0
    )

    rows = db.execute(
        select(Card, CardReview)
        .join(CardReview, CardReview.card_id == Card.id)
        .where(*conditions)
        .order_by(CardReview.due_date, Card.id)
        .limit(limit)
    ).all()

    cards = [
        StudyCardOut(
            id=card.id,
            subject_id=card.subject_id,
            front=card.front,
            back=card.back,
            bookmarked=card.bookmarked,
            ease=review.ease,
            interval_days=review.interval_days,
            due_date=review.due_date,
        )
        for card, review in rows
    ]
    return DueOut(total_due=total_due, cards=cards)


@router.post("/review", response_model=ReviewOut)
def review_card(data: ReviewIn, db: Session = Depends(get_db)):
    card = db.get(Card, data.card_id)
    if card is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Card not found")

    review = db.scalar(select(CardReview).where(CardReview.card_id == card.id))
    if review is None:
        review = CardReview(card_id=card.id, ease=2.5, interval_days=0)
        db.add(review)

    ease, interval, due = schedule(
        data.rating, review.ease, review.interval_days, today_ph()
    )
    review.ease = ease
    review.interval_days = interval
    review.due_date = due
    review.last_reviewed_at = datetime.now(timezone.utc)
    db.commit()

    return ReviewOut(
        card_id=card.id, ease=ease, interval_days=interval, due_date=due
    )