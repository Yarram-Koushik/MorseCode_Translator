from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class TrainingSessionCreate(BaseModel):
    level: str
    target_type: str = "letters"
    total_prompts: int
    correct_count: int
    accuracy_percentage: float
    wpm: float
    average_response_time_ms: float
    streak: int = 0

class TrainingSessionOut(TrainingSessionCreate):
    id: str
    user_id: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class ChallengeSubmit(BaseModel):
    challenge_id: str
    challenge_title: str
    challenge_mode: str
    score: int
    time_taken_ms: int
    accuracy_percentage: float
    wpm: float
    signal_quality: float = 1.0

class ChallengeResultOut(ChallengeSubmit):
    id: str
    user_id: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class TrainingStatsSummary(BaseModel):
    total_sessions: int
    average_accuracy: float
    average_wpm: float
    highest_streak: int
    total_challenges_completed: int
    best_score: int
