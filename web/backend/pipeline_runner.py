import asyncio
import json
import logging
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Callable

from sqlmodel import Session, select

# 把 viral-structure-engine 加入路径，以便读取 .env 和调用模块
VSE_DIR = Path(__file__).resolve().parent.parent.parent / "viral-structure-engine"
sys.path.insert(0, str(VSE_DIR))

from app_config import STORAGE_ROOT
from database import engine
from db_models import Material, MaterialType, Project, Task, User

logger = logging.getLogger(__name__)

VSE_DATA_DIR = VSE_DIR / "data"
VSE_TEMP_DIR = VSE_DATA_DIR / "temp"
VSE_RUNS_DIR = VSE_DATA_DIR / "runs"

# 正在运行的子进程注册表：proc_key -> Popen，用于外部取消（如基因删除时终止提取）
_active_procs: dict[str, "object"] = {}


def kill_active_process(proc_key: str) -> bool:
    """终止指定 key 的子进程。有进程被终止返回 True。"""
    proc = _active_procs.get(proc_key)
    if proc and proc.poll() is None:
        proc.kill()
        logger.info(f"已终止子进程: {proc_key} (pid={proc.pid})")
        return True
    return False


def _run_command_sync(
    cmd: list[str],
    cwd: Path,
    emit_callback: Callable,
    step: str,
    start_percent: int,
    end_percent: int,
    proc_key: str | None = None,
):
    """同步运行子进程并流式输出日志（在 asyncio.to_thread 中执行）。

    proc_key 不为空时把 Popen 登记到 _active_procs，允许外部用
    kill_active_process(proc_key) 强制终止。
    """
    import subprocess
    emit_callback(step, f"启动: {' '.join(cmd)}", start_percent)
    process = subprocess.Popen(
        cmd,
        cwd=str(cwd),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if proc_key:
        _active_procs[proc_key] = process

    def read_stream(stream, prefix: str):
        for line in stream:
            line = line.strip()
            if line:
                emit_callback(step, f"{prefix}: {line}", start_percent)

    try:
        import threading
        t_out = threading.Thread(target=read_stream, args=(process.stdout, "OUT"))
        t_err = threading.Thread(target=read_stream, args=(process.stderr, "ERR"))
        t_out.start()
        t_err.start()
        returncode = process.wait()
        t_out.join()
        t_err.join()

        emit_callback(step, f"完成，退出码: {returncode}", end_percent)
        if returncode != 0:
            raise RuntimeError(f"步骤 {step} 执行失败，退出码 {returncode}")
    finally:
        if proc_key:
            _active_procs.pop(proc_key, None)


async def run_command(
    cmd: list[str],
    cwd: Path,
    emit_progress: Callable,
    step: str,
    start_percent: int,
    end_percent: int,
    proc_key: str | None = None,
):
    """异步包装：在后台线程中运行子进程，避免 Windows 事件循环限制。"""
    await asyncio.to_thread(
        _run_command_sync,
        cmd,
        cwd,
        emit_progress,
        step,
        start_percent,
        end_percent,
        proc_key,
    )


def get_task_storage(user_id: int, project_id: int, task_id: int) -> Path:
    path = STORAGE_ROOT / "users" / str(user_id) / "projects" / str(project_id) / "tasks" / str(task_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def find_materials(session: Session, project_id: int) -> tuple[Material | None, list[Material]]:
    """返回参考视频和照片列表。"""
    materials = session.exec(select(Material).where(Material.project_id == project_id)).all()
    video = next((m for m in materials if m.type == MaterialType.VIDEO), None)
    photos = [m for m in materials if m.type == MaterialType.IMAGE]
    return video, photos


def write_beijing_materials_json(photos: list[Material]):
    """为 run_material_analysis.py 准备输入文件。"""
    VSE_TEMP_DIR.mkdir(parents=True, exist_ok=True)
    data = []
    for idx, photo in enumerate(photos):
        data.append({
            "id": f"mat_{idx:03d}",
            "path": str(Path(photo.storage_path).resolve()),
            "type": "image",
            "description": Path(photo.filename).stem,
        })
    path = VSE_TEMP_DIR / "beijing_materials.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def copy_result_to_task_dir(src: Path, task_dir: Path) -> Path:
    if not src.exists():
        raise RuntimeError(f"结果文件不存在: {src}")
    dst = task_dir / src.name
    shutil.copy2(src, dst)
    return dst


def _get_effective_api_keys(user_id: int) -> dict[str, str]:
    """合并后端默认（环境/.env）与用户自定义 API Key，返回实际生效的键值。"""
    from config import settings as vse_settings
    from db_models import ApiKey, Provider

    # 后端默认值
    defaults = {
        "DEEPSEEK_API_KEY": vse_settings.DEEPSEEK_API_KEY,
        "ZHIPU_API_KEY": vse_settings.ZHIPU_API_KEY,
        "MOONSHOT_API_KEY": vse_settings.MOONSHOT_API_KEY,
    }

    # 用户自定义值
    overrides = {}
    with Session(engine) as session:
        keys = session.exec(select(ApiKey).where(ApiKey.user_id == user_id)).all()
        for k in keys:
            if k.provider == Provider.DEEPSEEK:
                overrides["DEEPSEEK_API_KEY"] = k.key_value
            elif k.provider == Provider.ZHIPU:
                overrides["ZHIPU_API_KEY"] = k.key_value
            elif k.provider == Provider.MOONSHOT:
                overrides["MOONSHOT_API_KEY"] = k.key_value
            elif k.provider == Provider.ALIYUN:
                overrides["ALIYUN_ACCESS_KEY_ID"] = k.key_value

    effective = {k: overrides.get(k, v) for k, v in defaults.items()}
    return {k: v for k, v in effective.items() if v}


def setup_api_keys_for_user(user_id: int):
    """将用户自定义 API Key 写入 viral-structure-engine/.env，覆盖系统默认。"""
    from db_models import ApiKey, Provider

    with Session(engine) as session:
        keys = session.exec(select(ApiKey).where(ApiKey.user_id == user_id)).all()
        overrides = {}
        for k in keys:
            if k.provider == Provider.DEEPSEEK:
                overrides["DEEPSEEK_API_KEY"] = k.key_value
            elif k.provider == Provider.ZHIPU:
                overrides["ZHIPU_API_KEY"] = k.key_value
            elif k.provider == Provider.MOONSHOT:
                overrides["MOONSHOT_API_KEY"] = k.key_value
            elif k.provider == Provider.ALIYUN:
                overrides["ALIYUN_ACCESS_KEY_ID"] = k.key_value
                # 这里只覆盖 id，secret 如用户也设置了则一起覆盖
        if overrides:
            env_file = VSE_DIR / ".env"
            lines = []
            if env_file.exists():
                lines = env_file.read_text(encoding="utf-8").splitlines()
            existing = {}
            for i, line in enumerate(lines):
                if "=" in line and not line.strip().startswith("#"):
                    key = line.split("=", 1)[0].strip()
                    existing[key] = i
            for key, value in overrides.items():
                line = f"{key}={value}"
                if key in existing:
                    lines[existing[key]] = line
                else:
                    lines.append(line)
            env_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
            # 重新加载 .env
            from dotenv import load_dotenv
            load_dotenv(str(env_file), override=True)


async def run_pipeline(
    task_id: int,
    project_id: int,
    user_id: int,
    emit_progress: Callable,
) -> str:
    with Session(engine) as session:
        task = session.get(Task, task_id)
        project = session.get(Project, project_id)
        user = session.get(User, user_id)
        if not task or not project or not user:
            raise ValueError("Task/Project/User not found")

        video, photos = find_materials(session, project_id)
        if not video:
            raise ValueError("项目缺少参考视频素材")
        if not photos:
            raise ValueError("项目缺少照片素材")

    task_dir = get_task_storage(user_id, project_id, task_id)
    python_exe = sys.executable

    # 应用用户 API Key 覆盖
    setup_api_keys_for_user(user_id)

    # 预检：当前流水线核心依赖 ZHIPU_API_KEY（analyze_video / material_analysis 均使用）
    effective_keys = _get_effective_api_keys(user_id)
    if not effective_keys.get("ZHIPU_API_KEY"):
        raise RuntimeError(
            "未配置 ZHIPU_API_KEY。请在“个人设置”页面上传智谱 API Key，"
            "或由管理员在 viral-structure-engine/.env 中设置 ZHIPU_API_KEY。"
        )

    # 根据任务类型执行不同步骤
    task_type = task.type.value

    if task_type == "material_analysis":
        await _run_material_analysis(photos, python_exe, emit_progress)
        inventory = VSE_RUNS_DIR / "material_analysis" / "material" / "inventory.json"
        result = copy_result_to_task_dir(inventory, task_dir)
        emit_progress("done", f"素材分析完成: {result.name}", 100)
        return str(result)

    if task_type == "analyze_video":
        analysis_output_path = await _run_video_analysis(
            video, task_dir, python_exe, emit_progress
        )
        result = copy_result_to_task_dir(analysis_output_path, task_dir)
        emit_progress("done", f"视频分析完成: {result.name}", 100)
        return str(result)

    if task_type == "end_to_end":
        await _run_material_analysis(photos, python_exe, emit_progress)
        await _run_video_analysis(video, task_dir, python_exe, emit_progress)

        if project.pipeline_mode.value == "editing_transfer":
            return await _run_editing_transfer(
                task_id, video, python_exe, emit_progress, task_dir
            )
        elif project.pipeline_mode.value == "agent_pipeline":
            return await _run_agent_pipeline(
                task_id, project, photos, python_exe, emit_progress, task_dir
            )
        raise ValueError(f"不支持的 pipeline 模式: {project.pipeline_mode}")

    raise ValueError(f"不支持的流水线任务类型: {task_type}")


async def _run_material_analysis(
    photos: list[Material],
    python_exe: str,
    emit_progress: Callable,
):
    """执行素材分析步骤。"""
    emit_progress("material_analysis", "准备照片素材清单", 5)
    write_beijing_materials_json(photos)

    emit_progress("material_analysis", "开始分析照片素材", 10)
    await run_command(
        [python_exe, "run_material_analysis.py"],
        cwd=VSE_DIR,
        emit_progress=emit_progress,
        step="material_analysis",
        start_percent=10,
        end_percent=30,
    )


async def _run_video_analysis(
    video: Material,
    task_dir: Path,
    python_exe: str,
    emit_progress: Callable,
) -> Path:
    """执行参考视频分析步骤，返回分析结果 JSON 路径。

    使用 analyze_video.py：其返回的 raw_shot_analyses 含 shot_index，
    正好是 run_editing_transfer.py 所要求的格式。
    """
    emit_progress("video_analysis", "开始分析参考视频结构", 32)
    analysis_output_path = task_dir / "analysis_result.json"
    await run_command(
        [
            python_exe, "analyze_video.py",
            "--video", str(Path(video.storage_path).resolve()),
            "--output", str(analysis_output_path),
        ],
        cwd=VSE_DIR,
        emit_progress=emit_progress,
        step="video_analysis",
        start_percent=32,
        end_percent=50,
    )

    # 将 analyze_video.py 的输出拆分为 run_editing_transfer.py / run_pipeline_e2e.py
    # 所读取的固定路径文件。
    emit_progress("video_analysis", "整理分析结果到流水线目录", 50)
    analysis_data = json.loads(analysis_output_path.read_text(encoding="utf-8"))
    analysis_run_dir = VSE_RUNS_DIR / "video_analysis_demo" / "analyst"
    analysis_run_dir.mkdir(parents=True, exist_ok=True)

    shot_analyses = analysis_data.get("raw_shot_analyses", [])
    for i, sa in enumerate(shot_analyses):
        sa.setdefault("shot_index", i)
    (analysis_run_dir / "shot_analyses.json").write_text(
        json.dumps(shot_analyses, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (analysis_run_dir / "structure_analysis.json").write_text(
        json.dumps(analysis_data.get("raw_structure_analysis", {}), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (analysis_run_dir / "video_structure.json").write_text(
        json.dumps(analysis_data, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    emit_progress("video_analysis", f"分析结果已写入 {analysis_run_dir}", 52)
    return analysis_output_path


async def _run_editing_transfer(
    task_id: int,
    video: Material,
    python_exe: str,
    emit_progress: Callable,
    task_dir: Path,
) -> str:
    """编辑迁移路线：无需 LLM，节拍驱动。"""
    emit_progress("editing_transfer", "开始编辑迁移渲染", 55)
    run_id = f"web_task_{task_id}"
    await run_command(
        [
            python_exe, "run_editing_transfer.py",
            "--viral-video", str(Path(video.storage_path).resolve()),
            "--run-id", run_id,
        ],
        cwd=VSE_DIR,
        emit_progress=emit_progress,
        step="editing_transfer",
        start_percent=55,
        end_percent=95,
    )
    src_output = VSE_RUNS_DIR / run_id / "editing" / "final_video.mp4"
    result = copy_result_to_task_dir(src_output, task_dir)
    emit_progress("done", f"渲染完成: {result.name}", 100)
    return str(result)


async def _run_agent_pipeline(
    task_id: int,
    project: Project,
    photos: list[Material],
    python_exe: str,
    emit_progress: Callable,
    task_dir: Path,
) -> str:
    """多智能体路线：基于已分析的结构生成方案并渲染。"""
    video_structure_src = VSE_RUNS_DIR / "video_analysis_demo" / "analyst" / "video_structure.json"
    if not video_structure_src.exists():
        raise RuntimeError(f"视频结构分析结果未生成: {video_structure_src}")

    photos_dir = task_dir / "photos"
    photos_dir.mkdir(parents=True, exist_ok=True)
    for p in photos:
        shutil.copy2(p.storage_path, photos_dir / Path(p.storage_path).name)

    run_id = f"web_task_{task_id}"
    emit_progress("pipeline", "开始端到端多智能体流水线", 60)
    await run_command(
        [
            python_exe, "run_pipeline_e2e.py",
            "--struct", str(video_structure_src),
            "--struct-analysis", str(VSE_RUNS_DIR / "video_analysis_demo" / "analyst" / "structure_analysis.json"),
            "--photo-dir", str(photos_dir),
            "--topic", project.topic or "旅行Vlog",
            "--run-id", run_id,
        ],
        cwd=VSE_DIR,
        emit_progress=emit_progress,
        step="pipeline",
        start_percent=60,
        end_percent=95,
    )
    src_output = VSE_RUNS_DIR / run_id / "final_video.mp4"
    result = copy_result_to_task_dir(src_output, task_dir)
    emit_progress("done", f"渲染完成: {result.name}", 100)
    return str(result)
