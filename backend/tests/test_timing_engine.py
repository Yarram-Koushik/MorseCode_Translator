import pytest
from app.core.timing_engine import TimingEngine

def test_timing_pulse_classification():
    engine = TimingEngine(dot_duration_ms=100.0, dash_duration_ms=300.0)
    
    # 95ms is clearly a dot
    sym, conf = engine.classify_pulse(95.0)
    assert sym == "."
    assert conf > 0.85

    # 290ms is clearly a dash
    sym, conf = engine.classify_pulse(290.0)
    assert sym == "-"
    assert conf > 0.85

    # Boundary cases near 200ms
    sym_low, conf_low = engine.classify_pulse(190.0)
    assert sym_low == "."
    
    sym_high, conf_high = engine.classify_pulse(210.0)
    assert sym_high == "-"

def test_timing_gap_classification():
    engine = TimingEngine(
        dot_duration_ms=100.0,
        char_gap_ms=300.0,
        word_gap_ms=700.0
    )
    
    # 80ms is intra-element gap
    gap_type, _ = engine.classify_gap(80.0)
    assert gap_type == "intra"

    # 320ms is character gap
    gap_type, _ = engine.classify_gap(320.0)
    assert gap_type == "char"

    # 750ms is word gap
    gap_type, _ = engine.classify_gap(750.0)
    assert gap_type == "word"

def test_timing_reconstruct_hello_sequence():
    # Construct pulse/gap intervals for 'HI' ('....' space '..')
    intervals = [
        # H: . . . .
        {"type": "pulse", "duration_ms": 100, "timestamp_ms": 0},
        {"type": "gap",   "duration_ms": 90,  "timestamp_ms": 100},
        {"type": "pulse", "duration_ms": 110, "timestamp_ms": 190},
        {"type": "gap",   "duration_ms": 95,  "timestamp_ms": 300},
        {"type": "pulse", "duration_ms": 105, "timestamp_ms": 395},
        {"type": "gap",   "duration_ms": 85,  "timestamp_ms": 500},
        {"type": "pulse", "duration_ms": 95,  "timestamp_ms": 585},
        
        # Char gap between H and I
        {"type": "gap",   "duration_ms": 320, "timestamp_ms": 680},
        
        # I: . .
        {"type": "pulse", "duration_ms": 100, "timestamp_ms": 1000},
        {"type": "gap",   "duration_ms": 90,  "timestamp_ms": 1100},
        {"type": "pulse", "duration_ms": 105, "timestamp_ms": 1190},
    ]

    engine = TimingEngine(dot_duration_ms=100.0, dash_duration_ms=300.0, char_gap_ms=300.0)
    result = engine.process_signal_intervals(intervals)

    assert result["morse_sequence"] == ".... .."
    assert result["decoded_text"] == "HI"
    assert result["overall_confidence"] > 0.85
    assert result["signal_quality"] > 0.80
