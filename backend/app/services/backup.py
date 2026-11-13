from datetime import date, datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Attempt,
    AttemptAnswer,
    Card,
    CardReview,
    Note,
    Question,
    Subject,
)
from app.schemas import CardText, Choices, SubjectName


class SubjectBackup(BaseModel):
    id: int
    name: SubjectName


class CardBackup(BaseModel):
    id: int
    subject_id: int
    front: CardText
    back: CardText
    bookmarked: bool = False
    ease: float = Field(default=2.5, ge=1.0, le=5.0)
    interval_days: int = Field(default=0, ge=0)
    due_date: date | None = None
    last_reviewed_at: datetime | None = None


class QuestionBackup(BaseModel):
    id: int
    subject_id: int
    question: CardText
    choices: Choices
    correct_index: int = Field(ge=0)
    rationale: str | None = None
    source: Literal["manual", "csv", "ai"] = "manual"
    bookmarked: bool = False

    @model_validator(mode="after")
    def check_correct_index(self):
        if self.correct_index >= len(self.choices):
            raise ValueError("correct_index must point to one of the choices")
        return self


class NoteBackup(BaseModel):
    target_type: Literal["card", "question"]
    target_id: int
    text: str = Field(min_length=1, max_length=5000)


class AnswerBackup(BaseModel):
    question_id: int
    chosen_index: int = Field(ge=0)
    is_correct: bool


class AttemptBackup(BaseModel):
    mode: Literal["quiz", "mock"]
    started_at: datetime
    finished_at: datetime | None = None
    score: int = Field(ge=0)
    total: int = Field(ge=0)
    answers: list[AnswerBackup] = []


class Backup(BaseModel):
    version: Literal[1] = 1
    exported_at: datetime | None = None
    subjects: list[SubjectBackup] = []
    cards: list[CardBackup] = []
    questions: list[QuestionBackup] = []
    notes: list[NoteBackup] = []
    attempts: list[AttemptBackup] = []


class ImportResult(BaseModel):
    subjects_added: int = 0
    subjects_existing: int = 0
    cards_added: int = 0
    cards_skipped: int = 0
    questions_added: int = 0
    questions_skipped: int = 0
    notes_added: int = 0
    notes_skipped: int = 0
    attempts_added: int = 0
    attempts_skipped: int = 0


def export_backup(db: Session) -> Backup:
    subjects = db.scalars(select(Subject).order_by(Subject.id)).all()

    card_rows = db.execute(
        select(Card, CardReview)
        .outerjoin(CardReview, CardReview.card_id == Card.id)
        .order_by(Card.id)
    ).all()
    cards = []
    for card, review in card_rows:
        cards.append(
            CardBackup(
                id=card.id,
                subject_id=card.subject_id,
                front=card.front,
                back=card.back,
                bookmarked=card.bookmarked,
                ease=review.ease if review else 2.5,
                interval_days=review.interval_days if review else 0,
                due_date=review.due_date if review else None,
                last_reviewed_at=review.last_reviewed_at if review else None,
            )
        )

    questions = db.scalars(select(Question).order_by(Question.id)).all()
    notes = db.scalars(select(Note).order_by(Note.id)).all()

    answers_by_attempt: dict[int, list[AnswerBackup]] = {}
    for answer in db.scalars(select(AttemptAnswer).order_by(AttemptAnswer.id)):
        answers_by_attempt.setdefault(answer.attempt_id, []).append(
            AnswerBackup(
                question_id=answer.question_id,
                chosen_index=answer.chosen_index,
                is_correct=answer.is_correct,
            )
        )
    attempts = db.scalars(select(Attempt).order_by(Attempt.id)).all()

    return Backup(
        exported_at=datetime.now(timezone.utc),
        subjects=[SubjectBackup(id=s.id, name=s.name) for s in subjects],
        cards=cards,
        questions=[
            QuestionBackup(
                id=q.id,
                subject_id=q.subject_id,
                question=q.question,
                choices=q.choices,
                correct_index=q.correct_index,
                rationale=q.rationale,
                source=q.source,  # type: ignore[arg-type]
                bookmarked=q.bookmarked,
            )
            for q in questions
        ],
        notes=[
            NoteBackup(
                target_type=n.target_type,  # type: ignore[arg-type]
                target_id=n.target_id,
                text=n.text,
            )
            for n in notes
        ],
        attempts=[
            AttemptBackup(
                mode=a.mode,  # type: ignore[arg-type]
                started_at=a.started_at,
                finished_at=a.finished_at,
                score=a.score,
                total=a.total,
                answers=answers_by_attempt.get(a.id, []),
            )
            for a in attempts
        ],
    )


def import_backup(db: Session, backup: Backup) -> ImportResult:
    result = ImportResult()

    # Subjects: match by name, create the missing ones
    existing_subjects = {s.name: s.id for s in db.scalars(select(Subject))}
    subject_map: dict[int, int] = {}
    for item in backup.subjects:
        subject_id = existing_subjects.get(item.name)
        if subject_id is None:
            subject = Subject(name=item.name)
            db.add(subject)
            db.flush()
            subject_id = subject.id
            existing_subjects[item.name] = subject_id
            result.subjects_added += 1
        else:
            result.subjects_existing += 1
        subject_map[item.id] = subject_id

    # Cards: skip ones that already exist (same subject, front, and back)
    existing_cards = {
        (c.subject_id, c.front, c.back): c.id for c in db.scalars(select(Card))
    }
    card_map: dict[int, int] = {}
    for item in backup.cards:
        subject_id = subject_map.get(item.subject_id)
        if subject_id is None:
            result.cards_skipped += 1
            continue
        key = (subject_id, item.front, item.back)
        existing_id = existing_cards.get(key)
        if existing_id is not None:
            card_map[item.id] = existing_id
            result.cards_skipped += 1
            continue

        card = Card(
            subject_id=subject_id,
            front=item.front,
            back=item.back,
            bookmarked=item.bookmarked,
        )
        db.add(card)
        db.flush()
        review = CardReview(
            card_id=card.id,
            ease=item.ease,
            interval_days=item.interval_days,
            last_reviewed_at=item.last_reviewed_at,
        )
        if item.due_date is not None:
            review.due_date = item.due_date
        db.add(review)
        existing_cards[key] = card.id
        card_map[item.id] = card.id
        result.cards_added += 1

    # Questions: skip ones that already exist (same subject and question text)
    existing_questions = {
        (q.subject_id, q.question): q.id for q in db.scalars(select(Question))
    }
    question_map: dict[int, int] = {}
    for item in backup.questions:
        subject_id = subject_map.get(item.subject_id)
        if subject_id is None:
            result.questions_skipped += 1
            continue
        key = (subject_id, item.question)
        existing_id = existing_questions.get(key)
        if existing_id is not None:
            question_map[item.id] = existing_id
            result.questions_skipped += 1
            continue

        question = Question(
            subject_id=subject_id,
            question=item.question,
            choices=item.choices,
            correct_index=item.correct_index,
            rationale=item.rationale,
            source=item.source,
            bookmarked=item.bookmarked,
        )
        db.add(question)
        db.flush()
        existing_questions[key] = question.id
        question_map[item.id] = question.id
        result.questions_added += 1

    # Notes: attach to the matching card or question, skip duplicates
    existing_notes = {
        (n.target_type, n.target_id, n.text) for n in db.scalars(select(Note))
    }
    for item in backup.notes:
        id_map = card_map if item.target_type == "card" else question_map
        target_id = id_map.get(item.target_id)
        if target_id is None:
            result.notes_skipped += 1
            continue
        key = (item.target_type, target_id, item.text)
        if key in existing_notes:
            result.notes_skipped += 1
            continue
        db.add(Note(target_type=item.target_type, target_id=target_id, text=item.text))
        existing_notes.add(key)
        result.notes_added += 1

    # Attempts: only restored into a database that has no attempts yet
    has_attempts = db.scalar(select(Attempt.id).limit(1)) is not None
    if has_attempts:
        result.attempts_skipped = len(backup.attempts)
    else:
        for item in backup.attempts:
            attempt = Attempt(
                mode=item.mode,
                started_at=item.started_at,
                finished_at=item.finished_at,
                score=item.score,
                total=item.total,
            )
            db.add(attempt)
            db.flush()
            seen: set[int] = set()
            for answer in item.answers:
                question_id = question_map.get(answer.question_id)
                if question_id is None or question_id in seen:
                    continue
                seen.add(question_id)
                db.add(
                    AttemptAnswer(
                        attempt_id=attempt.id,
                        question_id=question_id,
                        chosen_index=answer.chosen_index,
                        is_correct=answer.is_correct,
                    )
                )
            result.attempts_added += 1

    return result