import math
import time

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.security import create_access_token, require_auth, verify_passcode
from app.services.login_limiter import (
    clear_failures,
    record_failure,
    seconds_until_allowed,
)

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginIn(BaseModel):
    passcode: str = Field(min_length=1, max_length=72)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn):
    wait = seconds_until_allowed()
    if wait > 0:
        minutes = math.ceil(wait / 60)
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Too many wrong attempts. Please try again in {minutes} "
            f"{'minute' if minutes == 1 else 'minutes'}.",
            headers={"Retry-After": str(wait)},
        )

    if not verify_passcode(data.passcode):
        record_failure()
        time.sleep(1)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong passcode")

    clear_failures()
    return TokenOut(access_token=create_access_token())


@router.get("/me")
def me(_: None = Depends(require_auth)):
    return {"authenticated": True}