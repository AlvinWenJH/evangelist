from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, text
from typing import List, Optional, Dict, Any
from uuid import UUID
import uuid

from app.modules.evals.models import EvalsModel, EvalStatus


class EvalsRepo:
    def __init__(self, session: Session):
        self.session = session

    def create(
        self,
        name: str,
        description: str = None,
        suite_id: UUID = None,
        dataset_id: UUID = None,
        eval_metadata: Dict[str, Any] = None,
        status: EvalStatus = EvalStatus.PENDING,
    ) -> EvalsModel:
        """Create a new evaluation"""
        evaluation = EvalsModel(
            name=name,
            description=description,
            suite_id=suite_id,
            dataset_id=dataset_id,
            eval_metadata=eval_metadata or {},
            status=status,
        )
        self.session.add(evaluation)
        self.session.commit()
        self.session.refresh(evaluation)
        return evaluation

    def get_by_id(self, eval_id: UUID) -> Optional[EvalsModel]:
        """Get evaluation by ID (excluding deleted evaluations)"""
        return (
            self.session.query(EvalsModel)
            .filter(EvalsModel.id == eval_id)
            .filter(EvalsModel.is_deleted == False)
            .first()
        )

    def get_by_name(self, name: str) -> Optional[EvalsModel]:
        """Get evaluation by name (excluding deleted evaluations)"""
        return (
            self.session.query(EvalsModel)
            .filter(EvalsModel.name == name)
            .filter(EvalsModel.is_deleted == False)
            .first()
        )

    def get_all(
        self,
        page: int = 1,
        page_size: int = 10,
        keyword: str = None,
        status: EvalStatus = None,
        suite_id: UUID = None,
    ) -> Dict[str, Any]:
        """Get all evaluations with pagination and optional keyword search, status filter, and suite filter (excluding deleted evaluations)"""
        query = self.session.query(EvalsModel)

        # Filter out deleted evaluations
        query = query.filter(EvalsModel.is_deleted == False)

        # Apply keyword search if provided
        if keyword:
            search_filter = or_(
                EvalsModel.name.ilike(f"%{keyword}%"),
                EvalsModel.description.ilike(f"%{keyword}%"),
            )
            query = query.filter(search_filter)

        # Apply status filter if provided
        if status:
            query = query.filter(EvalsModel.status == status)

        # Apply suite filter if provided
        if suite_id:
            query = query.filter(EvalsModel.suite_id == suite_id)

        # Get total count for pagination
        total_count = query.count()

        # Apply pagination
        offset = (page - 1) * page_size
        evaluations = (
            query.order_by(EvalsModel.created_at.desc())
            .offset(offset)
            .limit(page_size)
            .all()
        )

        # Calculate pagination info
        total_pages = (total_count + page_size - 1) // page_size

        return {
            "evaluations": evaluations,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_count": total_count,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1,
            },
        }

    def update(self, eval_id: UUID, **kwargs) -> Optional[EvalsModel]:
        """Update evaluation by ID"""
        evaluation = self.get_by_id(eval_id)
        if not evaluation:
            return None

        # Update only provided fields
        for key, value in kwargs.items():
            if hasattr(evaluation, key) and value is not None:
                setattr(evaluation, key, value)

        self.session.commit()
        self.session.refresh(evaluation)
        return evaluation

    def delete(self, eval_id: UUID) -> bool:
        """Soft delete evaluation by ID"""
        evaluation = self.get_by_id(eval_id)
        if not evaluation:
            return False

        evaluation.is_deleted = True
        self.session.commit()
        return True

    def exists(self, eval_id: UUID) -> bool:
        """Check if evaluation exists by ID (excluding deleted evaluations)"""
        return (
            self.session.query(EvalsModel.id)
            .filter(EvalsModel.id == eval_id)
            .filter(EvalsModel.is_deleted == False)
            .first()
            is not None
        )

    def exists_by_name(self, name: str) -> bool:
        """Check if evaluation exists by name (excluding deleted evaluations)"""
        return (
            self.session.query(EvalsModel.id)
            .filter(EvalsModel.name == name)
            .filter(EvalsModel.is_deleted == False)
            .first()
            is not None
        )

    def get_stats(self, suite_id: UUID = None) -> Dict[str, Any]:
        """Get evaluation statistics"""
        # Base query for non-deleted evaluations
        base_query = self.session.query(EvalsModel).filter(
            EvalsModel.is_deleted == False
        )

        # Apply suite_id filter if provided
        if suite_id is not None:
            base_query = base_query.filter(EvalsModel.suite_id == suite_id)

        # Total evaluations
        total_evals = base_query.count()

        # Status counts
        status_counts = {}
        for status in EvalStatus:
            count = base_query.filter(EvalsModel.status == status).count()
            status_counts[status.value] = count

        # Request statistics
        request_stats = base_query.with_entities(
            func.sum(EvalsModel.total_requests).label("total_requests"),
            func.sum(EvalsModel.successful_requests).label("successful_requests"),
            func.sum(EvalsModel.failed_requests).label("failed_requests"),
            func.avg(EvalsModel.total_requests).label("avg_requests_per_eval"),
        ).first()

        # Success rate calculation
        total_requests = request_stats.total_requests or 0
        successful_requests = request_stats.successful_requests or 0
        success_rate = (
            (successful_requests / total_requests * 100) if total_requests > 0 else 0
        )

        # Average completion time for completed evaluations
        completed_evals = base_query.filter(
            EvalsModel.status == EvalStatus.COMPLETED,
            EvalsModel.started_at.isnot(None),
            EvalsModel.completed_at.isnot(None),
        )

        avg_completion_time = None
        if completed_evals.count() > 0:
            # Calculate average completion time in seconds
            completion_times = completed_evals.with_entities(
                func.extract(
                    "epoch",
                    EvalsModel.completed_at - EvalsModel.started_at,
                ).label("duration")
            ).all()
            if completion_times:
                avg_completion_time = sum(ct.duration for ct in completion_times) / len(
                    completion_times
                )

        return {
            "total_evaluations": total_evals,
            "status_counts": status_counts,
            "total_requests": int(request_stats.total_requests or 0),
            "successful_requests": int(request_stats.successful_requests or 0),
            "failed_requests": int(request_stats.failed_requests or 0),
            "success_rate": round(success_rate, 2),
            "average_requests_per_eval": round(
                float(request_stats.avg_requests_per_eval or 0), 2
            ),
            "average_completion_time_seconds": (
                round(avg_completion_time, 2) if avg_completion_time else None
            ),
        }

    def search(
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
        query = self.session.query(EvalsModel)

        # Filter out deleted evaluations
        query = query.filter(EvalsModel.is_deleted == False)

        # Apply filters
        if name:
            query = query.filter(EvalsModel.name.ilike(f"%{name}%"))

        if description:
            query = query.filter(EvalsModel.description.ilike(f"%{description}%"))

        if suite_id:
            query = query.filter(EvalsModel.suite_id == suite_id)

        if dataset_id:
            query = query.filter(EvalsModel.dataset_id == dataset_id)

        if metadata_key and metadata_value:
            # Search in JSON metadata
            query = query.filter(
                EvalsModel.eval_metadata[metadata_key].astext.ilike(
                    f"%{metadata_value}%"
                )
            )
        elif metadata_key:
            # Check if metadata key exists
            query = query.filter(EvalsModel.eval_metadata.has_key(metadata_key))

        # Get total count for pagination
        total_count = query.count()

        # Apply pagination
        offset = (page - 1) * page_size
        evaluations = (
            query.order_by(EvalsModel.created_at.desc())
            .offset(offset)
            .limit(page_size)
            .all()
        )

        # Calculate pagination info
        total_pages = (total_count + page_size - 1) // page_size

        return {
            "evaluations": evaluations,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_count": total_count,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1,
            },
        }

    def get_by_suite_id(self, suite_id: UUID) -> List[EvalsModel]:
        """Get all evaluations for a specific suite (excluding deleted evaluations)"""
        return (
            self.session.query(EvalsModel)
            .filter(EvalsModel.suite_id == suite_id)
            .filter(EvalsModel.is_deleted == False)
            .order_by(EvalsModel.created_at.desc())
            .all()
        )

    def get_by_dataset_id(self, dataset_id: UUID) -> List[EvalsModel]:
        """Get all evaluations for a specific dataset (excluding deleted evaluations)"""
        return (
            self.session.query(EvalsModel)
            .filter(EvalsModel.dataset_id == dataset_id)
            .filter(EvalsModel.is_deleted == False)
            .order_by(EvalsModel.created_at.desc())
            .all()
        )
