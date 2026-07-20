from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, status
from sqlmodel import Session, select

from auth import get_current_user
from database import engine, get_session
from db_models import MaterialType, Project, Task, TaskCreate, TaskRead, TaskStatus, TaskType, User
from media import get_current_user_media, range_file_response
from queue_manager import queue
from storage import delete_file
from websocket_manager import ws_manager

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("/project/{project_id}", response_model=list[TaskRead])
def list_project_tasks(
    project_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    project = session.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    tasks = session.exec(select(Task).where(Task.project_id == project_id)).all()
    return tasks


@router.get("", response_model=list[TaskRead])
def list_user_tasks(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    # 获取当前用户所有项目的任务
    projects = session.exec(select(Project.id).where(Project.user_id == current_user.id)).all()
    project_ids = [p for p in projects]
    if not project_ids:
        return []
    tasks = session.exec(select(Task).where(Task.project_id.in_(project_ids))).all()
    return tasks


@router.post("/project/{project_id}", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(
    project_id: int,
    task_in: TaskCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    project = session.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")

    # 简单校验素材
    from db_models import Material
    materials = session.exec(select(Material).where(Material.project_id == project_id)).all()
    has_video = any(m.type == MaterialType.VIDEO for m in materials)
    has_photo = any(m.type == MaterialType.IMAGE for m in materials)
    if not has_video or not has_photo:
        raise HTTPException(status_code=400, detail="项目需要至少一个参考视频和一张照片")

    task = Task(
        project_id=project_id,
        type=task_in.type,
        status=TaskStatus.PENDING,
        progress=0,
        logs=[],
    )
    session.add(task)
    session.commit()
    session.refresh(task)

    # 入队
    queue.enqueue(task.id, project_id, current_user.id)

    return task


@router.get("/{task_id}", response_model=TaskRead)
def get_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    project = session.get(Project, task.project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    project = session.get(Project, task.project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.result_path:
        delete_file(task.result_path)
    session.delete(task)
    session.commit()
    return None


@router.get("/{task_id}/download")
def download_task_result(
    task_id: int,
    request: Request,
    current_user: User = Depends(get_current_user_media),
    session: Session = Depends(get_session),
):
    task = session.get(Task, task_id)
    if not task or task.status != TaskStatus.SUCCESS:
        raise HTTPException(status_code=404, detail="Result not ready")
    project = session.get(Project, task.project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Task not found")
    if not task.result_path or not Path(task.result_path).exists():
        raise HTTPException(status_code=404, detail="Result file not found")

    return range_file_response(
        request,
        task.result_path,
        media_type="video/mp4",
        filename=f"task_{task_id}_result.mp4",
    )


@router.websocket("/{task_id}/ws")
async def task_websocket(websocket: WebSocket, task_id: str):
    await ws_manager.connect(task_id, websocket)
    try:
        while True:
            # 保持连接，前端可发送 ping
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text('{"type":"pong"}')
    except Exception:
        pass
    finally:
        ws_manager.disconnect(task_id, websocket)
