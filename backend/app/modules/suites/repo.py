from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, text
from typing import List, Optional, Dict, Any
from uuid import UUID
import uuid

from app.modules.suites.models import SuitesModel, SuiteStatus


class SuitesRepo:
    def __init__(self, session: Session):
        self.session = session

    def create(
        self,
        name: str,
        description: str = None,
        dataset_id: UUID = None,
        suite_metadata: Dict[str, Any] = None,
        status: SuiteStatus = SuiteStatus.READY,
    ) -> SuitesModel:
        """Create a new evaluation suite"""
        suite = SuitesModel(
            name=name,
            description=description,
            dataset_id=dataset_id,
            suite_metadata=suite_metadata or {},
            status=status,
        )
        self.session.add(suite)
        self.session.commit()
        self.session.refresh(suite)
        return suite

    def get_by_id(self, suite_id: UUID) -> Optional[SuitesModel]:
        """Get suite by ID (excluding deleted suites)"""
        return (
            self.session.query(SuitesModel)
            .filter(SuitesModel.id == suite_id)
            .filter(SuitesModel.is_deleted == False)
            .first()
        )

    def get_by_name(self, name: str) -> Optional[SuitesModel]:
        """Get suite by name (excluding deleted suites)"""
        return (
            self.session.query(SuitesModel)
            .filter(SuitesModel.name == name)
            .filter(SuitesModel.is_deleted == False)
            .first()
        )

    def get_all(
        self,
        page: int = 1,
        page_size: int = 10,
        keyword: str = None,
        status: SuiteStatus = None,
    ) -> Dict[str, Any]:
        """Get all suites with pagination and optional keyword search and status filter (excluding deleted suites)"""
        query = self.session.query(SuitesModel)

        # Filter out deleted suites
        query = query.filter(SuitesModel.is_deleted == False)

        # Apply keyword search if provided
        if keyword:
            search_filter = or_(
                SuitesModel.name.ilike(f"%{keyword}%"),
                SuitesModel.description.ilike(f"%{keyword}%"),
            )
            query = query.filter(search_filter)

        # Apply status filter if provided
        if status:
            query = query.filter(SuitesModel.status == status)

        # Get total count for pagination
        total_count = query.count()

        # Apply pagination
        offset = (page - 1) * page_size
        suites = (
            query.order_by(SuitesModel.created_at.desc())
            .offset(offset)
            .limit(page_size)
            .all()
        )

        # Calculate pagination info
        total_pages = (total_count + page_size - 1) // page_size

        return {
            "suites": suites,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_count": total_count,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1,
            },
        }

    def update(self, suite_id: UUID, **kwargs) -> Optional[SuitesModel]:
        """Update suite by ID"""
        suite = self.get_by_id(suite_id)
        if not suite:
            return None

        # Update allowed fields
        allowed_fields = [
            "name",
            "description",
            "dataset_id",
            "total_evals",
            "suite_metadata",
            "status",
            "is_deleted",
        ]
        for field, value in kwargs.items():
            if field in allowed_fields and hasattr(suite, field):
                setattr(suite, field, value)

        self.session.commit()
        self.session.refresh(suite)
        return suite

    def delete(self, suite_id: UUID) -> bool:
        """Soft delete suite by ID (sets is_deleted to True)"""
        suite = self.get_by_id(suite_id)
        if not suite:
            return False

        suite.is_deleted = True
        self.session.commit()
        return True

    def exists(self, suite_id: UUID) -> bool:
        """Check if suite exists (excluding deleted suites)"""
        return (
            self.session.query(SuitesModel.id)
            .filter(SuitesModel.id == suite_id)
            .filter(SuitesModel.is_deleted == False)
            .first()
            is not None
        )

    def exists_by_name(self, name: str) -> bool:
        """Check if suite with name exists (excluding deleted suites)"""
        return (
            self.session.query(SuitesModel.id)
            .filter(SuitesModel.name == name)
            .filter(SuitesModel.is_deleted == False)
            .first()
            is not None
        )

    def get_stats(self) -> Dict[str, Any]:
        """Get suite statistics (excluding deleted suites)"""
        total_suites = (
            self.session.query(func.count(SuitesModel.id))
            .filter(SuitesModel.is_deleted == False)
            .scalar()
        )

        # Count suites by dataset
        suites_with_dataset = (
            self.session.query(func.count(SuitesModel.id))
            .filter(SuitesModel.is_deleted == False)
            .filter(SuitesModel.dataset_id.isnot(None))
            .scalar()
        )

        # Count suites by status
        total_ready = (
            self.session.query(func.count(SuitesModel.id))
            .filter(SuitesModel.is_deleted == False)
            .filter(SuitesModel.status == SuiteStatus.READY)
            .scalar()
        )

        total_running = (
            self.session.query(func.count(SuitesModel.id))
            .filter(SuitesModel.is_deleted == False)
            .filter(SuitesModel.status == SuiteStatus.RUNNING)
            .scalar()
        )

        total_failed = (
            self.session.query(func.count(SuitesModel.id))
            .filter(SuitesModel.is_deleted == False)
            .filter(SuitesModel.status == SuiteStatus.FAILED)
            .scalar()
        )

        # Calculate total evaluations across all suites
        total_evals = (
            self.session.query(func.sum(SuitesModel.total_evals))
            .filter(SuitesModel.is_deleted == False)
            .scalar()
        ) or 0

        # Calculate average evaluations per suite
        average_evals_per_suite = 0
        if total_suites > 0:
            average_evals_per_suite = round(total_evals / total_suites, 2)

        return {
            "total_suites": total_suites,
            "suites_with_dataset": suites_with_dataset,
            "suites_without_dataset": total_suites - suites_with_dataset,
            "total_ready": total_ready,
            "total_running": total_running,
            "total_failed": total_failed,
            "total_evals": total_evals,
            "average_evals_per_suite": average_evals_per_suite,
        }

    def search(
        self,
        name: str = None,
        description: str = None,
        dataset_id: UUID = None,
        metadata_key: str = None,
        metadata_value: str = None,
        page: int = 1,
        page_size: int = 10,
    ) -> Dict[str, Any]:
        """Search suites with multiple filters (excluding deleted suites)"""
        query = self.session.query(SuitesModel)

        # Filter out deleted suites
        query = query.filter(SuitesModel.is_deleted == False)

        # Apply filters
        if name:
            query = query.filter(SuitesModel.name.ilike(f"%{name}%"))

        if description:
            query = query.filter(SuitesModel.description.ilike(f"%{description}%"))

        if dataset_id:
            query = query.filter(SuitesModel.dataset_id == dataset_id)

        if metadata_key and metadata_value:
            # Search in JSON metadata
            query = query.filter(
                SuitesModel.suite_metadata[metadata_key].astext.ilike(
                    f"%{metadata_value}%"
                )
            )
        elif metadata_key:
            # Check if metadata key exists
            query = query.filter(SuitesModel.suite_metadata.has_key(metadata_key))

        # Get total count for pagination
        total_count = query.count()

        # Apply pagination
        offset = (page - 1) * page_size
        suites = (
            query.order_by(SuitesModel.created_at.desc())
            .offset(offset)
            .limit(page_size)
            .all()
        )

        # Calculate pagination info
        total_pages = (total_count + page_size - 1) // page_size

        return {
            "suites": suites,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_count": total_count,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1,
            },
        }

    def get_by_dataset_id(self, dataset_id: UUID) -> List[SuitesModel]:
        """Get all suites associated with a specific dataset (excluding deleted suites)"""
        return (
            self.session.query(SuitesModel)
            .filter(SuitesModel.dataset_id == dataset_id)
            .filter(SuitesModel.is_deleted == False)
            .order_by(SuitesModel.created_at.desc())
            .all()
        )
