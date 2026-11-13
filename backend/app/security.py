from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

ALGORITHM = "HS256"
bearer_scheme = HTTPBearer(auto_error=False)


def verify_passcode(passcode: str) -> bool:
    if not settings.app_passcode_hash:
        return False
    try:
        return bcrypt.checkpw(
            passcode.encode(), settings.app_passcode_hash.encode()
        )
    except ValueError:
        return False


def create_access_token() -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.access_token_expire_days
    )
    return jwt.encode(
        {"sub": "owner", "exp": expire}, settings.secret_key, algorithm=ALGORITHM
    )


def require_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> None:
    unauthorized = HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    try:
        jwt.decode(
            credentials.credentials, settings.secret_key, algorithms=[ALGORITHM]
        )
    except jwt.PyJWTError:
        raise unauthorized