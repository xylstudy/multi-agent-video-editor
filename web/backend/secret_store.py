import os
import threading
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

from app_config import PROJECT_ROOT

_PREFIX = "fernet:v1:"
_KEY_FILE = PROJECT_ROOT / ".local" / "model_api_keys.key"
_lock = threading.Lock()
_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is not None:
        return _fernet
    with _lock:
        if _fernet is not None:
            return _fernet
        configured_key = os.getenv("MODEL_SECRET_KEY", "").strip()
        if configured_key:
            key = configured_key.encode("ascii")
        elif _KEY_FILE.exists():
            key = _KEY_FILE.read_bytes().strip()
        else:
            _KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
            key = Fernet.generate_key()
            _KEY_FILE.write_bytes(key)
            try:
                _KEY_FILE.chmod(0o600)
            except OSError:
                pass
        _fernet = Fernet(key)
        return _fernet


def encrypt_secret(value: str) -> str:
    value = value.strip()
    if not value:
        return ""
    if value.startswith(_PREFIX):
        return value
    token = _get_fernet().encrypt(value.encode("utf-8")).decode("ascii")
    return f"{_PREFIX}{token}"


def decrypt_secret(value: str) -> str:
    if not value:
        return ""
    if not value.startswith(_PREFIX):
        return value
    try:
        token = value[len(_PREFIX):].encode("ascii")
        return _get_fernet().decrypt(token).decode("utf-8")
    except (InvalidToken, UnicodeDecodeError, ValueError):
        return ""
