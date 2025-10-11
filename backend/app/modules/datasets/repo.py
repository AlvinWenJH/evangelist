from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, text
from typing import List, Optional, Dict, Any
from uuid import UUID
import uuid

from app.modules.datasets.models import DatasetsModel


class DatasetsRepo:
    def __init__(self, session: Session):
        self.session = session

    def create(
        self,
        name: str,
        description: str = None,
        dataset_metadata: Dict[str, Any] = None,
    ) -> DatasetsModel:
        """Create a new dataset"""
        dataset = DatasetsModel(
            name=name,
            description=description,
            dataset_metadata=dataset_metadata or {},
        )
        self.session.add(dataset)
        self.session.commit()
        self.session.refresh(dataset)
        return dataset

    def get_by_id(self, dataset_id: UUID) -> Optional[DatasetsModel]:
        """Get dataset by ID (excluding deleted datasets)"""
        return (
            self.session.query(DatasetsModel)
            .filter(DatasetsModel.id == dataset_id)
            .filter(DatasetsModel.is_deleted == False)
            .first()
        )

    def get_by_name(self, name: str) -> Optional[DatasetsModel]:
        """Get dataset by name (excluding deleted datasets)"""
        return (
            self.session.query(DatasetsModel)
            .filter(DatasetsModel.name == name)
            .filter(DatasetsModel.is_deleted == False)
            .first()
        )

    def get_all(
        self, page: int = 1, page_size: int = 10, keyword: str = None
    ) -> Dict[str, Any]:
        """Get all datasets with pagination and optional keyword search (excluding deleted datasets)"""
        query = self.session.query(DatasetsModel)
        
        # Filter out deleted datasets
        query = query.filter(DatasetsModel.is_deleted == False)

        # Apply keyword search if provided
        if keyword:
            search_filter = or_(
                DatasetsModel.name.ilike(f"%{keyword}%"),
                DatasetsModel.description.ilike(f"%{keyword}%"),
            )
            query = query.filter(search_filter)

        # Get total count for pagination
        total_count = query.count()

        # Apply pagination
        offset = (page - 1) * page_size
        datasets = (
            query.order_by(DatasetsModel.created_at.desc())
            .offset(offset)
            .limit(page_size)
            .all()
        )

        # Calculate pagination info
        total_pages = (total_count + page_size - 1) // page_size

        return {
            "datasets": datasets,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_count": total_count,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1,
            },
        }

    def update(self, dataset_id: UUID, **kwargs) -> Optional[DatasetsModel]:
        """Update dataset by ID"""
        dataset = self.get_by_id(dataset_id)
        if not dataset:
            return None

        # Update allowed fields
        allowed_fields = ["name", "description", "total_rows", "dataset_metadata", "is_deleted"]
        for field, value in kwargs.items():
            if field in allowed_fields and hasattr(dataset, field):
                setattr(dataset, field, value)

        self.session.commit()
        self.session.refresh(dataset)
        return dataset

    def delete(self, dataset_id: UUID) -> bool:
        """Soft delete dataset by ID (sets is_deleted to True)"""
        dataset = self.get_by_id(dataset_id)
        if not dataset:
            return False

        dataset.is_deleted = True
        self.session.commit()
        return True

    def exists(self, dataset_id: UUID) -> bool:
        """Check if dataset exists (excluding deleted datasets)"""
        return (
            self.session.query(DatasetsModel.id)
            .filter(DatasetsModel.id == dataset_id)
            .filter(DatasetsModel.is_deleted == False)
            .first()
            is not None
        )

    def exists_by_name(self, name: str) -> bool:
        """Check if dataset with name exists (excluding deleted datasets)"""
        return (
            self.session.query(DatasetsModel.id)
            .filter(DatasetsModel.name == name)
            .filter(DatasetsModel.is_deleted == False)
            .first()
            is not None
        )

    def get_stats(self) -> Dict[str, Any]:
        """Get dataset statistics (excluding deleted datasets)"""
        total_datasets = (
            self.session.query(func.count(DatasetsModel.id))
            .filter(DatasetsModel.is_deleted == False)
            .scalar()
        )
        total_rows = (
            self.session.query(func.sum(DatasetsModel.total_rows))
            .filter(DatasetsModel.is_deleted == False)
            .scalar() or 0
        )

        return {
            "total_datasets": total_datasets,
            "total_rows": total_rows,
            "average_rows_per_dataset": total_rows / total_datasets
            if total_datasets > 0
            else 0,
        }

    def search(
        self,
        name: str = None,
        description: str = None,
        metadata_key: str = None,
        metadata_value: str = None,
        page: int = 1,
        page_size: int = 10,
    ) -> Dict[str, Any]:
        """Advanced search with multiple filters (excluding deleted datasets)"""
        query = self.session.query(DatasetsModel)
        
        # Filter out deleted datasets
        query = query.filter(DatasetsModel.is_deleted == False)

        if name:
            query = query.filter(DatasetsModel.name.ilike(f"%{name}%"))

        if description:
            query = query.filter(DatasetsModel.description.ilike(f"%{description}%"))

        if metadata_key and metadata_value:
            # Search for specific key-value pair in JSON metadata using PostgreSQL JSON operators
            query = query.filter(
                text(f"dataset_metadata->>'{metadata_key}' = :metadata_value")
            ).params(metadata_value=metadata_value)
        elif metadata_key:
            # Search for existence of key in JSON metadata
            query = query.filter(text(f"dataset_metadata ? '{metadata_key}'"))

        # Get total count before pagination
        total_count = query.count()

        # Apply pagination
        offset = (page - 1) * page_size
        datasets = (
            query.order_by(DatasetsModel.created_at.desc())
            .offset(offset)
            .limit(page_size)
            .all()
        )

        total_pages = (total_count + page_size - 1) // page_size

        return {
            "datasets": datasets,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_count": total_count,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1,
            },
        }
