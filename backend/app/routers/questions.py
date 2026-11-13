from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Note, Question, Subject
from app.schemas import QuestionCreate, QuestionOut, QuestionUpdate

router = APIRouter(prefix="/questions", tags=["questions"])


def get_question_or_404(db: Session, question_id: int) -> Question:
    question = db.get(Question, question_id)
    if question is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")
    return question


def ensure_subject_exists(db: Session, subject_id: int) -> None:
    if db.get(Subject, subject_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subject not found")


@router.get("", response_model=list[QuestionOut])
def list_questions(
    subject_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = select(Question).order_by(Question.id)
    if subject_id is not None:
        query = query.where(Question.subject_id == subject_id)
    return db.scalars(query).all()


@router.post("", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
def create_question(data: QuestionCreate, db: Session = Depends(get_db)):
    ensure_subject_exists(db, data.subject_id)
    question = Question(**data.model_dump())
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


@router.put("/{question_id}", response_model=QuestionOut)
def update_question(
    question_id: int, data: QuestionUpdate, db: Session = Depends(get_db)
):
    question = get_question_or_404(db, question_id)
    changes = {
        key: value
        for key, value in data.model_dump(exclude_unset=True).items()
        if value is not None
    }
    if "subject_id" in changes:
        ensure_subject_exists(db, changes["subject_id"])

    final_choices = changes.get("choices", question.choices)
    final_index = changes.get("correct_index", question.correct_index)
    if final_index >= len(final_choices):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "correct_index must point to one of the choices",
        )

    for key, value in changes.items():
        setattr(question, key, value)
    db.commit()
    db.refresh(question)
    return question


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(question_id: int, db: Session = Depends(get_db)):
    question = get_question_or_404(db, question_id)
    db.execute(
        delete(Note).where(
            Note.target_type == "question", Note.target_id == question_id
        )
    )
    db.delete(question)
    db.commit()