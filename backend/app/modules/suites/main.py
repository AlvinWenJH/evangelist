from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from typing import Dict, Any
from uuid import UUID
import uuid
import re
import json

from app.modules.suites.repo import SuitesRepo
from app.modules.suites.models import SuiteStatus

import logging

logger = logging.getLogger(__name__)


class SuiteValidationError(Exception):
    """Custom exception for suite validation errors"""

    pass


class Suites:
    def __init__(self, session: Session):
        self.session = session
        self.repo = SuitesRepo(session)

    def _validate_suite_name(self, name: str) -> None:
        """Validate suite name"""
        if not name or not isinstance(name, str):
            raise SuiteValidationError("Suite name is required and must be a string")

        if len(name.strip()) == 0:
            raise SuiteValidationError("Suite name cannot be empty")

        if len(name) > 255:
            raise SuiteValidationError("Suite name cannot exceed 255 characters")

        # Check for valid characters (alphanumeric, spaces, hyphens, underscores)
        if not re.match(r"^[a-zA-Z0-9\s\-_]+$", name):
            raise SuiteValidationError(
                "Suite name can only contain letters, numbers, spaces, hyphens, and underscores"
            )

    def _validate_description(self, description: str) -> None:
        """Validate suite description"""
        if description is not None:
            if not isinstance(description, str):
                raise SuiteValidationError("Description must be a string")

            if len(description) > 10000:  # Reasonable limit for text field
                raise SuiteValidationError(
                    "Description cannot exceed 10,000 characters"
                )

    def _validate_metadata(self, metadata: Dict[str, Any]) -> None:
        """Validate metadata"""
        if metadata is not None:
            if not isinstance(metadata, dict):
                raise SuiteValidationError("Metadata must be a dictionary")

            # Check for reasonable size limit (JSON serialization)
            try:
                import json

                json_str = json.dumps(metadata)
                if len(json_str) > 100000:  # 100KB limit
                    raise SuiteValidationError(
                        "Metadata is too large (max 100KB when serialized)"
                    )
            except (TypeError, ValueError) as e:
                raise SuiteValidationError(
                    f"Metadata must be JSON serializable: {str(e)}"
                )

    def _validate_total_evals(self, total_evals: int) -> None:
        """Validate total evaluations count"""
        if total_evals is not None:
            if not isinstance(total_evals, int):
                raise SuiteValidationError("Total evals must be an integer")
            if total_evals < 0:
                raise SuiteValidationError("Total evals cannot be negative")

    def _validate_uuid(self, suite_id: UUID) -> None:
        """Validate UUID format"""
        if not isinstance(suite_id, UUID):
            try:
                uuid.UUID(str(suite_id))
            except (ValueError, TypeError):
                raise SuiteValidationError("Invalid UUID format")

    def _validate_pagination(self, page: int, page_size: int) -> tuple:
        """Validate and normalize pagination parameters"""
        try:
            page = int(page) if page is not None else 1
            page_size = int(page_size) if page_size is not None else 10
        except (ValueError, TypeError):
            raise SuiteValidationError("Page and page_size must be integers")

        if page < 1:
            page = 1

        if page_size < 1:
            page_size = 1
        elif page_size > 100:
            page_size = 100

        return page, page_size

    def create_suite(
        self,
        name: str,
        description: str = None,
        dataset_id: UUID = None,
        suite_metadata: Dict[str, Any] = None,
        status: SuiteStatus = SuiteStatus.READY,
    ) -> Dict[str, Any]:
        """Create a new evaluation suite"""
        try:
            # Validate inputs
            self._validate_suite_name(name)
            self._validate_description(description)
            self._validate_metadata(suite_metadata)

            if dataset_id is not None:
                self._validate_uuid(dataset_id)

            # Normalize name (strip whitespace)
            name = name.strip()

            # Check if suite with same name already exists
            if self.repo.exists_by_name(name):
                raise SuiteValidationError(f"Suite with name '{name}' already exists")

            # Create the suite
            suite = self.repo.create(
                name=name,
                description=description,
                dataset_id=dataset_id,
                suite_metadata=suite_metadata,
                status=status,
            )

            logger.info(f"Created suite: {suite.id} - {suite.name}")
            return {
                "success": True,
                "data": suite.to_dict(),
                "message": f"Suite '{name}' created successfully",
            }
        except SuiteValidationError as e:
            logger.warning(f"Validation error creating suite: {str(e)}")
            return {"success": False, "error": str(e), "message": "Validation failed"}
        except IntegrityError as e:
            logger.error(f"Database integrity error creating suite: {str(e)}")
            self.session.rollback()
            return {
                "success": False,
                "error": "Database constraint violation",
                "message": "Failed to create suite due to database constraints",
            }
        except SQLAlchemyError as e:
            logger.error(f"Database error creating suite: {str(e)}")
            self.session.rollback()
            return {
                "success": False,
                "error": "Database error",
                "message": "Failed to create suite due to database error",
            }
        except Exception as e:
            logger.error(f"Unexpected error creating suite: {str(e)}")
            self.session.rollback()
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to create suite",
            }

    def get_suite(self, suite_id: UUID) -> Dict[str, Any]:
        """Get suite by ID"""
        try:
            self._validate_uuid(suite_id)

            suite = self.repo.get_by_id(suite_id)
            if not suite:
                return {
                    "success": False,
                    "error": "Suite not found",
                    "message": f"Suite with ID {suite_id} does not exist",
                }

            return {
                "success": True,
                "data": suite.to_dict(),
                "message": "Suite retrieved successfully",
            }
        except SuiteValidationError as e:
            logger.warning(f"Validation error retrieving suite: {str(e)}")
            return {"success": False, "error": str(e), "message": "Validation failed"}
        except SQLAlchemyError as e:
            logger.error(f"Database error retrieving suite {suite_id}: {str(e)}")
            return {
                "success": False,
                "error": "Database error",
                "message": "Failed to retrieve suite due to database error",
            }
        except Exception as e:
            logger.error(f"Unexpected error retrieving suite {suite_id}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to retrieve suite",
            }

    def get_suite_by_name(self, name: str) -> Dict[str, Any]:
        """Get suite by name"""
        try:
            if not name or not isinstance(name, str):
                raise SuiteValidationError(
                    "Suite name is required and must be a string"
                )

            name = name.strip()
            if not name:
                raise SuiteValidationError("Suite name cannot be empty")

            suite = self.repo.get_by_name(name)
            if not suite:
                return {
                    "success": False,
                    "error": "Suite not found",
                    "message": f"Suite with name '{name}' does not exist",
                }

            return {
                "success": True,
                "data": suite.to_dict(),
                "message": "Suite retrieved successfully",
            }
        except SuiteValidationError as e:
            logger.warning(f"Validation error retrieving suite by name: {str(e)}")
            return {"success": False, "error": str(e), "message": "Validation failed"}
        except SQLAlchemyError as e:
            logger.error(f"Database error retrieving suite by name {name}: {str(e)}")
            return {
                "success": False,
                "error": "Database error",
                "message": "Failed to retrieve suite due to database error",
            }
        except Exception as e:
            logger.error(f"Unexpected error retrieving suite by name {name}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to retrieve suite",
            }

    def get_suites(
        self,
        page: int = 1,
        page_size: int = 10,
        keyword: str = None,
        status: SuiteStatus = None,
    ) -> Dict[str, Any]:
        """Get suites with pagination, keyword search, and status filter"""
        try:
            # Validate and normalize pagination parameters
            page, page_size = self._validate_pagination(page, page_size)

            # Validate keyword if provided
            if keyword is not None:
                if not isinstance(keyword, str):
                    raise SuiteValidationError("Keyword must be a string")
                keyword = keyword.strip() if keyword.strip() else None

            # Validate status if provided
            if status is not None and not isinstance(status, SuiteStatus):
                raise SuiteValidationError(
                    "Status must be a valid SuiteStatus enum value"
                )

            result = self.repo.get_all(
                page=page, page_size=page_size, keyword=keyword, status=status
            )

            # Convert suites to dict format
            suites_data = [suite.to_dict() for suite in result["suites"]]

            return {
                "success": True,
                "data": {"suites": suites_data, "pagination": result["pagination"]},
                "message": "Suites retrieved successfully",
            }
        except SuiteValidationError as e:
            logger.warning(f"Validation error retrieving suites: {str(e)}")
            return {"success": False, "error": str(e), "message": "Validation failed"}
        except SQLAlchemyError as e:
            logger.error(f"Database error retrieving suites: {str(e)}")
            return {
                "success": False,
                "error": "Database error",
                "message": "Failed to retrieve suites due to database error",
            }
        except Exception as e:
            logger.error(f"Unexpected error retrieving suites: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to retrieve suites",
            }

    def update_suite(
        self,
        suite_id: UUID,
        name: str = None,
        description: str = None,
        dataset_id: UUID = None,
        total_evals: int = None,
        suite_metadata: Dict[str, Any] = None,
        status: SuiteStatus = None,
    ) -> Dict[str, Any]:
        """Update suite"""
        try:
            self._validate_uuid(suite_id)

            # Validate inputs if provided
            if name is not None:
                self._validate_suite_name(name)
                name = name.strip()

                # Check if another suite with same name exists
                existing = self.repo.get_by_name(name)
                if existing and existing.id != suite_id:
                    raise SuiteValidationError(
                        f"Another suite with name '{name}' already exists"
                    )

            if description is not None:
                self._validate_description(description)

            if suite_metadata is not None:
                self._validate_metadata(suite_metadata)

            if total_evals is not None:
                self._validate_total_evals(total_evals)

            if dataset_id is not None:
                self._validate_uuid(dataset_id)

            # Check if suite exists
            if not self.repo.exists(suite_id):
                return {
                    "success": False,
                    "error": "Suite not found",
                    "message": f"Suite with ID {suite_id} does not exist",
                }

            # Update the suite
            suite = self.repo.update(
                suite_id,
                name=name,
                description=description,
                dataset_id=dataset_id,
                total_evals=total_evals,
                suite_metadata=suite_metadata,
                status=status,
            )

            logger.info(f"Updated suite: {suite.id} - {suite.name}")
            return {
                "success": True,
                "data": suite.to_dict(),
                "message": "Suite updated successfully",
            }
        except SuiteValidationError as e:
            logger.warning(f"Validation error updating suite: {str(e)}")
            return {"success": False, "error": str(e), "message": "Validation failed"}
        except IntegrityError as e:
            logger.error(f"Database integrity error updating suite: {str(e)}")
            self.session.rollback()
            return {
                "success": False,
                "error": "Database constraint violation",
                "message": "Failed to update suite due to database constraints",
            }
        except SQLAlchemyError as e:
            logger.error(f"Database error updating suite {suite_id}: {str(e)}")
            self.session.rollback()
            return {
                "success": False,
                "error": "Database error",
                "message": "Failed to update suite due to database error",
            }
        except Exception as e:
            logger.error(f"Unexpected error updating suite {suite_id}: {str(e)}")
            self.session.rollback()
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to update suite",
            }

    def delete_suite(self, suite_id: UUID) -> Dict[str, Any]:
        """Delete suite"""
        try:
            self._validate_uuid(suite_id)

            # Check if suite exists
            suite = self.repo.get_by_id(suite_id)
            if not suite:
                return {
                    "success": False,
                    "error": "Suite not found",
                    "message": f"Suite with ID {suite_id} does not exist",
                }

            # Store suite name for logging
            suite_name = suite.name

            # Delete the suite
            success = self.repo.delete(suite_id)

            if success:
                logger.info(f"Deleted suite: {suite_id} - {suite_name}")
                return {
                    "success": True,
                    "message": f"Suite '{suite_name}' deleted successfully",
                }
            else:
                return {
                    "success": False,
                    "error": "Delete operation failed",
                    "message": "Failed to delete suite",
                }
        except SuiteValidationError as e:
            logger.warning(f"Validation error deleting suite: {str(e)}")
            return {"success": False, "error": str(e), "message": "Validation failed"}
        except SQLAlchemyError as e:
            logger.error(f"Database error deleting suite {suite_id}: {str(e)}")
            self.session.rollback()
            return {
                "success": False,
                "error": "Database error",
                "message": "Failed to delete suite due to database error",
            }
        except Exception as e:
            logger.error(f"Unexpected error deleting suite {suite_id}: {str(e)}")
            self.session.rollback()
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to delete suite",
            }

    def get_suite_stats(self) -> Dict[str, Any]:
        """Get suite statistics"""
        try:
            stats = self.repo.get_stats()
            return {
                "success": True,
                "data": stats,
                "message": "Suite statistics retrieved successfully",
            }
        except SQLAlchemyError as e:
            logger.error(f"Database error retrieving suite stats: {str(e)}")
            return {
                "success": False,
                "error": "Database error",
                "message": "Failed to retrieve suite statistics due to database error",
            }
        except Exception as e:
            logger.error(f"Unexpected error retrieving suite stats: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to retrieve suite statistics",
            }

    def search_suites(
        self,
        name: str = None,
        description: str = None,
        dataset_id: UUID = None,
        metadata_key: str = None,
        metadata_value: str = None,
        page: int = 1,
        page_size: int = 10,
    ) -> Dict[str, Any]:
        """Search suites with multiple filters"""
        try:
            # Validate and normalize pagination parameters
            page, page_size = self._validate_pagination(page, page_size)

            # Validate search parameters
            if name is not None:
                if not isinstance(name, str):
                    raise SuiteValidationError("Name filter must be a string")
                name = name.strip() if name.strip() else None

            if description is not None:
                if not isinstance(description, str):
                    raise SuiteValidationError("Description filter must be a string")
                description = description.strip() if description.strip() else None

            if dataset_id is not None:
                self._validate_uuid(dataset_id)

            if metadata_key is not None:
                if not isinstance(metadata_key, str):
                    raise SuiteValidationError("Metadata key filter must be a string")
                metadata_key = metadata_key.strip() if metadata_key.strip() else None

            if metadata_value is not None:
                if not isinstance(metadata_value, str):
                    raise SuiteValidationError("Metadata value filter must be a string")
                metadata_value = (
                    metadata_value.strip() if metadata_value.strip() else None
                )

            result = self.repo.search(
                name=name,
                description=description,
                dataset_id=dataset_id,
                metadata_key=metadata_key,
                metadata_value=metadata_value,
                page=page,
                page_size=page_size,
            )

            # Convert suites to dict format
            suites_data = [suite.to_dict() for suite in result["suites"]]

            return {
                "success": True,
                "data": {"suites": suites_data, "pagination": result["pagination"]},
                "message": "Suite search completed successfully",
            }
        except SuiteValidationError as e:
            logger.warning(f"Validation error searching suites: {str(e)}")
            return {"success": False, "error": str(e), "message": "Validation failed"}
        except SQLAlchemyError as e:
            logger.error(f"Database error searching suites: {str(e)}")
            return {
                "success": False,
                "error": "Database error",
                "message": "Failed to search suites due to database error",
            }
        except Exception as e:
            logger.error(f"Unexpected error searching suites: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to search suites",
            }

    def suite_exists(self, suite_id: UUID) -> bool:
        """Check if suite exists by ID"""
        try:
            self._validate_uuid(suite_id)
            return self.repo.exists(suite_id)
        except SuiteValidationError as e:
            logger.warning(f"Validation error checking suite existence: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Error checking suite existence {suite_id}: {str(e)}")
            return False

    def suite_exists_by_name(self, name: str) -> bool:
        """Check if suite exists by name"""
        try:
            if not name or not isinstance(name, str):
                return False
            name = name.strip()
            if not name:
                return False
            return self.repo.exists_by_name(name)
        except Exception as e:
            logger.error(f"Error checking suite existence by name {name}: {str(e)}")
            return False

    def get_suites_by_dataset(self, dataset_id: UUID) -> Dict[str, Any]:
        """Get all suites associated with a specific dataset"""
        try:
            self._validate_uuid(dataset_id)

            suites = self.repo.get_by_dataset_id(dataset_id)
            suites_data = [suite.to_dict() for suite in suites]

            return {
                "success": True,
                "data": {"suites": suites_data, "count": len(suites_data)},
                "message": "Suites retrieved successfully",
            }
        except SuiteValidationError as e:
            logger.warning(f"Validation error retrieving suites by dataset: {str(e)}")
            return {"success": False, "error": str(e), "message": "Validation failed"}
        except SQLAlchemyError as e:
            logger.error(
                f"Database error retrieving suites by dataset {dataset_id}: {str(e)}"
            )
            return {
                "success": False,
                "error": "Database error",
                "message": "Failed to retrieve suites due to database error",
            }
        except Exception as e:
            logger.error(
                f"Unexpected error retrieving suites by dataset {dataset_id}: {str(e)}"
            )
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to retrieve suites",
            }
