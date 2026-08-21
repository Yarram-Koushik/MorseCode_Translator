import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class Message(Base):
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    room_id = Column(String(36), ForeignKey("rooms.id"), nullable=True, index=True)
    sender_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    sender_name = Column(String(50), nullable=False, default="Anonymous")
    
    text = Column(String(2000), nullable=False)
    morse_code = Column(String(4000), nullable=False)
    input_mode = Column(String(20), nullable=False, default="keyboard") # eye, audio, light, tap, keyboard, file
    
    confidence = Column(Float, default=1.0)
    signal_quality = Column(Float, default=1.0)
    timing_telemetry = Column(JSON, nullable=True) # Array of raw signal duration events
    
    created_at = Column(DateTime, default=datetime.utcnow)

    room = relationship("Room", back_populates="messages")
    sender = relationship("User", back_populates="messages")
    signal_events = relationship("RawSignalEvent", back_populates="message", cascade="all, delete-orphan")

class RawSignalEvent(Base):
    __tablename__ = "raw_signal_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    message_id = Column(String(36), ForeignKey("messages.id"), nullable=False, index=True)
    event_type = Column(String(20), nullable=False) # 'dot', 'dash', 'element_gap', 'char_gap', 'word_gap'
    duration_ms = Column(Float, nullable=False)
    timestamp_ms = Column(Float, nullable=False)
    confidence = Column(Float, default=1.0)
    raw_reading = Column(Float, nullable=True) # EAR or Audio RMS or Brightness
    
    message = relationship("Message", back_populates="signal_events")
