from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from api.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    display_name = Column(String, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Monetization
    free_credits = Column(Integer, default=10)
    purchased_credits = Column(Integer, default=0)
    last_free_credit_grant = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    is_unlimited = Column(Boolean, default=False)

    jobs = relationship("Job", back_populates="owner")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    task_type = Column(String, nullable=False)
    start_date = Column(String, nullable=False)
    end_date = Column(String, nullable=False)
    aoi_geojson = Column(JSON, nullable=False)
    results = Column(JSON, nullable=False)   # The full scored_images array
    result_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="jobs")
