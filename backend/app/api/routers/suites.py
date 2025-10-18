from fastapi import APIRouter, Query, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from uuid import UUID
from pydantic import BaseModel

from app.modules.response_model.main import ResponseModel
from app.modules.postgredb.main import SessionLocal
from app.modules.suites.main import Suites
from app.modules.suites.models import SuiteStatus
from app.modules.minio.main import MINIO
from app.modules.evals.main import Evals

import logging
import json

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


class UpdateConfigurationRequest(BaseModel):
    configuration: Dict[str, Any]


class PartialUpdateConfigurationRequest(BaseModel):
    preprocessing: Optional[Dict[str, Any]] = None
    invocation: Optional[Dict[str, Any]] = None
    postprocessing: Optional[Dict[str, Any]] = None
    evaluation: Optional[Dict[str, Any]] = None


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


@router.post("/configure_workflow/{suite_id}")
def configure_workflow(suite_id: UUID, db: Session = Depends(get_db)):
    """Configure workflow by uploading template files to MinIO for a specific suite"""
    try:
        # First verify that the suite exists
        suites_service = Suites(db)
        suite_result = suites_service.get_suite(suite_id)

        if not suite_result["success"]:
            if "not found" in suite_result["message"].lower():
                raise HTTPException(status_code=404, detail=suite_result["message"])
            raise HTTPException(status_code=400, detail=suite_result["message"])

        # Upload template files to MinIO
        try:
            minio_client = MINIO()
            upload_results = minio_client.upload_template_files(str(suite_id))

            # Log upload results
            successful_uploads = [f for f, success in upload_results.items() if success]
            failed_uploads = [f for f, success in upload_results.items() if not success]

            if successful_uploads:
                logger.info(
                    f"Successfully uploaded template files for suite {suite_id}: {successful_uploads}"
                )

            if failed_uploads:
                logger.warning(
                    f"Failed to upload some template files for suite {suite_id}: {failed_uploads}"
                )

            # Save production configuration as version 0 in draft
            try:
                # Copy production files to draft/0
                copy_results = minio_client.copy_suite_config_to_version(
                    str(suite_id), 0
                )

                # Update database to set latest_config_version to 0
                suites_service.save_config_as_version(suite_id, initial_version=True)

                logger.info(
                    f"Saved production configuration as version 0 for suite {suite_id}"
                )

            except Exception as version_error:
                logger.warning(
                    f"Failed to save initial version for suite {suite_id}: {version_error}"
                )
                # Don't fail the entire operation if version saving fails

            return ResponseModel(
                message="Workflow configuration completed",
                data={
                    "suite_id": str(suite_id),
                    "template_upload_results": upload_results,
                    "successful_uploads": successful_uploads,
                    "failed_uploads": failed_uploads,
                },
            )

        except Exception as upload_error:
            logger.error(
                f"Error uploading template files for suite {suite_id}: {upload_error}"
            )
            raise HTTPException(
                status_code=500,
                detail=f"Failed to upload template files: {str(upload_error)}",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error configuring workflow for suite {suite_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{suite_id}/config")
def get_suite_config(suite_id: UUID, db: Session = Depends(get_db)):
    """Get suite configuration by suite ID"""
    try:
        # First verify that the suite exists
        suites_service = Suites(db)
        suite_result = suites_service.get_suite(suite_id)

        if not suite_result["success"]:
            if "not found" in suite_result["message"].lower():
                raise HTTPException(status_code=404, detail=suite_result["message"])
            raise HTTPException(status_code=400, detail=suite_result["message"])

        # Get configuration from MinIO
        try:
            minio_client = MINIO()

            # Try to get the workflow template file
            try:
                workflow_config = minio_client.get_suite_config_file(
                    str(suite_id), "workflow-template.json", "production"
                )
                config_data = json.loads(workflow_config)

                # Get list of all config files
                config_files = minio_client.list_suite_config_files(
                    str(suite_id), "production"
                )

                return ResponseModel(
                    message="Suite configuration retrieved successfully",
                    data={
                        "suite_id": str(suite_id),
                        "workflow_config": config_data,
                        "config_files": config_files,
                    },
                )
            except Exception as config_error:
                # If no config exists yet, return empty config
                logger.warning(
                    f"No configuration found for suite {suite_id}: {config_error}"
                )
                return ResponseModel(
                    message="No configuration found for suite",
                    data={
                        "suite_id": str(suite_id),
                        "workflow_config": None,
                        "config_files": [],
                    },
                )

        except Exception as minio_error:
            logger.error(f"Error accessing MinIO for suite {suite_id}: {minio_error}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to retrieve configuration: {str(minio_error)}",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting configuration for suite {suite_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{suite_id}/preprocessing_step")
def get_preprocessing_step(suite_id: UUID, db: Session = Depends(get_db)):
    """Get preprocessing step by suite ID
    Returns:
        dict:
            description: Preprocessing step configuration
            script: str
            script_content: str
            input: dict
    """
    try:
        # First verify that the suite exists
        suites_service = Suites(db)
        suite_result = suites_service.get_suite(suite_id)

        if not suite_result["success"]:
            if "not found" in suite_result["message"].lower():
                raise HTTPException(status_code=404, detail=suite_result["message"])
            raise HTTPException(status_code=400, detail=suite_result["message"])

        # Get configuration from MinIO
        try:
            minio_client = MINIO()

            # Get workflow configuration
            workflow_config = minio_client.get_suite_config_file(
                str(suite_id), "workflow-template.json", "production"
            )
            config_data = json.loads(workflow_config)

            # Extract preprocessing step
            preprocessing_step = (
                config_data.get("workflow", {})
                .get("steps", {})
                .get("preprocessing", {})
            )

            # Try to get the script content if script file exists
            script_content = None
            script_name = preprocessing_step.get("script")
            if script_name:
                try:
                    script_content = minio_client.get_suite_config_file(
                        str(suite_id), script_name, "production"
                    )
                except Exception:
                    # Script file doesn't exist yet
                    pass

            return ResponseModel(
                message="Preprocessing step retrieved successfully",
                data={
                    "suite_id": str(suite_id),
                    "description": preprocessing_step.get("description", ""),
                    "script": script_name,
                    "script_content": script_content,
                    "input": preprocessing_step.get("input", {}),
                },
            )

        except Exception as config_error:
            logger.error(
                f"Error retrieving preprocessing step for suite {suite_id}: {config_error}"
            )
            raise HTTPException(
                status_code=404,
                detail="Preprocessing configuration not found",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting preprocessing step for suite {suite_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{suite_id}/invocation_step")
def get_invocation_step(suite_id: UUID, db: Session = Depends(get_db)):
    """Get invocation step by suite ID
    Returns:
        dict:
            description: Invocation step configuration
            script: str
            script_content: str
            input: dict
    """
    try:
        # First verify that the suite exists
        suites_service = Suites(db)
        suite_result = suites_service.get_suite(suite_id)

        if not suite_result["success"]:
            if "not found" in suite_result["message"].lower():
                raise HTTPException(status_code=404, detail=suite_result["message"])
            raise HTTPException(status_code=400, detail=suite_result["message"])

        # Get configuration from MinIO
        try:
            minio_client = MINIO()

            # Get workflow configuration
            workflow_config = minio_client.get_suite_config_file(
                str(suite_id), "workflow-template.json", "production"
            )
            config_data = json.loads(workflow_config)

            # Extract invocation step
            invocation_step = (
                config_data.get("workflow", {}).get("steps", {}).get("invocation", {})
            )

            # Try to get the script content if script file exists
            script_content = None
            script_name = invocation_step.get("script")
            if script_name:
                try:
                    script_content = minio_client.get_suite_config_file(
                        str(suite_id), script_name, "production"
                    )
                except Exception:
                    # Script file doesn't exist yet
                    pass

            return ResponseModel(
                message="Invocation step retrieved successfully",
                data={
                    "suite_id": str(suite_id),
                    "description": invocation_step.get("description", ""),
                    "script": script_name,
                    "script_content": script_content,
                    "input": invocation_step.get("input", {}),
                },
            )

        except Exception as config_error:
            logger.error(
                f"Error retrieving invocation step for suite {suite_id}: {config_error}"
            )
            raise HTTPException(
                status_code=404,
                detail="Invocation configuration not found",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting invocation step for suite {suite_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{suite_id}/postprocessing_step")
def get_postprocessing_step(suite_id: UUID, db: Session = Depends(get_db)):
    """Get postprocessing step by suite ID
    Returns:
        dict:
            description: Postprocessing step configuration
            script: str
            script_content: str
            input: dict
    """
    try:
        # First verify that the suite exists
        suites_service = Suites(db)
        suite_result = suites_service.get_suite(suite_id)

        if not suite_result["success"]:
            if "not found" in suite_result["message"].lower():
                raise HTTPException(status_code=404, detail=suite_result["message"])
            raise HTTPException(status_code=400, detail=suite_result["message"])

        # Get configuration from MinIO
        try:
            minio_client = MINIO()

            # Get workflow configuration
            workflow_config = minio_client.get_suite_config_file(
                str(suite_id), "workflow-template.json", "production"
            )
            config_data = json.loads(workflow_config)

            # Extract postprocessing step
            postprocessing_step = (
                config_data.get("workflow", {})
                .get("steps", {})
                .get("postprocessing", {})
            )

            # Try to get the script content if script file exists
            script_content = None
            script_name = postprocessing_step.get("script")
            if script_name:
                try:
                    script_content = minio_client.get_suite_config_file(
                        str(suite_id), script_name, "production"
                    )
                except Exception:
                    # Script file doesn't exist yet
                    pass

            return ResponseModel(
                message="Postprocessing step retrieved successfully",
                data={
                    "suite_id": str(suite_id),
                    "description": postprocessing_step.get("description", ""),
                    "script": script_name,
                    "script_content": script_content,
                    "input": postprocessing_step.get("input", {}),
                },
            )

        except Exception as config_error:
            logger.error(
                f"Error retrieving postprocessing step for suite {suite_id}: {config_error}"
            )
            raise HTTPException(
                status_code=404,
                detail="Postprocessing configuration not found",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting postprocessing step for suite {suite_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{suite_id}/evaluation_step")
def get_evaluation_step(suite_id: UUID, db: Session = Depends(get_db)):
    """Get evaluation step by suite ID
    Returns:
        dict:
            description: Evaluation step configuration
            script: str
            script_content: str
            input: dict
    """
    try:
        # First verify that the suite exists
        suites_service = Suites(db)
        suite_result = suites_service.get_suite(suite_id)

        if not suite_result["success"]:
            if "not found" in suite_result["message"].lower():
                raise HTTPException(status_code=404, detail=suite_result["message"])
            raise HTTPException(status_code=400, detail=suite_result["message"])

        # Get configuration from MinIO
        try:
            minio_client = MINIO()

            # Get workflow configuration
            workflow_config = minio_client.get_suite_config_file(
                str(suite_id), "workflow-template.json", "production"
            )
            config_data = json.loads(workflow_config)

            # Extract evaluation step
            evaluation_step = (
                config_data.get("workflow", {}).get("steps", {}).get("evaluation", {})
            )

            # Try to get the script content if script file exists
            script_content = None
            script_name = evaluation_step.get("script")
            if script_name:
                try:
                    script_content = minio_client.get_suite_config_file(
                        str(suite_id), script_name, "production"
                    )
                except Exception:
                    # Script file doesn't exist yet
                    pass

            return ResponseModel(
                message="Evaluation step retrieved successfully",
                data={
                    "suite_id": str(suite_id),
                    "description": evaluation_step.get("description", ""),
                    "script": script_name,
                    "script_content": script_content,
                    "input": evaluation_step.get("input", {}),
                },
            )

        except Exception as config_error:
            logger.error(
                f"Error retrieving evaluation step for suite {suite_id}: {config_error}"
            )
            raise HTTPException(
                status_code=404,
                detail="Evaluation configuration not found",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting evaluation step for suite {suite_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/{suite_id}/save_as_version")
def save_as_version(suite_id: UUID, db: Session = Depends(get_db)):
    """Save suite configuration files from production to draft/{incremental_version}
    Returns:
        dict:
            version: int - The new incremental version number
            copied_files: list - List of files copied to the new version
            failed_files: list - List of files that failed to copy
    """
    try:
        # First verify that the suite exists and increment version in database
        suites_service = Suites(db)
        version_result = suites_service.save_config_as_version(suite_id)

        if not version_result["success"]:
            if "not found" in version_result["message"].lower():
                raise HTTPException(status_code=404, detail=version_result["message"])
            raise HTTPException(status_code=400, detail=version_result["message"])

        new_version = version_result["data"]["version"]

        # Copy configuration files from production to draft/{version}
        try:
            minio_client = MINIO()

            # Copy files from production to draft/{version}
            copy_results = minio_client.copy_suite_config_to_version(
                str(suite_id), new_version
            )

            # Separate successful and failed copies
            copied_files = [f for f, success in copy_results.items() if success]
            failed_files = [f for f, success in copy_results.items() if not success]

            if copied_files:
                logger.info(
                    f"Successfully saved suite {suite_id} configuration as version {new_version}: {copied_files}"
                )

            if failed_files:
                logger.warning(
                    f"Failed to copy some files for suite {suite_id} version {new_version}: {failed_files}"
                )

            return ResponseModel(
                message=f"Suite configuration saved as version {new_version}",
                data={
                    "suite_id": str(suite_id),
                    "version": new_version,
                    "copied_files": copied_files,
                    "failed_files": failed_files,
                    "total_files": len(copy_results),
                },
            )

        except Exception as copy_error:
            logger.error(f"Error saving version for suite {suite_id}: {copy_error}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to save configuration as version: {str(copy_error)}",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving version for suite {suite_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/{suite_id}/rollback_to_version/{version}")
def rollback_to_version(suite_id: UUID, version: int, db: Session = Depends(get_db)):
    """Rollback suite configuration from draft/{version} to production/
    Args:
        suite_id: UUID of the suite
        version: Version number to rollback to
    Returns:
        dict:
            version: int - The version that was rolled back to
            copied_files: list - List of files copied to production
            failed_files: list - List of files that failed to copy
    """
    try:
        # First verify that the suite exists and update current version in database
        suites_service = Suites(db)
        rollback_result = suites_service.rollback_to_config_version(suite_id, version)

        if not rollback_result["success"]:
            if "not found" in rollback_result["message"].lower():
                raise HTTPException(status_code=404, detail=rollback_result["message"])
            raise HTTPException(status_code=400, detail=rollback_result["message"])

        # Copy configuration files from draft/{version} to production/
        try:
            minio_client = MINIO()

            # Copy files from draft/{version} to production
            copy_results = minio_client.rollback_suite_config_from_version(
                str(suite_id), version
            )

            # Separate successful and failed copies
            copied_files = [f for f, success in copy_results.items() if success]
            failed_files = [f for f, success in copy_results.items() if not success]

            if copied_files:
                logger.info(
                    f"Successfully rolled back suite {suite_id} to version {version}: {copied_files}"
                )

            if failed_files:
                logger.warning(
                    f"Failed to rollback some files for suite {suite_id} version {version}: {failed_files}"
                )

            return ResponseModel(
                message=f"Suite configuration rolled back to version {version}",
                data={
                    "suite_id": str(suite_id),
                    "version": version,
                    "copied_files": copied_files,
                    "failed_files": failed_files,
                    "total_files": len(copy_results),
                },
            )

        except Exception as minio_error:
            logger.error(
                f"Error rolling back files for suite {suite_id} to version {version}: {minio_error}"
            )
            raise HTTPException(
                status_code=500,
                detail="Failed to rollback configuration files",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rolling back suite {suite_id} to version {version}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


def _check_suite_has_evaluations(suite_id: UUID, db: Session) -> bool:
    """Helper function to check if a suite has any evaluations"""
    try:
        evals_service = Evals(db)
        result = evals_service.get_evals_by_suite(suite_id)
        if result["success"]:
            evaluations = result["data"]["evaluations"]
            return len(evaluations) > 0
        return False
    except Exception:
        return False


@router.put("/{suite_id}/configuration")
def update_suite_configuration(
    suite_id: UUID, 
    request: UpdateConfigurationRequest, 
    db: Session = Depends(get_db)
):
    """Update entire suite configuration and save as new version
    
    If the suite has evaluations, all configuration updates are frozen.
    """
    try:
        # Check if suite exists
        suites_service = Suites(db)
        suite_result = suites_service.get_suite(suite_id)
        
        if not suite_result["success"]:
            if "not found" in suite_result["message"].lower():
                raise HTTPException(status_code=404, detail=suite_result["message"])
            raise HTTPException(status_code=400, detail=suite_result["message"])
        
        # Check if suite has evaluations - if so, freeze all updates
        if _check_suite_has_evaluations(suite_id, db):
            raise HTTPException(
                status_code=403, 
                detail="Configuration updates are frozen because this suite has evaluations. Only invocation step updates are allowed."
            )
        
        # Update configuration in MinIO
        minio_client = MINIO()
        
        # Convert configuration to JSON and upload
        config_json = json.dumps(request.configuration, indent=2)
        success = minio_client.upload_suite_config_file(
            str(suite_id), "workflow-template.json", config_json, "draft"
        )
        
        if not success:
            raise HTTPException(
                status_code=500, 
                detail="Failed to update configuration in storage"
            )
        
        # Save as new version
        version_result = suites_service.save_config_as_version(suite_id)
        if not version_result["success"]:
            raise HTTPException(status_code=400, detail=version_result["message"])
        
        return ResponseModel(
            message="Configuration updated and saved as new version successfully",
            data={
                "suite_id": str(suite_id),
                "version": version_result["data"]["version"],
                "configuration": request.configuration
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating configuration for suite {suite_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.patch("/{suite_id}/configuration")
def partial_update_suite_configuration(
    suite_id: UUID, 
    request: PartialUpdateConfigurationRequest, 
    db: Session = Depends(get_db)
):
    """Partially update suite configuration and save as new version
    
    If the suite has evaluations, only invocation step updates are allowed.
    """
    try:
        # Check if suite exists
        suites_service = Suites(db)
        suite_result = suites_service.get_suite(suite_id)
        
        if not suite_result["success"]:
            if "not found" in suite_result["message"].lower():
                raise HTTPException(status_code=404, detail=suite_result["message"])
            raise HTTPException(status_code=400, detail=suite_result["message"])
        
        # Check if suite has evaluations
        has_evaluations = _check_suite_has_evaluations(suite_id, db)
        
        # If has evaluations, only allow invocation updates
        if has_evaluations:
            if (request.preprocessing is not None or 
                request.postprocessing is not None or 
                request.evaluation is not None):
                raise HTTPException(
                    status_code=403, 
                    detail="Only invocation step updates are allowed because this suite has evaluations."
                )
        
        # Get current configuration
        minio_client = MINIO()
        try:
            current_config_str = minio_client.get_suite_config_file(
                str(suite_id), "workflow-template.json", "draft"
            )
            current_config = json.loads(current_config_str)
        except Exception:
            raise HTTPException(
                status_code=404, 
                detail="Current configuration not found"
            )
        
        # Update only provided sections
        workflow_steps = current_config.setdefault("workflow", {}).setdefault("steps", {})
        
        updated_sections = []
        if request.preprocessing is not None:
            workflow_steps["preprocessing"] = request.preprocessing
            updated_sections.append("preprocessing")
        
        if request.invocation is not None:
            workflow_steps["invocation"] = request.invocation
            updated_sections.append("invocation")
        
        if request.postprocessing is not None:
            workflow_steps["postprocessing"] = request.postprocessing
            updated_sections.append("postprocessing")
        
        if request.evaluation is not None:
            workflow_steps["evaluation"] = request.evaluation
            updated_sections.append("evaluation")
        
        if not updated_sections:
            raise HTTPException(
                status_code=400, 
                detail="No configuration sections provided for update"
            )
        
        # Upload updated configuration
        config_json = json.dumps(current_config, indent=2)
        success = minio_client.upload_suite_config_file(
            str(suite_id), "workflow-template.json", config_json, "draft"
        )
        
        if not success:
            raise HTTPException(
                status_code=500, 
                detail="Failed to update configuration in storage"
            )
        
        # Save as new version
        version_result = suites_service.save_config_as_version(suite_id)
        if not version_result["success"]:
            raise HTTPException(status_code=400, detail=version_result["message"])
        
        return ResponseModel(
            message=f"Configuration sections {', '.join(updated_sections)} updated and saved as new version successfully",
            data={
                "suite_id": str(suite_id),
                "version": version_result["data"]["version"],
                "updated_sections": updated_sections,
                "has_evaluations": has_evaluations
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error partially updating configuration for suite {suite_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

