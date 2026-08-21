from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

class TimelineEvent(BaseModel):
    time_offset_s: float
    time_formatted: str
    event_type: str
    duration_ms: float
    confidence: float
    symbol: Optional[str] = None
    raw_intensity: Optional[float] = None

class RecordingAnalysisOut(BaseModel):
    id: str
    user_id: Optional[str] = None
    media_type: str
    file_name: str
    file_size_bytes: Optional[int] = None
    duration_seconds: Optional[float] = None
    detected_mode: str
    detected_morse: str
    decoded_text: str
    confidence: float
    signal_quality: float
    timeline_json: Optional[List[Dict[str, Any]]] = None
    spectrogram_or_waveform_summary: Optional[Dict[str, Any]] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
