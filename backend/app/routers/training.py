from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from app.database import get_db
from app.models.training import TrainingSession, ChallengeResult
from app.models.user import User
from app.schemas.training import (
    TrainingSessionCreate, TrainingSessionOut,
    ChallengeSubmit, ChallengeResultOut,
    TrainingStatsSummary
)
from app.core.security import get_current_user_optional

router = APIRouter(prefix="/training", tags=["Training & Challenges"])

@router.post("/session", response_model=TrainingSessionOut, status_code=status.HTTP_201_CREATED)
def record_training_session(
    session_in: TrainingSessionCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    session_obj = TrainingSession(
        user_id=current_user.id if current_user else None,
        **session_in.model_dump()
    )
    db.add(session_obj)
    db.commit()
    db.refresh(session_obj)
    return TrainingSessionOut.model_validate(session_obj)

@router.post("/challenges/submit", response_model=ChallengeResultOut, status_code=status.HTTP_201_CREATED)
def submit_challenge_result(
    challenge_in: ChallengeSubmit,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    result_obj = ChallengeResult(
        user_id=current_user.id if current_user else None,
        **challenge_in.model_dump()
    )
    db.add(result_obj)
    db.commit()
    db.refresh(result_obj)
    return ChallengeResultOut.model_validate(result_obj)

@router.get("/stats", response_model=TrainingStatsSummary)
def get_training_stats(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    query_ts = db.query(TrainingSession)
    query_cr = db.query(ChallengeResult)
    if current_user:
        query_ts = query_ts.filter(TrainingSession.user_id == current_user.id)
        query_cr = query_cr.filter(ChallengeResult.user_id == current_user.id)
    
    sessions = query_ts.all()
    challenges = query_cr.all()

    total_sessions = len(sessions)
    avg_accuracy = (sum(s.accuracy_percentage for s in sessions) / total_sessions) if total_sessions > 0 else 0.0
    avg_wpm = (sum(s.wpm for s in sessions) / total_sessions) if total_sessions > 0 else 0.0
    max_streak = max([s.streak for s in sessions], default=0)
    best_score = max([c.score for c in challenges], default=0)

    return TrainingStatsSummary(
        total_sessions=total_sessions,
        average_accuracy=round(avg_accuracy, 1),
        average_wpm=round(avg_wpm, 1),
        highest_streak=max_streak,
        total_challenges_completed=len(challenges),
        best_score=best_score
    )
