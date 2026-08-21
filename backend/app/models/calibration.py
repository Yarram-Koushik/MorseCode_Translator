import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class Calibration(Base):
    __tablename__ = "calibrations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    mode = Column(String(20), nullable=False) # 'eye', 'audio', 'light', 'tap'
    
    # Timing parameters in milliseconds
    dot_duration_ms = Column(Float, nullable=False, default=100.0)
    dash_duration_ms = Column(Float, nullable=False, default=300.0)
    char_gap_ms = Column(Float, nullable=False, default=300.0)
    word_gap_ms = Column(Float, nullable=False, default=700.0)
    tolerance_ratio = Column(Float, nullable=False, default=0.35)
    
    # Mode-specific detection thresholds
    threshold_value = Column(Float, nullable=True) # EAR threshold for eye, RMS for audio, etc.
    baseline_value = Column(Float, nullable=True)  # Resting open-eye EAR / ambient noise floor
    extra_metadata = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="calibrations")
