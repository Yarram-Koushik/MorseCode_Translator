from app.routers.auth import router as auth_router
from app.routers.morse import router as morse_router
from app.routers.calibration import router as calibration_router
from app.routers.rooms import router as rooms_router
from app.routers.messages import router as messages_router
from app.routers.analysis import router as analysis_router
from app.routers.training import router as training_router
from app.routers.websocket import router as ws_router

__all__ = [
    "auth_router",
    "morse_router",
    "calibration_router",
    "rooms_router",
    "messages_router",
    "analysis_router",
    "training_router",
    "ws_router",
]
