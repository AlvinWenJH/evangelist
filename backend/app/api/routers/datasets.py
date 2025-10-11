from fastapi import APIRouter, Query, HTTPException, Depends, UploadFile, File
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from uuid import UUID
from pydantic import BaseModel

from app.modules.response_model.main import ResponseModel
from app.modules.postgredb.main import SessionLocal
from app.modules.datasets.main import Datasets

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/datasets", tags=["datasets"])


# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Pydantic models for request bodies
class CreateDatasetRequest(BaseModel):
    name: str
    description: Optional[str] = None
    dataset_metadata: Optional[Dict[str, Any]] = None


class UpdateDatasetRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    dataset_metadata: Optional[Dict[str, Any]] = None


@router.get("/")
def get_datasets(
    page: int = Query(1, description="Page number"),
    limit: int = Query(10, description="Number of items per page"),
    keyword: str = Query(None, description="Search keyword"),
    db: Session = Depends(get_db),
):
    """Get all datasets with pagination and optional keyword search"""
    try:
        datasets_service = Datasets(db)
        result = datasets_service.get_datasets(
            page=page, page_size=limit, keyword=keyword
        )

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])

        # Transform response to match expected format
        data = result["data"]
        return ResponseModel(
            message=result["message"],
            data={
                "datasets": data["datasets"],
                "page": data["pagination"]["page"],
                "limit": data["pagination"]["page_size"],
                "total": data["pagination"]["total_count"],
                "total_page": data["pagination"]["total_pages"],
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching datasets: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/")
def create_dataset(request: CreateDatasetRequest, db: Session = Depends(get_db)):
    """Create a new dataset"""
    try:
        datasets_service = Datasets(db)
        result = datasets_service.create_dataset(
            name=request.name,
            description=request.description,
            dataset_metadata=request.dataset_metadata,
        )

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])

        return ResponseModel(message=result["message"], data=result["data"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating dataset: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{dataset_id}")
def get_dataset(dataset_id: UUID, db: Session = Depends(get_db)):
    """Get dataset by ID"""
    try:
        datasets_service = Datasets(db)
        result = datasets_service.get_dataset(dataset_id)

        if not result["success"]:
            if "not found" in result["message"].lower():
                raise HTTPException(status_code=404, detail=result["message"])
            raise HTTPException(status_code=400, detail=result["message"])

        return ResponseModel(message=result["message"], data=result["data"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving dataset {dataset_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/{dataset_id}")
def update_dataset(
    dataset_id: UUID, request: UpdateDatasetRequest, db: Session = Depends(get_db)
):
    """Update dataset by ID"""
    try:
        datasets_service = Datasets(db)
        result = datasets_service.update_dataset(
            dataset_id=dataset_id,
            name=request.name,
            description=request.description,
            dataset_metadata=request.dataset_metadata,
        )

        if not result["success"]:
            if "not found" in result["message"].lower():
                raise HTTPException(status_code=404, detail=result["message"])
            raise HTTPException(status_code=400, detail=result["message"])

        return ResponseModel(message=result["message"], data=result["data"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating dataset {dataset_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/{dataset_id}")
def delete_dataset(dataset_id: UUID, db: Session = Depends(get_db)):
    """Delete dataset by ID"""
    try:
        datasets_service = Datasets(db)
        result = datasets_service.delete_dataset(dataset_id)

        if not result["success"]:
            if "not found" in result["message"].lower():
                raise HTTPException(status_code=404, detail=result["message"])
            raise HTTPException(status_code=400, detail=result["message"])

        return ResponseModel(message=result["message"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting dataset {dataset_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/search/advanced")
def search_datasets(
    name: Optional[str] = Query(None, description="Filter by name"),
    description: Optional[str] = Query(None, description="Filter by description"),
    metadata_key: Optional[str] = Query(None, description="Filter by metadata key"),
    metadata_value: Optional[str] = Query(None, description="Filter by metadata value"),
    page: int = Query(1, description="Page number"),
    limit: int = Query(10, description="Number of items per page"),
    db: Session = Depends(get_db),
):
    """Advanced search for datasets with multiple filters"""
    try:
        datasets_service = Datasets(db)
        result = datasets_service.search_datasets(
            name=name,
            description=description,
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
                "datasets": data["datasets"],
                "page": data["pagination"]["page"],
                "limit": data["pagination"]["page_size"],
                "total": data["pagination"]["total_count"],
                "total_page": data["pagination"]["total_pages"],
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error searching datasets: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/stats/overview")
def get_dataset_stats(db: Session = Depends(get_db)):
    """Get dataset statistics"""
    try:
        datasets_service = Datasets(db)
        result = datasets_service.get_dataset_stats()

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])

        return ResponseModel(message=result["message"], data=result["data"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving dataset stats: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/name/{dataset_name}")
def get_dataset_by_name(dataset_name: str, db: Session = Depends(get_db)):
    """Get dataset by name"""
    try:
        datasets_service = Datasets(db)
        result = datasets_service.get_dataset_by_name(dataset_name)

        if not result["success"]:
            if "not found" in result["message"].lower():
                raise HTTPException(status_code=404, detail=result["message"])
            raise HTTPException(status_code=400, detail=result["message"])

        return ResponseModel(message=result["message"], data=result["data"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving dataset by name {dataset_name}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{dataset_id}/exists")
def check_dataset_exists(dataset_id: UUID, db: Session = Depends(get_db)):
    """Check if dataset exists by ID"""
    try:
        datasets_service = Datasets(db)
        exists = datasets_service.dataset_exists(dataset_id)

        return ResponseModel(
            message="Dataset existence check completed", data={"exists": exists}
        )
    except Exception as e:
        logger.error(f"Error checking dataset existence {dataset_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/name/{dataset_name}/exists")
def check_dataset_exists_by_name(dataset_name: str, db: Session = Depends(get_db)):
    """Check if dataset exists by name"""
    try:
        datasets_service = Datasets(db)
        exists = datasets_service.dataset_exists_by_name(dataset_name)

        return ResponseModel(
            message="Dataset existence check completed", data={"exists": exists}
        )
    except Exception as e:
        logger.error(f"Error checking dataset existence by name {dataset_name}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{dataset_id}/upload-csv")
def upload_csv_to_dataset(
    dataset_id: UUID,
    csv_file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload CSV file to dataset"""
    try:
        datasets_service = Datasets(db)
        result = datasets_service.upload_csv_to_dataset(dataset_id, csv_file)

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])

        return ResponseModel(message=result["message"], data=result["data"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading CSV to dataset {dataset_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{dataset_id}/schema")
def get_dataset_schema(
    dataset_id: UUID,
    db: Session = Depends(get_db),
):
    """Get dataset schema"""
    try:
        datasets_service = Datasets(db)
        result = datasets_service.get_dataset_schema(dataset_id)

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])

        return ResponseModel(message=result["message"], data=result["data"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving dataset schema {dataset_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{dataset_id}/preview")
def preview_dataset(
    dataset_id: UUID,
    limit: int = Query(10, description="Number of rows to preview"),
    db: Session = Depends(get_db),
):
    """Preview dataset rows"""
    try:
        datasets_service = Datasets(db)
        result = datasets_service.preview_dataset(dataset_id, limit)

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])

        return ResponseModel(message=result["message"], data=result["data"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error previewing dataset {dataset_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
