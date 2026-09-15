import os
import secrets
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = Path(__file__).resolve().parent
STORAGE_ROOT = BACKEND_DIR / "storage"
DB_PATH = BACKEND_DIR / "app.db"
LOCAL_STATE_DIR = PROJECT_ROOT / ".local"

# JWT
def _load_jwt_secret() -> str:
    """Read an explicit secret or keep one stable across local restarts."""
    configured = os.getenv("JWT_SECRET_KEY", "").strip()
    if configured:
        return configured

    secret_file = LOCAL_STATE_DIR / "jwt_secret.key"
    if secret_file.exists():
        existing = secret_file.read_text(encoding="utf-8").strip()
        if existing:
            return existing

    LOCAL_STATE_DIR.mkdir(parents=True, exist_ok=True)
    generated = secrets.token_urlsafe(48)
    secret_file.write_text(generated, encoding="utf-8")
    try:
        secret_file.chmod(0o600)
    except OSError:
        pass
    return generated


JWT_SECRET_KEY = _load_jwt_secret()
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))  # 7 天

# CORS
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
ALLOWED_ORIGINS = [FRONTEND_URL]

# 兼容 Windows：确保 storage 目录存在
STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
