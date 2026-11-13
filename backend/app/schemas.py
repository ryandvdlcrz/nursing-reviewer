from datetime import datetime
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    model_validator,
)

SubjectName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
]
CardText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
Choice = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
Choices = Annotated[list[Choice], Field(min_length=2, max_length=6)]


class SubjectCreate(BaseModel):
    name: SubjectName


class SubjectUpdate(BaseModel):
    name: SubjectName


class SubjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    created_at: datetime


class CardCreate(BaseModel):
    subject_id: int
    front: CardText
    back: CardText


class CardUpdate(BaseModel):
    subject_id: int | None = None
    front: CardText | None = None
    back: CardText | None = None
    bookmarked: bool | None = None


class CardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subject_id: int
    front: str
    back: str
    bookmarked: bool
    created_at: datetime


class QuestionCreate(BaseModel):
    subject_id: int
    question: CardText
    choices: Choices
    correct_index: int = Field(ge=0)
    rationale: str | None = None
    source: Literal["manual", "csv", "ai"] = "manual"

    @model_validator(mode="after")
    def check_correct_index(self):
        if self.correct_index >= len(self.choices):
            raise ValueError("correct_index must point to one of the choices")
        return self


class QuestionUpdate(BaseModel):
    subject_id: int | None = None
    question: CardText | None = None
    choices: Choices | None = None
    correct_index: int | None = Field(default=None, ge=0)
    rationale: str | None = None
    bookmarked: bool | None = None


class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subject_id: int
    question: str
    choices: list[str]
    correct_index: int
    rationale: str | None
    source: str
    bookmarked: bool
    created_at: datetime