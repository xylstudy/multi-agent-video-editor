"""用 Remotion 合成最终视频（支持视频素材 + 图片 Ken Burns + 字幕 + 转场）
使用自定义 HTTP 服务提供素材，通过 material_id 映射文件路径"""
import json
import logging
import subprocess
import sys
import threading
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

from config.output_manager import OutputManager

REMOTION_DIR = Path(__file__).resolve().parent / "remotion"


def build_material_map() -> dict:
    """合并照片素材和爆款视频片段，值保持本地路径"""
    material_map = {}

    photo_inv = json.loads(
        Path("data/runs/material_analysis/material/inventory.json").read_text(encoding="utf-8")
    )
    for item in photo_inv.get("items", photo_inv.get("materials", [])):
        mid = item.get("id", "")
        mpath = item.get("path", "")
        if mid and mpath and Path(mpath).exists():
            material_map[mid] = str(Path(mpath).resolve())

    viral_inv_path = Path("data/runs/viral_clips/viral/inventory.json")
    if viral_inv_path.exists():
        viral_inv = json.loads(viral_inv_path.read_text(encoding="utf-8"))
        for item in viral_inv.get("items", []):
            mid = item.get("id", "")
            mpath = item.get("path", "")
            if mid and mpath and Path(mpath).exists():
                material_map[mid] = str(Path(mpath).resolve())

    return material_map


def start_material_server(port: int, material_map: dict) -> HTTPServer:
    """启动自定义 HTTP 服务：通过 /{material_id} 访问素材文件"""
    class _Handler(BaseHTTPRequestHandler):
        _files: dict = {}

        def do_GET(self):
            path = urllib.parse.urlparse(self.path).path
            # URL 格式: /{material_id}.{ext}，去掉扩展名得到 material_id
            stem = path.lstrip("/")
            mat_id = Path(stem).stem  # "viral_act_0.mp4" → "viral_act_0"

            file_path = self._files.get(mat_id)
            if not file_path or not Path(file_path).exists():
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"Not found")
                return

            ext = Path(file_path).suffix.lower()
            content_types = {
                ".mp4": "video/mp4",
                ".mov": "video/quicktime",
                ".webm": "video/webm",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
                ".webp": "image/webp",
            }
            ct = content_types.get(ext, "application/octet-stream")

            try:
                data = Path(file_path).read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", ct)
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(data)
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode())

        def log_message(self, fmt, *args):
            pass  # 静默日志

    _Handler._files = dict(material_map)
    return HTTPServer(("127.0.0.1", port), _Handler)


def main():
    run_id = "assembler_output"
    out = OutputManager(run_id=run_id)
    logger.info(f"输出目录: {out.run_dir}")

    # 1. 加载方案
    scheme_path = Path("data/runs/scheme_generation_v3/planner/scheme.json")
    scheme = json.loads(scheme_path.read_text(encoding="utf-8"))
    storyboard = scheme.get("storyboard", [])
    logger.info(f"方案: {scheme.get('title', '?')}, {len(storyboard)} 个分镜")

    # 2. 构建素材映射（本地路径）
    local_material_map = build_material_map()
    logger.info(f"素材映射: {len(local_material_map)} 个")

    # 检查分镜素材是否存在
    missing = []
    for f in storyboard:
        mid = f.get("material_id") or f.get("source_material_id", "")
        if mid and mid not in local_material_map:
            missing.append(mid)
    if missing:
        logger.warning(f"缺失素材: {missing}")
    else:
        logger.info("所有分镜素材已就绪")

    # 3. 启动自定义 HTTP 服务（通过 material_id 访问）
    http_server = start_material_server(19999, local_material_map)
    server_thread = threading.Thread(target=http_server.serve_forever, daemon=True)
    server_thread.start()
    logger.info("素材 HTTP 服务已启动: http://127.0.0.1:19999/{material_id}")

    # 将本地路径转为 http 格式（带扩展名，便于 Remotion 判断类型）
    def _url_for(mid: str, local_path: str) -> str:
        ext = Path(local_path).suffix  # .mp4, .jpg 等
        return f"http://127.0.0.1:19999/{mid}{ext}"

    http_material_map = {
        mid: _url_for(mid, local_path)
        for mid, local_path in local_material_map.items()
    }

    try:
        # 4. 构建 Remotion inputProps
        input_props = {
            "scheme": scheme,
            "material_map": http_material_map,
        }

        # 5. 写 props JSON 文件
        props_file = REMOTION_DIR / "input_props_assembler.json"
        props_file.write_text(json.dumps(input_props, ensure_ascii=False), encoding="utf-8")
        logger.info(f"inputProps 已写入: {props_file}")

        # 6. 调用 Remotion 渲染
        entry = (REMOTION_DIR / "src/index.ts").resolve().as_posix()
        output = str((out.run_dir / "assembler" / "final_video.mp4").resolve())
        Path(output).parent.mkdir(parents=True, exist_ok=True)

        npx_cmd = "npx.cmd" if sys.platform == "win32" else "npx"
        cmd = [npx_cmd, "remotion", "render", entry, "VideoScheme", output,
               "--props", str(props_file), "--overwrite"]

        logger.info(f"Remotion 渲染中...")
        logger.info(f"  {' '.join(cmd)}")

        result = subprocess.run(cmd, cwd=str(REMOTION_DIR), capture_output=True, text=True, timeout=600)

        # 清理 props 文件
        props_file.unlink(missing_ok=True)

        if result.returncode != 0:
            stderr = result.stderr[-1500:] if result.stderr else "unknown error"
            logger.error(f"Remotion 渲染失败: {stderr}")
            return

        size_mb = Path(output).stat().st_size / 1024 / 1024
        logger.info(f"[OK] 渲染完成: {output}")
        logger.info(f"[OK] 文件大小: {size_mb:.1f}MB")

        # 7. 保存渲染摘要
        summary = {
            "shots": len(storyboard),
            "title": scheme.get("title", ""),
            "output": output,
            "size_mb": round(size_mb, 1),
            "method": "remotion",
            "material_count": len(http_material_map),
        }
        out.save_json("assembler", "render_summary.json", summary)

    finally:
        http_server.shutdown()
        logger.info("HTTP 服务已关闭")


if __name__ == "__main__":
    main()
