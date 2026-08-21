import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class TrainingSession(Base):
    __tablename__ = "training_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    level = Column(String(20), nullable=False) # 'beginner', 'intermediate', 'advanced'
    target_type = Column(String(20), default="letters") # 'letters', 'words', 'sentences'
    
    total_prompts = Column(Integer, default=0)
    correct_count = Column(Integer, default=0)
    accuracy_percentage = Column(Float, default=0.0)
    wpm = Column(Float, default=0.0)
    average_response_time_ms = Column(Float, default=0.0)
    streak = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="training_sessions")

class ChallengeResult(Base):
    __tablename__ = "challenge_results"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    challenge_id = Column(String(50), nullable=False)
    challenge_title = Column(String(100), nullable=False)
    challenge_mode = Column(String(20), nullable=False) # 'decode', 'transmit'
    
    score = Column(Integer, default=0)
    time_taken_ms = Column(Integer, default=0)
    accuracy_percentage = Column(Float, default=0.0)
    wpm = Column(Float, default=0.0)
    signal_quality = Column(Float, default=1.0)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="challenge_results")
