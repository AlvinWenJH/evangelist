# Evangelist - From Data to Metrics

**Evangelist** is a comprehensive AI-powered evaluation platform designed to streamline the process of testing, evaluating, and optimizing AI models and APIs. The platform provides unified dataset management, automated evaluation workflows, and intelligent assistance for building evaluation pipelines.

## 🚀 Current Implementation Status

### ✅ Completed Features

#### Dataset Management System
- **Core Dataset Operations**: Full CRUD operations for datasets with UUID-based identification
- **File Upload & Processing**: Support for CSV file uploads with automatic Parquet conversion
- **Schema Management**: Automatic schema inference and validation with DuckDB integration
- **Data Preview**: Optimized dataset preview using DuckDB's direct MinIO access
- **Soft Delete**: Comprehensive soft delete functionality preserving data integrity
- **Storage Integration**: MinIO-based file storage with organized bucket structure

#### Evaluation Suite Management System
- **Core Suite Operations**: Full CRUD operations for evaluation suites with UUID-based identification
- **Status Management**: Suite status tracking with READY, RUNNING, and FAILED states
- **Advanced Filtering**: Multi-criteria search and filtering by status, name, description, and metadata
- **Dataset Integration**: Link suites to datasets for organized evaluation workflows
- **Statistics & Analytics**: Real-time suite statistics including status-based counts
- **Flexible Metadata**: JSONB-based metadata storage for custom suite configurations
- **Soft Delete**: Preserve suite data integrity while marking as deleted

#### Database Architecture
- **PostgreSQL Integration**: SQLAlchemy-based ORM with async support
- **Data Models**: Complete dataset models with metadata support
- **Repository Pattern**: Clean separation of data access logic
- **Migration Support**: Database migration scripts for schema updates

#### API Infrastructure
- **FastAPI Backend**: Modern async API framework with automatic documentation
- **RESTful Endpoints**: Complete dataset management API
- **Authentication**: JWT-based authentication system
- **Error Handling**: Comprehensive error handling and logging

### 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   File Storage  │
│   (Planned)     │◄──►│   FastAPI       │◄──►│   MinIO         │
│   React + TS    │    │   Python 3.11   │    │   S3-Compatible │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   PostgreSQL    │    │   DuckDB        │
                       │   Metadata      │    │   Analytics     │
                       └─────────────────┘    └─────────────────┘
```

### 📁 Project Structure

```
evangelist/
├── backend/                    # FastAPI backend application
│   ├── app/
│   │   ├── api/               # API routes and endpoints
│   │   │   ├── main.py        # Main API application
│   │   │   └── routers/       # Route modules
│   │   │       ├── auth.py    # Authentication endpoints
│   │   │       ├── datasets.py # Dataset management endpoints
│   │   │       ├── suites.py  # Evaluation suite endpoints
│   │   │       └── evals.py   # Evaluation management endpoints
│   │   └── modules/           # Business logic modules
│   │       ├── datasets/      # Dataset management
│   │       │   ├── main.py    # Core dataset operations
│   │       │   ├── models.py  # SQLAlchemy models
│   │       │   └── repo.py    # Data access layer
│   │       ├── suites/        # Evaluation suite management
│   │       │   ├── main.py    # Core suite operations
│   │       │   ├── models.py  # SQLAlchemy models
│   │       │   └── repo.py    # Data access layer
│   │       ├── evals/         # Evaluation management
│   │       │   ├── main.py    # Core evaluation operations
│   │       │   ├── models.py  # SQLAlchemy models
│   │       │   └── repo.py    # Data access layer
│   │       ├── minio/         # MinIO integration
│   │       ├── postgredb/     # PostgreSQL integration
│   │       └── response_model/ # API response models
│   ├── Dockerfile             # Container configuration
│   └── pyproject.toml         # Python dependencies
├── compose.yml                # Docker Compose setup
├── PRD.md                     # Product Requirements Document
└── README.md                  # This file
```

### 🛠️ Technology Stack

#### Backend Flow & Architecture

**Request Processing Pipeline**
1. **API Layer**: FastAPI receives HTTP requests and validates them using Pydantic models
2. **Authentication**: JWT tokens are validated for protected endpoints
3. **Business Logic**: Request is routed to appropriate service modules (datasets, auth)
4. **Data Access**: Repository pattern abstracts database operations using SQLAlchemy ORM
5. **File Operations**: MinIO handles file storage with automatic Parquet conversion
6. **Response**: Structured JSON responses with comprehensive error handling

**Data Processing Workflow**
- **Upload**: CSV files are uploaded to MinIO and processed with DuckDB for schema inference
- **Storage**: Original files stored in MinIO, metadata in PostgreSQL, processed data as Parquet
- **Retrieval**: DuckDB directly reads from MinIO using `httpfs` extension for optimal performance
- **Analytics**: Real-time data preview and statistics without downloading entire files

**Key Components**
- **FastAPI**: Async web framework with automatic OpenAPI documentation
- **SQLAlchemy**: ORM with repository pattern for clean data access
- **DuckDB**: In-process analytics engine for CSV processing and data preview
- **MinIO**: S3-compatible object storage for scalable file management
- **PostgreSQL**: Relational database for metadata and application state

#### Infrastructure
- **Container Runtime**: Docker + Docker Compose
- **Database**: PostgreSQL 15
- **Object Storage**: MinIO
- **Analytics Database**: ClickHouse (configured)

### 📊 Implemented API Endpoints

#### Dataset Management
```
# Core CRUD Operations
POST   /v1/datasets                    # Create new dataset
GET    /v1/datasets                    # List all datasets (with pagination)
GET    /v1/datasets/{id}               # Get dataset details
PUT    /v1/datasets/{id}               # Update dataset metadata
DELETE /v1/datasets/{id}               # Soft delete dataset

# File Operations
POST   /v1/datasets/{id}/upload-csv    # Upload CSV file to dataset
GET    /v1/datasets/{id}/schema        # Get dataset schema with total_rows
GET    /v1/datasets/{id}/preview       # Preview dataset (optimized with DuckDB)
GET    /v1/datasets/{id}/history       # Get dataset history timeline with row counts

# Search & Analytics
GET    /v1/datasets/search/advanced    # Advanced search with multiple filters
GET    /v1/datasets/stats/overview     # Get platform statistics
GET    /v1/datasets/name/{name}        # Get dataset by name
GET    /v1/datasets/{id}/exists        # Check if dataset exists by ID
GET    /v1/datasets/name/{name}/exists # Check if dataset exists by name
```

#### Evaluation Suite Management
```
# Core CRUD Operations
GET    /v1/suites                      # List all suites (with pagination, keyword search, status filter)
POST   /v1/suites                      # Create new evaluation suite
GET    /v1/suites/{id}                 # Get suite details by ID
PUT    /v1/suites/{id}                 # Update suite metadata by ID
DELETE /v1/suites/{id}                 # Soft delete suite by ID

# Search & Analytics
GET    /v1/suites/search/advanced      # Advanced search with multiple filters
GET    /v1/suites/stats/overview       # Get suite statistics (including status counts)
GET    /v1/suites/name/{name}          # Get suite by name
GET    /v1/suites/{id}/exists          # Check if suite exists by ID
GET    /v1/suites/name/{name}/exists   # Check if suite exists by name
GET    /v1/suites/dataset/{dataset_id} # Get all suites for a specific dataset

# Configuration Management
POST   /v1/suites/configure_workflow/{id}  # Configure workflow and save as version 0
GET    /v1/suites/{id}/config          # Get suite configuration (production version)
GET    /v1/suites/{id}/preprocessing_step   # Get preprocessing step configuration
GET    /v1/suites/{id}/invocation_step      # Get invocation step configuration
GET    /v1/suites/{id}/postprocessing_step  # Get postprocessing step configuration
GET    /v1/suites/{id}/evaluation_step      # Get evaluation step configuration

# Configuration Updates (with Version Control)
PUT    /v1/suites/{id}/configuration   # Full configuration update and save as new version
PATCH  /v1/suites/{id}/configuration   # Partial configuration update and save as new version

# Version Management
PUT    /v1/suites/{id}/save_as_version # Save current draft as new version
PUT    /v1/suites/{id}/rollback_to_version/{version} # Rollback to specific version
```

#### Evaluation Management
```
# Core CRUD Operations
GET    /v1/evals                       # List all evaluations (with pagination)
POST   /v1/evals                       # Create new evaluation
GET    /v1/evals/{id}                  # Get evaluation details by ID
PUT    /v1/evals/{id}                  # Update evaluation by ID
DELETE /v1/evals/{id}                  # Delete evaluation by ID

# Search & Analytics
GET    /v1/evals/search/advanced       # Advanced search with multiple filters
GET    /v1/evals/stats/overview        # Get evaluation statistics
GET    /v1/evals/name/{name}           # Get evaluation by name
GET    /v1/evals/{id}/exists           # Check if evaluation exists by ID
GET    /v1/evals/name/{name}/exists    # Check if evaluation exists by name

# Relationships
GET    /v1/evals/suite/{suite_id}      # Get all evaluations for a specific suite
GET    /v1/evals/dataset/{dataset_id}  # Get all evaluations for a specific dataset
```

#### Authentication
```
POST   /v1/auth/sign-in                # User authentication
```

### 🔧 Key Features Implemented

#### Advanced Dataset Operations
- **Optimized Preview**: Direct MinIO access via DuckDB's `httpfs` extension
- **Schema Validation**: Automatic schema inference with type detection
- **Soft Delete**: Preserves data integrity while marking datasets as deleted
- **Metadata Management**: JSONB-based flexible metadata storage
- **File Processing**: Automatic CSV to Parquet conversion for optimal storage
- **Dataset History Timeline**: Track data growth over time with row counts and file sizes per upload

#### Performance Optimizations
- **Direct Storage Access**: DuckDB reads directly from MinIO without downloading
- **Efficient Filtering**: Database-level filtering for soft-deleted records
- **Indexed Queries**: Optimized database indexes for common operations
- **Streaming Operations**: Memory-efficient file processing

#### Data Integrity
- **Transaction Management**: Proper database transaction handling
- **Error Recovery**: Comprehensive error handling with rollback support
- **Audit Trail**: Timestamp tracking for all operations
- **Schema Consistency**: Validation ensures data consistency across operations

#### Dataset History & Analytics
- **Timeline Tracking**: Complete history of dataset uploads with timestamps
- **Growth Analytics**: Track cumulative rows and file sizes over time
- **Efficient Processing**: DuckDB directly reads Parquet files from MinIO for row counts
- **Performance Optimized**: No file downloads required, direct S3-compatible access

#### Evaluation Suite Management
- **CRUD Operations**: Complete suite lifecycle management with UUID-based identification
- **Status Management**: Suite status tracking (READY, RUNNING, FAILED) with filtering capabilities
- **Advanced Search**: Multi-criteria search with name, description, dataset, and metadata filters
- **Dataset Integration**: Link suites to datasets for organized evaluation workflows
- **Statistics Dashboard**: Real-time suite statistics including status-based counts
- **Flexible Metadata**: JSONB-based metadata storage for custom suite configurations
- **Soft Delete**: Preserve suite data integrity while marking as deleted

#### Configuration Management & Version Control
- **Workflow Configuration**: Complete workflow setup with preprocessing, invocation, postprocessing, and evaluation steps
- **Version Control**: Automatic versioning system with draft and production environments
- **Configuration Updates**: Full and partial configuration updates with automatic version saving
- **Evaluation-Based Freezing**: Smart configuration locking when evaluations exist (allows only invocation updates)
- **Version Rollback**: Ability to rollback to any previous configuration version
- **Step-by-Step Access**: Individual access to each workflow step configuration

#### Evaluation Management
- **CRUD Operations**: Complete evaluation lifecycle management with UUID-based identification
- **Suite Integration**: Link evaluations to specific suites for organized workflow execution
- **Dataset Relationships**: Connect evaluations to datasets for comprehensive tracking
- **Advanced Search**: Multi-criteria search with name, description, and metadata filters
- **Statistics Dashboard**: Real-time evaluation statistics and status tracking


## 📖 API Documentation

### Base URL
```
http://localhost:8000/api
```

### Authentication Router (`/v1/auth`)

#### POST `/v1/auth/sign-in`
**Description**: User authentication endpoint

**Request**:
```bash
curl -X POST "http://localhost:8000/api/v1/auth/sign-in?username=admin&password=secret1234" \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "success": true,
  "message": "Successfully signed in",
  "data": null
}
```

**Error Response** (401):
```json
{
  "detail": "Invalid credentials"
}
```

---

### Dataset Management Router (`/v1/datasets`)

#### GET `/v1/datasets/`
**Description**: Get all datasets with pagination and search

**Request**:
```bash
curl -X GET "http://localhost:8000/api/v1/datasets/?page=1&limit=10&keyword=test" \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "message": "Datasets retrieved successfully",
  "data": {
    "datasets": [
      {
        "id": "71685f7d-5f03-42a2-8bd9-ed8117a28a5c",
        "name": "mydataset",
        "description": "just a test",
        "total_rows": 0,
        "created_at": "2025-10-13T15:58:10.498378+00:00",
        "updated_at": "2025-10-13T15:58:10.498378+00:00",
        "dataset_metadata": {},
        "is_deleted": false
      }
    ],
    "page": 1,
    "limit": 10,
    "total": 3,
    "total_page": 1
  }
}
```

#### POST `/v1/datasets/`
**Description**: Create a new dataset

**Request**:
```bash
curl -X POST "http://localhost:8000/api/v1/datasets/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Dataset",
    "description": "Dataset description",
    "dataset_metadata": {"type": "csv", "source": "upload"}
  }'
```

**Response**:
```json
{
  "message": "Dataset 'New Dataset' created successfully",
  "data": {
    "id": "b7c0515d-93bb-4598-b26a-bc4c3df7ab82",
    "name": "New Dataset",
    "description": "Dataset description",
    "total_rows": 0,
    "created_at": "2025-10-18T14:34:16.123133+00:00",
    "updated_at": "2025-10-18T14:34:16.123133+00:00",
    "dataset_metadata": {},
    "is_deleted": false
  }
}
```

#### GET `/v1/datasets/{dataset_id}`
**Description**: Get dataset by ID

**Request**:
```bash
curl -X GET "http://localhost:8000/api/v1/datasets/596d019a-758b-424c-9143-db666ba52909" \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "success": true,
  "message": "Dataset retrieved successfully",
  "data": {
    "id": "596d019a-758b-424c-9143-db666ba52909",
    "name": "Test Dataset",
    "description": "A test dataset",
    "dataset_metadata": {"type": "csv", "rows": 1000},
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

#### PUT `/v1/datasets/{dataset_id}`
**Description**: Update dataset by ID

**Request**:
```bash
curl -X PUT "http://localhost:8000/api/v1/datasets/596d019a-758b-424c-9143-db666ba52909" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Dataset Name",
    "description": "Updated description"
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "Dataset updated successfully",
  "data": {
    "id": "596d019a-758b-424c-9143-db666ba52909",
    "name": "Updated Dataset Name",
    "description": "Updated description",
    "dataset_metadata": {"type": "csv", "rows": 1000},
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T01:00:00Z"
  }
}
```

#### DELETE `/v1/datasets/{dataset_id}`
**Description**: Delete dataset by ID

**Request**:
```bash
curl -X DELETE "http://localhost:8000/api/v1/datasets/596d019a-758b-424c-9143-db666ba52909" \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "success": true,
  "message": "Dataset deleted successfully",
  "data": null
}
```

#### POST `/v1/datasets/{dataset_id}/upload-csv`
**Description**: Upload CSV file to dataset

**Request**:
```bash
curl -X POST "http://localhost:8000/api/v1/datasets/596d019a-758b-424c-9143-db666ba52909/upload-csv" \
  -H "Content-Type: multipart/form-data" \
  -F "csv_file=@data.csv"
```

**Response**:
```json
{
  "success": true,
  "message": "CSV uploaded successfully",
  "data": {
    "rows_processed": 1000,
    "schema": {
      "columns": ["id", "name", "value"],
      "types": ["integer", "string", "float"]
    }
  }
}
```

#### GET `/v1/datasets/{dataset_id}/schema`
**Description**: Get dataset schema with column information and total rows

**Note**: This endpoint requires that a CSV file has been uploaded to the dataset first. If no CSV file has been uploaded, it will return a 400 error.

**Request**:
```bash
curl -X GET "http://localhost:8000/api/v1/datasets/596d019a-758b-424c-9143-db666ba52909/schema" \
  -H "Content-Type: application/json"
```

**Response** (Success):
```json
{
  "message": "Dataset schema retrieved successfully",
  "data": {
    "columns": ["id", "name", "value"],
    "types": ["integer", "string", "float"],
    "total_rows": 1000
  }
}
```

**Response** (Error - No CSV uploaded):
```json
{
  "detail": "No schema found for dataset {dataset_id}. Upload a CSV file first."
}
```

#### GET `/v1/datasets/{dataset_id}/preview`
**Description**: Preview dataset rows

**Request**:
```bash
curl -X GET "http://localhost:8000/api/v1/datasets/596d019a-758b-424c-9143-db666ba52909/preview?limit=5" \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "success": true,
  "message": "Dataset preview retrieved successfully",
  "data": {
    "rows": [
      {"id": 1, "name": "Item 1", "value": 10.5},
      {"id": 2, "name": "Item 2", "value": 20.3}
    ],
    "total_rows": 1000,
    "preview_count": 2
  }
}
```

#### GET `/v1/datasets/stats/overview`
**Description**: Get platform statistics overview

**Request**:
```bash
curl -X GET "http://localhost:8000/api/v1/datasets/stats/overview" \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "message": "Dataset statistics retrieved successfully",
  "data": {
    "total_datasets": 3,
    "total_rows": 0,
    "total_size_mb": 0.0,
    "datasets_by_status": {
      "active": 3,
      "deleted": 0
    }
  }
}
```

---

### Evaluation Suite Management Router (`/v1/suites`)

#### GET `/v1/suites/`
**Description**: Get all suites with pagination, search, and status filter

**Request**:
```bash
curl -X GET "http://localhost:8000/api/v1/suites/?page=1&limit=10&keyword=test&status=READY" \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "message": "Suites retrieved successfully",
  "data": {
    "suites": [
      {
        "id": "a701c3cf-d3f6-4c79-9a06-5b15b378a8cd",
        "name": "Test",
        "description": "testing suites",
        "dataset_id": "596d019a-758b-424c-9143-db666ba52909",
        "total_evals": 0,
        "status": "ready",
        "created_at": "2025-10-13T15:03:07.817904+00:00",
        "updated_at": "2025-10-16T16:30:03.646211+00:00",
        "suite_metadata": {
          "company": "A"
        },
        "is_deleted": false,
        "current_config_version": 3,
        "latest_config_version": 3
      }
    ],
    "page": 1,
    "limit": 10,
    "total": 1,
    "total_page": 1
  }
}
```

#### POST `/v1/suites/`
**Description**: Create a new evaluation suite

**Request**:
```bash
curl -X POST "http://localhost:8000/api/v1/suites/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Suite",
    "description": "Suite description",
    "dataset_id": "596d019a-758b-424c-9143-db666ba52909",
    "status": "ready",
    "suite_metadata": {"version": "1.0"}
  }'
```

**Response**:
```json
{
  "message": "Suite created successfully",
  "data": {
    "id": "a701c3cf-d3f6-4c79-9a06-5b15b378a8cd",
    "name": "New Suite",
    "description": "Suite description",
    "dataset_id": "596d019a-758b-424c-9143-db666ba52909",
    "total_evals": 0,
    "status": "ready",
    "created_at": "2025-10-13T15:03:07.817904+00:00",
    "updated_at": "2025-10-16T16:30:03.646211+00:00",
    "suite_metadata": {"version": "1.0"},
    "is_deleted": false,
    "current_config_version": 1,
    "latest_config_version": 1
  }
}
```

#### POST `/v1/suites/configure_workflow/{suite_id}`
**Description**: Configure workflow for a suite

**Request**:
```bash
curl -X POST "http://localhost:8000/api/v1/suites/configure_workflow/a701c3cf-d3f6-4c79-9a06-5b15b378a8cd" \
  -H "Content-Type: application/json" \
  -d '{
    "preprocessing": {
      "steps": ["data_cleaning", "normalization"],
      "config": {"remove_nulls": true}
    },
    "invocation": {
      "endpoint": "https://api.example.com/predict",
      "method": "POST",
      "headers": {"Authorization": "Bearer token"}
    },
    "postprocessing": {
      "steps": ["format_output"],
      "config": {"format": "json"}
    },
    "evaluation": {
      "metrics": ["accuracy", "precision", "recall"],
      "thresholds": {"accuracy": 0.8}
    }
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "Workflow configured successfully",
  "data": {
    "suite_id": "a701c3cf-d3f6-4c79-9a06-5b15b378a8cd",
    "configuration": {
      "preprocessing": {
        "steps": ["data_cleaning", "normalization"],
        "config": {"remove_nulls": true}
      },
      "invocation": {
        "endpoint": "https://api.example.com/predict",
        "method": "POST",
        "headers": {"Authorization": "Bearer token"}
      },
      "postprocessing": {
        "steps": ["format_output"],
        "config": {"format": "json"}
      },
      "evaluation": {
        "metrics": ["accuracy", "precision", "recall"],
        "thresholds": {"accuracy": 0.8}
      }
    },
    "version": 0,
    "environment": "draft"
  }
}
```

#### GET `/v1/suites/stats/overview`
**Description**: Get suite statistics overview

**Request**:
```bash
curl -X GET "http://localhost:8000/api/v1/suites/stats/overview" \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "message": "Suite statistics retrieved successfully",
  "data": {
    "total_suites": 1,
    "suites_by_status": {
      "ready": 1,
      "draft": 0,
      "archived": 0
    },
    "total_evaluations": 0,
    "avg_evaluations_per_suite": 0.0
  }
}
```

#### PUT `/v1/suites/{suite_id}/configuration`
**Description**: Full update of suite configuration (saves as new version)

**Request**:
```bash
curl -X PUT "http://localhost:8000/api/v1/suites/550e8400-e29b-41d4-a716-446655440002/configuration" \
  -H "Content-Type: application/json" \
  -d '{
    "configuration": {
      "preprocessing": {
        "steps": ["data_cleaning", "validation"],
        "config": {"remove_nulls": true, "validate_schema": true}
      },
      "invocation": {
        "endpoint": "https://api.example.com/v2/predict",
        "method": "POST",
        "headers": {"Authorization": "Bearer new_token"}
      },
      "postprocessing": {
        "steps": ["format_output", "save_results"],
        "config": {"format": "json", "save_path": "/results"}
      },
      "evaluation": {
        "metrics": ["accuracy", "precision", "recall", "f1_score"],
        "thresholds": {"accuracy": 0.85, "f1_score": 0.8}
      }
    }
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "Configuration updated and saved as new version",
  "data": {
    "suite_id": "550e8400-e29b-41d4-a716-446655440002",
    "version": 1,
    "environment": "draft",
    "configuration": {
      "preprocessing": {
        "steps": ["data_cleaning", "validation"],
        "config": {"remove_nulls": true, "validate_schema": true}
      },
      "invocation": {
        "endpoint": "https://api.example.com/v2/predict",
        "method": "POST",
        "headers": {"Authorization": "Bearer new_token"}
      },
      "postprocessing": {
        "steps": ["format_output", "save_results"],
        "config": {"format": "json", "save_path": "/results"}
      },
      "evaluation": {
        "metrics": ["accuracy", "precision", "recall", "f1_score"],
        "thresholds": {"accuracy": 0.85, "f1_score": 0.8}
      }
    }
  }
}
```

#### PATCH `/v1/suites/{suite_id}/configuration`
**Description**: Partial update of suite configuration (saves as new version)

**Request**:
```bash
curl -X PATCH "http://localhost:8000/api/v1/suites/550e8400-e29b-41d4-a716-446655440002/configuration" \
  -H "Content-Type: application/json" \
  -d '{
    "invocation": {
      "endpoint": "https://api.example.com/v3/predict",
      "timeout": 30
    },
    "evaluation": {
      "metrics": ["accuracy", "precision", "recall", "f1_score", "auc"],
      "thresholds": {"accuracy": 0.9}
    }
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "Configuration partially updated and saved as new version",
  "data": {
    "suite_id": "550e8400-e29b-41d4-a716-446655440002",
    "version": 2,
    "environment": "draft",
    "updated_sections": ["invocation", "evaluation"]
  }
}
```

#### GET `/v1/suites/{suite_id}/config`
**Description**: Get current suite configuration

**Request**:
```bash
curl -X GET "http://localhost:8000/api/v1/suites/550e8400-e29b-41d4-a716-446655440002/config" \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "success": true,
  "message": "Configuration retrieved successfully",
  "data": {
    "suite_id": "550e8400-e29b-41d4-a716-446655440002",
    "version": 2,
    "environment": "production",
    "configuration": {
      "preprocessing": {
        "steps": ["data_cleaning", "validation"],
        "config": {"remove_nulls": true, "validate_schema": true}
      },
      "invocation": {
        "endpoint": "https://api.example.com/v3/predict",
        "method": "POST",
        "timeout": 30,
        "headers": {"Authorization": "Bearer new_token"}
      },
      "postprocessing": {
        "steps": ["format_output", "save_results"],
        "config": {"format": "json", "save_path": "/results"}
      },
      "evaluation": {
        "metrics": ["accuracy", "precision", "recall", "f1_score", "auc"],
        "thresholds": {"accuracy": 0.9}
      }
    }
  }
}
```

#### PUT `/v1/suites/{suite_id}/rollback_to_version/{version}`
**Description**: Rollback suite to a specific version

**Request**:
```bash
curl -X PUT "http://localhost:8000/api/v1/suites/550e8400-e29b-41d4-a716-446655440002/rollback_to_version/1" \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "success": true,
  "message": "Successfully rolled back to version 1",
  "data": {
    "suite_id": "550e8400-e29b-41d4-a716-446655440002",
    "previous_version": 2,
    "current_version": 1,
    "environment": "production"
  }
}
```

---

### Evaluation Management Router (`/v1/evals`)

#### GET `/v1/evals/`
**Description**: Get all evaluations with pagination, search, and status filter

**Request**:
```bash
curl -X GET "http://localhost:8000/api/v1/evals/?page=1&limit=10&keyword=test&status=COMPLETED" \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "message": "Evaluations retrieved successfully",
  "data": {
    "evals": [
      {
        "id": "a701c3cf-d3f6-4c79-9a06-5b15b378a8cd",
        "name": "Test Evaluation",
        "description": "A test evaluation",
        "suite_id": "596d019a-758b-424c-9143-db666ba52909",
        "dataset_id": "596d019a-758b-424c-9143-db666ba52909",
        "status": "completed",
        "total_requests": 100,
        "successful_requests": 95,
        "failed_requests": 5,
        "started_at": "2025-10-13T15:03:07.817904+00:00",
        "completed_at": "2025-10-16T16:30:03.646211+00:00",
        "eval_metadata": {"accuracy": 0.95},
        "is_deleted": false,
        "created_at": "2025-10-13T15:03:07.817904+00:00",
        "updated_at": "2025-10-16T16:30:03.646211+00:00"
      }
    ],
    "page": 1,
    "limit": 10,
    "total": 1,
    "total_page": 1
  }
}
```

#### POST `/v1/evals/`
**Description**: Create a new evaluation

**Request**:
```bash
curl -X POST "http://localhost:8000/api/v1/evals/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Evaluation",
    "description": "Evaluation description",
    "suite_id": "a701c3cf-d3f6-4c79-9a06-5b15b378a8cd",
    "dataset_id": "596d019a-758b-424c-9143-db666ba52909",
    "eval_metadata": {"target_accuracy": 0.9}
  }'
```

**Response**:
```json
{
  "message": "Evaluation created successfully",
  "data": {
    "id": "a701c3cf-d3f6-4c79-9a06-5b15b378a8cd",
    "name": "New Evaluation",
    "description": "Evaluation description",
    "suite_id": "596d019a-758b-424c-9143-db666ba52909",
    "dataset_id": "596d019a-758b-424c-9143-db666ba52909",
    "status": "pending",
    "total_requests": 0,
    "successful_requests": 0,
    "failed_requests": 0,
    "eval_metadata": {"target_accuracy": 0.9},
    "is_deleted": false,
    "created_at": "2025-10-13T15:03:07.817904+00:00",
    "updated_at": "2025-10-16T16:30:03.646211+00:00"
  }
}
```

#### GET `/v1/evals/{eval_id}`
**Description**: Get evaluation by ID

**Request**:
```bash
curl -X GET "http://localhost:8000/api/v1/evals/550e8400-e29b-41d4-a716-446655440004" \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "success": true,
  "message": "Evaluation retrieved successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440004",
    "name": "Test Evaluation",
    "description": "A test evaluation",
    "suite_id": "550e8400-e29b-41d4-a716-446655440002",
    "dataset_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "COMPLETED",
    "total_requests": 100,
    "successful_requests": 95,
    "failed_requests": 5,
    "started_at": "2024-01-01T00:00:00Z",
    "completed_at": "2024-01-01T01:00:00Z",
    "eval_metadata": {"accuracy": 0.95, "precision": 0.92, "recall": 0.98}
  }
}
```

#### GET `/v1/evals/stats/overview`
**Description**: Get evaluation statistics overview

**Request**:
```bash
curl -X GET "http://localhost:8000/api/v1/evals/stats/overview" \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "message": "Evaluation statistics retrieved successfully",
  "data": {
    "total_evaluations": 0,
    "evaluations_by_status": {
      "pending": 0,
      "running": 0,
      "completed": 0,
      "failed": 0
    },
    "total_requests": 0,
    "avg_success_rate": 0.0
  }
}
```

#### GET `/v1/evals/suite/{suite_id}`
**Description**: Get all evaluations for a specific suite

**Request**:
```bash
curl -X GET "http://localhost:8000/api/v1/evals/suite/550e8400-e29b-41d4-a716-446655440002" \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "success": true,
  "message": "Evaluations for suite retrieved successfully",
  "data": {
    "suite_id": "550e8400-e29b-41d4-a716-446655440002",
    "evaluations": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440004",
        "name": "Test Evaluation",
        "status": "COMPLETED",
        "total_requests": 100,
        "successful_requests": 95,
        "failed_requests": 5,
        "started_at": "2024-01-01T00:00:00Z",
        "completed_at": "2024-01-01T01:00:00Z"
      }
    ],
    "total_evaluations": 1
  }
}
```

---

### Common Response Format

All API responses follow this standard format:

**Success Response**:
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data here
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "message": "Error description",
  "data": null
}
```

**HTTP Status Codes**:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `404`: Not Found
- `500`: Internal Server Error

### 🚧 Planned Features (From PRD)

#### Evaluation Suite Management
- Visual workflow builder with drag-and-drop interface
- API endpoint testing with configurable metrics
- Custom Python scripting for advanced evaluations
- Real-time progress monitoring and result dashboards

#### AI Workflow Assistant
- Conversational interface for workflow creation
- Natural language to YAML configuration generation
- Intelligent optimization suggestions
- Template library for common evaluation patterns

#### Advanced Analytics
- Historical trend analysis and comparison views
- Performance bottleneck identification
- Cost tracking and optimization recommendations
- Integration with external monitoring tools

## 🚀 Getting Started

### Prerequisites
- Docker and Docker Compose
- Python 3.11+ (for local development)

### Quick Start
1. Clone the repository
2. Copy `.env.example` to `.env` and configure environment variables
3. Start the services:
   ```bash
   docker-compose up -d
   ```
4. Access the API documentation at `http://localhost:8000/api/docs`
5. (Optional) Run the API test suite to verify everything is working:
   ```bash
   python test_api.py
   ```

## 🧪 API Testing

The project includes a comprehensive API testing suite that validates all endpoints across the platform. The test suite ensures API reliability and provides documentation through actual response examples.

### Test Coverage
- **Authentication**: Sign-in endpoint validation
- **Dataset Management**: CRUD operations, file uploads, search functionality
- **Evaluation Suites**: Suite creation, configuration management, status tracking
- **Evaluation Management**: Evaluation lifecycle, statistics, and analytics

### Running Tests
Execute the complete test suite:
```bash
python test_api.py
```

The test script will:
- Validate all API endpoints
- Generate detailed test results in `api_test_results.json`
- Provide comprehensive pass/fail statistics
- Test authentication flows and data validation

### Test Results
Recent test run: **8/8 tests passed (100% success rate)**
- AUTH: 1/1 ✅
- DATASETS: 3/3 ✅  
- SUITES: 2/2 ✅
- EVALS: 2/2 ✅

### Test Configuration
The test suite automatically:
- Authenticates with the API using configured credentials
- Tests GET endpoints for data retrieval
- Validates request/response schemas
- Excludes POST endpoints to maintain database cleanliness
- Provides detailed error reporting for debugging



## 📈 Roadmap

### Phase 1: Core Platform (Current)
- ✅ Dataset management system
- ✅ File upload and processing
- ✅ Basic API infrastructure
- ✅ Frontend development (React + TypeScript)

### Phase 2: Evaluation Engine
- ✅ Evaluation suite creation and management
- ✅ API endpoint testing framework
- 🔄 Built-in metrics library
- 🔄 Custom scripting support

### Phase 3: AI Assistant
- 🔄 Conversational workflow creation
- 🔄 YAML configuration generation
- 🔄 Intelligent optimization suggestions
- 🔄 Template library

### Phase 4: Enterprise Features
- 🔄 Advanced analytics and reporting
- 🔄 Multi-tenant support
- 🔄 CI/CD integration
- 🔄 Enterprise security features



## 📞 Contacts
- **Email**: alvin.wenjianhong@gmail.com
- **LinkedIn**: https://www.linkedin.com/in/alvin-wen/

