# -*- coding: utf-8 -*-
"""批量渲染知识库技法的演示视频。

为 knowledge.json 中每个知识条目渲染一段独立演示短片（Remotion TechniqueDemo 合成），
输出到 web/backend/storage/knowledge_demos/{entry_id}.mp4，供 Web 端知识库卡片播放。

用法：
    python render_knowledge_demos.py              # 渲染全部（跳过已存在）
    python render_knowledge_demos.py --only k_0   # 只渲染指定条目
    python render_knowledge_demos.py --force      # 全部重渲
"""

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

VSE_DIR = Path(__file__).resolve().parent
REMOTION_DIR = VSE_DIR / "remotion"
KNOWLEDGE_JSON = VSE_DIR / "data" / "knowledge_db" / "knowledge.json"
DEMO_OUT_DIR = VSE_DIR.parent / "web" / "backend" / "storage" / "knowledge_demos"

REVEAL_IDS = {"float_up", "scale_burst", "tilt_3d", "glow_fade", "parallax", "split", "blur_in"}
SUBTITLE_IDS = {"typewriter", "neon_sign", "gradient_bar", "scale_bounce", "slide_crop", "letter_fall", "wave", "cinematic"}

# 无 structured_data.id 的抽象剪辑原则 → 演示类型映射
ABSTRACT_TECHNIQUE_MAP = {
    "前3秒抓眼球": ("montage", "hook"),
    "音乐卡点": ("beat", "beat"),
    "5段式情绪设计": ("emotion_arc", "emotion_arc"),
    "前景背景分离": ("reveal", "float_up"),
    "速度对比": ("effect", "speed_ramp_slow"),
    "转场不做重复": ("variety", "variety"),
    "胶片质感": ("effect", "film_grain_dust"),
}


def demo_spec(entry: dict) -> tuple[str, str]:
    """根据知识条目推断 (kind, tech_id)。"""
    etype = entry.get("type", "")
    sd_id = (entry.get("structured_data") or {}).get("id", "")

    if etype == "transition_type":
        return "transition", sd_id or "cut"
    if etype == "effect_type":
        return "effect", sd_id or "film_grain"
    if etype == "packaging_style":
        return "packaging", sd_id or "douyin_travel_fast"
    # editing_technique
    if sd_id in REVEAL_IDS:
        return "reveal", sd_id
    if sd_id in SUBTITLE_IDS:
        return "subtitle", sd_id
    return ABSTRACT_TECHNIQUE_MAP.get(entry.get("title", ""), ("subtitle", "scale_bounce"))


def render_one(entry: dict, timeout: int = 600) -> tuple[bool, str]:
    kind, tech_id = demo_spec(entry)
    props = {"kind": kind, "tech_id": tech_id, "title": entry.get("title", "")}
    props_file = REMOTION_DIR / f"demo_props_{entry['id']}.json"
    props_file.write_text(json.dumps(props, ensure_ascii=False), encoding="utf-8")

    out_path = DEMO_OUT_DIR / f"{entry['id']}.mp4"
    npx_cmd = "npx.cmd" if sys.platform == "win32" else "npx"
    cmd = [
        npx_cmd, "remotion", "render",
        str((REMOTION_DIR / "src/index.ts").resolve().as_posix()),
        "TechniqueDemo",
        str(out_path),
        f"--props={props_file}",
        "--overwrite",
        "--log=error",
    ]
    try:
        result = subprocess.run(cmd, cwd=str(REMOTION_DIR), capture_output=True, timeout=timeout)
        if result.returncode == 0 and out_path.exists():
            return True, f"{out_path.stat().st_size / 1024:.0f}KB"
        stderr = (result.stderr or b"").decode("utf-8", errors="replace")
        return False, stderr[-400:]
    except subprocess.TimeoutExpired:
        return False, f"渲染超时（>{timeout}s）"
    finally:
        props_file.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", help="只渲染指定条目 id（如 k_0）")
    parser.add_argument("--force", action="store_true", help="已存在也重渲")
    args = parser.parse_args()

    entries = json.loads(KNOWLEDGE_JSON.read_text(encoding="utf-8"))
    if isinstance(entries, dict):
        entries = list(entries.get("entries", entries).values())

    DEMO_OUT_DIR.mkdir(parents=True, exist_ok=True)

    todo = []
    for e in entries:
        if args.only and e["id"] != args.only:
            continue
        out = DEMO_OUT_DIR / f"{e['id']}.mp4"
        if out.exists() and not args.force:
            continue
        todo.append(e)

    print(f"共 {len(entries)} 条知识，待渲染 {len(todo)} 条")
    ok, fail = 0, []
    t0 = time.time()
    for i, e in enumerate(todo, 1):
        kind, tech_id = demo_spec(e)
        t1 = time.time()
        success, info = render_one(e)
        cost = time.time() - t1
        if success:
            ok += 1
            print(f"[{i}/{len(todo)}] OK  {e['id']} {e['title']} ({kind}/{tech_id}) {info} {cost:.0f}s", flush=True)
        else:
            fail.append(e["id"])
            print(f"[{i}/{len(todo)}] FAIL {e['id']} {e['title']}: {info}", flush=True)

    print(f"\n完成：成功 {ok}，失败 {len(fail)}，耗时 {time.time() - t0:.0f}s")
    if fail:
        print("失败条目:", ", ".join(fail))
        sys.exit(1)


if __name__ == "__main__":
    main()
