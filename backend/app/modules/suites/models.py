from sqlalchemy import Column, String, Text, DateTime, JSON, Boolean, Integer, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.modules.postgredb.main import Base
import uuid
import enum


class SuiteStatus(enum.Enum):
    READY = "ready"
    RUNNING = "running"
    FAILED = "failed"


class SuitesModel(Base):
    __tablename__ = "evaluation_suites"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    dataset_id = Column(UUID(as_uuid=True), nullable=True)  # Reference to dataset
    total_evals = Column(Integer, default=0)  # Total number of evaluations in the suite
    status = Column(
        Enum(SuiteStatus), default=SuiteStatus.READY, nullable=False
    )  # Suite status
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    suite_metadata = Column(JSON, default=dict)
    is_deleted = Column(Boolean, default=False, nullable=False)
    current_config_version = Column(Integer, default=0, nullable=False)
    latest_config_version = Column(Integer, default=0, nullable=False)

    def __repr__(self):
        return f"<SuitesModel(id={self.id}, name='{self.name}', dataset_id={self.dataset_id})>"

    def to_dict(self):
        """Convert model instance to dictionary"""
        return {
            "id": str(self.id),
            "name": self.name,
            "description": self.description,
            "dataset_id": str(self.dataset_id) if self.dataset_id else None,
            "total_evals": self.total_evals,
            "status": self.status.value if self.status else "ready",
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "suite_metadata": self.suite_metadata or {},
            "is_deleted": self.is_deleted,
            "current_config_version": self.current_config_version,
            "latest_config_version": self.latest_config_version,
        }
