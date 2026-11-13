from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Card, CardReview, Note, Subject
from app.schemas import CardCreate, CardOut, CardUpdate

router = APIRouter(prefix="/cards", tags=["cards"])


def get_card_or_404(db: Session, card_id: int) -> Card:
    card = db.get(Card, card_id)
    if card is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Card not found")
    return card


def ensure_subject_exists(db: Session, subject_id: int) -> None:
    if db.get(Subject, subject_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subject not found")


@router.get("", response_model=list[CardOut])
def list_cards(
    subject_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = select(Card).order_by(Card.id)
    if subject_id is not None:
        query = query.where(Card.subject_id == subject_id)
    return db.scalars(query).all()


@router.post("", response_model=CardOut, status_code=status.HTTP_201_CREATED)
def create_card(data: CardCreate, db: Session = Depends(get_db)):
    ensure_subject_exists(db, data.subject_id)
    card = Card(**data.model_dump())
    db.add(card)
    db.flush()
    db.add(CardReview(card_id=card.id))
    db.commit()
    db.refresh(card)
    return card


@router.put("/{card_id}", response_model=CardOut)
def update_card(card_id: int, data: CardUpdate, db: Session = Depends(get_db)):
    card = get_card_or_404(db, card_id)
    changes = {
        key: value
        for key, value in data.model_dump(exclude_unset=True).items()
        if value is not None
    }
    if "subject_id" in changes:
        ensure_subject_exists(db, changes["subject_id"])
    for key, value in changes.items():
        setattr(card, key, value)
    db.commit()
    db.refresh(card)
    return card


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_card(card_id: int, db: Session = Depends(get_db)):
    card = get_card_or_404(db, card_id)
    db.execute(
        delete(Note).where(Note.target_type == "card", Note.target_id == card_id)
    )
    db.delete(card)
    db.commit()