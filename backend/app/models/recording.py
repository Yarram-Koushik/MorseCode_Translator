import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, JSON
from app.database import Base

class RecordingAnalysis(Base):
    __tablename__ = "recordings_analysis"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    media_type = Column(String(20), nullable=False) # 'audio', 'video'
    file_name = Column(String(255), nullable=False)
    file_size_bytes = Column(Integer, nullable=True)
    duration_seconds = Column(Float, nullable=True)
    
    detected_mode = Column(String(20), nullable=False) # 'audio_tone', 'audio_tap', 'eye_blink', 'light_flash'
    detected_morse = Column(String(4000), nullable=False)
    decoded_text = Column(String(2000), nullable=False)
    
    confidence = Column(Float, default=0.0)
    signal_quality = Column(Float, default=0.0)
    timeline_json = Column(JSON, nullable=True) # Full list of timestamped marks/gaps
    spectrogram_or_waveform_summary = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
