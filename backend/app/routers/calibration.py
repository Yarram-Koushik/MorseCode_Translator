from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.calibration import Calibration
from app.models.user import User
from app.schemas.calibration import CalibrationCreate, CalibrationOut
from app.core.security import get_current_user_optional

router = APIRouter(prefix="/calibration", tags=["Calibration"])

@router.post("/", response_model=CalibrationOut, status_code=status.HTTP_201_CREATED)
def save_calibration_profile(
    profile_in: CalibrationCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    user_id = current_user.id if current_user else None
    
    # If user exists and already has a profile for this mode, update it
    existing = None
    if user_id:
        existing = db.query(Calibration).filter(
            Calibration.user_id == user_id,
            Calibration.mode == profile_in.mode
        ).first()

    if existing:
        existing.dot_duration_ms = profile_in.dot_duration_ms
        existing.dash_duration_ms = profile_in.dash_duration_ms
        existing.char_gap_ms = profile_in.char_gap_ms
        existing.word_gap_ms = profile_in.word_gap_ms
        existing.tolerance_ratio = profile_in.tolerance_ratio
        existing.threshold_value = profile_in.threshold_value
        existing.baseline_value = profile_in.baseline_value
        existing.extra_metadata = profile_in.extra_metadata
        db.commit()
        db.refresh(existing)
        return CalibrationOut.model_validate(existing)
    else:
        new_cal = Calibration(
            user_id=user_id,
            **profile_in.model_dump()
        )
        db.add(new_cal)
        db.commit()
        db.refresh(new_cal)
        return CalibrationOut.model_validate(new_cal)

@router.get("/", response_model=List[CalibrationOut])
def get_user_calibrations(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    if current_user:
        profiles = db.query(Calibration).filter(Calibration.user_id == current_user.id).all()
        return [CalibrationOut.model_validate(p) for p in profiles]
    return []

@router.get("/{mode}", response_model=CalibrationOut)
def get_calibration_by_mode(
    mode: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    if current_user:
        profile = db.query(Calibration).filter(
            Calibration.user_id == current_user.id,
            Calibration.mode == mode
        ).first()
        if profile:
            return CalibrationOut.model_validate(profile)

    # Default fallback profile
    defaults = {
        "eye": {"dot": 150.0, "dash": 450.0, "char": 450.0, "word": 1000.0, "thresh": 0.22, "base": 0.32},
        "audio": {"dot": 80.0, "dash": 240.0, "char": 240.0, "word": 560.0, "thresh": 0.15, "base": 0.03},
        "light": {"dot": 120.0, "dash": 360.0, "char": 360.0, "word": 800.0, "thresh": 0.30, "base": 0.10},
        "tap": {"dot": 100.0, "dash": 300.0, "char": 300.0, "word": 700.0, "thresh": None, "base": None}
    }
    cfg = defaults.get(mode, defaults["tap"])
    return CalibrationOut(
        id="default-" + mode,
        mode=mode,
        dot_duration_ms=cfg["dot"],
        dash_duration_ms=cfg["dash"],
        char_gap_ms=cfg["char"],
        word_gap_ms=cfg["word"],
        tolerance_ratio=0.35,
        threshold_value=cfg["thresh"],
        baseline_value=cfg["base"],
        created_at=Calibration.__table__.columns['created_at'].default.arg()
    )
