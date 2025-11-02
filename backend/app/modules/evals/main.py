from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from typing import Dict, Any
from uuid import UUID
import uuid
import re
import json
from datetime import datetime

from app.modules.evals.repo import EvalsRepo
from app.modules.evals.models import EvalStatus

import logging

logger = logging.getLogger(__name__)


class EvalValidationError(Exception):
    """Custom exception for evaluation validation errors"""

    pass


class Evals:
    def __init__(self, session: Session):
        self.session = session
        self.repo = EvalsRepo(session)

    def _validate_eval_name(self, name: str) -> None:
        """Validate evaluation name"""
        if not name or not isinstance(name, str):
            raise EvalValidationError(
                "Evaluation name is required and must be a string"
            )

        if len(name.strip()) == 0:
            raise EvalValidationError("Evaluation name cannot be empty")

        if len(name) > 255:
            raise EvalValidationError("Evaluation name cannot exceed 255 characters")

        # Check for valid characters (alphanumeric, spaces, hyphens, underscores)
        if not re.match(r"^[a-zA-Z0-9\s\-_]+$", name):
            raise EvalValidationError(
                "Evaluation name can only contain letters, numbers, spaces, hyphens, and underscores"
            )

    def _validate_description(self, description: str) -> None:
        """Validate evaluation description"""
        if description is not None:
            if not isinstance(description, str):
                raise EvalValidationError("Description must be a string")

            if len(description) > 10000:  # Reasonable limit for text field
                raise EvalValidationError("Description cannot exceed 10,000 characters")

    def _validate_metadata(self, metadata: Dict[str, Any]) -> None:
        """Validate metadata"""
        if metadata is not None:
            if not isinstance(metadata, dict):
                raise EvalValidationError("Metadata must be a dictionary")

            # Check for reasonable size limit (JSON serialization)
            try:
                import json

                json_str = json.dumps(metadata)
                if len(json_str) > 100000:  # 100KB limit
                    raise EvalValidationError(
                        "Metadata is too large (max 100KB when serialized)"
                    )
            except (TypeError, ValueError) as e:
                raise EvalValidationError(
                    f"Metadata must be JSON serializable: {str(e)}"
                )

    def _validate_request_counts(
        self,
        total_requests: int = None,
        successful_requests: int = None,
        failed_requests: int = None,
    ) -> None:
        """Validate request count fields"""
        for field_name, value in [
            ("total_requests", total_requests),
            ("successful_requests", successful_requests),
            ("failed_requests", failed_requests),
        ]:
            if value is not None:
                if not isinstance(value, int):
                    raise EvalValidationError(f"{field_name} must be an integer")
                if value < 0:
                    raise EvalValidationError(f"{field_name} cannot be negative")

    def _validate_uuid(self, eval_id: UUID) -> None:
        """Validate UUID format"""
        if not isinstance(eval_id, UUID):
            try:
                uuid.UUID(str(eval_id))
            except (ValueError, TypeError):
                raise EvalValidationError("Invalid UUID format")

    def _validate_pagination(self, page: int, page_size: int) -> tuple:
        """Validate and normalize pagination parameters"""
        try:
            page = int(page) if page is not None else 1
            page_size = int(page_size) if page_size is not None else 10
        except (ValueError, TypeError):
            raise EvalValidationError("Page and page_size must be integers")

        if page < 1:
            raise EvalValidationError("Page must be greater than 0")

        if page_size < 1 or page_size > 100:
            raise EvalValidationError("Page size must be between 1 and 100")

        return page, page_size

    def create_eval(
        self,
        name: str,
        description: str = None,
        suite_id: UUID = None,
        dataset_id: UUID = None,
        eval_metadata: Dict[str, Any] = None,
        status: EvalStatus = EvalStatus.PENDING,
    ) -> Dict[str, Any]:
        """Create a new evaluation"""
        try:
            # Validate inputs
            self._validate_eval_name(name)
            self._validate_description(description)
            self._validate_metadata(eval_metadata)

            # Check if evaluation with same name already exists
            if self.repo.exists_by_name(name):
                return {
                    "success": False,
                    "message": f"Evaluation with name '{name}' already exists",
                    "data": None,
                }

            # Create evaluation
            evaluation = self.repo.create(
                name=name,
                description=description,
                suite_id=suite_id,
                dataset_id=dataset_id,
                eval_metadata=eval_metadata,
                status=status,
            )

            return {
                "success": True,
                "message": "Evaluation created successfully",
                "data": evaluation.to_dict(),
            }

        except EvalValidationError as e:
            return {
                "success": False,
                "message": str(e),
                "data": None,
            }
        except IntegrityError as e:
            self.session.rollback()
            return {
                "success": False,
                "message": "Database integrity error: evaluation creation failed",
                "data": None,
            }
        except SQLAlchemyError as e:
            self.session.rollback()
            logger.error(f"Database error creating evaluation: {e}")
            return {
                "success": False,
                "message": "Database error occurred",
                "data": None,
            }

    def get_eval(self, eval_id: UUID) -> Dict[str, Any]:
        """Get evaluation by ID"""
        try:
            self._validate_uuid(eval_id)
            evaluation = self.repo.get_by_id(eval_id)

            if not evaluation:
                return {
                    "success": False,
                    "message": "Evaluation not found",
                    "data": None,
                }

            return {
                "success": True,
                "message": "Evaluation retrieved successfully",
                "data": evaluation.to_dict(),
            }

        except EvalValidationError as e:
            return {
                "success": False,
                "message": str(e),
                "data": None,
            }
        except SQLAlchemyError as e:
            logger.error(f"Database error retrieving evaluation: {e}")
            return {
                "success": False,
                "message": "Database error occurred",
                "data": None,
            }

    def get_eval_by_name(self, name: str) -> Dict[str, Any]:
        """Get evaluation by name"""
        try:
            if not name or not isinstance(name, str):
                raise EvalValidationError("Evaluation name is required")

            evaluation = self.repo.get_by_name(name)

            if not evaluation:
                return {
                    "success": False,
                    "message": f"Evaluation with name '{name}' not found",
                    "data": None,
                }

            return {
                "success": True,
                "message": "Evaluation retrieved successfully",
                "data": evaluation.to_dict(),
            }

        except EvalValidationError as e:
            return {
                "success": False,
                "message": str(e),
                "data": None,
            }
        except SQLAlchemyError as e:
            logger.error(f"Database error retrieving evaluation by name: {e}")
            return {
                "success": False,
                "message": "Database error occurred",
                "data": None,
            }

    def get_evals(
        self,
        page: int = 1,
        page_size: int = 10,
        keyword: str = None,
        status: EvalStatus = None,
        suite_id: UUID = None,
    ) -> Dict[str, Any]:
        """Get all evaluations with pagination, optional keyword search, status filter, and suite filter"""
        try:
            page, page_size = self._validate_pagination(page, page_size)
            result = self.repo.get_all(
                page=page, page_size=page_size, keyword=keyword, status=status, suite_id=suite_id
            )

            evaluations_data = [eval.to_dict() for eval in result["evaluations"]]

            return {
                "success": True,
                "message": "Evaluations retrieved successfully",
                "data": {
                    "evaluations": evaluations_data,
                    "pagination": result["pagination"],
                },
            }

        except EvalValidationError as e:
            return {
                "success": False,
                "message": str(e),
                "data": None,
            }
        except SQLAlchemyError as e:
            logger.error(f"Database error retrieving evaluations: {e}")
            return {
                "success": False,
                "message": "Database error occurred",
                "data": None,
            }

    def update_eval(
        self,
        eval_id: UUID,
        name: str = None,
        description: str = None,
        suite_id: UUID = None,
        dataset_id: UUID = None,
        total_requests: int = None,
        successful_requests: int = None,
        failed_requests: int = None,
        eval_metadata: Dict[str, Any] = None,
        status: EvalStatus = None,
        started_at: datetime = None,
        completed_at: datetime = None,
    ) -> Dict[str, Any]:
        """Update evaluation by ID"""
        try:
            self._validate_uuid(eval_id)

            # Validate provided fields
            if name is not None:
                self._validate_eval_name(name)
            if description is not None:
                self._validate_description(description)
            if eval_metadata is not None:
                self._validate_metadata(eval_metadata)
            self._validate_request_counts(
                total_requests, successful_requests, failed_requests
            )

            # Check if evaluation exists
            if not self.repo.exists(eval_id):
                return {
                    "success": False,
                    "message": "Evaluation not found",
                    "data": None,
                }

            # Check for name conflicts if name is being updated
            if name is not None:
                existing_eval = self.repo.get_by_name(name)
                if existing_eval and existing_eval.id != eval_id:
                    return {
                        "success": False,
                        "message": f"Evaluation with name '{name}' already exists",
                        "data": None,
                    }

            # Prepare update data
            update_data = {}
            if name is not None:
                update_data["name"] = name
            if description is not None:
                update_data["description"] = description
            if suite_id is not None:
                update_data["suite_id"] = suite_id
            if dataset_id is not None:
                update_data["dataset_id"] = dataset_id
            if total_requests is not None:
                update_data["total_requests"] = total_requests
            if successful_requests is not None:
                update_data["successful_requests"] = successful_requests
            if failed_requests is not None:
                update_data["failed_requests"] = failed_requests
            if eval_metadata is not None:
                update_data["eval_metadata"] = eval_metadata
            if status is not None:
                update_data["status"] = status
            if started_at is not None:
                update_data["started_at"] = started_at
            if completed_at is not None:
                update_data["completed_at"] = completed_at

            # Update evaluation
            updated_evaluation = self.repo.update(eval_id, **update_data)

            return {
                "success": True,
                "message": "Evaluation updated successfully",
                "data": updated_evaluation.to_dict(),
            }

        except EvalValidationError as e:
            return {
                "success": False,
                "message": str(e),
                "data": None,
            }
        except IntegrityError as e:
            self.session.rollback()
            return {
                "success": False,
                "message": "Database integrity error: evaluation update failed",
                "data": None,
            }
        except SQLAlchemyError as e:
            self.session.rollback()
            logger.error(f"Database error updating evaluation: {e}")
            return {
                "success": False,
                "message": "Database error occurred",
                "data": None,
            }

    def delete_eval(self, eval_id: UUID) -> Dict[str, Any]:
        """Delete evaluation by ID (soft delete)"""
        try:
            self._validate_uuid(eval_id)

            # Check if evaluation exists
            if not self.repo.exists(eval_id):
                return {
                    "success": False,
                    "message": "Evaluation not found",
                    "data": None,
                }

            # Soft delete evaluation
            success = self.repo.delete(eval_id)

            if success:
                return {
                    "success": True,
                    "message": "Evaluation deleted successfully",
                }
            else:
                return {
                    "success": False,
                    "message": "Failed to delete evaluation",
                    "data": None,
                }

        except EvalValidationError as e:
            return {
                "success": False,
                "message": str(e),
                "data": None,
            }
        except SQLAlchemyError as e:
            self.session.rollback()
            logger.error(f"Database error deleting evaluation: {e}")
            return {
                "success": False,
                "message": "Database error occurred",
                "data": None,
            }

    def get_eval_stats(self, suite_id: UUID = None) -> Dict[str, Any]:
        """Get evaluation statistics"""
        try:
            stats = self.repo.get_stats(suite_id=suite_id)
            return {
                "success": True,
                "message": "Evaluation statistics retrieved successfully",
                "data": stats,
            }
        except SQLAlchemyError as e:
            logger.error(f"Database error retrieving evaluation stats: {e}")
            return {
                "success": False,
                "message": "Database error occurred",
                "data": None,
            }

    def search_evals(
        self,
        name: str = None,
        description: str = None,
        suite_id: UUID = None,
        dataset_id: UUID = None,
        metadata_key: str = None,
        metadata_value: str = None,
        page: int = 1,
        page_size: int = 10,
    ) -> Dict[str, Any]:
        """Advanced search for evaluations with multiple filters"""
        try:
            page, page_size = self._validate_pagination(page, page_size)

            result = self.repo.search(
                name=name,
                description=description,
                suite_id=suite_id,
                dataset_id=dataset_id,
                metadata_key=metadata_key,
                metadata_value=metadata_value,
                page=page,
                page_size=page_size,
            )

            evaluations_data = [eval.to_dict() for eval in result["evaluations"]]

            return {
                "success": True,
                "message": "Evaluation search completed successfully",
                "data": {
                    "evaluations": evaluations_data,
                    "pagination": result["pagination"],
                },
            }

        except EvalValidationError as e:
            return {
                "success": False,
                "message": str(e),
                "data": None,
            }
        except SQLAlchemyError as e:
            logger.error(f"Database error searching evaluations: {e}")
            return {
                "success": False,
                "message": "Database error occurred",
                "data": None,
            }

    def eval_exists(self, eval_id: UUID) -> bool:
        """Check if evaluation exists by ID"""
        try:
            self._validate_uuid(eval_id)
            return self.repo.exists(eval_id)
        except EvalValidationError:
            return False

    def eval_exists_by_name(self, name: str) -> bool:
        """Check if evaluation exists by name"""
        try:
            if not name or not isinstance(name, str):
                return False
            return self.repo.exists_by_name(name)
        except Exception:
            return False

    def get_evals_by_suite(self, suite_id: UUID) -> Dict[str, Any]:
        """Get all evaluations associated with a specific suite"""
        try:
            self._validate_uuid(suite_id)
            evaluations = self.repo.get_by_suite_id(suite_id)
            evaluations_data = [eval.to_dict() for eval in evaluations]

            return {
                "success": True,
                "message": "Evaluations retrieved successfully",
                "data": {"evaluations": evaluations_data},
            }

        except EvalValidationError as e:
            return {
                "success": False,
                "message": str(e),
                "data": None,
            }
        except SQLAlchemyError as e:
            logger.error(f"Database error retrieving evaluations by suite: {e}")
            return {
                "success": False,
                "message": "Database error occurred",
                "data": None,
            }

    def get_evals_by_dataset(self, dataset_id: UUID) -> Dict[str, Any]:
        """Get all evaluations associated with a specific dataset"""
        try:
            self._validate_uuid(dataset_id)
            evaluations = self.repo.get_by_dataset_id(dataset_id)
            evaluations_data = [eval.to_dict() for eval in evaluations]

            return {
                "success": True,
                "message": "Evaluations retrieved successfully",
                "data": {"evaluations": evaluations_data},
            }

        except EvalValidationError as e:
            return {
                "success": False,
                "message": str(e),
                "data": None,
            }
        except SQLAlchemyError as e:
            logger.error(f"Database error retrieving evaluations by dataset: {e}")
            return {
                "success": False,
                "message": "Database error occurred",
                "data": None,
            }
