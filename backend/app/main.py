from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import (
    attempts,
    auth,
    backup,
    bookmarks,
    cards,
    generate,
    notes,
    questions,
    stats,
    study,
    subjects,
)
from app.security import require_auth

app = FastAPI(title="Nursing Reviewer API")

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

protected = [Depends(require_auth)]

app.include_router(auth.router)
app.include_router(subjects.router, dependencies=protected)
app.include_router(cards.router, dependencies=protected)
app.include_router(questions.router, dependencies=protected)
app.include_router(generate.router, dependencies=protected)
app.include_router(study.router, dependencies=protected)
app.include_router(attempts.router, dependencies=protected)
app.include_router(stats.router, dependencies=protected)
app.include_router(notes.router, dependencies=protected)
app.include_router(bookmarks.router, dependencies=protected)
app.include_router(backup.router, dependencies=protected)


@app.get("/health")
def health():
    return {"status": "ok"}