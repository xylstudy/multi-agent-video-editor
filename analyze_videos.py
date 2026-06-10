"""
Analyze Douyin travel vlog editing techniques.
Extracts keyframes, detects scenes, catalogs transitions and effects.
"""
import json, subprocess
from pathlib import Path

FFMPEG = r"D:\Users\15935\AppData\Local\Programs\Python\Python312\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg.exe"
OUTPUT_DIR = Path(r"E:\py pbjects\video_claw\get_video\output")
FRAME_OUT = Path(r"E:\py pbjects\video_claw\get_video\frames_analysis")
FRAME_OUT.mkdir(exist_ok=True)

def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)

def parse_duration(stderr):
    for line in stderr.split("\n"):
        if "Duration" in line:
            d = line.split("Duration:")[1].split(",")[0].strip()
            h, m, s = d.split(":")
            return int(h)*3600 + int(m)*60 + float(s)
    return None

def parse_resolution_fps(stderr):
    res, fps = None, None
    for line in stderr.split("\n"):
        if "Stream #0:0" in line and "Video" in line:
            parts = line.split(",")
            for p in parts:
                p = p.strip()
                if "x" in p and any(c.isdigit() for c in p):
                    res = p.split()[0]
                if "fps" in p:
                    fps = p.split()[0]
            break
    return res, fps

def analyze_video(video_path, video_name):
    result = {"file": video_name}

    # Get video info (ffmpeg outputs to stderr)
    r = run([FFMPEG, "-i", str(video_path)])
    stderr = r.stderr + r.stdout

    dur = parse_duration(stderr)
    res, fps = parse_resolution_fps(stderr)
    result["duration_sec"] = round(dur, 2) if dur else None
    result["resolution"] = res
    result["fps"] = fps

    if not dur:
        return result

    # Extract 1 frame per second max 20 frames
    out_dir = FRAME_OUT / video_name.replace(".mp4", "")
    out_dir.mkdir(exist_ok=True)
    interval = max(1, int(dur / min(dur, 20)))
    frames = []

    for t in range(0, int(dur), interval):
        out_path = out_dir / f"frame_{t:04d}.jpg"
        run([FFMPEG, "-ss", str(t), "-i", str(video_path),
             "-vframes", "1", "-q:v", "2", str(out_path)])
        if out_path.exists():
            frames.append({"time": t, "path": str(out_path)})

    result["sample_frames"] = frames
    return result

def main():
    videos = sorted(OUTPUT_DIR.glob("*/douyin_*.mp4"))
    all_results = {}

    for vp in videos:
        name = vp.name
        print(f"Analyzing: {name} ...")
        info = analyze_video(vp, name)
        all_results[name] = info

        jp = vp.parent / vp.name.replace(".mp4", ".json")
        if jp.exists():
            with open(jp, encoding="utf-8") as f:
                info["meta"] = json.load(f)

        print(f"  Duration: {info.get('duration_sec','?')}s, "
              f"Res: {info.get('resolution','?')}, "
              f"FPS: {info.get('fps','?')}, "
              f"Frames: {len(info.get('sample_frames',[]))}")

    rp = FRAME_OUT / "analysis_summary.json"
    with open(rp, "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False)

    print(f"\nDone! {len(videos)} videos.")
    print(f"Frames: {FRAME_OUT}")


if __name__ == "__main__":
    main()
