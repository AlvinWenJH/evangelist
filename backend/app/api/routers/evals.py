from fastapi import APIRouter, Query, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime

from app.modules.response_model.main import ResponseModel
from app.modules.postgredb.main import SessionLocal
from app.modules.evals.main import Evals
from app.modules.evals.models import EvalStatus

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/evals", tags=["evals"])


# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Pydantic models for request bodies
class CreateEvalRequest(BaseModel):
    name: str
    description: Optional[str] = None
    suite_id: Optional[UUID] = None
    dataset_id: Optional[UUID] = None
    eval_metadata: Optional[Dict[str, Any]] = None


class UpdateEvalRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    suite_id: Optional[UUID] = None
    dataset_id: Optional[UUID] = None
    total_requests: Optional[int] = None
    successful_requests: Optional[int] = None
    failed_requests: Optional[int] = None
    eval_metadata: Optional[Dict[str, Any]] = None
    status: Optional[EvalStatus] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


@router.get("/")
def get_evals(
    page: int = Query(1, description="Page number"),
    limit: int = Query(10, description="Number of items per page"),
    keyword: str = Query(None, description="Search keyword"),
    status: Optional[EvalStatus] = Query(None, description="Filter by status"),
    suite_id: Optional[UUID] = Query(None, description="Filter by suite ID"),
    db: Session = Depends(get_db),
):
    """Get all evaluations with pagination, optional keyword search, status filter, and suite filter"""
    try:
        evals_service = Evals(db)
        result = evals_service.get_evals(
            page=page, page_size=limit, keyword=keyword, status=status, suite_id=suite_id
        )

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])

        # Transform response to match expected format
        data = result["data"]
        return ResponseModel(
            message=result["message"],
            data={
                "evals": data["evaluations"],
                "page": data["pagination"]["page"],
                "limit": data["pagination"]["page_size"],
                "total": data["pagination"]["total_count"],
                "total_page": data["pagination"]["total_pages"],
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching evaluations: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/")
def create_eval(request: CreateEvalRequest, db: Session = Depends(get_db)):
    """Create a new evaluation"""
    try:
        evals_service = Evals(db)
        result = evals_service.create_eval(
            name=request.name,
            description=request.description,
            suite_id=request.suite_id,
            dataset_id=request.dataset_id,
            eval_metadata=request.eval_metadata,
        )

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])

        return ResponseModel(message=result["message"], data=result["data"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating evaluation: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{eval_id}")
def get_eval(eval_id: UUID, db: Session = Depends(get_db)):
    """Get evaluation by ID"""
    try:
        evals_service = Evals(db)
        result = evals_service.get_eval(eval_id)

        if not result["success"]:
            if "not found" in result["message"].lower():
                raise HTTPException(status_code=404, detail=result["message"])
            raise HTTPException(status_code=400, detail=result["message"])

        return ResponseModel(message=result["message"], data=result["data"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving evaluation {eval_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/{eval_id}")
def update_eval(
    eval_id: UUID, request: UpdateEvalRequest, db: Session = Depends(get_db)
):
    """Update evaluation by ID"""
    try:
        evals_service = Evals(db)
        result = evals_service.update_eval(
            eval_id=eval_id,
            name=request.name,
            description=request.description,
            suite_id=request.suite_id,
            dataset_id=request.dataset_id,
            total_requests=request.total_requests,
            successful_requests=request.successful_requests,
            failed_requests=request.failed_requests,
            eval_metadata=request.eval_metadata,
            status=request.status,
            started_at=request.started_at,
            completed_at=request.completed_at,
        )

        if not result["success"]:
            if "not found" in result["message"].lower():
                raise HTTPException(status_code=404, detail=result["message"])
            raise HTTPException(status_code=400, detail=result["message"])

        return ResponseModel(message=result["message"], data=result["data"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating evaluation {eval_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/{eval_id}")
def delete_eval(eval_id: UUID, db: Session = Depends(get_db)):
    """Delete evaluation by ID"""
    try:
        evals_service = Evals(db)
        result = evals_service.delete_eval(eval_id)

        if not result["success"]:
            if "not found" in result["message"].lower():
                raise HTTPException(status_code=404, detail=result["message"])
            raise HTTPException(status_code=400, detail=result["message"])

        return ResponseModel(message=result["message"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting evaluation {eval_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/search/advanced")
def search_evals(
    name: Optional[str] = Query(None, description="Filter by name"),
    description: Optional[str] = Query(None, description="Filter by description"),
    suite_id: Optional[UUID] = Query(None, description="Filter by suite ID"),
    dataset_id: Optional[UUID] = Query(None, description="Filter by dataset ID"),
    metadata_key: Optional[str] = Query(None, description="Filter by metadata key"),
    metadata_value: Optional[str] = Query(None, description="Filter by metadata value"),
    page: int = Query(1, description="Page number"),
    limit: int = Query(10, description="Number of items per page"),
    db: Session = Depends(get_db),
):
    """Advanced search for evaluations with multiple filters"""
    try:
        evals_service = Evals(db)
        result = evals_service.search_evals(
            name=name,
            description=description,
            suite_id=suite_id,
            dataset_id=dataset_id,
            metadata_key=metadata_key,
            metadata_value=metadata_value,
            page=page,
            page_size=limit,
        )

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])

        # Transform response to match expected format
        data = result["data"]
        return ResponseModel(
            message=result["message"],
            data={
                "evals": data["evaluations"],
                "page": data["pagination"]["page"],
                "limit": data["pagination"]["page_size"],
                "total": data["pagination"]["total_count"],
                "total_page": data["pagination"]["total_pages"],
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error searching evaluations: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/stats/overview")
def get_eval_stats(
    suite_id: Optional[UUID] = Query(None, description="Filter by suite ID"),
    db: Session = Depends(get_db),
):
    """Get evaluation statistics"""
    try:
        evals_service = Evals(db)
        result = evals_service.get_eval_stats(suite_id=suite_id)

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])

        return ResponseModel(message=result["message"], data=result["data"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving evaluation stats: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/name/{eval_name}")
def get_eval_by_name(eval_name: str, db: Session = Depends(get_db)):
    """Get evaluation by name"""
    try:
        evals_service = Evals(db)
        result = evals_service.get_eval_by_name(eval_name)

        if not result["success"]:
            if "not found" in result["message"].lower():
                raise HTTPException(status_code=404, detail=result["message"])
            raise HTTPException(status_code=400, detail=result["message"])

        return ResponseModel(message=result["message"], data=result["data"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving evaluation by name {eval_name}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{eval_id}/exists")
def check_eval_exists(eval_id: UUID, db: Session = Depends(get_db)):
    """Check if evaluation exists by ID"""
    try:
        evals_service = Evals(db)
        exists = evals_service.eval_exists(eval_id)

        return ResponseModel(
            message="Evaluation existence check completed", data={"exists": exists}
        )
    except Exception as e:
        logger.error(f"Error checking evaluation existence {eval_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/name/{eval_name}/exists")
def check_eval_exists_by_name(eval_name: str, db: Session = Depends(get_db)):
    """Check if evaluation exists by name"""
    try:
        evals_service = Evals(db)
        exists = evals_service.eval_exists_by_name(eval_name)

        return ResponseModel(
            message="Evaluation existence check completed", data={"exists": exists}
        )
    except Exception as e:
        logger.error(f"Error checking evaluation existence by name {eval_name}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/suite/{suite_id}")
def get_evals_by_suite(suite_id: UUID, db: Session = Depends(get_db)):
    """Get all evaluations associated with a specific suite"""
    try:
        evals_service = Evals(db)
        result = evals_service.get_evals_by_suite(suite_id)

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])

        return ResponseModel(message=result["message"], data=result["data"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving evaluations by suite {suite_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/dataset/{dataset_id}")
def get_evals_by_dataset(dataset_id: UUID, db: Session = Depends(get_db)):
    """Get all evaluations associated with a specific dataset"""
    try:
        evals_service = Evals(db)
        result = evals_service.get_evals_by_dataset(dataset_id)

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])

        return ResponseModel(message=result["message"], data=result["data"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving evaluations by dataset {dataset_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
