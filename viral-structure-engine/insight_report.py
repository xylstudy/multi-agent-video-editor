"""洞察报告生成器 — 自包含 HTML（内联 SVG + 原生 JS，零外部依赖，离线可打开）。

产出内容：
- 洞察总览表（5 维统计结论 + 置信度徽章）
- 每个视频的镜头时间线（色块=镜头类型，点击展开轨迹详情）
- 情绪弧线 + 节奏强度双折线图
- 镜头类型 / 转场分布条形图
"""
import html
import json
from pathlib import Path

from knowledge.insight_miner import ARC_SEGMENTS, VideoAnalysisData

SHOT_TYPE_COLORS = {
    "hook": "#e5484d",
    "scene_establish": "#0091ff",
    "daily_moment": "#30a46c",
    "emotion_peak": "#f76b15",
    "persona_expression": "#8e4ec6",
    "info_card": "#12a594",
    "closing_moment": "#d6409f",
    "transition": "#8c8c8c",
    "cta": "#3e63dd",
    "unknown": "#c4c4c4",
}

# 情绪 → 纵向位置（未知情绪落在中位）
EMOTION_LEVELS = ["忧郁", "平静", "治愈", "温馨", "期待", "好奇", "活力", "欢乐", "热血", "震撼"]

CONFIDENCE_LABELS = {"high": "高置信", "medium": "中置信", "low": "样本不足"}
CONFIDENCE_COLORS = {"high": "#30a46c", "medium": "#f76b15", "low": "#c4c4c4"}

SVG_W = 920
TIMELINE_H = 44
ARC_H = 120


def _emotion_level(emotion: str) -> float:
    if emotion in EMOTION_LEVELS:
        return EMOTION_LEVELS.index(emotion)
    return len(EMOTION_LEVELS) / 2


def _esc(text: str) -> str:
    return html.escape(str(text), quote=True)


def _shot_color(shot_type: str) -> str:
    return SHOT_TYPE_COLORS.get(shot_type, SHOT_TYPE_COLORS["unknown"])


def _timeline_svg(video: VideoAnalysisData, video_idx: int) -> str:
    """镜头时间线：色块宽度=时长（无时间则均分），点击展开详情。"""
    shots = video.shots
    if not shots:
        return "<p class='muted'>无镜头数据</p>"
    total = video.duration if video.duration > 0 else (shots[-1].end if shots[-1].end > 0 else 0)
    use_time = total > 0 and any(s.duration > 0 for s in shots)
    if not use_time:
        total = len(shots)

    rects = []
    legend_types = []
    for s in shots:
        if use_time:
            x = s.start / total * SVG_W
            w = max(2.0, s.duration / total * SVG_W)
        else:
            x = s.index / total * SVG_W
            w = SVG_W / total - 1
        color = _shot_color(s.shot_type)
        if s.shot_type not in legend_types:
            legend_types.append(s.shot_type)
        label = _esc(s.shot_type)
        dur = f"{s.duration:.1f}s" if s.duration > 0 else ""
        rects.append(
            f"<rect x='{x:.1f}' y='8' width='{w:.1f}' height='{TIMELINE_H}' rx='3' "
            f"fill='{color}' class='shot' "
            f"onclick='showDetail({video_idx},{s.index})'>"
            f"<title>镜头{s.index + 1} {label} {dur}</title></rect>"
        )
        if w > 46:
            rects.append(
                f"<text x='{x + w / 2:.1f}' y='{8 + TIMELINE_H / 2 + 4}' text-anchor='middle' "
                f"font-size='11' fill='#fff' pointer-events='none'>{s.index + 1}</text>"
            )

    legend = " ".join(
        f"<span class='legend'><i style='background:{_shot_color(t)}'></i>{_esc(t)}</span>"
        for t in legend_types
    )
    return (
        f"<div class='legend-row'>{legend}</div>"
        f"<svg viewBox='0 0 {SVG_W} {TIMELINE_H + 16}' class='chart'>{''.join(rects)}</svg>"
    )


def _arc_svg(video: VideoAnalysisData) -> str:
    """情绪弧线（阶梯折线）+ 节奏强度（若存在）。"""
    shots = video.shots
    emotions = [s.emotion for s in shots if s.emotion]
    parts = []

    if len(emotions) >= 2:
        pad, usable = 24, SVG_W - 48
        max_lv = len(EMOTION_LEVELS) - 1
        step = usable / (len(emotions) - 1)
        points = " ".join(
            f"{pad + i * step:.1f},{ARC_H - 14 - (_emotion_level(e) / max_lv) * (ARC_H - 28):.1f}"
            for i, e in enumerate(emotions)
        )
        dots = "".join(
            f"<circle cx='{pad + i * step:.1f}' "
            f"cy='{ARC_H - 14 - (_emotion_level(e) / max_lv) * (ARC_H - 28):.1f}' r='3.5' fill='#8e4ec6'>"
            f"<title>{_esc(e)}</title></circle>"
            for i, e in enumerate(emotions)
        )
        parts.append(f"<polyline points='{points}' fill='none' stroke='#8e4ec6' stroke-width='2'/>{dots}")

    curve = video.rhythm_curve
    if len(curve) >= 2:
        duration = video.duration or max(p.get("time", 0) for p in curve) or 1
        pts = []
        for p in curve:
            t = float(p.get("time", 0))
            intensity = max(0.0, min(1.0, float(p.get("intensity", 0))))
            pts.append(f"{t / duration * SVG_W:.1f},{ARC_H - 10 - intensity * (ARC_H - 24):.1f}")
        parts.append(
            f"<polyline points='{' '.join(pts)}' fill='none' stroke='#f76b15' "
            f"stroke-width='1.5' stroke-dasharray='5 3' opacity='0.8'/>"
        )

    if not parts:
        return "<p class='muted'>无情绪/节奏数据</p>"
    legend = ("<span class='legend'><i style='background:#8e4ec6'></i>情绪弧线</span> "
              + ("<span class='legend'><i style='background:#f76b15'></i>节奏强度</span>" if curve else ""))
    return f"<div class='legend-row'>{legend}</div><svg viewBox='0 0 {SVG_W} {ARC_H}' class='chart'>{''.join(parts)}</svg>"


def _bars(counter: dict, color: str = "#0091ff") -> str:
    if not counter:
        return "<p class='muted'>无数据</p>"
    top = sorted(counter.items(), key=lambda kv: -kv[1])[:8]
    mx = top[0][1] or 1
    rows = "".join(
        f"<div class='bar-row'><span class='bar-label'>{_esc(k)}</span>"
        f"<span class='bar-track'><span class='bar-fill' style='width:{v / mx * 100:.0f}%;background:{color}'></span></span>"
        f"<span class='bar-val'>{v}</span></div>"
        for k, v in top
    )
    return f"<div class='bars'>{rows}</div>"


def _detail_payload(video: VideoAnalysisData) -> list[dict]:
    """合并归一化镜头与详情（轨迹），供前端 drill-down。"""
    details_by_idx = {d.get("index"): d for d in video.shot_details}
    payload = []
    for s in video.shots:
        d = details_by_idx.get(s.index, {})
        analysis = d.get("analysis", {}) or {}
        role = analysis.get("structure_role", {}) if isinstance(analysis, dict) else {}
        payload.append({
            "index": s.index, "shot_type": s.shot_type, "emotion": s.emotion,
            "duration": s.duration, "has_trace": d.get("has_trace", False),
            "reasoning": role.get("reasoning", "") if isinstance(role, dict) else "",
            "prev_context": d.get("prev_context_summary", ""),
            "frames": d.get("frame_paths", []),
            "model": d.get("model", ""),
            "prompt_version": d.get("prompt_version", ""),
            "summary": analysis.get("one_sentence_summary", "") if isinstance(analysis, dict) else "",
        })
    return payload


def generate_report(mined: dict, videos: list[VideoAnalysisData], output: Path) -> Path:
    output.parent.mkdir(parents=True, exist_ok=True)

    # 洞察总览表
    rows = "".join(
        f"<tr><td class='dim'>{_esc(i['dimension'])}</td>"
        f"<td>{_esc(i['finding'])}</td>"
        f"<td class='num'>{i['sample_size']}</td>"
        f"<td><span class='badge' style='background:{CONFIDENCE_COLORS.get(i['confidence'], '#999')}'>"
        f"{CONFIDENCE_LABELS.get(i['confidence'], i['confidence'])}</span></td></tr>"
        for i in mined["insights"]
    )

    # 分布图（跨样本聚合）
    for insight in mined["insights"]:
        if insight["dimension"] == "shot_types":
            overall = insight["data"].get("overall", {})
            front3 = insight["data"].get("front3", {})
        elif insight["dimension"] == "transitions":
            transitions = (insight["data"].get("from_packaging") or
                           insight["data"].get("from_shot_config") or {})

    video_sections = []
    for vi, v in enumerate(videos):
        name = Path(v.video_path).name or Path(v.source).parent.name or f"视频{vi + 1}"
        timing_note = "" if v.has_timing else "<span class='badge' style='background:#c4c4c4'>无镜头时间数据</span>"
        video_sections.append(f"""
<section class="video-card">
  <h3>#{vi + 1} {_esc(name)} <span class="muted">[{v.format}]</span> {timing_note}</h3>
  <p class="muted">结构类型: {_esc(v.structure_type or '?')} ｜ 整体情绪: {_esc(v.overall_emotion or '?')} ｜
     镜头数: {len(v.shots)} ｜ Hook: {_esc(v.hook_method or '?')}</p>
  <h4>镜头时间线 <small class="muted">（点击色块查看推理轨迹）</small></h4>
  {_timeline_svg(v, vi)}
  <h4>情绪弧线 / 节奏强度</h4>
  {_arc_svg(v)}
</section>""")

    details_json = json.dumps(
        [_detail_payload(v) for v in videos], ensure_ascii=False
    ).replace("</", "<\\/")

    page = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>Video Claw 洞察报告</title>
<style>
  body {{ font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; margin: 0; background: #f5f6f8; color: #222; }}
  .wrap {{ max-width: 980px; margin: 0 auto; padding: 24px; }}
  h1 {{ font-size: 22px; }} h3 {{ margin-bottom: 4px; }} h4 {{ margin: 14px 0 6px; font-size: 14px; color: #555; }}
  .muted {{ color: #888; font-size: 12px; font-weight: normal; }}
  table {{ border-collapse: collapse; width: 100%; background: #fff; border-radius: 8px; overflow: hidden; }}
  th, td {{ padding: 10px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; vertical-align: top; }}
  th {{ background: #fafafa; color: #666; font-weight: 600; }}
  td.dim {{ font-weight: 600; white-space: nowrap; }} td.num {{ text-align: center; }}
  .badge {{ color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 10px; white-space: nowrap; }}
  .video-card {{ background: #fff; border-radius: 8px; padding: 16px 20px; margin-top: 18px; }}
  .chart {{ width: 100%; background: #fafbfc; border-radius: 6px; }}
  .shot {{ cursor: pointer; }} .shot:hover {{ opacity: 0.8; stroke: #222; stroke-width: 1; }}
  .legend-row {{ margin: 4px 0; }}
  .legend {{ font-size: 11px; color: #666; margin-right: 12px; }}
  .legend i {{ display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }}
  .bars {{ background: #fff; }} .bar-row {{ display: flex; align-items: center; gap: 8px; margin: 4px 0; font-size: 12px; }}
  .bar-label {{ width: 140px; text-align: right; color: #555; }} .bar-val {{ width: 30px; color: #888; }}
  .bar-track {{ flex: 1; background: #f0f0f0; border-radius: 3px; height: 14px; }}
  .bar-fill {{ display: block; height: 14px; border-radius: 3px; }}
  #detail {{ position: fixed; right: 0; top: 0; width: 380px; height: 100vh; overflow-y: auto;
             background: #fff; box-shadow: -2px 0 12px rgba(0,0,0,.12); padding: 16px;
             display: none; font-size: 13px; }}
  #detail.open {{ display: block; }}
  #detail h4 {{ margin-top: 0; }} #detail pre {{ white-space: pre-wrap; background: #f6f8fa; padding: 8px; border-radius: 6px; font-size: 11px; }}
  .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 18px; }}
  .panel {{ background: #fff; border-radius: 8px; padding: 14px 18px; }}
  @media (max-width: 800px) {{ .grid {{ grid-template-columns: 1fr; }} }}
</style>
</head>
<body>
<div class="wrap">
  <h1>Video Claw 洞察报告 <span class="muted">样本 {mined['sample_size']} 条 · 生成于 {mined['generated_at'][:19]}</span></h1>

  <table>
    <tr><th>维度</th><th>发现</th><th>样本</th><th>置信度</th></tr>
    {rows}
  </table>

  <div class="grid">
    <div class="panel"><h4>镜头类型分布</h4>{_bars(overall)}</div>
    <div class="panel"><h4>转场使用频次</h4>{_bars(transitions, '#f76b15')}</div>
  </div>

  {''.join(video_sections)}
</div>

<div id="detail"><h4>镜头详情 <button onclick="closeDetail()" style="float:right">×</button></h4><div id="detail-body"></div></div>

<script type="application/json" id="details">{details_json}</script>
<script>
const DETAILS = JSON.parse(document.getElementById('details').textContent);
function showDetail(vi, si) {{
  const list = DETAILS[vi] || [];
  const d = list.find(x => x.index === si);
  if (!d) return;
  const el = document.getElementById('detail-body');
  el.innerHTML = `
    <p><b>镜头 ${{d.index + 1}}</b> · ${{d.shot_type}} · 情绪 ${{d.emotion || '?'}} · 时长 ${{d.duration ? d.duration.toFixed(1) + 's' : '?'}}</p>
    <p>${{d.summary || ''}}</p>
    ${{d.reasoning ? '<p><b>结构判断依据：</b>' + d.reasoning + '</p>' : ''}}
    ${{d.prev_context ? '<p><b>继承的上下文：</b>' + d.prev_context + '</p>' : ''}}
    ${{d.frames && d.frames.length ? '<p><b>关键帧：</b>' + d.frames.join('<br>') + '</p>' : ''}}
    <p class="muted">${{d.has_trace ? '轨迹: ' + d.prompt_version + ' / ' + d.model : '无轨迹（历史数据）'}}</p>`;
  document.getElementById('detail').classList.add('open');
}}
function closeDetail() {{ document.getElementById('detail').classList.remove('open'); }}
</script>
</body>
</html>"""
    output.write_text(page, encoding="utf-8")
    return output
