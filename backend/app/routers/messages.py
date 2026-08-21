from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.message import Message, RawSignalEvent
from app.models.room import Room
from app.models.user import User
from app.schemas.message import MessageCreate, MessageOut
from app.core.security import get_current_user_optional

router = APIRouter(prefix="/messages", tags=["Messages & Signal History"])

@router.post("/", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def create_message(
    msg_in: MessageCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    sender_name = current_user.username if current_user else (msg_in.sender_name or "Operator")
    
    new_msg = Message(
        room_id=msg_in.room_id,
        sender_id=current_user.id if current_user else None,
        sender_name=sender_name,
        text=msg_in.text,
        morse_code=msg_in.morse_code,
        input_mode=msg_in.input_mode,
        confidence=msg_in.confidence,
        signal_quality=msg_in.signal_quality,
        timing_telemetry=msg_in.timing_telemetry
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)

    # Persist fine-grained raw signal events if telemetry provided
    if msg_in.timing_telemetry:
        for ev in msg_in.timing_telemetry:
            raw_ev = RawSignalEvent(
                message_id=new_msg.id,
                event_type=ev.get("event_type", "dot"),
                duration_ms=ev.get("duration_ms", 100.0),
                timestamp_ms=ev.get("timestamp_ms", 0.0),
                confidence=ev.get("confidence", 1.0),
                raw_reading=ev.get("raw_reading", None)
            )
            db.add(raw_ev)
        db.commit()

    return MessageOut.model_validate(new_msg)

@router.get("/", response_model=List[MessageOut])
def get_message_history(
    room_id: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    query = db.query(Message)
    if room_id:
        query = query.filter(Message.room_id == room_id)
    elif current_user:
        query = query.filter((Message.sender_id == current_user.id) | (Message.room_id == None))
    
    messages = query.order_by(Message.created_at.desc()).limit(limit).all()
    return [MessageOut.model_validate(m) for m in reversed(messages)]

@router.delete("/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_message(
    message_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    msg = db.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    
    db.delete(msg)
    db.commit()
    return None
