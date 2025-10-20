from fastapi import APIRouter, Query, HTTPException, Depends, UploadFile, File
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from uuid import UUID
from pydantic import BaseModel

from app.modules.response_model.main import ResponseModel
from app.modules.postgredb.main import SessionLocal


import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/invocations", tags=["invocations"])


class InvocationPayload(BaseModel):
    name: str = Query(..., description="User name")
    email: str = Query(..., description="User email")


# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/test")
def test(payload: InvocationPayload):
    try:
        names = [n.strip().lower() for n in payload.name.split(" ")]
        for n in names:
            if n in payload.email.lower():
                return ResponseModel(
                    success=True,
                    message="Found",
                )
        return ResponseModel(
            success=True,
            message="Not Found",
        )
    except Exception as e:
        logger.error(f"Error creating invocation: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
