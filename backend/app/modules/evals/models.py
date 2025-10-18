from sqlalchemy import Column, String, Text, DateTime, JSON, Boolean, Integer, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.modules.postgredb.main import Base
import uuid
import enum


class EvalStatus(enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class EvalsModel(Base):
    __tablename__ = "evaluations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    suite_id = Column(UUID(as_uuid=True), nullable=True)  # Reference to evaluation suite
    dataset_id = Column(UUID(as_uuid=True), nullable=True)  # Reference to dataset
    total_requests = Column(Integer, default=0)  # Total number of API requests
    successful_requests = Column(Integer, default=0)  # Number of successful requests
    failed_requests = Column(Integer, default=0)  # Number of failed requests
    status = Column(
        Enum(EvalStatus), default=EvalStatus.PENDING, nullable=False
    )  # Evaluation status
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    started_at = Column(DateTime(timezone=True), nullable=True)  # When evaluation started
    completed_at = Column(DateTime(timezone=True), nullable=True)  # When evaluation completed
    eval_metadata = Column(JSON, default=dict)  # Evaluation configuration and results
    is_deleted = Column(Boolean, default=False, nullable=False)

    def __repr__(self):
        return f"<EvalsModel(id={self.id}, name='{self.name}', suite_id={self.suite_id})>"

    def to_dict(self):
        """Convert model instance to dictionary"""
        return {
            "id": str(self.id),
            "name": self.name,
            "description": self.description,
            "suite_id": str(self.suite_id) if self.suite_id else None,
            "dataset_id": str(self.dataset_id) if self.dataset_id else None,
            "total_requests": self.total_requests,
            "successful_requests": self.successful_requests,
            "failed_requests": self.failed_requests,
            "status": self.status.value if self.status else "pending",
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "eval_metadata": self.eval_metadata or {},
            "is_deleted": self.is_deleted,
        }