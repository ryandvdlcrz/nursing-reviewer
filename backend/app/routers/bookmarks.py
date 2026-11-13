from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Card, Question
from app.schemas import CardOut, QuestionOut

router = APIRouter(prefix="/bookmarks", tags=["bookmarks"])


class BookmarksOut(BaseModel):
    cards: list[CardOut]
    questions: list[QuestionOut]


@router.get("", response_model=BookmarksOut)
def list_bookmarks(
    subject_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    card_query = select(Card).where(Card.bookmarked.is_(True)).order_by(Card.id)
    question_query = (
        select(Question).where(Question.bookmarked.is_(True)).order_by(Question.id)
    )
    if subject_id is not None:
        card_query = card_query.where(Card.subject_id == subject_id)
        question_query = question_query.where(Question.subject_id == subject_id)

    return BookmarksOut(
        cards=[CardOut.model_validate(c) for c in db.scalars(card_query).all()],
        questions=[
            QuestionOut.model_validate(q) for q in db.scalars(question_query).all()
        ],
    )