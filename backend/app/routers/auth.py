import time

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.security import create_access_token, require_auth, verify_passcode

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginIn(BaseModel):
    passcode: str = Field(min_length=1, max_length=72)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn):
    if not verify_passcode(data.passcode):
        time.sleep(1)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong passcode")
    return TokenOut(access_token=create_access_token())


@router.get("/me")
def me(_: None = Depends(require_auth)):
    return {"authenticated": True}