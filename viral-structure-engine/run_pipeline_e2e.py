"""快速端到端流程：利用现有分析 + 新素材 + 剪辑手法学识 → 生成方案 → Remotion 渲染"""
import asyncio, json, logging, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

from config.llm_client import LLMTools
from config import settings
from config.output_manager import OutputManager
from agents.planner import PlannerAgent
from knowledge.techniques_loader import get_summary

REMOTION_DIR = Path(__file__).resolve().parent / "remotion"


async def main():
    run_id = "pipeline_e2e_techniques"
    out = OutputManager(run_id=run_id)
    logger.info(f"输出目录: {out.run_dir}")

    # ===== 1. 加载现有视频结构分析 =====
    logger.info("=" * 60)
    logger.info("1. 加载视频结构分析")
    struct_path = Path("data/runs/video_analysis_demo/analyst/video_structure.json")
    struct = json.loads(struct_path.read_text(encoding="utf-8"))
    logger.info(f"   视频: {struct.get('source_video', '?')}")
    logger.info(f"   时长: {struct.get('duration', 0):.1f}s, 镜头: {len(struct.get('shots', []))}")

    struct_analysis_path = Path("data/runs/video_analysis_demo/analyst/structure_analysis.json")
    struct_analysis = json.loads(struct_analysis_path.read_text(encoding="utf-8")) if struct_analysis_path.exists() else {}

    # ===== 2. 加载素材 =====
    logger.info("=" * 60)
    logger.info("2. 加载用户素材 (39张北京照片)")
    photo_dir = Path(r"E:\py pbjects\video_claw\data\北京")
    photo_paths = sorted([p for p in photo_dir.glob("*") if p.suffix.lower() in (".jpg", ".jpeg", ".png")])
    inventory = {
        "items": [
            {"id": f"mat_{i:03d}", "path": str(p.resolve()), "type": "image", "description": p.stem[:40]}
            for i, p in enumerate(photo_paths)
        ]
    }
    # 也设置 materials 字段兼容不同代码
    inventory["materials"] = inventory["items"]
    logger.info(f"   共 {len(inventory['items'])} 张照片")

    # ===== 3. 注入剪辑手法学识，生成方案 =====
    logger.info("=" * 60)
    logger.info("3. 编导生成方案 (DeepSeek + 剪辑手法学识)")

    techniques = get_summary()
    logger.info(f"   注入 {len(techniques)} 行学识")
    # 打印部分学识预览
    for line in techniques.split("\n")[:6]:
        logger.info(f"   {line}")

    llm = LLMTools(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL, model="deepseek-chat")
    planner = PlannerAgent(llm)

    structure_summary = json.dumps(struct, ensure_ascii=False)
    structure_analysis_json = json.dumps(struct_analysis, ensure_ascii=False)

    skeleton = await planner._extract_skeleton(structure_summary, "北京旅行Vlog", "", structure_analysis=structure_analysis_json)
    out.save_json("planner", "skeleton.json", skeleton)
    logger.info(f"   骨架: {skeleton.get('structure_type', '?')}")

    inv_json = json.dumps(inventory, ensure_ascii=False)
    preferences = json.dumps({
        "style": "旅行Vlog创意风格",
        "shot_count_target": "12-16个分镜",
        "total_duration_guide": "35-50秒",
        "material_usage": "尽量使用不同照片，充分展示北京多样性（天坛、故宫、街景、夜景等）",
        "note": "使用分割前景图片做前景展示效果。高潮段用震撼全景。",
    })

    # manually inject techniques into the generate call
    scheme_data = await planner._generate_scheme(
        json.dumps(skeleton, ensure_ascii=False), inv_json,
        "北京旅行Vlog", "", preferences,
        material_type_hint="全部为静态照片素材，需要做 Ken Burns 运镜。建议每镜用不同照片。",
    )
    out.save_json("planner", "scheme_raw.json", scheme_data)

    scheme = planner.build_scheme(scheme_data, "北京旅行Vlog", iteration=0)
    out.save_json("planner", "scheme.json", scheme)
    logger.info(f"   方案: {scheme.title}, {len(scheme.storyboard)} 个分镜, {scheme.target_duration}s")

    for f in scheme.storyboard:
        logger.info(f"   [{f.index}] {f.shot_type.value:20s} | {f.duration:.1f}s | {f.visual_content[:50] if f.visual_content else ''}")

    # ===== 4. 渲染决策 =====
    logger.info("=" * 60)
    logger.info("4. 渲染决策")

    from agents.renderer import RendererAgent
    renderer = RendererAgent(llm)

    scheme_json = json.dumps(scheme.to_dict() if hasattr(scheme, "to_dict") else scheme_data, ensure_ascii=False)
    decisions = await renderer._analyze_scheme(scheme_json, f"{len(inventory['items'])} 个素材")
    out.save_json("renderer", "render_decisions.json", decisions)

    frame_decisions = decisions.get("frame_decisions", [])
    for d in frame_decisions:
        logger.info(f"   [{d.get('index', '?')}] render: {d.get('render_component', 'auto')[:20]} | {d.get('reasoning', '')[:60]}")

    # ===== 5. Remotion 渲染 =====
    logger.info("=" * 60)
    logger.info("5. Remotion 渲染最终视频")

    scheme_dict = scheme.to_dict() if hasattr(scheme, "to_dict") else scheme_data
    # 将决策写回 scheme
    decisions_map = {d["index"]: d for d in frame_decisions}
    for frame in scheme_dict.get("storyboard", []):
        d = decisions_map.get(frame.get("index", -1), {})
        frame["render_component"] = d.get("render_component", "auto")

    import subprocess, threading, socket, shutil, tempfile
    from http.server import HTTPServer, SimpleHTTPRequestHandler

    # 启动本地 HTTP 服务提供素材访问
    media_root = Path(tempfile.mkdtemp(prefix="vse_media_"))
    material_map = {}
    for m in inventory["items"]:
        src = Path(m["path"])
        if src.exists():
            ext = src.suffix.lower() or ".jpg"
            dst = media_root / f"{m['id']}{ext}"
            if not dst.exists():
                shutil.copy2(src, dst)
            material_map[m["id"]] = f"/{m['id']}{ext}"
    logger.info(f"   素材复制: {len(material_map)} 个到临时目录")

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()

    class _Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(media_root), **kwargs)
        def log_message(self, fmt, *args):
            pass

    httpd = HTTPServer(("127.0.0.1", port), _Handler)
    httpd_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    httpd_thread.start()
    logger.info(f"   HTTP 素材服务: http://127.0.0.1:{port}")

    http_map = {mid: f"http://127.0.0.1:{port}{path}" for mid, path in material_map.items()}
    input_props = {"scheme": scheme_dict, "material_map": http_map}

    props_file = REMOTION_DIR / "input_props_e2e.json"
    props_file.write_text(json.dumps(input_props, ensure_ascii=False), encoding="utf-8")

    output = str((out.run_dir / "final_video.mp4").resolve())
    entry = (REMOTION_DIR / "src/index.ts").resolve().as_posix()
    npx_cmd = "npx.cmd"
    cmd = [npx_cmd, "remotion", "render", entry, "VideoScheme", output,
           "--props", str(props_file), "--overwrite"]

    logger.info(f"   {' '.join(cmd)}")
    try:
        result = subprocess.run(cmd, cwd=str(REMOTION_DIR), capture_output=True, text=True, timeout=600)
        if result.returncode != 0:
            logger.error(f"Remotion 渲染失败: {result.stderr[-800:]}")
        else:
            size_mb = Path(output).stat().st_size / 1024 / 1024
            logger.info(f"   [OK] 渲染完成: {output}")
            logger.info(f"   [OK] 大小: {size_mb:.1f}MB")
    except subprocess.TimeoutExpired:
        logger.error("Remotion 渲染超时")
    finally:
        props_file.unlink(missing_ok=True)
        httpd.shutdown()
        shutil.rmtree(media_root, ignore_errors=True)

    logger.info("=" * 60)
    logger.info("端到端流程完成")


if __name__ == "__main__":
    asyncio.run(main())
