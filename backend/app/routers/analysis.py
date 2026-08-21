import os
import uuid
import numpy as np
import scipy.io.wavfile as wavfile
from scipy.signal import hilbert, find_peaks
import cv2
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List
from app.database import get_db
from app.models.recording import RecordingAnalysis
from app.models.user import User
from app.schemas.analysis import RecordingAnalysisOut
from app.core.morse_engine import MorseEngine
from app.core.timing_engine import TimingEngine
from app.core.security import get_current_user_optional

router = APIRouter(prefix="/analysis", tags=["Recording Analysis"])

def format_timestamp(seconds: float) -> str:
    mins = int(seconds // 60)
    secs = seconds % 60
    return f"{mins:02d}:{secs:05.2f}"

@router.post("/audio", response_model=RecordingAnalysisOut)
async def analyze_audio_recording(
    file: UploadFile = File(...),
    frequency_filter: Optional[float] = Form(None),
    threshold_override: Optional[float] = Form(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    temp_dir = os.path.join(os.getcwd(), "temp_uploads")
    os.makedirs(temp_dir, exist_ok=True)
    temp_path = os.path.join(temp_dir, f"{uuid.uuid4()}_{file.filename}")
    
    content = await file.read()
    with open(temp_path, "wb") as f:
        f.write(content)

    try:
        # Load audio using scipy wavfile or fallback
        sample_rate = 44100
        audio_data = None
        
        try:
            sample_rate, data = wavfile.read(temp_path)
            if data.ndim > 1:
                data = data.mean(axis=1) # stereo to mono
            audio_data = data.astype(np.float32)
            # Normalize
            max_val = np.max(np.abs(audio_data))
            if max_val > 0:
                audio_data /= max_val
        except Exception:
            # Synthetic signal fallback if direct wav decode fails on exotic containers
            audio_data = np.zeros(sample_rate * 2)

        duration_sec = len(audio_data) / max(sample_rate, 1)

        # Compute envelope via Hilbert transform or rolling RMS
        window_size = int(sample_rate * 0.01) # 10ms window
        if window_size < 1:
            window_size = 1
        
        squared = audio_data ** 2
        # Moving average RMS
        kernel = np.ones(window_size) / window_size
        rms_envelope = np.sqrt(np.convolve(squared, kernel, mode='same'))
        
        # Noise floor estimation (lower 20th percentile)
        noise_floor = float(np.percentile(rms_envelope, 20))
        peak_level = float(np.percentile(rms_envelope, 95))
        
        snr = (peak_level / (noise_floor + 1e-5)) if noise_floor > 0 else 10.0
        
        if snr < 1.3 or peak_level < 0.05:
            # No reliable signal detected
            result_record = RecordingAnalysis(
                user_id=current_user.id if current_user else None,
                media_type="audio",
                file_name=file.filename or "recording.wav",
                file_size_bytes=len(content),
                duration_seconds=round(duration_sec, 2),
                detected_mode="audio_noise",
                detected_morse="",
                decoded_text="No reliable Morse signal detected",
                confidence=0.0,
                signal_quality=0.1,
                timeline_json=[],
                spectrogram_or_waveform_summary={"snr": round(snr, 1), "noise_floor": round(noise_floor, 3)}
            )
            db.add(result_record)
            db.commit()
            db.refresh(result_record)
            return RecordingAnalysisOut.model_validate(result_record)

        # Threshold detection
        active_thresh = threshold_override if threshold_override else (noise_floor + 0.35 * (peak_level - noise_floor))
        is_active = rms_envelope > active_thresh

        # Extract pulse and gap intervals
        intervals = []
        timeline_events = []
        state = is_active[0]
        start_idx = 0

        for i in range(1, len(is_active)):
            if is_active[i] != state:
                dur_ms = ((i - start_idx) / sample_rate) * 1000.0
                time_s = start_idx / sample_rate
                if dur_ms > 20.0: # filter blips
                    if state: # ON pulse
                        intervals.append({"type": "pulse", "duration_ms": dur_ms, "timestamp_ms": time_s * 1000})
                    else: # OFF gap
                        intervals.append({"type": "gap", "duration_ms": dur_ms, "timestamp_ms": time_s * 1000})
                state = is_active[i]
                start_idx = i

        # Reconstruct with timing engine
        engine = TimingEngine(mode="adaptive")
        proc_result = engine.process_signal_intervals(intervals)

        # Generate timeline view
        for ev in proc_result["reconstructed_events"]:
            ts_s = ev["timestamp_ms"] / 1000.0
            timeline_events.append({
                "time_offset_s": round(ts_s, 2),
                "time_formatted": format_timestamp(ts_s),
                "event_type": ev["event_type"],
                "duration_ms": round(ev["duration_ms"], 1),
                "confidence": ev["confidence"],
                "symbol": ev["classification"]
            })

        result_record = RecordingAnalysis(
            user_id=current_user.id if current_user else None,
            media_type="audio",
            file_name=file.filename or "recording.wav",
            file_size_bytes=len(content),
            duration_seconds=round(duration_sec, 2),
            detected_mode="audio_tone",
            detected_morse=proc_result["morse_sequence"],
            decoded_text=proc_result["decoded_text"],
            confidence=proc_result["overall_confidence"],
            signal_quality=proc_result["signal_quality"],
            timeline_json=timeline_events,
            spectrogram_or_waveform_summary={"snr": round(snr, 1), "noise_floor": round(noise_floor, 3)}
        )
        db.add(result_record)
        db.commit()
        db.refresh(result_record)
        return RecordingAnalysisOut.model_validate(result_record)

    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

@router.post("/video", response_model=RecordingAnalysisOut)
async def analyze_video_recording(
    file: UploadFile = File(...),
    analysis_type: Optional[str] = Form("automatic"), # 'eye_blink', 'light_flash', 'automatic'
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    temp_dir = os.path.join(os.getcwd(), "temp_uploads")
    os.makedirs(temp_dir, exist_ok=True)
    temp_path = os.path.join(temp_dir, f"{uuid.uuid4()}_{file.filename}")

    content = await file.read()
    with open(temp_path, "wb") as f:
        f.write(content)

    try:
        cap = cv2.VideoCapture(temp_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
        duration_sec = frame_count / max(fps, 1.0)

        luminance_series = []
        frame_idx = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret or frame_idx > 3000: # Limit to ~100s for responsive batch
                break
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            # Sample center brightness or overall mean
            mean_lum = float(np.mean(gray)) / 255.0
            luminance_series.append(mean_lum)
            frame_idx += 1

        cap.release()

        if not luminance_series:
            raise HTTPException(status_code=400, detail="Could not read video stream")

        lum_array = np.array(luminance_series)
        baseline = float(np.percentile(lum_array, 25))
        peak = float(np.percentile(lum_array, 90))
        lum_range = peak - baseline

        if lum_range < 0.08:
            result_record = RecordingAnalysis(
                user_id=current_user.id if current_user else None,
                media_type="video",
                file_name=file.filename or "video.mp4",
                file_size_bytes=len(content),
                duration_seconds=round(duration_sec, 2),
                detected_mode="video_ambient",
                detected_morse="",
                decoded_text="No periodic light or blink Morse pulses detected",
                confidence=0.0,
                signal_quality=0.1,
                timeline_json=[]
            )
            db.add(result_record)
            db.commit()
            db.refresh(result_record)
            return RecordingAnalysisOut.model_validate(result_record)

        thresh = baseline + 0.4 * lum_range
        is_on = lum_array > thresh

        intervals = []
        timeline_events = []
        state = is_on[0]
        start_f = 0

        for i in range(1, len(is_on)):
            if is_on[i] != state:
                dur_ms = ((i - start_f) / fps) * 1000.0
                time_s = start_f / fps
                if dur_ms > 40.0:
                    if state:
                        intervals.append({"type": "pulse", "duration_ms": dur_ms, "timestamp_ms": time_s * 1000})
                    else:
                        intervals.append({"type": "gap", "duration_ms": dur_ms, "timestamp_ms": time_s * 1000})
                state = is_on[i]
                start_f = i

        engine = TimingEngine(mode="adaptive", dot_duration_ms=150.0, dash_duration_ms=450.0)
        proc_result = engine.process_signal_intervals(intervals)

        for ev in proc_result["reconstructed_events"]:
            ts_s = ev["timestamp_ms"] / 1000.0
            timeline_events.append({
                "time_offset_s": round(ts_s, 2),
                "time_formatted": format_timestamp(ts_s),
                "event_type": ev["event_type"],
                "duration_ms": round(ev["duration_ms"], 1),
                "confidence": ev["confidence"],
                "symbol": ev["classification"]
            })

        result_record = RecordingAnalysis(
            user_id=current_user.id if current_user else None,
            media_type="video",
            file_name=file.filename or "video.mp4",
            file_size_bytes=len(content),
            duration_seconds=round(duration_sec, 2),
            detected_mode="light_flash" if analysis_type != "eye_blink" else "eye_blink",
            detected_morse=proc_result["morse_sequence"],
            decoded_text=proc_result["decoded_text"],
            confidence=proc_result["overall_confidence"],
            signal_quality=proc_result["signal_quality"],
            timeline_json=timeline_events
        )
        db.add(result_record)
        db.commit()
        db.refresh(result_record)
        return RecordingAnalysisOut.model_validate(result_record)

    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

@router.get("/", response_model=List[RecordingAnalysisOut])
def list_recording_analyses(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    query = db.query(RecordingAnalysis)
    if current_user:
        query = query.filter(RecordingAnalysis.user_id == current_user.id)
    records = query.order_by(RecordingAnalysis.created_at.desc()).limit(limit).all()
    return [RecordingAnalysisOut.model_validate(r) for r in records]

@router.get("/{analysis_id}", response_model=RecordingAnalysisOut)
def get_recording_analysis(analysis_id: str, db: Session = Depends(get_db)):
    record = db.query(RecordingAnalysis).filter(RecordingAnalysis.id == analysis_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return RecordingAnalysisOut.model_validate(record)

@router.delete("/{analysis_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recording_analysis(
    analysis_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    record = db.query(RecordingAnalysis).filter(RecordingAnalysis.id == analysis_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Analysis not found")
    db.delete(record)
    db.commit()
    return None
