from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import settings
from app.database import engine, Base
from app.models import * # Load all models for metadata creation
from app.routers import (
    auth_router,
    morse_router,
    calibration_router,
    rooms_router,
    messages_router,
    analysis_router,
    training_router,
    ws_router
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize all database tables
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Multimodal Morse Communication & Signal Intelligence Platform API",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(morse_router, prefix=settings.API_V1_STR)
app.include_router(calibration_router, prefix=settings.API_V1_STR)
app.include_router(rooms_router, prefix=settings.API_V1_STR)
app.include_router(messages_router, prefix=settings.API_V1_STR)
app.include_router(analysis_router, prefix=settings.API_V1_STR)
app.include_router(training_router, prefix=settings.API_V1_STR)
app.include_router(ws_router)

@app.get("/", tags=["Health & Info"])
def root_info():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "operational",
        "pipeline": "Input Adapter -> Signal Event -> Timing Engine -> Morse Engine -> Message"
    }

@app.get("/health", tags=["Health & Info"])
def health_check():
    return {"status": "healthy"}
