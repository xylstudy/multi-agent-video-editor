"""媒体文件服务工具：?token= 查询参数鉴权 + HTTP Range 请求支持。

浏览器 <video> 标签和 <a download> 无法携带 Authorization 头，
因此媒体端点额外允许通过查询参数传递 JWT。
Range 支持保证视频拖动进度条、断点续传可用。
"""

from pathlib import Path
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.responses import FileResponse, Response, StreamingResponse
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session

from auth import decode_token
from database import get_session
from db_models import User

# auto_error=False：缺少 Authorization 头时不直接抛错，交由查询参数兜底
oauth2_scheme_media = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_current_user_media(
    request: Request,
    header_token: Optional[str] = Depends(oauth2_scheme_media),
    session: Session = Depends(get_session),
) -> User:
    """媒体端点专用鉴权：优先 Authorization 头，其次 ?token= 查询参数。"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = header_token or request.query_params.get("token")
    if not token:
        raise credentials_exception
    payload = decode_token(token)
    if payload is None:
        raise credentials_exception
    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    user = session.get(User, user_id)
    if user is None:
        raise credentials_exception
    return user


def range_file_response(
    request: Request,
    path: str | Path,
    media_type: str = "video/mp4",
    filename: Optional[str] = None,
) -> Response:
    """返回支持 Range 的文件响应。无 Range 头时回退为完整 FileResponse。"""
    file_path = Path(path)
    file_size = file_path.stat().st_size
    range_header = request.headers.get("range")

    if not range_header:
        return FileResponse(path=file_path, media_type=media_type, filename=filename)

    # 解析 "bytes=start-end" / "bytes=start-" / "bytes=-suffix"
    try:
        unit, _, rng = range_header.partition("=")
        if unit.strip() != "bytes":
            raise ValueError
        start_s, _, end_s = rng.partition("-")
        if start_s:
            start = int(start_s)
            end = int(end_s) if end_s else file_size - 1
        else:
            # 后缀范围：最后 N 字节
            start = max(0, file_size - int(end_s))
            end = file_size - 1
    except ValueError:
        return Response(
            status_code=status.HTTP_416_RANGE_NOT_SATISFIABLE,
            headers={"Content-Range": f"bytes */{file_size}"},
        )

    if start >= file_size or start > end:
        return Response(
            status_code=status.HTTP_416_RANGE_NOT_SATISFIABLE,
            headers={"Content-Range": f"bytes */{file_size}"},
        )
    end = min(end, file_size - 1)
    chunk_size = end - start + 1

    def iterfile():
        with open(file_path, "rb") as f:
            f.seek(start)
            remaining = chunk_size
            while remaining > 0:
                data = f.read(min(1024 * 1024, remaining))
                if not data:
                    break
                remaining -= len(data)
                yield data

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(chunk_size),
    }
    if filename:
        headers["Content-Disposition"] = f'attachment; filename="{filename}"'

    return StreamingResponse(
        iterfile(),
        status_code=status.HTTP_206_PARTIAL_CONTENT,
        headers=headers,
        media_type=media_type,
    )
