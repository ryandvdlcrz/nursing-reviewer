from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Attempt, AttemptAnswer, Card, CardReview, Question, Subject
from app.routers.study import today_ph

router = APIRouter(prefix="/stats", tags=["stats"])


class SubjectStats(BaseModel):
    subject_id: int
    name: str
    cards: int
    questions: int
    due_cards: int
    answered: int
    correct: int
    accuracy: float | None


class RecentAttempt(BaseModel):
    id: int
    mode: str
    score: int
    total: int
    percent: float
    finished_at: datetime


def _counts(db: Session, stmt) -> dict[int, int]:
    return {row[0]: row[1] for row in db.execute(stmt).all()}


def build_subject_stats(db: Session) -> list[SubjectStats]:
    subjects = db.scalars(select(Subject).order_by(Subject.name)).all()

    card_counts = _counts(
        db,
        select(Card.subject_id, func.count())
        .select_from(Card)
        .group_by(Card.subject_id),
    )
    question_counts = _counts(
        db,
        select(Question.subject_id, func.count())
        .select_from(Question)
        .group_by(Question.subject_id),
    )
    due_counts = _counts(
        db,
        select(Card.subject_id, func.count())
        .select_from(Card)
        .join(CardReview, CardReview.card_id == Card.id)
        .where(CardReview.due_date <= today_ph())
        .group_by(Card.subject_id),
    )

    answer_rows = db.execute(
        select(
            Question.subject_id,
            func.count(AttemptAnswer.id),
            func.sum(case((AttemptAnswer.is_correct.is_(True), 1), else_=0)),
        )
        .select_from(AttemptAnswer)
        .join(Question, Question.id == AttemptAnswer.question_id)
        .group_by(Question.subject_id)
    ).all()
    answers = {row[0]: (row[1], int(row[2] or 0)) for row in answer_rows}

    result = []
    for subject in subjects:
        answered, correct = answers.get(subject.id, (0, 0))
        accuracy = round(correct / answered * 100, 1) if answered else None
        result.append(
            SubjectStats(
                subject_id=subject.id,
                name=subject.name,
                cards=card_counts.get(subject.id, 0),
                questions=question_counts.get(subject.id, 0),
                due_cards=due_counts.get(subject.id, 0),
                answered=answered,
                correct=correct,
                accuracy=accuracy,
            )
        )
    return result


@router.get("/subjects", response_model=list[SubjectStats])
def subject_stats(db: Session = Depends(get_db)):
    return build_subject_stats(db)


@router.get("/weak", response_model=list[SubjectStats])
def weak_areas(
    min_answered: int = Query(default=5, ge=1),
    limit: int = Query(default=3, ge=1, le=20),
    db: Session = Depends(get_db),
):
    candidates = [
        s
        for s in build_subject_stats(db)
        if s.accuracy is not None and s.answered >= min_answered
    ]
    candidates.sort(key=lambda s: s.accuracy)
    return candidates[:limit]


@router.get("/recent", response_model=list[RecentAttempt])
def recent_attempts(
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    attempts = db.scalars(
        select(Attempt)
        .where(Attempt.finished_at.is_not(None))
        .order_by(Attempt.finished_at.desc())
        .limit(limit)
    ).all()
    return [
        RecentAttempt(
            id=a.id,
            mode=a.mode,
            score=a.score,
            total=a.total,
            percent=round(a.score / a.total * 100, 1) if a.total else 0.0,
            finished_at=a.finished_at,
        )
        for a in attempts
    ]