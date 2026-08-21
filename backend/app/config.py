from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "Morse Signal Lab"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # Security
    SECRET_KEY: str = Field(default="morse_signal_lab_secret_key_2026_super_secure_telemetry_jwt_key")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days
    
    # Database
    DATABASE_URL: str = Field(default="sqlite:///./morse_signal_lab.db")
    
    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "*"]
    
    # Timing defaults
    DEFAULT_UNIT_MS: int = 80
    DEFAULT_DOT_MS: int = 80
    DEFAULT_DASH_MS: int = 240
    DEFAULT_CHAR_GAP_MS: int = 240
    DEFAULT_WORD_GAP_MS: int = 560

    model_config = SettingsConfigDict(env_file=".env", extra="allow")

settings = Settings()
