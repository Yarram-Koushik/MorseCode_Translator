from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import random
import string
from app.database import get_db
from app.models.room import Room, RoomMember
from app.models.user import User
from app.schemas.room import RoomCreate, RoomJoin, RoomOut, RoomMemberOut
from app.core.security import get_current_user_optional

router = APIRouter(prefix="/rooms", tags=["Rooms"])

def generate_room_code(length: int = 6) -> str:
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

@router.post("/", response_model=RoomOut, status_code=status.HTTP_201_CREATED)
def create_room(
    room_in: RoomCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    code = (room_in.custom_code or generate_room_code()).upper().strip()
    
    # Ensure code uniqueness
    while db.query(Room).filter(Room.code == code).first():
        code = generate_room_code()

    new_room = Room(
        code=code,
        name=room_in.name or f"Lab Channel {code}",
        host_user_id=current_user.id if current_user else None,
        is_active=True
    )
    db.add(new_room)
    db.commit()
    db.refresh(new_room)

    # Add host as first member
    host_member = RoomMember(
        room_id=new_room.id,
        user_id=current_user.id if current_user else None,
        guest_name=current_user.username if current_user else "Host Operator",
        input_mode="tap"
    )
    db.add(host_member)
    db.commit()
    db.refresh(new_room)

    return RoomOut.model_validate(new_room)

@router.get("/{code}", response_model=RoomOut)
def get_room_by_code(code: str, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.code == code.upper().strip()).first()
    if not room or not room.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found or inactive"
        )
    return RoomOut.model_validate(room)

@router.post("/{code}/join", response_model=RoomMemberOut)
def join_room(
    code: str,
    join_in: RoomJoin,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    room = db.query(Room).filter(Room.code == code.upper().strip()).first()
    if not room or not room.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found or inactive"
        )
    
    member_name = current_user.username if current_user else (join_in.guest_name or "Operator")
    
    new_member = RoomMember(
        room_id=room.id,
        user_id=current_user.id if current_user else None,
        guest_name=member_name,
        input_mode=join_in.input_mode or "tap"
    )
    db.add(new_member)
    db.commit()
    db.refresh(new_member)
    return RoomMemberOut.model_validate(new_member)
