from sqlalchemy import Column, String, Text, BigInteger, DateTime, JSON, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.modules.postgredb.main import Base
import uuid


class DatasetsModel(Base):
    __tablename__ = "datasets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    total_rows = Column(BigInteger, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    dataset_metadata = Column(JSON, default=dict)
    is_deleted = Column(Boolean, default=False, nullable=False)

    def __repr__(self):
        return f"<DatasetsModel(id={self.id}, name='{self.name}', total_rows={self.total_rows})>"

    def to_dict(self):
        """Convert model instance to dictionary"""
        return {
            "id": str(self.id),
            "name": self.name,
            "description": self.description,
            "total_rows": self.total_rows,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "dataset_metadata": self.dataset_metadata or {},
            "is_deleted": self.is_deleted,
        }
