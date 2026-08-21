from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class RoomCreate(BaseModel):
    name: Optional[str] = "Morse Channel"
    custom_code: Optional[str] = None

class RoomJoin(BaseModel):
    guest_name: Optional[str] = "Operator"
    input_mode: Optional[str] = "tap"

class RoomMemberOut(BaseModel):
    id: str
    user_id: Optional[str] = None
    guest_name: Optional[str] = None
    input_mode: str
    joined_at: datetime
    model_config = ConfigDict(from_attributes=True)

class RoomOut(BaseModel):
    id: str
    code: str
    name: str
    host_user_id: Optional[str] = None
    is_active: bool
    created_at: datetime
    members: List[RoomMemberOut] = []
    model_config = ConfigDict(from_attributes=True)
