from fastapi import APIRouter, HTTPException, status
from app.schemas.morse import (
    TextEncodeRequest, TextEncodeResponse,
    MorseDecodeRequest, MorseDecodeResponse,
    TimingReconstructRequest, TimingReconstructResponse,
    AmbiguityAnalyzeRequest, AmbiguityAnalyzeResponse
)
from app.core.morse_engine import MorseEngine
from app.core.timing_engine import TimingEngine
from app.core.ambiguity_ranker import AmbiguityRanker

router = APIRouter(prefix="/morse", tags=["Morse Engine"])

@router.post("/encode", response_model=TextEncodeResponse)
def encode_text_to_morse(req: TextEncodeRequest):
    morse_str, confidence, tokens = MorseEngine.encode_text(
        text=req.text,
        char_delimiter=req.char_delimiter or " ",
        word_delimiter=req.word_delimiter or " / "
    )
    timing = MorseEngine.calculate_wpm_timing(wpm=req.wpm or 15.0)
    return TextEncodeResponse(
        text=req.text,
        morse_code=morse_str,
        confidence=confidence,
        token_breakdown=tokens,
        timing=timing
    )

@router.post("/decode", response_model=MorseDecodeResponse)
def decode_morse_to_text(req: MorseDecodeRequest):
    decoded_text, confidence, tokens = MorseEngine.decode_morse(req.morse_code)
    
    # If confidence is lower or unknown symbols exist, generate ambiguity hints
    ambiguities = []
    for tok in tokens:
        if not tok.get("valid", True) or confidence < 0.8:
            sym = tok.get("morse", "")
            if sym:
                candidates = AmbiguityRanker.rank_character_ambiguities(sym)
                if candidates:
                    ambiguities.extend(candidates)

    return MorseDecodeResponse(
        morse_code=req.morse_code,
        decoded_text=decoded_text,
        confidence=confidence,
        token_breakdown=tokens,
        ambiguities=ambiguities if ambiguities else None
    )

@router.post("/reconstruct-timing", response_model=TimingReconstructResponse)
def reconstruct_from_signal_timing(req: TimingReconstructRequest):
    intervals_raw = [item.model_dump() for item in req.intervals]
    engine = TimingEngine(
        mode=req.mode or "calibrated",
        dot_duration_ms=req.dot_duration_ms or 100.0,
        dash_duration_ms=req.dash_duration_ms or 300.0,
        char_gap_ms=req.char_gap_ms or 300.0,
        word_gap_ms=req.word_gap_ms or 700.0,
        tolerance_ratio=req.tolerance_ratio or 0.35
    )
    result = engine.process_signal_intervals(intervals_raw)
    return TimingReconstructResponse(**result)

@router.post("/analyze-ambiguity", response_model=AmbiguityAnalyzeResponse)
def analyze_ambiguity(req: AmbiguityAnalyzeRequest):
    candidates = AmbiguityRanker.rank_character_ambiguities(
        morse_sym=req.morse_symbol,
        pulse_confidences=req.pulse_confidences
    )
    return AmbiguityAnalyzeResponse(
        symbol=req.morse_symbol,
        candidates=candidates
    )
