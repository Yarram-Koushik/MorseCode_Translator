from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime

class CalibrationBase(BaseModel):
    mode: str
    dot_duration_ms: float = 100.0
    dash_duration_ms: float = 300.0
    char_gap_ms: float = 300.0
    word_gap_ms: float = 700.0
    tolerance_ratio: float = 0.35
    threshold_value: Optional[float] = None
    baseline_value: Optional[float] = None
    extra_metadata: Optional[Dict[str, Any]] = None

class CalibrationCreate(CalibrationBase):
    pass

class CalibrationOut(CalibrationBase):
    id: str
    user_id: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
