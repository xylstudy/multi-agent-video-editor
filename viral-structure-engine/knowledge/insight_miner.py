"""InsightMiner — 跨视频统计挖掘：从多份分析报告中提炼可复用的结构洞察。

兼容两种分析产物格式：
- 新格式：analyze_video.py 产出的 analysis_result.json（单文件，含 shots[] + raw_structure_analysis）
- 旧格式：data/runs/*/analyst/ 下的 shot_analyses.json + structure_analysis.json（两文件）

每条洞察都带 sample_size 和 confidence：样本不足时如实标注，不编造结论。
"""
import json
import logging
from hashlib import sha256
from dataclasses import dataclass, field
from pathlib import Path
from statistics import mean, median

logger = logging.getLogger(__name__)

# 旧格式的 structure_role.primary_function → 统一 shot_type
_SHOT_TYPE_ALIASES = {
    "persona": "persona_expression",
    "persona_expression": "persona_expression",
    "closing": "closing_moment",
    "closing_moment": "closing_moment",
    "cta": "cta",
    "pain_point": "pain_point",
}

# 5 段式情绪弧线分段数
ARC_SEGMENTS = 5


@dataclass
class NormalizedShot:
    index: int
    start: float
    end: float
    duration: float
    shot_type: str
    emotion: str = ""
    transition: str = ""

    def to_dict(self) -> dict:
        return {
            "index": self.index, "start": self.start, "end": self.end,
            "duration": self.duration, "shot_type": self.shot_type,
            "emotion": self.emotion, "transition": self.transition,
        }


@dataclass
class VideoAnalysisData:
    """归一化后的单视频分析数据（两种来源格式统一为此结构）。"""

    source: str = ""                    # 报告文件路径
    video_path: str = ""                # 原始视频路径
    duration: float = 0.0
    format: str = ""                    # "new" | "legacy"
    shots: list[NormalizedShot] = field(default_factory=list)
    hook_method: str = ""
    front_3s_shot_count: int = 0
    structure_type: str = ""
    overall_emotion: str = ""
    transitions_used: list[str] = field(default_factory=list)   # 包装分析里提到的转场
    rhythm_curve: list[dict] = field(default_factory=list)      # [{time, intensity, note}]
    # 轨迹/详情数据（可视化 drill-down 用），来自 analysis_trace.json 或 raw_shot_analyses
    shot_details: list[dict] = field(default_factory=list)

    @property
    def has_timing(self) -> bool:
        """镜头时间是否有效（旧数据可能全为 0）。"""
        return any(s.duration > 0 for s in self.shots)

    def to_dict(self) -> dict:
        return {
            "source": self.source, "video_path": self.video_path,
            "duration": self.duration, "format": self.format,
            "shots": [s.to_dict() for s in self.shots],
            "hook_method": self.hook_method,
            "front_3s_shot_count": self.front_3s_shot_count,
            "structure_type": self.structure_type,
            "overall_emotion": self.overall_emotion,
            "transitions_used": self.transitions_used,
            "rhythm_curve": self.rhythm_curve,
        }


def _norm_shot_type(raw: str) -> str:
    raw = (raw or "").strip()
    return _SHOT_TYPE_ALIASES.get(raw, raw or "unknown")


def normalize_new_format(report_path: Path) -> VideoAnalysisData | None:
    """解析 analysis_result.json（analyze_video.py 新格式）。"""
    try:
        data = json.loads(report_path.read_text(encoding="utf-8"))
    except Exception as e:
        logger.warning(f"解析失败 {report_path}: {e}")
        return None

    shots_raw = data.get("shots") or []
    # 时间全为 0 的旧运行数据：回退到 raw_shot_analyses 取时间
    raw_analyses = data.get("raw_shot_analyses") or []
    timings_bad = not any(s.get("duration", 0) > 0 for s in shots_raw)
    raw_times = {}
    if timings_bad:
        for ra in raw_analyses:
            idx = ra.get("shot_index", ra.get("index", -1))
            if idx >= 0:
                raw_times[idx] = (ra.get("start_time", 0), ra.get("end_time", 0))

    shots = []
    for i, s in enumerate(shots_raw):
        start = float(s.get("start_time", 0) or 0)
        end = float(s.get("end_time", 0) or 0)
        if timings_bad and i in raw_times:
            start, end = raw_times[i]
        stype = _norm_shot_type(s.get("shot_type", ""))
        shots.append(NormalizedShot(
            index=i, start=start, end=end,
            duration=max(0.0, end - start),
            shot_type=stype,
            emotion=s.get("emotion", ""),
            transition=s.get("transition_in", ""),
        ))

    meta = data.get("vlog_meta", {}) or {}
    structure = data.get("raw_structure_analysis", {}) or {}
    packaging = structure.get("packaging_analysis", {}) or {}
    rhythm = structure.get("rhythm_analysis", {}) or {}

    details = []
    trace_path = report_path.parent / "analysis_trace.json"
    if trace_path.exists():
        try:
            trace = json.loads(trace_path.read_text(encoding="utf-8"))
            for st in trace.get("shots", []):
                details.append({
                    "index": st.get("index"),
                    "frame_paths": st.get("frame_paths", []),
                    "prev_context_summary": st.get("prev_context_summary", ""),
                    "model": st.get("model", ""),
                    "prompt_version": st.get("prompt_version", ""),
                    "analysis": st.get("analysis", {}),
                    "has_trace": True,
                })
        except Exception as e:
            logger.warning(f"轨迹解析失败 {trace_path}: {e}")
    if not details:
        # 无轨迹文件：用 raw_shot_analyses 兜底
        details = [{"index": ra.get("shot_index", ra.get("index", i)),
                    "analysis": ra, "has_trace": False}
                   for i, ra in enumerate(raw_analyses)]

    front3 = sum(1 for s in shots if s.start < 3.0 and (s.end > 0 or not data.get("duration")))
    if not data.get("duration") or all(s.end == 0 for s in shots):
        front3 = 0  # 无有效时间时不下结论

    return VideoAnalysisData(
        source=str(report_path),
        video_path=data.get("source_path", ""),
        duration=float(data.get("duration", 0) or 0),
        format="new",
        shots=shots,
        hook_method=meta.get("hook_method", "") or structure.get("hook_strategy", {}).get("method", ""),
        front_3s_shot_count=front3,
        structure_type=meta.get("structure_type", "") or structure.get("structure_type", {}).get("category", ""),
        overall_emotion=meta.get("overall_emotion", "") or structure.get("overall_emotion", ""),
        transitions_used=[t.get("type", "") for t in packaging.get("transitions_used", []) if isinstance(t, dict)],
        rhythm_curve=rhythm.get("curve_points", []) or [],
        shot_details=details,
    )


def normalize_legacy_format(analyst_dir: Path) -> VideoAnalysisData | None:
    """解析旧格式：analyst/ 目录下的 shot_analyses.json + structure_analysis.json。"""
    shots_path = analyst_dir / "shot_analyses.json"
    structure_path = analyst_dir / "structure_analysis.json"
    if not shots_path.exists() or not structure_path.exists():
        return None
    try:
        shots_raw = json.loads(shots_path.read_text(encoding="utf-8"))
        structure = json.loads(structure_path.read_text(encoding="utf-8"))
    except Exception as e:
        logger.warning(f"解析失败 {analyst_dir}: {e}")
        return None

    shots = []
    for i, sa in enumerate(shots_raw):
        start = float(sa.get("start_time", 0) or 0)
        end = float(sa.get("end_time", 0) or 0)
        shots.append(NormalizedShot(
            index=i, start=start, end=end, duration=max(0.0, end - start),
            shot_type=_norm_shot_type(sa.get("structure_role", {}).get("primary_function", "")),
            emotion=sa.get("emotion", ""),
        ))

    packaging = structure.get("packaging_analysis", {}) or {}
    rhythm = structure.get("rhythm_analysis", {}) or {}
    front3 = sum(1 for s in shots if s.start < 3.0) if any(s.end > 0 for s in shots) else 0

    return VideoAnalysisData(
        source=str(analyst_dir),
        video_path="",
        duration=0.0,
        format="legacy",
        shots=shots,
        hook_method=structure.get("hook_strategy", {}).get("method", ""),
        front_3s_shot_count=front3,
        structure_type=structure.get("structure_type", {}).get("category", ""),
        overall_emotion=structure.get("overall_emotion", ""),
        transitions_used=[t.get("type", "") for t in packaging.get("transitions_used", []) if isinstance(t, dict)],
        rhythm_curve=rhythm.get("curve_points", []) or [],
        shot_details=[{"index": sa.get("shot_index", i), "analysis": sa, "has_trace": False}
                      for i, sa in enumerate(shots_raw)],
    )


def discover_analyses(roots: list[Path]) -> list[VideoAnalysisData]:
    """扫描多个根目录，收集所有可读的分析报告（自动去重）。"""
    found: list[VideoAnalysisData] = []
    seen: set[str] = set()
    seen_content: set[str] = set()

    def append_unique(data: VideoAnalysisData | None) -> None:
        if data is None:
            return
        fingerprint_payload = {
            "video": Path(data.video_path).name.lower() if data.video_path else "",
            "duration": data.duration,
            "shots": [shot.to_dict() for shot in data.shots],
            "hook_method": data.hook_method,
            "structure_type": data.structure_type,
            "overall_emotion": data.overall_emotion,
            "transitions_used": data.transitions_used,
        }
        fingerprint = sha256(
            json.dumps(fingerprint_payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
        ).hexdigest()
        if fingerprint in seen_content:
            return
        seen_content.add(fingerprint)
        found.append(data)

    for root in roots:
        if not root.exists():
            continue
        # 新格式：CLI 使用 analysis_result.json，Web 基因提取使用 report.json。
        for filename in ("analysis_result.json", "report.json"):
            for p in sorted(root.rglob(filename)):
                key = str(p.resolve())
                if key in seen:
                    continue
                seen.add(key)
                append_unique(normalize_new_format(p))
        # 旧格式：analyst/shot_analyses.json + structure_analysis.json
        for p in sorted(root.rglob("shot_analyses.json")):
            analyst_dir = p.parent
            key = str(analyst_dir.resolve())
            if key in seen:
                continue
            seen.add(key)
            append_unique(normalize_legacy_format(analyst_dir))

    logger.info(f"发现 {len(found)} 份分析报告")
    return found


def _confidence(n: int) -> str:
    if n >= 5:
        return "high"
    if n >= 2:
        return "medium"
    return "low"


def _fmt_counter(counter: dict, limit: int = 5) -> str:
    if not counter:
        return "无数据"
    items = sorted(counter.items(), key=lambda kv: -kv[1])[:limit]
    return "、".join(f"{k}({v})" for k, v in items)


class InsightMiner:
    """核心 5 维统计：Hook 策略 / 节奏模式 / 镜头类型 / 情绪弧线 / 转场使用。"""

    def __init__(self, videos: list[VideoAnalysisData]):
        self.videos = videos

    def mine(self) -> dict:
        insights = [
            self._mine_hook(),
            self._mine_rhythm(),
            self._mine_shot_types(),
            self._mine_emotion_arc(),
            self._mine_transitions(),
        ]
        return {
            "generated_at": __import__("datetime").datetime.now().isoformat(),
            "sample_size": len(self.videos),
            "videos": [
                {"source": v.source, "video_path": v.video_path, "format": v.format,
                 "duration": v.duration, "shot_count": len(v.shots)}
                for v in self.videos
            ],
            "insights": insights,
        }

    # ---- 1. Hook 策略 ----
    def _mine_hook(self) -> dict:
        timed = [v for v in self.videos if v.front_3s_shot_count > 0]
        with_method = [v for v in self.videos if v.hook_method]
        n = max(len(timed), len(with_method))

        parts = []
        data: dict = {}
        if timed:
            counts = [v.front_3s_shot_count for v in timed]
            data["front_3s_counts"] = counts
            data["avg_front_3s_shots"] = round(mean(counts), 2)
            ge2 = sum(1 for c in counts if c >= 2)
            data["ge2_ratio"] = round(ge2 / len(counts), 2)
            parts.append(f"前3秒平均 {mean(counts):.1f} 个镜头，{ge2}/{len(counts)} 个样本 ≥2 镜")
        if with_method:
            methods: dict[str, int] = {}
            for v in with_method:
                methods[v.hook_method] = methods.get(v.hook_method, 0) + 1
            data["hook_methods"] = methods
            parts.append(f"主要 hook 方法：{_fmt_counter(methods)}")

        return {
            "dimension": "hook", "metric": "front_3s + hook_method",
            "finding": "；".join(parts) if parts else "样本无 hook 数据",
            "sample_size": n, "confidence": _confidence(n),
            "data": data,
            "sources": [v.source for v in self.videos if v.front_3s_shot_count > 0 or v.hook_method],
        }

    # ---- 2. 节奏模式 ----
    def _mine_rhythm(self) -> dict:
        timed = [v for v in self.videos if v.has_timing and v.shots]
        durations = [s.duration for v in timed for s in v.shots if s.duration > 0]
        n = len(timed)
        data: dict = {"video_count": n}
        parts = []
        if durations:
            data["avg_shot_duration"] = round(mean(durations), 2)
            data["median_shot_duration"] = round(median(durations), 2)
            data["min_shot_duration"] = round(min(durations), 2)
            data["max_shot_duration"] = round(max(durations), 2)
            parts.append(f"镜头时长中位数 {median(durations):.1f}s（范围 {min(durations):.1f}~{max(durations):.1f}s）")

        # 位置-时长趋势：前1/3 vs 后1/3
        trends = []
        for v in timed:
            ds = [s.duration for s in v.shots if s.duration > 0]
            if len(ds) >= 6:
                k = max(1, len(ds) // 3)
                head, tail = mean(ds[:k]), mean(ds[-k:])
                trends.append((head, tail))
        if trends:
            heads = [t[0] for t in trends]
            tails = [t[1] for t in trends]
            data["first_third_avg"] = round(mean(heads), 2)
            data["last_third_avg"] = round(mean(tails), 2)
            accel = sum(1 for h, t in trends if t < h)
            data["accelerating_videos"] = accel
            trend_word = "加速" if accel > len(trends) / 2 else "平稳"
            parts.append(f"后1/3段较前1/3段 {trend_word}（{accel}/{len(trends)} 个样本镜头变短）")

        return {
            "dimension": "rhythm", "metric": "shot_duration + position_trend",
            "finding": "；".join(parts) if parts else "样本无有效镜头时间数据",
            "sample_size": n, "confidence": _confidence(n),
            "data": data,
            "sources": [v.source for v in timed],
        }

    # ---- 3. 镜头类型分布 ----
    def _mine_shot_types(self) -> dict:
        n = len(self.videos)
        total: dict[str, int] = {}
        front: dict[str, int] = {}
        front_n = 0
        for v in self.videos:
            for s in v.shots:
                total[s.shot_type] = total.get(s.shot_type, 0) + 1
            head = v.shots[:3]
            if head:
                front_n += 1
                for s in head:
                    front[s.shot_type] = front.get(s.shot_type, 0) + 1

        total_shots = sum(total.values()) or 1
        data = {
            "overall": dict(sorted(total.items(), key=lambda kv: -kv[1])),
            "front3": dict(sorted(front.items(), key=lambda kv: -kv[1])),
            "total_shots": total_shots,
        }
        top = _fmt_counter(total)
        front_top = _fmt_counter(front) if front else "无数据"
        return {
            "dimension": "shot_types", "metric": "type_distribution + front3_concentration",
            "finding": f"全部镜头：{top}；前3镜：{front_top}",
            "sample_size": n, "confidence": _confidence(n),
            "data": data,
            "sources": [v.source for v in self.videos],
        }

    # ---- 4. 情绪弧线 ----
    def _mine_emotion_arc(self) -> dict:
        arcs = []
        for v in self.videos:
            seq = [s.emotion for s in v.shots if s.emotion]
            if len(seq) >= ARC_SEGMENTS:
                arcs.append((v, seq))

        n = len(self.videos)
        parts = []
        data: dict = {"arc_segments": ARC_SEGMENTS, "videos_with_arc": len(arcs)}
        if arcs:
            # 每段的主导情绪跨样本统计
            segment_dominants: list[dict[str, int]] = [{} for _ in range(ARC_SEGMENTS)]
            for v, seq in arcs:
                k = max(1, len(seq) // ARC_SEGMENTS)
                for seg in range(ARC_SEGMENTS):
                    bucket = seq[seg * k:(seg + 1) * k] or seq[-1:]
                    dominant = max(set(bucket), key=bucket.count)
                    segment_dominants[seg][dominant] = segment_dominants[seg].get(dominant, 0) + 1
            data["segment_dominants"] = segment_dominants
            seg_desc = []
            for i, dom in enumerate(segment_dominants):
                if dom:
                    seg_desc.append(f"段{i+1}:{_fmt_counter(dom, 2)}")
            parts.append(" → ".join(seg_desc))
        overall: dict[str, int] = {}
        for v in self.videos:
            if v.overall_emotion:
                overall[v.overall_emotion] = overall.get(v.overall_emotion, 0) + 1
        if overall:
            data["overall_emotions"] = overall
            parts.append(f"整体情绪基调：{_fmt_counter(overall)}")

        return {
            "dimension": "emotion_arc", "metric": "5_segment_arc + overall_emotion",
            "finding": "；".join(parts) if parts else "样本无情绪数据",
            "sample_size": n, "confidence": _confidence(n),
            "data": data,
            "sources": [v.source for v in self.videos if any(s.emotion for s in v.shots)],
        }

    # ---- 5. 转场使用 ----
    def _mine_transitions(self) -> dict:
        n = len(self.videos)
        from_packaging: dict[str, int] = {}
        from_shots: dict[str, int] = {}
        for v in self.videos:
            for t in v.transitions_used:
                if t:
                    from_packaging[t] = from_packaging.get(t, 0) + 1
            for s in v.shots:
                if s.transition:
                    from_shots[s.transition] = from_shots.get(s.transition, 0) + 1

        data = {"from_packaging": dict(sorted(from_packaging.items(), key=lambda kv: -kv[1])),
                "from_shot_config": dict(sorted(from_shots.items(), key=lambda kv: -kv[1]))}
        primary = from_packaging or from_shots
        total_mentions = sum(primary.values()) or 1
        top = sorted(primary.items(), key=lambda kv: -kv[1])[:3]
        parts = []
        if top:
            desc = "、".join(f"{k} {v / total_mentions:.0%}" for k, v in top)
            parts.append(f"高频转场：{desc}")
        else:
            parts.append("样本无转场数据")

        return {
            "dimension": "transitions", "metric": "usage_frequency",
            "finding": "；".join(parts),
            "sample_size": n, "confidence": _confidence(n),
            "data": data,
            "sources": [v.source for v in self.videos if v.transitions_used],
        }
