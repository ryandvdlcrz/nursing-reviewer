from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, StringConstraints
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Card, Note, Question

router = APIRouter(prefix="/notes", tags=["notes"])

NoteText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)
]
TargetType = Literal["card", "question"]


class NoteCreate(BaseModel):
    target_type: TargetType
    target_id: int
    text: NoteText


class NoteUpdate(BaseModel):
    text: NoteText


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    target_type: str
    target_id: int
    text: str
    created_at: datetime


def ensure_target_exists(db: Session, target_type: str, target_id: int) -> None:
    model = Card if target_type == "card" else Question
    if db.get(model, target_id) is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"{target_type.capitalize()} not found"
        )


def get_note_or_404(db: Session, note_id: int) -> Note:
    note = db.get(Note, note_id)
    if note is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found")
    return note


@router.get("", response_model=list[NoteOut])
def list_notes(
    target_type: TargetType = Query(...),
    target_id: int = Query(...),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(Note)
        .where(Note.target_type == target_type, Note.target_id == target_id)
        .order_by(Note.created_at, Note.id)
    ).all()


@router.post("", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
def create_note(data: NoteCreate, db: Session = Depends(get_db)):
    ensure_target_exists(db, data.target_type, data.target_id)
    note = Note(**data.model_dump())
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.put("/{note_id}", response_model=NoteOut)
def update_note(note_id: int, data: NoteUpdate, db: Session = Depends(get_db)):
    note = get_note_or_404(db, note_id)
    note.text = data.text
    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: int, db: Session = Depends(get_db)):
    note = get_note_or_404(db, note_id)
    db.delete(note)
    db.commit()