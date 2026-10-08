"""Configuration contains no hard-coded account credentials."""
from dataclasses import dataclass
import os
from pathlib import Path
import re

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    mongodb_uri: str = "mongodb://127.0.0.1:27017"
    database: str = "rescueplan"
    host: str = "127.0.0.1"
    port: int = 8000
    cookie_secure: bool = False
    session_hours: int = 8

    @classmethod
    def from_env(cls):
        load_dotenv(PROJECT_ROOT / ".env")
        settings = cls(
            mongodb_uri=os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017"),
            database=os.getenv("MONGODB_DATABASE", "rescueplan"),
            host=os.getenv("HOST", "127.0.0.1"),
            port=int(os.getenv("PORT", "8000")),
            cookie_secure=os.getenv("COOKIE_SECURE", "false").lower() == "true",
            session_hours=int(os.getenv("SESSION_HOURS", "8")),
        )
        if not re.fullmatch(r"[a-zA-Z0-9_-]{1,63}", settings.database):
            raise ValueError("MONGODB_DATABASE must contain only letters, numbers, - or _.")
        if not 1 <= settings.port <= 65535 or not 1 <= settings.session_hours <= 168:
            raise ValueError("Check PORT (1–65535) and SESSION_HOURS (1–168).")
        return settings

