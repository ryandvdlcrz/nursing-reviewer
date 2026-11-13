from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import case, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Attempt, AttemptAnswer, Question, Subject

router = APIRouter(prefix="/attempts", tags=["attempts"])


class AttemptStart(BaseModel):
    mode: Literal["quiz", "mock"]
    subject_id: int | None = None
    num_questions: int = Field(default=10, ge=1, le=100)


class QuizQuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subject_id: int
    question: str
    choices: list[str]
    bookmarked: bool


class AttemptOut(BaseModel):
    id: int
    mode: str
    started_at: datetime
    total: int
    questions: list[QuizQuestionOut]


class AnswerIn(BaseModel):
    question_id: int
    chosen_index: int = Field(ge=0)


class AnswerOut(BaseModel):
    is_correct: bool
    correct_index: int
    rationale: str | None


class SubjectBreakdown(BaseModel):
    subject_id: int
    subject_name: str
    correct: int
    answered: int


class FinishOut(BaseModel):
    attempt_id: int
    mode: str
    score: int
    total: int
    percent: float
    started_at: datetime
    finished_at: datetime
    breakdown: list[SubjectBreakdown]


def get_attempt_or_404(db: Session, attempt_id: int) -> Attempt:
    attempt = db.get(Attempt, attempt_id)
    if attempt is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attempt not found")
    return attempt


@router.post("", response_model=AttemptOut, status_code=status.HTTP_201_CREATED)
def start_attempt(data: AttemptStart, db: Session = Depends(get_db)):
    query = select(Question)
    if data.subject_id is not None:
        if db.get(Subject, data.subject_id) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Subject not found")
        query = query.where(Question.subject_id == data.subject_id)

    questions = db.scalars(
        query.order_by(func.random()).limit(data.num_questions)
    ).all()
    if not questions:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No questions available")

    attempt = Attempt(mode=data.mode, total=len(questions))
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    return AttemptOut(
        id=attempt.id,
        mode=attempt.mode,
        started_at=attempt.started_at,
        total=attempt.total,
        questions=[QuizQuestionOut.model_validate(q) for q in questions],
    )


@router.post("/{attempt_id}/answer", response_model=AnswerOut)
def answer_question(
    attempt_id: int, data: AnswerIn, db: Session = Depends(get_db)
):
    attempt = get_attempt_or_404(db, attempt_id)
    if attempt.finished_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Attempt already finished")

    question = db.get(Question, data.question_id)
    if question is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")
    if data.chosen_index >= len(question.choices):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "chosen_index must point to one of the choices",
        )

    is_correct = data.chosen_index == question.correct_index
    db.add(
        AttemptAnswer(
            attempt_id=attempt.id,
            question_id=question.id,
            chosen_index=data.chosen_index,
            is_correct=is_correct,
        )
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Question already answered in this attempt",
        )

    return AnswerOut(
        is_correct=is_correct,
        correct_index=question.correct_index,
        rationale=question.rationale,
    )


@router.post("/{attempt_id}/finish", response_model=FinishOut)
def finish_attempt(attempt_id: int, db: Session = Depends(get_db)):
    attempt = get_attempt_or_404(db, attempt_id)

    if attempt.finished_at is None:
        score = (
            db.scalar(
                select(func.count())
                .select_from(AttemptAnswer)
                .where(
                    AttemptAnswer.attempt_id == attempt.id,
                    AttemptAnswer.is_correct.is_(True),
                )
            )
            or 0
        )
        attempt.score = score
        attempt.finished_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(attempt)

    rows = db.execute(
        select(
            Subject.id,
            Subject.name,
            func.count(AttemptAnswer.id).label("answered"),
            func.sum(case((AttemptAnswer.is_correct.is_(True), 1), else_=0)).label(
                "correct"
            ),
        )
        .select_from(Subject)
        .join(Question, Question.subject_id == Subject.id)
        .join(AttemptAnswer, AttemptAnswer.question_id == Question.id)
        .where(AttemptAnswer.attempt_id == attempt.id)
        .group_by(Subject.id, Subject.name)
        .order_by(Subject.name)
    ).all()

    percent = round(attempt.score / attempt.total * 100, 1) if attempt.total else 0.0

    return FinishOut(
        attempt_id=attempt.id,
        mode=attempt.mode,
        score=attempt.score,
        total=attempt.total,
        percent=percent,
        started_at=attempt.started_at,
        finished_at=attempt.finished_at,
        breakdown=[
            SubjectBreakdown(
                subject_id=row.id,
                subject_name=row.name,
                correct=int(row.correct or 0),
                answered=row.answered,
            )
            for row in rows
        ],
    )