from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from typing import Dict, Any
from uuid import UUID
import uuid
import re
import json
import io
import tempfile
import os
from datetime import datetime
from fastapi import UploadFile

import duckdb
from minio.error import S3Error

from app.modules.datasets.repo import DatasetsRepo
from app.modules.minio import MINIO

import logging

logger = logging.getLogger(__name__)


class DatasetValidationError(Exception):
    """Custom exception for dataset validation errors"""

    pass


class Datasets:
    def __init__(self, session: Session):
        self.session = session
        self.repo = DatasetsRepo(session)

    def _validate_dataset_name(self, name: str) -> None:
        """Validate dataset name"""
        if not name or not isinstance(name, str):
            raise DatasetValidationError(
                "Dataset name is required and must be a string"
            )

        if len(name.strip()) == 0:
            raise DatasetValidationError("Dataset name cannot be empty")

        if len(name) > 255:
            raise DatasetValidationError("Dataset name cannot exceed 255 characters")

        # Check for valid characters (alphanumeric, spaces, hyphens, underscores)
        if not re.match(r"^[a-zA-Z0-9\s\-_]+$", name):
            raise DatasetValidationError(
                "Dataset name can only contain letters, numbers, spaces, hyphens, and underscores"
            )

    def _validate_description(self, description: str) -> None:
        """Validate dataset description"""
        if description is not None:
            if not isinstance(description, str):
                raise DatasetValidationError("Description must be a string")

            if len(description) > 10000:  # Reasonable limit for text field
                raise DatasetValidationError(
                    "Description cannot exceed 10,000 characters"
                )

    def _validate_metadata(self, metadata: Dict[str, Any]) -> None:
        """Validate metadata"""
        if metadata is not None:
            if not isinstance(metadata, dict):
                raise DatasetValidationError("Metadata must be a dictionary")

            # Check for reasonable size limit (JSON serialization)
            try:
                import json

                json_str = json.dumps(metadata)
                if len(json_str) > 100000:  # 100KB limit
                    raise DatasetValidationError(
                        "Metadata is too large (max 100KB when serialized)"
                    )
            except (TypeError, ValueError) as e:
                raise DatasetValidationError(
                    f"Metadata must be JSON serializable: {str(e)}"
                )

    def _validate_uuid(self, dataset_id: UUID) -> None:
        """Validate UUID format"""
        if not isinstance(dataset_id, UUID):
            try:
                uuid.UUID(str(dataset_id))
            except (ValueError, TypeError):
                raise DatasetValidationError("Invalid UUID format")

    def _validate_pagination(self, page: int, page_size: int) -> tuple:
        """Validate and normalize pagination parameters"""
        try:
            page = int(page) if page is not None else 1
            page_size = int(page_size) if page_size is not None else 10
        except (ValueError, TypeError):
            raise DatasetValidationError("Page and page_size must be integers")

        if page < 1:
            page = 1

        if page_size < 1:
            page_size = 1
        elif page_size > 100:
            page_size = 100

        return page, page_size

    def create_dataset(
        self,
        name: str,
        description: str = None,
        dataset_metadata: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """Create a new dataset"""
        try:
            # Validate inputs
            self._validate_dataset_name(name)
            self._validate_description(description)
            self._validate_metadata(dataset_metadata)

            # Normalize name (strip whitespace)
            name = name.strip()

            # Check if dataset with same name already exists
            if self.repo.exists_by_name(name):
                raise DatasetValidationError(
                    f"Dataset with name '{name}' already exists"
                )

            # Create the dataset
            dataset = self.repo.create(
                name=name,
                description=description,
                dataset_metadata=dataset_metadata,
            )

            logger.info(f"Created dataset: {dataset.id} - {dataset.name}")
            return {
                "success": True,
                "data": dataset.to_dict(),
                "message": f"Dataset '{name}' created successfully",
            }
        except DatasetValidationError as e:
            logger.warning(f"Validation error creating dataset: {str(e)}")
            return {"success": False, "error": str(e), "message": "Validation failed"}
        except IntegrityError as e:
            logger.error(f"Database integrity error creating dataset: {str(e)}")
            self.session.rollback()
            return {
                "success": False,
                "error": "Database constraint violation",
                "message": "Failed to create dataset due to database constraints",
            }
        except SQLAlchemyError as e:
            logger.error(f"Database error creating dataset: {str(e)}")
            self.session.rollback()
            return {
                "success": False,
                "error": "Database error",
                "message": "Failed to create dataset due to database error",
            }
        except Exception as e:
            logger.error(f"Unexpected error creating dataset: {str(e)}")
            self.session.rollback()
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to create dataset",
            }

    def get_dataset(self, dataset_id: UUID) -> Dict[str, Any]:
        """Get dataset by ID"""
        try:
            self._validate_uuid(dataset_id)

            dataset = self.repo.get_by_id(dataset_id)
            if not dataset:
                return {
                    "success": False,
                    "error": "Dataset not found",
                    "message": f"Dataset with ID {dataset_id} does not exist",
                }

            return {
                "success": True,
                "data": dataset.to_dict(),
                "message": "Dataset retrieved successfully",
            }
        except DatasetValidationError as e:
            logger.warning(f"Validation error retrieving dataset: {str(e)}")
            return {"success": False, "error": str(e), "message": "Validation failed"}
        except SQLAlchemyError as e:
            logger.error(f"Database error retrieving dataset {dataset_id}: {str(e)}")
            return {
                "success": False,
                "error": "Database error",
                "message": "Failed to retrieve dataset due to database error",
            }
        except Exception as e:
            logger.error(f"Unexpected error retrieving dataset {dataset_id}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to retrieve dataset",
            }

    def get_dataset_by_name(self, name: str) -> Dict[str, Any]:
        """Get dataset by name"""
        try:
            if not name or not isinstance(name, str):
                raise DatasetValidationError(
                    "Dataset name is required and must be a string"
                )

            name = name.strip()
            if not name:
                raise DatasetValidationError("Dataset name cannot be empty")

            dataset = self.repo.get_by_name(name)
            if not dataset:
                return {
                    "success": False,
                    "error": "Dataset not found",
                    "message": f"Dataset with name '{name}' does not exist",
                }

            return {
                "success": True,
                "data": dataset.to_dict(),
                "message": "Dataset retrieved successfully",
            }
        except DatasetValidationError as e:
            logger.warning(f"Validation error retrieving dataset by name: {str(e)}")
            return {"success": False, "error": str(e), "message": "Validation failed"}
        except SQLAlchemyError as e:
            logger.error(f"Database error retrieving dataset by name {name}: {str(e)}")
            return {
                "success": False,
                "error": "Database error",
                "message": "Failed to retrieve dataset due to database error",
            }
        except Exception as e:
            logger.error(
                f"Unexpected error retrieving dataset by name {name}: {str(e)}"
            )
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to retrieve dataset",
            }

    def get_datasets(
        self, page: int = 1, page_size: int = 10, keyword: str = None
    ) -> Dict[str, Any]:
        """Get datasets with pagination and keyword search"""
        try:
            # Validate and normalize pagination parameters
            page, page_size = self._validate_pagination(page, page_size)

            # Validate keyword if provided
            if keyword is not None:
                if not isinstance(keyword, str):
                    raise DatasetValidationError("Keyword must be a string")
                keyword = keyword.strip() if keyword.strip() else None

            result = self.repo.get_all(page=page, page_size=page_size, keyword=keyword)

            # Convert datasets to dict format
            datasets_data = [dataset.to_dict() for dataset in result["datasets"]]

            return {
                "success": True,
                "data": {"datasets": datasets_data, "pagination": result["pagination"]},
                "message": "Datasets retrieved successfully",
            }
        except DatasetValidationError as e:
            logger.warning(f"Validation error retrieving datasets: {str(e)}")
            return {"success": False, "error": str(e), "message": "Validation failed"}
        except SQLAlchemyError as e:
            logger.error(f"Database error retrieving datasets: {str(e)}")
            return {
                "success": False,
                "error": "Database error",
                "message": "Failed to retrieve datasets due to database error",
            }
        except Exception as e:
            logger.error(f"Unexpected error retrieving datasets: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to retrieve datasets",
            }

    def update_dataset(
        self,
        dataset_id: UUID,
        name: str = None,
        description: str = None,
        dataset_metadata: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """Update dataset"""
        try:
            self._validate_uuid(dataset_id)

            # Validate inputs if provided
            if name is not None:
                self._validate_dataset_name(name)
                name = name.strip()

                # Check if another dataset with same name exists
                existing = self.repo.get_by_name(name)
                if existing and existing.id != dataset_id:
                    raise DatasetValidationError(
                        f"Another dataset with name '{name}' already exists"
                    )

            if description is not None:
                self._validate_description(description)

            if dataset_metadata is not None:
                self._validate_metadata(dataset_metadata)

            # Check if dataset exists
            if not self.repo.exists(dataset_id):
                return {
                    "success": False,
                    "error": "Dataset not found",
                    "message": f"Dataset with ID {dataset_id} does not exist",
                }

            # Update the dataset
            dataset = self.repo.update(
                dataset_id,
                name=name,
                description=description,
                dataset_metadata=dataset_metadata,
            )

            logger.info(f"Updated dataset: {dataset.id} - {dataset.name}")
            return {
                "success": True,
                "data": dataset.to_dict(),
                "message": "Dataset updated successfully",
            }
        except DatasetValidationError as e:
            logger.warning(f"Validation error updating dataset: {str(e)}")
            return {"success": False, "error": str(e), "message": "Validation failed"}
        except IntegrityError as e:
            logger.error(f"Database integrity error updating dataset: {str(e)}")
            self.session.rollback()
            return {
                "success": False,
                "error": "Database constraint violation",
                "message": "Failed to update dataset due to database constraints",
            }
        except SQLAlchemyError as e:
            logger.error(f"Database error updating dataset {dataset_id}: {str(e)}")
            self.session.rollback()
            return {
                "success": False,
                "error": "Database error",
                "message": "Failed to update dataset due to database error",
            }
        except Exception as e:
            logger.error(f"Unexpected error updating dataset {dataset_id}: {str(e)}")
            self.session.rollback()
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to update dataset",
            }

    def delete_dataset(self, dataset_id: UUID) -> Dict[str, Any]:
        """Delete dataset"""
        try:
            self._validate_uuid(dataset_id)

            # Check if dataset exists
            dataset = self.repo.get_by_id(dataset_id)
            if not dataset:
                return {
                    "success": False,
                    "error": "Dataset not found",
                    "message": f"Dataset with ID {dataset_id} does not exist",
                }

            # Store dataset name for logging
            dataset_name = dataset.name

            # Delete the dataset
            success = self.repo.delete(dataset_id)

            if success:
                logger.info(f"Deleted dataset: {dataset_id} - {dataset_name}")
                return {
                    "success": True,
                    "message": f"Dataset '{dataset_name}' deleted successfully",
                }
            else:
                return {
                    "success": False,
                    "error": "Delete operation failed",
                    "message": "Failed to delete dataset",
                }
        except DatasetValidationError as e:
            logger.warning(f"Validation error deleting dataset: {str(e)}")
            return {"success": False, "error": str(e), "message": "Validation failed"}
        except SQLAlchemyError as e:
            logger.error(f"Database error deleting dataset {dataset_id}: {str(e)}")
            self.session.rollback()
            return {
                "success": False,
                "error": "Database error",
                "message": "Failed to delete dataset due to database error",
            }
        except Exception as e:
            logger.error(f"Unexpected error deleting dataset {dataset_id}: {str(e)}")
            self.session.rollback()
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to delete dataset",
            }

    def get_dataset_stats(self) -> Dict[str, Any]:
        """Get dataset statistics"""
        try:
            stats = self.repo.get_stats()
            return {
                "success": True,
                "data": stats,
                "message": "Dataset statistics retrieved successfully",
            }
        except SQLAlchemyError as e:
            logger.error(f"Database error retrieving dataset stats: {str(e)}")
            return {
                "success": False,
                "error": "Database error",
                "message": "Failed to retrieve dataset statistics due to database error",
            }
        except Exception as e:
            logger.error(f"Unexpected error retrieving dataset stats: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to retrieve dataset statistics",
            }

    def search_datasets(
        self,
        name: str = None,
        description: str = None,
        metadata_key: str = None,
        metadata_value: str = None,
        page: int = 1,
        page_size: int = 10,
    ) -> Dict[str, Any]:
        """Search datasets with multiple filters"""
        try:
            # Validate and normalize pagination parameters
            page, page_size = self._validate_pagination(page, page_size)

            # Validate search parameters
            if name is not None:
                if not isinstance(name, str):
                    raise DatasetValidationError("Name filter must be a string")
                name = name.strip() if name.strip() else None

            if description is not None:
                if not isinstance(description, str):
                    raise DatasetValidationError("Description filter must be a string")
                description = description.strip() if description.strip() else None

            if metadata_key is not None:
                if not isinstance(metadata_key, str):
                    raise DatasetValidationError("Metadata key filter must be a string")
                metadata_key = metadata_key.strip() if metadata_key.strip() else None

            if metadata_value is not None:
                if not isinstance(metadata_value, str):
                    raise DatasetValidationError(
                        "Metadata value filter must be a string"
                    )
                metadata_value = (
                    metadata_value.strip() if metadata_value.strip() else None
                )

            result = self.repo.search(
                name=name,
                description=description,
                metadata_key=metadata_key,
                metadata_value=metadata_value,
                page=page,
                page_size=page_size,
            )

            # Convert datasets to dict format
            datasets_data = [dataset.to_dict() for dataset in result["datasets"]]

            return {
                "success": True,
                "data": {"datasets": datasets_data, "pagination": result["pagination"]},
                "message": "Dataset search completed successfully",
            }
        except DatasetValidationError as e:
            logger.warning(f"Validation error searching datasets: {str(e)}")
            return {"success": False, "error": str(e), "message": "Validation failed"}
        except SQLAlchemyError as e:
            logger.error(f"Database error searching datasets: {str(e)}")
            return {
                "success": False,
                "error": "Database error",
                "message": "Failed to search datasets due to database error",
            }
        except Exception as e:
            logger.error(f"Unexpected error searching datasets: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to search datasets",
            }

    def dataset_exists(self, dataset_id: UUID) -> bool:
        """Check if dataset exists by ID"""
        try:
            self._validate_uuid(dataset_id)
            return self.repo.exists(dataset_id)
        except DatasetValidationError as e:
            logger.warning(f"Validation error checking dataset existence: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Error checking dataset existence {dataset_id}: {str(e)}")
            return False

    def dataset_exists_by_name(self, name: str) -> bool:
        """Check if dataset exists by name"""
        try:
            if not name or not isinstance(name, str):
                return False

            name = name.strip()
            if not name:
                return False

            return self.repo.exists_by_name(name)
        except Exception as e:
            logger.error(f"Error checking dataset existence by name {name}: {str(e)}")
            return False

    def _get_minio_client(self):
        """Get Minio client instance"""
        minio = MINIO()
        return minio.client

    def _get_schema_from_minio(self, dataset_id: UUID) -> Dict[str, Any]:
        """Retrieve schema.json from Minio for the given dataset"""
        try:
            minio_client = self._get_minio_client()
            schema_path = f"{dataset_id}/schema.json"

            # Check if schema exists
            try:
                response = minio_client.get_object("datasets", schema_path)
                schema_data = json.loads(response.read().decode("utf-8"))
                response.close()
                response.release_conn()
                return schema_data
            except S3Error as e:
                if e.code == "NoSuchKey":
                    return None  # First upload, no schema exists
                raise
        except Exception as e:
            logger.error(f"Error retrieving schema from Minio: {str(e)}")
            return None

    def _save_schema_to_minio(self, dataset_id: UUID, schema: Dict[str, Any]) -> bool:
        """Save schema.json to Minio"""
        try:
            minio_client = self._get_minio_client()
            schema_path = f"{dataset_id}/schema.json"
            schema_json = json.dumps(schema, indent=2)
            schema_bytes = io.BytesIO(schema_json.encode("utf-8"))

            minio_client.put_object(
                "datasets",
                schema_path,
                schema_bytes,
                length=len(schema_json),
                content_type="application/json",
            )
            return True
        except Exception as e:
            logger.error(f"Error saving schema to Minio: {str(e)}")
            return False

    def _validate_csv_schema(
        self, csv_schema: Dict[str, Any], existing_schema: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Validate CSV schema against existing schema"""
        validation_result = {"valid": True, "errors": [], "warnings": []}

        if not existing_schema:
            return validation_result  # First upload, no validation needed

        existing_columns = existing_schema.get("columns", {})
        csv_columns = csv_schema.get("columns", {})

        # Check for missing columns
        missing_columns = set(existing_columns.keys()) - set(csv_columns.keys())
        if missing_columns:
            validation_result["errors"].append(
                f"Missing columns: {', '.join(missing_columns)}"
            )
            validation_result["valid"] = False

        # Check for extra columns
        extra_columns = set(csv_columns.keys()) - set(existing_columns.keys())
        if extra_columns:
            validation_result["warnings"].append(
                f"New columns found: {', '.join(extra_columns)}"
            )

        # Check data types for common columns
        for col_name in set(existing_columns.keys()) & set(csv_columns.keys()):
            existing_type = existing_columns[col_name]["type"]
            csv_type = csv_columns[col_name]["type"]

            if existing_type != csv_type:
                validation_result["errors"].append(
                    f"Column '{col_name}' type mismatch: expected {existing_type}, got {csv_type}"
                )
                validation_result["valid"] = False

        return validation_result

    def _process_csv_with_duckdb(self, csv_file: UploadFile) -> Dict[str, Any]:
        """Process CSV file using DuckDB and return schema and data info"""
        try:
            # Read CSV content
            csv_content = csv_file.file.read()
            csv_file.file.seek(0)  # Reset file pointer

            # Create temporary CSV file
            with tempfile.NamedTemporaryFile(
                mode="wb", suffix=".csv", delete=False
            ) as temp_csv:
                temp_csv.write(csv_content)
                temp_csv_path = temp_csv.name

            # Connect to DuckDB
            conn = duckdb.connect()

            # Create a table from CSV file
            conn.execute(f"""
                CREATE TABLE csv_data AS 
                SELECT * FROM read_csv_auto('{temp_csv_path}', header=true)
            """)

            # Get schema information
            schema_query = """
                DESCRIBE csv_data
            """
            schema_result = conn.execute(schema_query).fetchall()

            # Get row count
            row_count = conn.execute("SELECT COUNT(*) FROM csv_data").fetchone()[0]

            # Build schema dictionary
            schema = {
                "columns": {},
                "row_count": row_count,
                "created_at": datetime.now().isoformat(),
            }

            for (
                col_name,
                col_type,
                null_info,
                key_info,
                default_info,
                extra_info,
            ) in schema_result:
                schema["columns"][col_name] = {
                    "type": col_type,
                    "nullable": null_info == "YES",
                }

            conn.close()

            # Clean up temporary file
            os.unlink(temp_csv_path)

            return {"success": True, "schema": schema, "row_count": row_count}

        except Exception as e:
            logger.error(f"Error processing CSV with DuckDB: {str(e)}")
            return {"success": False, "error": str(e)}

    def _convert_csv_to_parquet_stream(
        self, csv_file: UploadFile, dataset_id: UUID
    ) -> Dict[str, Any]:
        """Convert CSV to Parquet and stream to Minio"""
        try:
            # Read CSV content
            csv_content = csv_file.file.read()
            csv_file.file.seek(0)  # Reset file pointer

            # Create temporary CSV file
            with tempfile.NamedTemporaryFile(
                mode="wb", suffix=".csv", delete=False
            ) as temp_csv:
                temp_csv.write(csv_content)
                temp_csv_path = temp_csv.name

            # Connect to DuckDB
            conn = duckdb.connect()

            # Create a table from CSV file
            conn.execute(f"""
                CREATE TABLE csv_data AS 
                SELECT * FROM read_csv_auto('{temp_csv_path}', header=true)
            """)

            # Create temporary file for Parquet output
            with tempfile.NamedTemporaryFile(
                suffix=".parquet", delete=False
            ) as temp_file:
                temp_path = temp_file.name

            # Export to Parquet file
            conn.execute(f"""
                COPY csv_data TO '{temp_path}' (FORMAT PARQUET)
            """)

            conn.close()

            # Read the Parquet file into memory
            with open(temp_path, "rb") as f:
                parquet_data = f.read()

            # Clean up temporary files
            os.unlink(temp_path)
            os.unlink(temp_csv_path)

            # Upload to Minio
            minio_client = self._get_minio_client()
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            parquet_path = f"{dataset_id}/{timestamp}.parquet"

            parquet_stream = io.BytesIO(parquet_data)

            minio_client.put_object(
                "datasets",
                parquet_path,
                parquet_stream,
                length=len(parquet_data),
                content_type="application/octet-stream",
            )

            return {
                "success": True,
                "parquet_path": parquet_path,
                "file_size": len(parquet_data),
            }

        except Exception as e:
            logger.error(f"Error converting CSV to Parquet: {str(e)}")
            return {"success": False, "error": str(e)}

    def upload_csv_to_dataset(
        self,
        dataset_id: UUID,
        csv_file: UploadFile,
    ) -> Dict[str, Any]:
        """Upload CSV file to dataset"""
        try:
            # Validate dataset exists
            if not self.dataset_exists(dataset_id):
                return {"success": False, "message": "Dataset not found"}

            # Validate file type
            if not csv_file.filename.lower().endswith(".csv"):
                return {"success": False, "message": "Only CSV files are supported"}

            # Process CSV and get schema
            csv_processing_result = self._process_csv_with_duckdb(csv_file)
            if not csv_processing_result["success"]:
                return {
                    "success": False,
                    "message": f"Error processing CSV: {csv_processing_result['error']}",
                }

            csv_schema = csv_processing_result["schema"]
            row_count = csv_processing_result["row_count"]

            # Get existing schema from Minio
            existing_schema = self._get_schema_from_minio(dataset_id)

            # Validate schema if exists
            if existing_schema:
                validation_result = self._validate_csv_schema(
                    csv_schema, existing_schema
                )
                if not validation_result["valid"]:
                    return {
                        "success": False,
                        "message": f"Schema validation failed: {'; '.join(validation_result['errors'])}",
                        "validation_errors": validation_result["errors"],
                        "validation_warnings": validation_result.get("warnings", []),
                    }

            # Convert CSV to Parquet and upload to Minio
            parquet_result = self._convert_csv_to_parquet_stream(csv_file, dataset_id)
            if not parquet_result["success"]:
                return {
                    "success": False,
                    "message": f"Error converting to Parquet: {parquet_result['error']}",
                }

            # Save/update schema in Minio
            schema_saved = self._save_schema_to_minio(dataset_id, csv_schema)
            if not schema_saved:
                logger.warning(f"Failed to save schema for dataset {dataset_id}")

            # Update total_rows in the dataset (add to existing count)
            current_dataset = self.repo.get_by_id(dataset_id)
            if current_dataset:
                current_total_rows = current_dataset.total_rows or 0
                new_total_rows = current_total_rows + row_count

                updated_dataset = self.repo.update(
                    dataset_id, total_rows=new_total_rows
                )
                if not updated_dataset:
                    logger.warning(
                        f"Failed to update total_rows for dataset {dataset_id}"
                    )
                    total_rows_updated = False
                else:
                    total_rows_updated = True
                    logger.info(
                        f"Updated total_rows from {current_total_rows} to {new_total_rows} (+{row_count}) for dataset {dataset_id}"
                    )
            else:
                logger.warning(
                    f"Could not find dataset {dataset_id} to update total_rows"
                )
                total_rows_updated = False

            return {
                "success": True,
                "message": "CSV uploaded and processed successfully",
                "data": {
                    "dataset_id": str(dataset_id),
                    "parquet_path": parquet_result["parquet_path"],
                    "file_size": parquet_result["file_size"],
                    "row_count": row_count,
                    "columns": list(csv_schema["columns"].keys()),
                    "schema_updated": schema_saved,
                    "total_rows_updated": total_rows_updated,
                    "is_first_upload": existing_schema is None,
                },
            }

        except Exception as e:
            logger.error(f"Error uploading CSV to dataset {dataset_id}: {str(e)}")
            return {
                "success": False,
                "message": "Internal server error during CSV upload",
            }

    def get_dataset_schema(self, dataset_id: UUID) -> Dict[str, Any]:
        """Get dataset schema from Minio with total_rows from datasets table"""
        try:
            self._validate_uuid(dataset_id)

            # Get dataset to check existence and get total_rows
            dataset = self.repo.get_by_id(dataset_id)
            if not dataset:
                return {
                    "success": False,
                    "error": "Dataset not found",
                    "message": f"Dataset with ID {dataset_id} does not exist",
                }

            # Get schema from Minio
            schema = self._get_schema_from_minio(dataset_id)
            if not schema:
                return {
                    "success": False,
                    "error": "Schema not found",
                    "message": f"No schema found for dataset {dataset_id}. Upload a CSV file first.",
                }

            # Replace row_count with total_rows from datasets table
            if "row_count" in schema:
                del schema["row_count"]
            schema["total_rows"] = dataset.total_rows or 0

            return {
                "success": True,
                "data": schema,
                "message": "Dataset schema retrieved successfully",
            }

        except DatasetValidationError as e:
            logger.warning(f"Validation error retrieving schema: {str(e)}")
            return {"success": False, "error": str(e), "message": "Validation failed"}
        except Exception as e:
            logger.error(f"Error retrieving schema for dataset {dataset_id}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to retrieve dataset schema",
            }

    def preview_dataset(self, dataset_id: UUID, limit: int = 10) -> Dict[str, Any]:
        """Preview dataset rows from the first Parquet file in Minio using DuckDB direct access"""
        try:
            self._validate_uuid(dataset_id)

            # Check if dataset exists
            if not self.repo.exists(dataset_id):
                return {
                    "success": False,
                    "error": "Dataset not found",
                    "message": f"Dataset with ID {dataset_id} does not exist",
                }

            # Get Minio client to list files
            minio_client = self._get_minio_client()
            bucket_name = "datasets"
            dataset_prefix = f"{dataset_id}/"

            try:
                # List objects in the dataset folder
                objects = list(
                    minio_client.list_objects(bucket_name, prefix=dataset_prefix)
                )

                # Filter for Parquet files
                parquet_files = [
                    obj for obj in objects if obj.object_name.endswith(".parquet")
                ]

                if not parquet_files:
                    return {
                        "success": False,
                        "error": "No data found",
                        "message": f"No Parquet files found for dataset {dataset_id}. Upload a CSV file first.",
                    }

                # Get the first Parquet file (sorted by name for consistency)
                first_parquet = sorted(parquet_files, key=lambda x: x.object_name)[0]
                parquet_path = first_parquet.object_name

                # Get MinIO configuration from environment
                minio_endpoint = os.getenv("MINIO_ENDPOINT", "minio:9000")
                minio_access_key = os.getenv("MINIO_ACCESS_KEY")
                minio_secret_key = os.getenv("MINIO_SECRET_KEY")
                minio_secure = os.getenv("MINIO_SECURE", "false") == "true"

                # Use DuckDB with direct S3/MinIO access
                conn = duckdb.connect()

                try:
                    # Install and load httpfs extension
                    conn.execute("INSTALL httpfs")
                    conn.execute("LOAD httpfs")

                    # Configure S3/MinIO settings
                    conn.execute("SET s3_region = 'us-east-1'")
                    conn.execute("SET s3_url_style = 'path'")
                    conn.execute(f"SET s3_endpoint = '{minio_endpoint}'")
                    conn.execute(f"SET s3_access_key_id = '{minio_access_key}'")
                    conn.execute(f"SET s3_secret_access_key = '{minio_secret_key}'")
                    conn.execute(f"SET s3_use_ssl = {str(minio_secure).lower()}")

                    # Construct S3 URL for the Parquet file
                    s3_url = f"s3://{bucket_name}/{parquet_path}"

                    # Read limited rows from the Parquet file directly from MinIO
                    query = f"SELECT * FROM read_parquet('{s3_url}') LIMIT {limit}"
                    result = conn.execute(query).fetchall()
                    columns = [desc[0] for desc in conn.description]

                    # Convert to list of dictionaries
                    rows = []
                    for row in result:
                        row_dict = {}
                        for i, value in enumerate(row):
                            # Handle datetime objects and other non-serializable types
                            if hasattr(value, "isoformat"):
                                row_dict[columns[i]] = value.isoformat()
                            else:
                                row_dict[columns[i]] = value
                        rows.append(row_dict)

                    # Get total row count from the file (efficient with DuckDB)
                    total_query = f"SELECT COUNT(*) FROM read_parquet('{s3_url}')"
                    total_rows_in_file = conn.execute(total_query).fetchone()[0]

                    return {
                        "success": True,
                        "data": {
                            "rows": rows,
                            "columns": columns,
                            "preview_count": len(rows),
                            "total_rows_in_file": total_rows_in_file,
                            "file_name": parquet_path.split("/")[-1],
                            "limit": limit,
                        },
                        "message": f"Dataset preview retrieved successfully ({len(rows)} rows)",
                    }

                finally:
                    conn.close()

            except S3Error as e:
                logger.error(f"Minio error accessing dataset {dataset_id}: {str(e)}")
                return {
                    "success": False,
                    "error": "Storage error",
                    "message": "Failed to access dataset files in storage",
                }

        except DatasetValidationError as e:
            logger.warning(f"Validation error previewing dataset: {str(e)}")
            return {"success": False, "error": str(e), "message": "Validation failed"}
        except Exception as e:
            logger.error(f"Error previewing dataset {dataset_id}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to preview dataset",
            }

    def get_dataset_history(self, dataset_id: UUID) -> Dict[str, Any]:
        """Get dataset history showing total_rows journey from each parquet file"""
        try:
            self._validate_uuid(dataset_id)

            # Check if dataset exists
            if not self.repo.exists(dataset_id):
                return {
                    "success": False,
                    "error": "Dataset not found",
                    "message": f"Dataset with ID {dataset_id} does not exist",
                }

            # Get Minio client to list files
            minio_client = self._get_minio_client()
            bucket_name = "datasets"
            dataset_prefix = f"{dataset_id}/"

            try:
                # List objects in the dataset folder
                objects = list(
                    minio_client.list_objects(bucket_name, prefix=dataset_prefix)
                )

                # Filter for Parquet files and exclude schema.json
                parquet_files = [
                    obj
                    for obj in objects
                    if obj.object_name.endswith(".parquet")
                    and not obj.object_name.endswith("schema.json")
                ]

                if not parquet_files:
                    return {
                        "success": True,
                        "data": {"history": [], "total_files": 0, "cumulative_rows": 0},
                        "message": "No parquet files found for this dataset",
                    }

                # Sort parquet files by name (which contains timestamp)
                parquet_files.sort(key=lambda x: x.object_name)

                # Get MinIO configuration from environment
                minio_endpoint = os.getenv("MINIO_ENDPOINT", "minio:9000")
                minio_access_key = os.getenv("MINIO_ACCESS_KEY")
                minio_secret_key = os.getenv("MINIO_SECRET_KEY")
                minio_secure = os.getenv("MINIO_SECURE", "false") == "true"

                # Use DuckDB with direct S3/MinIO access
                conn = duckdb.connect()

                try:
                    # Install and load httpfs extension
                    conn.execute("INSTALL httpfs")
                    conn.execute("LOAD httpfs")

                    # Configure S3/MinIO settings
                    conn.execute("SET s3_region = 'us-east-1'")
                    conn.execute("SET s3_url_style = 'path'")
                    conn.execute(f"SET s3_endpoint = '{minio_endpoint}'")
                    conn.execute(f"SET s3_access_key_id = '{minio_access_key}'")
                    conn.execute(f"SET s3_secret_access_key = '{minio_secret_key}'")
                    conn.execute(f"SET s3_use_ssl = {str(minio_secure).lower()}")

                    history = []
                    cumulative_rows = 0
                    cumulative_file_size_bytes = 0

                    for parquet_file in parquet_files:
                        parquet_path = parquet_file.object_name

                        # Extract timestamp from filename (format: {dataset_id}/{timestamp}.parquet)
                        filename = parquet_path.split("/")[-1]  # Get just the filename
                        timestamp_str = filename.replace(
                            ".parquet", ""
                        )  # Remove .parquet extension

                        # Construct S3 URL for the Parquet file
                        s3_url = f"s3://{bucket_name}/{parquet_path}"

                        try:
                            # Get total row count from the file efficiently with DuckDB
                            total_query = (
                                f"SELECT COUNT(*) FROM read_parquet('{s3_url}')"
                            )
                            file_rows = conn.execute(total_query).fetchone()[0]
                            cumulative_rows += file_rows
                            cumulative_file_size_bytes += parquet_file.size

                            # Parse timestamp for better display (format: YYYYMMDD_HHMMSS)
                            try:
                                parsed_timestamp = datetime.strptime(
                                    timestamp_str, "%Y%m%d_%H%M%S"
                                )
                                formatted_timestamp = parsed_timestamp.isoformat()
                            except ValueError:
                                # If timestamp parsing fails, use the original string
                                formatted_timestamp = timestamp_str

                            history.append(
                                {
                                    "timestamp": formatted_timestamp,
                                    "filename": filename,
                                    "rows_added": file_rows,
                                    "cumulative_rows": cumulative_rows,
                                    "file_size_bytes": parquet_file.size,
                                    "cumulative_file_size_bytes": cumulative_file_size_bytes,
                                }
                            )

                        except Exception as file_error:
                            logger.warning(
                                f"Error reading parquet file {parquet_path}: {str(file_error)}"
                            )
                            # Continue with other files even if one fails
                            continue

                    conn.close()

                    return {
                        "success": True,
                        "data": {
                            "history": history,
                            "total_files": len(history),
                            "cumulative_rows": cumulative_rows,
                            "dataset_id": str(dataset_id),
                        },
                        "message": f"Dataset history retrieved successfully with {len(history)} files",
                    }

                except Exception as duckdb_error:
                    logger.error(
                        f"DuckDB error reading parquet files: {str(duckdb_error)}"
                    )
                    return {
                        "success": False,
                        "error": "DuckDB error",
                        "message": f"Failed to read parquet files: {str(duckdb_error)}",
                    }

            except S3Error as s3_error:
                logger.error(
                    f"MinIO error listing files for dataset {dataset_id}: {str(s3_error)}"
                )
                return {
                    "success": False,
                    "error": "Storage error",
                    "message": f"Failed to list files from storage: {str(s3_error)}",
                }

        except DatasetValidationError as e:
            logger.warning(f"Validation error getting dataset history: {str(e)}")
            return {"success": False, "error": str(e), "message": "Validation failed"}
        except Exception as e:
            logger.error(f"Error getting dataset history {dataset_id}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to get dataset history",
            }
