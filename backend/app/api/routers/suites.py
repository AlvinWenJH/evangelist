from fastapi import APIRouter, Query, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from uuid import UUID
from pydantic import BaseModel

from app.modules.response_model.main import ResponseModel
from app.modules.postgredb.main import SessionLocal
from app.modules.suites.main import Suites
from app.modules.suites.models import SuiteStatus

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/suites", tags=["suites"])


# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Pydantic models for request bodies
class CreateSuiteRequest(BaseModel):
    name: str
    description: Optional[str] = None
    dataset_id: Optional[UUID] = None
    suite_metadata: Optional[Dict[str, Any]] = None
    status: Optional[SuiteStatus] = SuiteStatus.READY


class UpdateSuiteRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    dataset_id: Optional[UUID] = None
    total_evals: Optional[int] = None
    suite_metadata: Optional[Dict[str, Any]] = None
    status: Optional[SuiteStatus] = None


@router.get("/")
def get_suites(
    page: int = Query(1, description="Page number"),
    limit: int = Query(10, description="Number of items per page"),
    keyword: str = Query(None, description="Search keyword"),
    status: Optional[SuiteStatus] = Query(None, description="Filter by status"),
    db: Session = Depends(get_db),
):
    """Get all suites with pagination, optional keyword search, and status filter"""
    try:
        suites_service = Suites(db)
        result = suites_service.get_suites(
            page=page, page_size=limit, keyword=keyword, status=status
        )

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])

        # Transform response to match expected format
        data = result["data"]
        return ResponseModel(
            message=result["message"],
            data={
                "suites": data["suites"],
                "page": data["pagination"]["page"],
                "limit": data["pagination"]["page_size"],
                "total": data["pagination"]["total_count"],
                "total_page": data["pagination"]["total_pages"],
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching suites: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/")
def create_suite(request: CreateSuiteRequest, db: Session = Depends(get_db)):
    """Create a new evaluation suite"""
    try:
        suites_service = Suites(db)
        result = suites_service.create_suite(
            name=request.name,
            description=request.description,
            dataset_id=request.dataset_id,
            suite_metadata=request.suite_metadata,
            status=request.status,
        )

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])

        return ResponseModel(message=result["message"], data=result["data"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating suite: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{suite_id}")
def get_suite(suite_id: UUID, db: Session = Depends(get_db)):
    """Get suite by ID"""
    try:
        suites_service = Suites(db)
        result = suites_service.get_suite(suite_id)

        if not result["success"]:
            if "not found" in result["message"].lower():
                raise HTTPException(status_code=404, detail=result["message"])
            raise HTTPException(status_code=400, detail=result["message"])

        return ResponseModel(message=result["message"], data=result["data"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving suite {suite_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/{suite_id}")
def update_suite(
    suite_id: UUID, request: UpdateSuiteRequest, db: Session = Depends(get_db)
):
    """Update suite by ID"""
    try:
        suites_service = Suites(db)
        result = suites_service.update_suite(
            suite_id=suite_id,
            name=request.name,
            description=request.description,
            dataset_id=request.dataset_id,
            total_evals=request.total_evals,
            suite_metadata=request.suite_metadata,
            status=request.status,
        )

        if not result["success"]:
            if "not found" in result["message"].lower():
                raise HTTPException(status_code=404, detail=result["message"])
            raise HTTPException(status_code=400, detail=result["message"])

        return ResponseModel(message=result["message"], data=result["data"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating suite {suite_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/{suite_id}")
def delete_suite(suite_id: UUID, db: Session = Depends(get_db)):
    """Delete suite by ID"""
    try:
        suites_service = Suites(db)
        result = suites_service.delete_suite(suite_id)

        if not result["success"]:
            if "not found" in result["message"].lower():
                raise HTTPException(status_code=404, detail=result["message"])
            raise HTTPException(status_code=400, detail=result["message"])

        return ResponseModel(message=result["message"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting suite {suite_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/search/advanced")
def search_suites(
    name: Optional[str] = Query(None, description="Filter by name"),
    description: Optional[str] = Query(None, description="Filter by description"),
    dataset_id: Optional[UUID] = Query(None, description="Filter by dataset ID"),
    metadata_key: Optional[str] = Query(None, description="Filter by metadata key"),
    metadata_value: Optional[str] = Query(None, description="Filter by metadata value"),
    page: int = Query(1, description="Page number"),
    limit: int = Query(10, description="Number of items per page"),
    db: Session = Depends(get_db),
):
    """Advanced search for suites with multiple filters"""
    try:
        suites_service = Suites(db)
        result = suites_service.search_suites(
            name=name,
            description=description,
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
                "suites": data["suites"],
                "page": data["pagination"]["page"],
                "limit": data["pagination"]["page_size"],
                "total": data["pagination"]["total_count"],
                "total_page": data["pagination"]["total_pages"],
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error searching suites: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/stats/overview")
def get_suite_stats(db: Session = Depends(get_db)):
    """Get suite statistics"""
    try:
        suites_service = Suites(db)
        result = suites_service.get_suite_stats()

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])

        return ResponseModel(message=result["message"], data=result["data"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving suite stats: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/name/{suite_name}")
def get_suite_by_name(suite_name: str, db: Session = Depends(get_db)):
    """Get suite by name"""
    try:
        suites_service = Suites(db)
        result = suites_service.get_suite_by_name(suite_name)

        if not result["success"]:
            if "not found" in result["message"].lower():
                raise HTTPException(status_code=404, detail=result["message"])
            raise HTTPException(status_code=400, detail=result["message"])

        return ResponseModel(message=result["message"], data=result["data"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving suite by name {suite_name}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{suite_id}/exists")
def check_suite_exists(suite_id: UUID, db: Session = Depends(get_db)):
    """Check if suite exists by ID"""
    try:
        suites_service = Suites(db)
        exists = suites_service.suite_exists(suite_id)

        return ResponseModel(
            message="Suite existence check completed", data={"exists": exists}
        )
    except Exception as e:
        logger.error(f"Error checking suite existence {suite_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/name/{suite_name}/exists")
def check_suite_exists_by_name(suite_name: str, db: Session = Depends(get_db)):
    """Check if suite exists by name"""
    try:
        suites_service = Suites(db)
        exists = suites_service.suite_exists_by_name(suite_name)

        return ResponseModel(
            message="Suite existence check completed", data={"exists": exists}
        )
    except Exception as e:
        logger.error(f"Error checking suite existence by name {suite_name}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/dataset/{dataset_id}")
def get_suites_by_dataset(dataset_id: UUID, db: Session = Depends(get_db)):
    """Get all suites associated with a specific dataset"""
    try:
        suites_service = Suites(db)
        result = suites_service.get_suites_by_dataset(dataset_id)

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])

        return ResponseModel(message=result["message"], data=result["data"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving suites by dataset {dataset_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
