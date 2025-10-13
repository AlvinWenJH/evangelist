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
│   │   │       └── suites.py  # Evaluation suite endpoints
│   │   └── modules/           # Business logic modules
│   │       ├── datasets/      # Dataset management
│   │       │   ├── main.py    # Core dataset operations
│   │       │   ├── models.py  # SQLAlchemy models
│   │       │   └── repo.py    # Data access layer
│   │       ├── suites/        # Evaluation suite management
│   │       │   ├── main.py    # Core suite operations
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
POST   /v1/datasets                    # Create new dataset
GET    /v1/datasets                    # List all datasets (with pagination)
GET    /v1/datasets/{id}               # Get dataset details
PUT    /v1/datasets/{id}               # Update dataset metadata
DELETE /v1/datasets/{id}               # Soft delete dataset

POST   /v1/datasets/{id}/upload-csv        # Upload CSV file to dataset
GET    /v1/datasets/{id}/schema        # Get dataset schema with total_rows
GET    /v1/datasets/{id}/preview       # Preview dataset (optimized with DuckDB)
GET    /v1/datasets/{id}/history       # Get dataset history timeline with row counts
GET    /v1/datasets/stats              # Get platform statistics
```

#### Evaluation Suite Management
```
GET    /v1/suites                      # List all suites (with pagination, keyword search, status filter)
POST   /v1/suites                      # Create new evaluation suite
GET    /v1/suites/{id}                 # Get suite details by ID
PUT    /v1/suites/{id}                 # Update suite by ID
DELETE /v1/suites/{id}                 # Delete suite by ID

GET    /v1/suites/search/advanced      # Advanced search with multiple filters
GET    /v1/suites/stats/overview       # Get suite statistics (including status counts)
GET    /v1/suites/name/{name}          # Get suite by name
GET    /v1/suites/{id}/exists          # Check if suite exists by ID
GET    /v1/suites/name/{name}/exists   # Check if suite exists by name
GET    /v1/suites/dataset/{dataset_id} # Get all suites for a specific dataset
```

#### Authentication
```
POST   /v1/auth/login                  # User authentication
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



## 📈 Roadmap

### Phase 1: Core Platform (Current)
- ✅ Dataset management system
- ✅ File upload and processing
- ✅ Basic API infrastructure
- ✅ Frontend development (React + TypeScript)

### Phase 2: Evaluation Engine
- 🔄 Evaluation suite creation and management
- 🔄 API endpoint testing framework
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

