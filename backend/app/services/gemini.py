import time

from google import genai
from google.genai import errors, types
from pydantic import BaseModel, ValidationError

from app.config import settings

RETRYABLE_CODES = {429, 500, 503, 504}
RETRY_WAITS = [2, 5]  # seconds to wait before retry 1 and retry 2


class GeminiBusyError(Exception):
    """Gemini kept failing with temporary errors on every model we tried."""


class GeminiBadOutputError(Exception):
    """Gemini answered, but not in a usable format."""


class DraftQuestion(BaseModel):
    question: str
    choices: list[str]
    correct_index: int
    rationale: str


class DraftQuestionList(BaseModel):
    questions: list[DraftQuestion]


PROMPT = """You are helping a nursing student review her own lecture material.
The image is a screenshot or photo of her notes or slides.

Write {n} multiple-choice questions based ONLY on facts shown in the image.

Rules:
- Each question has exactly 4 choices, with exactly one correct answer.
- The correct answer must be supported by the image. Do not add outside facts.
- Wrong choices must be plausible but clearly wrong according to the image.
- Do not put letters or numbers like "A." in front of the choices.
- correct_index is the 0-based position of the correct choice. Vary it across questions.
- rationale is 1 to 3 sentences explaining why the answer is correct, using the image content.
- Write in the same language as the image.
- If the image is unreadable or has no study content, return an empty list.
"""


def _call_model(
    client: genai.Client,
    model: str,
    image_bytes: bytes,
    mime_type: str,
    num_questions: int,
) -> str | None:
    response = client.models.generate_content(
        model=model,
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            PROMPT.format(n=num_questions),
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=DraftQuestionList,
            temperature=0.3,
        ),
    )
    return response.text


def _call_with_retry(client, model, image_bytes, mime_type, num_questions):
    for attempt in range(len(RETRY_WAITS) + 1):
        try:
            return _call_model(client, model, image_bytes, mime_type, num_questions)
        except errors.APIError as exc:
            code = getattr(exc, "code", None)
            if code not in RETRYABLE_CODES or attempt == len(RETRY_WAITS):
                raise
            time.sleep(RETRY_WAITS[attempt])


def _clean(drafts: DraftQuestionList, num_questions: int) -> list[DraftQuestion]:
    cleaned: list[DraftQuestion] = []
    for draft in drafts.questions:
        question = draft.question.strip()
        choices = [c.strip() for c in draft.choices]
        if not question or any(not c for c in choices):
            continue
        if not 2 <= len(choices) <= 6:
            continue
        if not 0 <= draft.correct_index < len(choices):
            continue
        cleaned.append(
            DraftQuestion(
                question=question,
                choices=choices,
                correct_index=draft.correct_index,
                rationale=draft.rationale.strip(),
            )
        )
    return cleaned[:num_questions]


def generate_drafts(
    image_bytes: bytes, mime_type: str, num_questions: int
) -> list[DraftQuestion]:
    client = genai.Client(
        api_key=settings.gemini_api_key,
        http_options=types.HttpOptions(timeout=60_000),  # milliseconds
    )

    models = [settings.gemini_model]
    if settings.gemini_fallback_model and (
        settings.gemini_fallback_model != settings.gemini_model
    ):
        models.append(settings.gemini_fallback_model)

    text = None
    succeeded = False
    for model in models:
        try:
            text = _call_with_retry(
                client, model, image_bytes, mime_type, num_questions
            )
            succeeded = True
            break
        except errors.APIError as exc:
            code = getattr(exc, "code", None)
            if code in RETRYABLE_CODES or code == 404:
                continue  # try the next model
            raise

    if not succeeded:
        raise GeminiBusyError()
    if not text:
        raise GeminiBadOutputError()

    try:
        drafts = DraftQuestionList.model_validate_json(text)
    except ValidationError:
        raise GeminiBadOutputError()

    return _clean(drafts, num_questions)