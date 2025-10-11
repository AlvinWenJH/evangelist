from fastapi import APIRouter, Query, HTTPException

from app.modules.response_model.main import ResponseModel

import logging
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/auth", tags=["auth"])

APP_USER = os.getenv("APP_USER")
APP_PASSWORD = os.getenv("APP_PASSWORD")


@router.post("/sign-in")
def sign_in(
    username: str = Query(..., description="Username"),
    password: str = Query(..., description="Password"),
):
    if username != APP_USER or password != APP_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return ResponseModel(message="Successfully signed in")
