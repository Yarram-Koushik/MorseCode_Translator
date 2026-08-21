from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

class RawSignalEventIn(BaseModel):
    event_type: str
    duration_ms: float
    timestamp_ms: float
    confidence: float = 1.0
    raw_reading: Optional[float] = None

class MessageCreate(BaseModel):
    room_id: Optional[str] = None
    sender_name: Optional[str] = "Operator"
    text: str
    morse_code: str
    input_mode: str = "tap"
    confidence: float = 1.0
    signal_quality: float = 1.0
    timing_telemetry: Optional[List[Dict[str, Any]]] = None

class RawSignalEventOut(BaseModel):
    id: str
    event_type: str
    duration_ms: float
    timestamp_ms: float
    confidence: float
    raw_reading: Optional[float] = None
    model_config = ConfigDict(from_attributes=True)

class MessageOut(BaseModel):
    id: str
    room_id: Optional[str] = None
    sender_id: Optional[str] = None
    sender_name: str
    text: str
    morse_code: str
    input_mode: str
    confidence: float
    signal_quality: float
    timing_telemetry: Optional[List[Dict[str, Any]]] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
