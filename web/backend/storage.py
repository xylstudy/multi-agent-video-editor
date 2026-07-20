import shutil
from pathlib import Path

from fastapi import UploadFile

from app_config import STORAGE_ROOT


def get_project_dir(user_id: int, project_id: int) -> Path:
    path = STORAGE_ROOT / "users" / str(user_id) / "projects" / str(project_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_upload(
    user_id: int,
    project_id: int,
    file: UploadFile,
    material_type: str,
) -> Path:
    """保存上传文件到项目目录，返回相对 storage root 的路径。"""
    project_dir = get_project_dir(user_id, project_id)
    sub_dir = project_dir / material_type
    sub_dir.mkdir(parents=True, exist_ok=True)

    # 清理文件名中的非法字符
    safe_name = Path(file.filename or "unnamed").name
    for ch in '\\/:*?"<>|':
        safe_name = safe_name.replace(ch, "_")

    dest = sub_dir / safe_name
    counter = 1
    stem = dest.stem
    suffix = dest.suffix
    while dest.exists():
        dest = sub_dir / f"{stem}_{counter}{suffix}"
        counter += 1

    with dest.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return dest


def delete_file(abs_path: str):
    path = Path(abs_path)
    if path.exists():
        path.unlink()
