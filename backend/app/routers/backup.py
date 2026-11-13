from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers.study import today_ph
from app.services.backup import Backup, ImportResult, export_backup, import_backup

router = APIRouter(tags=["backup"])

MAX_BACKUP_MB = 20


@router.get("/export/json")
def export_json(db: Session = Depends(get_db)):
    backup = export_backup(db)
    filename = f"nursing-reviewer-backup-{today_ph().isoformat()}.json"
    return JSONResponse(
        content=jsonable_encoder(backup),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import/json", response_model=ImportResult)
def import_json(file: UploadFile = File(...), db: Session = Depends(get_db)):
    max_bytes = MAX_BACKUP_MB * 1024 * 1024
    data = file.file.read(max_bytes + 1)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty file")
    if len(data) > max_bytes:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"Backup file is larger than {MAX_BACKUP_MB} MB",
        )

    try:
        backup = Backup.model_validate_json(data)
    except ValidationError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Invalid backup file ({exc.error_count()} problems)",
        )

    try:
        result = import_backup(db, backup)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return result