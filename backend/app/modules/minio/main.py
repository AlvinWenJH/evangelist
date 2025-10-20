from minio import Minio
from minio.error import S3Error
import os
import io
import json
from pathlib import Path
from typing import List, Dict

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false") == "true"


class MINIO:
    def __init__(
        self,
        endpoint=MINIO_ENDPOINT,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=MINIO_SECURE,
    ):
        self.client = Minio(
            endpoint, access_key, secret_key, secure=secure, cert_check=False
        )

    def init_buckets(self, buckets: list[str] = []):
        for bucket in buckets:
            if not self.client.bucket_exists(bucket):
                self.client.make_bucket(bucket)
                print(f"Bucket {bucket} created")

    def file_exists(self, bucket_name: str, object_name: str) -> bool:
        """
        Check if a file exists in the specified bucket

        Args:
            bucket_name (str): Name of the bucket
            object_name (str): Object key/path in the bucket

        Returns:
            bool: True if file exists, False otherwise
        """
        try:
            self.client.stat_object(bucket_name, object_name)
            return True
        except S3Error as e:
            if e.code == "NoSuchKey":
                return False
            raise e

    def upload_file(self, bucket_name: str, object_name: str, file_path: str) -> bool:
        """
        Upload a file to MinIO bucket

        Args:
            bucket_name (str): Name of the bucket
            object_name (str): Object key/path in the bucket
            file_path (str): Local file path to upload

        Returns:
            bool: True if upload successful, False otherwise
        """
        try:
            self.client.fput_object(bucket_name, object_name, file_path)
            return True
        except Exception as e:
            print(
                f"Error uploading file {file_path} to {bucket_name}/{object_name}: {e}"
            )
            return False

    def upload_template_files(
        self, suite_id: str, template_dir: str = None
    ) -> Dict[str, bool]:
        """
        Upload all template files to MinIO bucket for a specific suite

        Args:
            suite_id (str): The suite ID to use in the object key
            template_dir (str): Directory containing template files (defaults to app/modules/templates)

        Returns:
            Dict[str, bool]: Dictionary with filename as key and upload success as value
        """
        if template_dir is None:
            # Default to the templates directory
            current_dir = Path(__file__).parent.parent
            template_dir = current_dir / "templates"
        else:
            template_dir = Path(template_dir)

        if not template_dir.exists():
            print(f"Template directory {template_dir} does not exist")
            return {}

        bucket_name = "suites"
        upload_results = {}

        # Get all files in the templates directory
        template_files = [f for f in template_dir.iterdir() if f.is_file()]

        for file_path in template_files:
            file_name = file_path.name
            object_key = f"{suite_id}/configs/production/{file_name}"

            # Check if file already exists
            if self.file_exists(bucket_name, object_key):
                print(
                    f"File {object_key} already exists in bucket {bucket_name}, skipping upload"
                )
                upload_results[file_name] = (
                    True  # Consider existing files as successful
                )
                continue

            # Upload the file
            success = self.upload_file(bucket_name, object_key, str(file_path))
            upload_results[file_name] = success

            if success:
                print(
                    f"Successfully uploaded {file_name} to {bucket_name}/{object_key}"
                )
            else:
                print(f"Failed to upload {file_name} to {bucket_name}/{object_key}")

        return upload_results

    def download_file(self, bucket_name: str, object_name: str) -> bytes:
        """
        Download a file from MinIO bucket and return its content as bytes

        Args:
            bucket_name (str): Name of the bucket
            object_name (str): Object key/path in the bucket

        Returns:
            bytes: File content as bytes

        Raises:
            S3Error: If file doesn't exist or other MinIO errors
        """
        try:
            response = self.client.get_object(bucket_name, object_name)
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except S3Error as e:
            raise e

    def get_file_content(self, bucket_name: str, object_name: str) -> str:
        """
        Get file content as string from MinIO bucket

        Args:
            bucket_name (str): Name of the bucket
            object_name (str): Object key/path in the bucket

        Returns:
            str: File content as string

        Raises:
            S3Error: If file doesn't exist or other MinIO errors
        """
        try:
            data = self.download_file(bucket_name, object_name)
            return data.decode("utf-8")
        except S3Error as e:
            raise e

    def get_suite_config_file(
        self, suite_id: str, filename: str, version: str = "draft"
    ) -> str:
        """
        Get a specific configuration file for a suite

        Args:
            suite_id (str): The suite ID
            filename (str): Name of the configuration file
            version (str): Version folder (default: "draft")

        Returns:
            str: File content as string

        Raises:
            S3Error: If file doesn't exist or other MinIO errors
        """
        bucket_name = "suites"
        object_key = f"{suite_id}/configs/{version}/{filename}"
        return self.get_file_content(bucket_name, object_key)

    def list_suite_config_files(
        self, suite_id: str, version: str = "draft"
    ) -> List[str]:
        """
        List all configuration files for a suite

        Args:
            suite_id (str): The suite ID
            version (str): Version folder (default: "draft")

        Returns:
            List[str]: List of configuration file names
        """
        bucket_name = "suites"
        prefix = f"{suite_id}/configs/{version}/"

        try:
            objects = self.client.list_objects(bucket_name, prefix=prefix)
            filenames = []
            for obj in objects:
                # Extract filename from the full object key
                filename = obj.object_name.split("/")[-1]
                if filename:  # Skip empty strings (directories)
                    filenames.append(filename)
            return filenames
        except S3Error as e:
            if e.code == "NoSuchKey":
                return []
            raise e

    def copy_suite_config_to_version(self, suite_id: str, latest_version: int) -> dict:
        """Copy suite configuration files from production to draft/{version}

        Args:
            suite_id: The suite ID
            latest_version: The incremental version number for the draft

        Returns:
            dict: Mapping of filename to copy success status
        """
        bucket_name = "suites"
        from_prefix = f"{suite_id}/configs/production/"
        to_prefix = f"{suite_id}/configs/draft/{latest_version}/"

        copy_results = {}

        try:
            # List all objects in the production folder
            objects = self.client.list_objects(bucket_name, prefix=from_prefix)

            for obj in objects:
                filename = obj.object_name.split("/")[-1]
                if not filename:  # Skip directories
                    continue

                source_key = obj.object_name
                target_key = f"{to_prefix}{filename}"

                try:
                    # Copy the object
                    from minio.commonconfig import CopySource

                    copy_source = CopySource(bucket_name, source_key)
                    self.client.copy_object(bucket_name, target_key, copy_source)
                    copy_results[filename] = True

                except Exception as e:
                    print(f"Failed to copy {source_key} to {target_key}: {e}")
                    copy_results[filename] = False

        except Exception as e:
            print(f"Failed to list objects in {from_prefix}: {e}")

        return copy_results

    def upload_template_files_with_customization(
        self,
        suite_id: str,
        suite_name: str,
        suite_description: str,
        template_dir: str = None,
    ) -> Dict[str, bool]:
        """
        Upload template files to MinIO bucket with customization for a specific suite

        Args:
            suite_id (str): The suite ID to use in the object key
            suite_name (str): The suite name to replace SUITE_NAME placeholder
            suite_description (str): The suite description to replace SUITE_DESCRIPTION placeholder
            template_dir (str): Directory containing template files (defaults to app/modules/templates)

        Returns:
            Dict[str, bool]: Dictionary with filename as key and upload success as value
        """
        if template_dir is None:
            # Default to the templates directory
            current_dir = Path(__file__).parent.parent
            template_dir = current_dir / "templates"
        else:
            template_dir = Path(template_dir)

        if not template_dir.exists():
            print(f"Template directory {template_dir} does not exist")
            return {}

        bucket_name = "suites"
        upload_results = {}

        # Get all files in the templates directory
        template_files = [f for f in template_dir.iterdir() if f.is_file()]

        for file_path in template_files:
            file_name = file_path.name
            object_key = f"{suite_id}/configs/production/{file_name}"

            # Check if file already exists
            if self.file_exists(bucket_name, object_key):
                print(
                    f"File {object_key} already exists in bucket {bucket_name}, skipping upload"
                )
                upload_results[file_name] = (
                    True  # Consider existing files as successful
                )
                continue

            try:
                # Read the file content
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()

                # Customize content if it's the workflow template
                if file_name == "workflow-template.json":
                    try:
                        # Parse JSON
                        template_data = json.loads(content)

                        # Replace placeholders in the workflow section
                        if "workflow" in template_data:
                            if "name" in template_data["workflow"]:
                                template_data["workflow"]["name"] = suite_name
                            if "description" in template_data["workflow"]:
                                template_data["workflow"]["description"] = (
                                    suite_description
                                )

                        # Convert back to JSON string with proper formatting
                        content = json.dumps(template_data, indent=4)

                    except json.JSONDecodeError as e:
                        print(f"Warning: Could not parse {file_name} as JSON: {e}")
                        # Continue with original content if JSON parsing fails

                # Upload the customized content
                content_bytes = content.encode("utf-8")
                content_stream = io.BytesIO(content_bytes)

                self.client.put_object(
                    bucket_name,
                    object_key,
                    content_stream,
                    length=len(content_bytes),
                    content_type="application/json"
                    if file_name.endswith(".json")
                    else "text/plain",
                )

                upload_results[file_name] = True
                print(
                    f"Successfully uploaded and customized {file_name} to {bucket_name}/{object_key}"
                )

            except Exception as e:
                print(
                    f"Failed to upload {file_name} to {bucket_name}/{object_key}: {e}"
                )
                upload_results[file_name] = False

        return upload_results

    def rollback_suite_config_from_version(self, suite_id: str, version: int) -> dict:
        """Copy suite configuration files from draft/{version} to production

        Args:
            suite_id: The suite ID
            version: The draft version number to rollback from

        Returns:
            dict: Mapping of filename to copy success status
        """
        bucket_name = "suites"
        from_prefix = f"{suite_id}/configs/draft/{version}/"
        to_prefix = f"{suite_id}/configs/production/"

        copy_results = {}

        try:
            # List all objects in the draft version folder
            objects = self.client.list_objects(bucket_name, prefix=from_prefix)

            for obj in objects:
                filename = obj.object_name.split("/")[-1]
                if not filename:  # Skip directories
                    continue

                source_key = obj.object_name
                target_key = f"{to_prefix}{filename}"

                try:
                    # Copy the object
                    from minio.commonconfig import CopySource

                    copy_source = CopySource(bucket_name, source_key)
                    self.client.copy_object(bucket_name, target_key, copy_source)
                    copy_results[filename] = True

                except Exception as e:
                    print(f"Failed to copy {source_key} to {target_key}: {e}")
                    copy_results[filename] = False

        except Exception as e:
            print(f"Failed to list objects in {from_prefix}: {e}")

        return copy_results

    def upload_suite_config_file(
        self, suite_id: str, filename: str, content: str, version: str = "production"
    ) -> bool:
        """
        Upload a configuration file with string content to replace /suites/{suite_id}/configs/{version}/{filename}

        Args:
            suite_id (str): The suite ID
            filename (str): Name of the configuration file
            content (str): File content as string
            version (str): Version folder (default: "production")

        Returns:
            bool: True if upload successful, False otherwise
        """
        # Validate version
        if version not in ["draft", "production"]:
            raise ValueError("version must be either 'draft' or 'production'")

        # Construct object key
        object_key = f"{suite_id}/configs/{version}/{filename}"

        try:
            # Upload content
            content_bytes = content.encode("utf-8")
            content_stream = io.BytesIO(content_bytes)

            self.client.put_object(
                bucket_name="suites",
                object_name=object_key,
                data=content_stream,
                length=len(content_bytes),
                content_type="application/json"
                if filename.endswith(".json")
                else "text/plain",
            )

            return True

        except Exception as e:
            print(f"Failed to upload {filename} to {object_key}: {e}")
            return False
