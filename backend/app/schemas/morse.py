from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class TextEncodeRequest(BaseModel):
    text: str
    char_delimiter: Optional[str] = " "
    word_delimiter: Optional[str] = " / "
    wpm: Optional[float] = 15.0

class TextEncodeResponse(BaseModel):
    text: str
    morse_code: str
    confidence: float
    token_breakdown: List[Dict[str, Any]]
    timing: Dict[str, float]

class MorseDecodeRequest(BaseModel):
    morse_code: str

class MorseDecodeResponse(BaseModel):
    morse_code: str
    decoded_text: str
    confidence: float
    token_breakdown: List[Dict[str, Any]]
    ambiguities: Optional[List[Dict[str, Any]]] = None

class SignalIntervalItem(BaseModel):
    type: str # 'pulse' or 'gap'
    duration_ms: float
    timestamp_ms: Optional[float] = 0.0
    raw_reading: Optional[float] = None

class TimingReconstructRequest(BaseModel):
    intervals: List[SignalIntervalItem]
    mode: Optional[str] = "calibrated" # 'calibrated', 'fixed', 'adaptive'
    dot_duration_ms: Optional[float] = 100.0
    dash_duration_ms: Optional[float] = 300.0
    char_gap_ms: Optional[float] = 300.0
    word_gap_ms: Optional[float] = 700.0
    tolerance_ratio: Optional[float] = 0.35

class TimingReconstructResponse(BaseModel):
    morse_sequence: str
    decoded_text: str
    overall_confidence: float
    signal_quality: float
    estimated_wpm: float
    reconstructed_events: List[Dict[str, Any]]
    token_breakdown: List[Dict[str, Any]]

class AmbiguityAnalyzeRequest(BaseModel):
    morse_symbol: str
    pulse_confidences: Optional[List[float]] = None

class AmbiguityAnalyzeResponse(BaseModel):
    symbol: str
    candidates: List[Dict[str, Any]]
