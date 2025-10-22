from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from typing import Dict, Any
from uuid import UUID
import uuid
import re
import json

from app.modules.suites.repo import SuitesRepo
from app.modules.suites.models import SuiteStatus
from app.modules.datasets import Datasets
from app.modules.minio import MINIO

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

    def save_config_as_version(
        self, suite_id: UUID, initial_version: bool = False
    ) -> Dict[str, Any]:
        """Save current production config as a new draft version"""
        try:
            self._validate_uuid(suite_id)

            # Check if suite exists
            if not self.repo.exists(suite_id):
                return {
                    "success": False,
                    "message": f"Suite with ID {suite_id} does not exist",
                    "data": None,
                }

            if initial_version:
                # For initial version, set latest_config_version to 0
                self.repo.update(suite_id, latest_config_version=0)
                new_version = 0
            else:
                # Increment latest version and get the new version number
                new_version = self.repo.increment_latest_config_version(suite_id)
                if new_version is None:
                    return {
                        "success": False,
                        "message": "Failed to increment version",
                        "data": None,
                    }

            return {
                "success": True,
                "message": f"Config saved as version {new_version}",
                "data": {"version": new_version},
            }

        except SuiteValidationError as e:
            return {
                "success": False,
                "message": str(e),
                "data": None,
            }
        except SQLAlchemyError as e:
            logger.error(f"Database error saving config version: {e}")
            return {
                "success": False,
                "message": "Database error occurred",
                "data": None,
            }
        except Exception as e:
            logger.error(f"Unexpected error saving config version: {e}")
            return {
                "success": False,
                "message": "Failed to save config version",
                "data": None,
            }

    def rollback_to_config_version(
        self, suite_id: UUID, version: int
    ) -> Dict[str, Any]:
        """Rollback to a specific config version"""
        try:
            self._validate_uuid(suite_id)

            # Check if suite exists
            if not self.repo.exists(suite_id):
                return {
                    "success": False,
                    "message": f"Suite with ID {suite_id} does not exist",
                    "data": None,
                }

            # Get current version info to validate the rollback version
            version_info = self.repo.get_config_versions(suite_id)
            if not version_info:
                return {
                    "success": False,
                    "message": "Failed to get version information",
                    "data": None,
                }

            # Validate that the target version exists (should be <= latest_config_version)
            if version < 0 or version > version_info["latest_config_version"]:
                return {
                    "success": False,
                    "message": f"Invalid version {version}. Must be between 0 and {version_info['latest_config_version']}",
                    "data": None,
                }

            # Update current config version
            success = self.repo.update_current_config_version(suite_id, version)
            if not success:
                return {
                    "success": False,
                    "message": "Failed to update current config version",
                    "data": None,
                }

            return {
                "success": True,
                "message": f"Successfully rolled back to version {version}",
                "data": {
                    "current_version": version,
                    "previous_version": version_info["current_config_version"],
                },
            }

        except SuiteValidationError as e:
            return {
                "success": False,
                "message": str(e),
                "data": None,
            }
        except SQLAlchemyError as e:
            logger.error(f"Database error rolling back config version: {e}")
            return {
                "success": False,
                "message": "Database error occurred",
                "data": None,
            }
        except Exception as e:
            logger.error(f"Unexpected error rolling back config version: {e}")
            return {
                "success": False,
                "message": "Failed to rollback config version",
                "data": None,
            }

    def get_config_versions(self, suite_id: UUID) -> Dict[str, Any]:
        """Get current and latest config versions for a suite"""
        try:
            self._validate_uuid(suite_id)

            # Check if suite exists
            if not self.repo.exists(suite_id):
                return {
                    "success": False,
                    "message": f"Suite with ID {suite_id} does not exist",
                    "data": None,
                }

            version_info = self.repo.get_config_versions(suite_id)
            if not version_info:
                return {
                    "success": False,
                    "message": "Failed to get version information",
                    "data": None,
                }

            return {
                "success": True,
                "message": "Version information retrieved successfully",
                "data": version_info,
            }

        except SuiteValidationError as e:
            return {
                "success": False,
                "message": str(e),
                "data": None,
            }
        except SQLAlchemyError as e:
            logger.error(f"Database error getting config versions: {e}")
            return {
                "success": False,
                "message": "Database error occurred",
                "data": None,
            }
        except Exception as e:
            logger.error(f"Unexpected error getting config versions: {e}")
            return {
                "success": False,
                "message": "Failed to get config versions",
                "data": None,
            }

    def get_preprocessing_step(self, suite_id: UUID) -> Dict[str, Any]:
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
            suite_result = self.get_suite(suite_id)

            if not suite_result["success"]:
                return suite_result

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

                return {
                    "success": True,
                    "message": "Preprocessing step retrieved successfully",
                    "data": {
                        "suite_id": str(suite_id),
                        "description": preprocessing_step.get("description", ""),
                        "script": script_name,
                        "script_content": script_content,
                        "input": preprocessing_step.get("input", {}),
                    },
                }

            except Exception as config_error:
                logger.error(
                    f"Error retrieving preprocessing step for suite {suite_id}: {config_error}"
                )
                return {
                    "success": False,
                    "error": "Configuration not found",
                    "message": "Preprocessing configuration not found",
                }

        except Exception as e:
            logger.error(f"Error getting preprocessing step for suite {suite_id}: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to retrieve preprocessing step",
            }

    def get_invocation_step(self, suite_id: UUID) -> Dict[str, Any]:
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
            suite_result = self.get_suite(suite_id)

            if not suite_result["success"]:
                return suite_result

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
                    config_data.get("workflow", {})
                    .get("steps", {})
                    .get("invocation", {})
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

                return {
                    "success": True,
                    "message": "Invocation step retrieved successfully",
                    "data": {
                        "suite_id": str(suite_id),
                        "description": invocation_step.get("description", ""),
                        "script": script_name,
                        "script_content": script_content,
                        "input": invocation_step.get("input", {}),
                    },
                }

            except Exception as config_error:
                logger.error(
                    f"Error retrieving invocation step for suite {suite_id}: {config_error}"
                )
                return {
                    "success": False,
                    "error": "Configuration not found",
                    "message": "Invocation configuration not found",
                }

        except Exception as e:
            logger.error(f"Error getting invocation step for suite {suite_id}: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to retrieve invocation step",
            }

    def get_postprocessing_step(self, suite_id: UUID) -> Dict[str, Any]:
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
            suite_result = self.get_suite(suite_id)

            if not suite_result["success"]:
                return suite_result

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

                return {
                    "success": True,
                    "message": "Postprocessing step retrieved successfully",
                    "data": {
                        "suite_id": str(suite_id),
                        "description": postprocessing_step.get("description", ""),
                        "script": script_name,
                        "script_content": script_content,
                        "input": postprocessing_step.get("input", {}),
                    },
                }

            except Exception as config_error:
                logger.error(
                    f"Error retrieving postprocessing step for suite {suite_id}: {config_error}"
                )
                return {
                    "success": False,
                    "error": "Configuration not found",
                    "message": "Postprocessing configuration not found",
                }

        except Exception as e:
            logger.error(f"Error getting postprocessing step for suite {suite_id}: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to retrieve postprocessing step",
            }

    def get_evaluation_step(self, suite_id: UUID) -> Dict[str, Any]:
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
            suite_result = self.get_suite(suite_id)

            if not suite_result["success"]:
                return suite_result

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
                    config_data.get("workflow", {})
                    .get("steps", {})
                    .get("evaluation", {})
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

                return {
                    "success": True,
                    "message": "Evaluation step retrieved successfully",
                    "data": {
                        "suite_id": str(suite_id),
                        "description": evaluation_step.get("description", ""),
                        "script": script_name,
                        "script_content": script_content,
                        "input": evaluation_step.get("input", {}),
                    },
                }

            except Exception as config_error:
                logger.error(
                    f"Error retrieving evaluation step for suite {suite_id}: {config_error}"
                )
                return {
                    "success": False,
                    "error": "Configuration not found",
                    "message": "Evaluation configuration not found",
                }

        except Exception as e:
            logger.error(f"Error getting evaluation step for suite {suite_id}: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to retrieve evaluation step",
            }

    def _execute_script_content(
        self, script_content: str, function_name: str, **kwargs
    ) -> Dict[str, Any]:
        """Execute script content dynamically and return the result"""
        try:
            # Create a global namespace with access to commonly used modules
            global_namespace = {
                "__builtins__": __builtins__,
                # Standard library modules
                "json": json,
                "re": re,
                "uuid": uuid,
                "logging": logging,
                # Third-party modules that are commonly used
                "requests": __import__("requests"),
                # Add other commonly used modules as needed
            }

            # Create a local namespace for script execution
            local_namespace = {}

            # Execute the script content to define the function
            exec(script_content, global_namespace, local_namespace)

            # Check if the function exists in the namespace
            if function_name not in local_namespace:
                raise ValueError(
                    f"Function '{function_name}' not found in script content"
                )

            # Get the function and execute it
            func = local_namespace[function_name]
            result = func(**kwargs)

            return result

        except Exception as e:
            logger.error(f"Error executing script content: {e}")
            raise

    def process_step(
        self,
        step: str,
        config: Dict[str, Any],
        suite_id: UUID,
        dataset_id: UUID,
        results: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Process a single step with the given config"""
        try:
            if step == "load_data":
                output = self.load_row_from_data(suite_id, dataset_id)
            elif step == "preprocessing":
                previous_step_result = results.get("load_data", {})
                preprocessing_config = config.get("preprocessing", {})

                # Execute script content if available
                script_content = preprocessing_config.get("script_content")
                # print(f"script_content: \n{script_content}", flush=True)

                if script_content:
                    try:
                        # Get input parameters from config
                        input_params = {
                            "data": previous_step_result,
                            **preprocessing_config.get("input", {}),
                        }

                        # Execute the preprocessing function
                        output = self._execute_script_content(
                            script_content=script_content,
                            function_name="preprocess_data",
                            **input_params,
                        )
                        logger.info(
                            f"Preprocessing step executed successfully for suite {suite_id}"
                        )

                    except ValueError as ve:
                        logger.error(f"Validation error in preprocessing script: {ve}")
                        raise SuiteValidationError(
                            f"Preprocessing validation failed: {ve}"
                        )
                    except Exception as e:
                        logger.error(f"Error executing preprocessing script: {e}")
                        raise SuiteValidationError(
                            f"Preprocessing execution failed: {e}"
                        )
                else:
                    logger.warning("No script content found for preprocessing step")
                    output = previous_step_result
            elif step == "invocation":
                previous_step_result = results.get("preprocessing", {})
                invocation_config = config.get("invocation", {})
                # Execute script content if available
                script_content = invocation_config.get("script_content")
                # print(f"script_content: \n{script_content}", flush=True)

                if script_content:
                    try:
                        # Get input parameters from config
                        invocation_input_config = invocation_config.get("input", {})
                        input_params = {
                            "data": previous_step_result,
                            "url": invocation_input_config.get("url"),
                            "method": invocation_input_config.get("method", "POST"),
                            "input_type": invocation_input_config.get("input_type", {}),
                        }

                        # Execute the invocation function
                        output = self._execute_script_content(
                            script_content=script_content,
                            function_name="request_invocation",
                            **input_params,
                        )
                        logger.info(
                            f"Invocation step executed successfully for suite {suite_id}"
                        )

                    except ValueError as ve:
                        logger.error(f"Validation error in invocation script: {ve}")
                        raise SuiteValidationError(
                            f"Invocation validation failed: {ve}"
                        )
                    except Exception as e:
                        logger.error(f"Error executing invocation script: {e}")
                        raise SuiteValidationError(f"Invocation execution failed: {e}")
                else:
                    logger.warning("No script content found for invocation step")
                    output = previous_step_result
            elif step == "postprocessing":
                previous_step_result = results.get("invocation", {})
                postprocessing_config = config.get("postprocessing", {})

                # Execute script content if available
                script_content = postprocessing_config.get("script_content")

                if script_content:
                    try:
                        # Get input parameters from config
                        input_params = {
                            "data": previous_step_result.get("response", {}),
                            **postprocessing_config.get("input", {}),
                        }

                        # Execute the postprocessing function
                        output = self._execute_script_content(
                            script_content=script_content,
                            function_name="postprocess_data",
                            **input_params,
                        )
                        logger.info(
                            f"Postprocessing step executed successfully for suite {suite_id}"
                        )

                    except ValueError as ve:
                        logger.error(f"Validation error in postprocessing script: {ve}")
                        raise SuiteValidationError(
                            f"Postprocessing validation failed: {ve}"
                        )
                    except Exception as e:
                        logger.error(f"Error executing postprocessing script: {e}")
                        raise SuiteValidationError(
                            f"Postprocessing execution failed: {e}"
                        )
                else:
                    logger.warning("No script content found for postprocessing step")
                    output = previous_step_result
            else:
                output = None
            return output

        except SuiteValidationError as e:
            logger.error(f"Validation error processing step {step}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error processing step {step}: {e}")
            raise

    def load_row_from_data(self, suite_id: UUID, dataset_id: UUID) -> Dict[str, Any]:
        """Load a row of data from the dataset"""
        try:
            datasets_service = Datasets(self.session)
            row = datasets_service.preview_dataset(dataset_id, limit=1)
            return row["data"]["rows"][0]

        except Exception as e:
            raise
