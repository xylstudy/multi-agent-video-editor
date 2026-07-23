import React from "react";
import {
  AbsoluteFill, Sequence, Audio, useCurrentFrame, useVideoConfig,
  interpolate, spring, Easing, Img, staticFile,
} from "remotion";
import { DualTransitionLayer, getRequiredOverlap } from "./components/DualTransitions";
import { FilmGrain, MotionBlur, useSpeedRamp, useWhipPanEnhanced } from "./components/Effects";
import { SceneSubtitle } from "./ForegroundSplit";
import type { TransitionType } from "./types/schema";

// ================================================================
//  TechniqueDemo — 知识库单条技法演示（教学优先，不是成片示例）
//
//  通过 props 指定演示类型与技法 ID，为知识库每个条目渲染独立短片：
//  - transition: 23 种转场（A/B 画面编码 + 放慢转场 + 教学时间轴）
//  - reveal:     7 种前景揭示（前景发光轮廓标注 + 放慢循环 2 次 + 时间轴）
//  - subtitle:   8 种字幕样式（固定示例文案与技法名分离，循环 2 次）
//  - effect:     胶片颗粒/变速/运动模糊/强化甩镜头（前半原片 → 后半特效，前后对比）
//  - packaging:  3 种包装风格预设（配方清单 + 转场名弹标 + 场景链时间轴）
//  - montage / beat / emotion_arc / variety: 抽象剪辑原则演示（统一教学时间轴）
//
//  所有场景在 1080x1920 设计坐标下构建，合成注册为 540x960，
//  由 DesignFrame 整体 scale(0.5) —— 布局与生产渲染完全一致。
// ================================================================

export interface TechniqueDemoProps {
  kind:
    | "transition" | "reveal" | "subtitle" | "effect" | "packaging"
    | "montage" | "beat" | "emotion_arc" | "variety";
  tech_id: string;
  title: string;
}

export function getDemoDuration(kind: string): number {
  switch (kind) {
    case "transition": return 90;  // 30 A段 + 30 放慢转场 + 30 B段（硬切为 4 段循环）
    case "reveal": return 120;     // (背景15 + 揭示30 + 合成15) × 2 循环
    case "subtitle": return 150;   // 75f × 2 循环
    case "effect": return 90;      // 原片 45 + 特效 45 前后对比
    case "packaging": return 116;  // 3 场景链: 44 + 28*2 + 16（见 PackagingDemo）
    case "montage": return 85;     // 大标题 18 + 快切 54 + 定格 13
    case "beat": return 135;       // 8 拍 × 15f + 15f 尾
    case "emotion_arc": return 160;// 5 段: 30×4 + 40
    case "variety": return 158;    // 5 场景链: 26 + (14+12)*3 + 14 + 40
    default: return 75;
  }
}

// ===== 素材 =====

const PHOTOS = [
  "/photos/88250e8474df89bdc677ba059048b55c.jpg",
  "/photos/北京丨这可能是我花的最值的两块钱…_1_小鹿拍全国_来自小红书网页版.jpg",
  "/photos/微信图片_20260602210248_45_11.jpg",
  "/photos/微信图片_20260602210250_46_11.jpg",
  "/photos/微信图片_20260602210252_47_11.jpg",
  "/photos/微信图片_20260602210255_51_11.jpg",
];
const FG_IMG = "/segmented/fg_000.png";
const BG_FOR_FG = PHOTOS[0];

// ===== 设计坐标容器（1080x1920 → scale 到实际画布） =====

const DESIGN_W = 1080;
const DESIGN_H = 1920;

const DesignFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { width } = useVideoConfig();
  const scale = width / DESIGN_W;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      {/* flexShrink:0 必须——否则 AbsoluteFill 的 flex 布局会把 1920 高的容器压缩到画布高度 */}
      <div style={{ width: DESIGN_W, height: DESIGN_H, flexShrink: 0, transform: `scale(${scale})`, transformOrigin: "top left", position: "relative" }}>
        {children}
      </div>
    </AbsoluteFill>
  );
};

// ===== 通用小组件 =====

/** Ken Burns 照片场景（transform 直接作用于 Img，与生产组件 KenBurns 同构） */
const PhotoScene: React.FC<{ img: string; zoom?: number; panY?: number }> = ({ img, zoom = 1.1, panY = -25 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const sp = spring({ fps, frame: Math.min(frame, durationInFrames), config: { damping: 300, stiffness: 200 } });
  const z = interpolate(sp, [0, 1], [1, zoom]);
  const y = interpolate(frame, [0, durationInFrames], [0, panY], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Img
        src={staticFile(img)}
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z}) translateY(${y}px)` }}
      />
    </AbsoluteFill>
  );
};

/** 顶部技法标签 */
const DemoLabel: React.FC<{ title: string; sub?: string }> = ({ title, sub }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateLeft: "clamp" });
  return (
    <div style={{ position: "absolute", top: 56, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, opacity, pointerEvents: "none", zIndex: 30 }}>
      <span style={{ color: "#0ff", fontSize: 30, fontFamily: "'PingFang SC','Microsoft YaHei',monospace", background: "rgba(0,0,0,0.55)", padding: "8px 28px", borderRadius: 8, border: "2px solid rgba(0,255,255,0.35)", letterSpacing: 4 }}>
        {title}
      </span>
      {sub && (
        <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 20, fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif", background: "rgba(0,0,0,0.4)", padding: "4px 18px", borderRadius: 6, letterSpacing: 2 }}>
          {sub}
        </span>
      )}
    </div>
  );
};

/** 右上角阶段角标（原片/特效、背景/前景） */
const PhaseBadge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <div style={{ position: "absolute", top: 170, right: 48, zIndex: 30, backgroundColor: color, borderRadius: 10, padding: "8px 24px", border: "3px solid rgba(255,255,255,0.75)", boxShadow: "0 4px 14px rgba(0,0,0,0.5)", pointerEvents: "none" }}>
    <span style={{ color: "#fff", fontSize: 26, fontWeight: 800, fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif", letterSpacing: 4 }}>
      {text}
    </span>
  </div>
);

/** 运动方向箭头（教学标注） */
const DirectionArrow: React.FC<{ dir: "left" | "right" }> = ({ dir }) => {
  const right = dir === "right";
  return (
    <div style={{ position: "absolute", top: "50%", [right ? "right" : "left"]: 70, transform: "translateY(-50%)", display: "flex", alignItems: "center", zIndex: 25, pointerEvents: "none", opacity: 0.9 }}>
      {!right && <div style={{ width: 0, height: 0, borderTop: "22px solid transparent", borderBottom: "22px solid transparent", borderRight: "34px solid #facc15" }} />}
      <div style={{ width: 90, height: 14, backgroundColor: "#facc15" }} />
      {right && <div style={{ width: 0, height: 0, borderTop: "22px solid transparent", borderBottom: "22px solid transparent", borderLeft: "34px solid #facc15" }} />}
    </div>
  );
};

// ===== transition: 教学版 A → [转场] → B =====
//
// 教学设计（不是成片示例）：
// - 转场统一拉伸到 30 帧（1 秒），生产参数（fade 仅 4 帧）肉眼根本看不清
// - 画面 A 蓝色调 + 角标 / 画面 B 橙色调 + 角标，切换对象一眼可辨
// - 底部时间轴标注「画面A → 转场 → 画面B」，白色播放头实时指示当前位置
// - 硬切（overlap=0）无过渡可看，改为 A→B→A→B 循环 4 次 + 切点白闪标记

const TEACH_PRE = 30;   // 转场前 A 单独展示
const TEACH_TRANS = 30; // 转场时长（放慢）
const TEACH_POST = 30;  // 转场后 B 单独展示

/** 教学画面：照片 + 色调编码 + 大字角标 */
const TeachScene: React.FC<{ img: string; label: "A" | "B" }> = ({ img, label }) => {
  const color = label === "A" ? "#3b82f6" : "#f97316";
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <PhotoScene img={img} />
      <AbsoluteFill style={{ backgroundColor: color, opacity: 0.16, pointerEvents: "none" }} />
      <div style={{
        position: "absolute", top: 220, left: 48, width: 88, height: 88, borderRadius: 44,
        backgroundColor: color, display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontSize: 52, fontWeight: 900, fontFamily: "sans-serif",
        border: "4px solid rgba(255,255,255,0.9)", boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
      }}>
        {label}
      </div>
    </AbsoluteFill>
  );
};

interface TimelineSeg { label: string; frames: number; color: string; isTransition?: boolean }

/** 底部教学时间轴：分段着色 + 播放头，转场段激活时呼吸高亮 */
const TransitionTimeline: React.FC<{ segments: TimelineSeg[] }> = ({ segments }) => {
  const frame = useCurrentFrame();
  const total = segments.reduce((s, x) => s + x.frames, 0);
  const playhead = Math.min(frame / total, 1) * 100;
  const pulse = 0.55 + 0.45 * Math.sin(frame * 0.35);
  let acc = 0;
  return (
    <div style={{ position: "absolute", left: 48, right: 48, bottom: 72, zIndex: 30, pointerEvents: "none" }}>
      <div style={{ position: "relative", display: "flex", height: 64, borderRadius: 10, overflow: "hidden", border: "2px solid rgba(255,255,255,0.5)" }}>
        {segments.map((seg, i) => {
          const start = acc;
          acc += seg.frames;
          const active = frame >= start && frame < acc;
          return (
            <div key={i} style={{
              width: `${(seg.frames / total) * 100}%`, height: "100%",
              backgroundColor: seg.color,
              opacity: seg.isTransition ? (active ? pulse : 0.55) : (active ? 0.95 : 0.45),
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRight: i < segments.length - 1 ? "2px solid rgba(255,255,255,0.6)" : "none",
            }}>
              <span style={{ color: "#fff", fontSize: 22, fontWeight: 700, fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif", textShadow: "0 1px 4px rgba(0,0,0,0.8)", whiteSpace: "nowrap" }}>
                {seg.label}
              </span>
            </div>
          );
        })}
        {/* 播放头 */}
        <div style={{ position: "absolute", left: `${playhead}%`, top: -6, bottom: -6, width: 4, backgroundColor: "#fff", boxShadow: "0 0 8px rgba(255,255,255,0.9)" }} />
      </div>
    </div>
  );
};

/** 标准转场（overlap>0）：放慢到 1 秒 */
const TransitionDemo: React.FC<{ techId: string; title: string }> = ({ techId, title }) => {
  const t = techId as TransitionType;
  if (getRequiredOverlap(t) === 0) {
    return <CutLoopDemo title={title} techId={techId} />;
  }
  return (
    <DesignFrame>
      <Sequence from={0} durationInFrames={TEACH_PRE}>
        <TeachScene img={PHOTOS[0]} label="A" />
      </Sequence>
      <Sequence from={TEACH_PRE} durationInFrames={TEACH_TRANS + TEACH_POST}>
        <DualTransitionLayer
          transitionType={t}
          overlapFrames={TEACH_TRANS}
          totalDurationInFrames={TEACH_TRANS + TEACH_POST}
          currentContent={<TeachScene img={PHOTOS[1]} label="B" />}
          outgoingContent={<TeachScene img={PHOTOS[0]} label="A" />}
        />
      </Sequence>
      <TransitionTimeline segments={[
        { label: "画面 A", frames: TEACH_PRE, color: "#3b82f6" },
        { label: `转场 · ${title}`, frames: TEACH_TRANS, color: "#facc15", isTransition: true },
        { label: "画面 B", frames: TEACH_POST, color: "#f97316" },
      ]} />
      <DemoLabel title={title} sub={`转场 · ${techId} · 放慢至 1 秒演示`} />
    </DesignFrame>
  );
};

/** 硬切：A→B→A→B 循环 4 段，切点白闪 + 时间轴交替标注 */
const CutLoopDemo: React.FC<{ techId: string; title: string }> = ({ techId, title }) => {
  const frame = useCurrentFrame();
  const SEGS = [22, 22, 22, 24]; // 共 90 帧
  const starts = [0, 22, 44, 66];
  const cuts = starts.slice(1);
  const flash = cuts.some((c) => frame - c >= 0 && frame - c <= 2);
  return (
    <DesignFrame>
      {starts.map((s, i) => (
        <Sequence key={i} from={s} durationInFrames={SEGS[i]}>
          <TeachScene img={PHOTOS[i % 2]} label={i % 2 === 0 ? "A" : "B"} />
        </Sequence>
      ))}
      {/* 切点白闪 */}
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: flash ? 0.85 : 0, pointerEvents: "none", zIndex: 25 }} />
      <TransitionTimeline segments={[
        { label: "A", frames: SEGS[0], color: "#3b82f6" },
        { label: "B", frames: SEGS[1], color: "#f97316" },
        { label: "A", frames: SEGS[2], color: "#3b82f6" },
        { label: "B", frames: SEGS[3], color: "#f97316" },
      ]} />
      <DemoLabel title={title} sub={`${techId} · 无过渡直接切换 · 白闪处为切点`} />
    </DesignFrame>
  );
};

// ===== reveal: 前景揭示（教学版） =====
//
// 教学设计：
// - 揭示动作放慢到 30 帧，完整循环 2 次（背景 15f → 揭示 30f → 合成 15f）
// - 前景带发光轮廓 + 右上角「前景」角标，观众一眼认出被揭示对象
// - 底部时间轴标注「背景 → 揭示·技法名 → 合成」

const REVEAL_CYCLE = 60;
const REVEAL_BG = 15;
const REVEAL_DUR = 30;

const useRevealStyle = (reveal: string, revealFrame: number, revealDur: number): React.CSSProperties => {
  const { fps } = useVideoConfig();
  const p = interpolate(revealFrame, [0, revealDur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const sp = spring({ fps, frame: Math.min(revealFrame, revealDur), config: { damping: 14, mass: 0.6, stiffness: 180 } });
  switch (reveal) {
    case "float_up": return { opacity: p, transform: `translateY(${interpolate(sp, [0, 1], [200, 0])}px)` };
    case "scale_burst": return { opacity: p, transform: `scale(${interpolate(sp, [0, 1], [0.3, 1])})` };
    case "tilt_3d": return { opacity: p, transform: `perspective(800px) rotateY(${interpolate(p, [0, 1], [25, 0])}deg)`, filter: `brightness(${interpolate(p, [0, 1], [1.3, 1])})` };
    case "glow_fade": { const g = interpolate(revealFrame, [0, revealDur * 0.6, revealDur], [0, 1.5, 0]); return { opacity: p, filter: `brightness(${1 + g * 0.3}) drop-shadow(0 0 ${g * 20}px rgba(255,215,0,${g * 0.6}))` }; }
    case "parallax": return { opacity: p, transform: `translateX(${Math.sin(revealFrame * 0.02) * 15}px) translateY(${Math.cos(revealFrame * 0.015) * 10}px)`, filter: "drop-shadow(4px 8px 12px rgba(0,0,0,0.4))" };
    case "split": { const s = interpolate(sp, [0, 1], [0, 1]); return { opacity: p, clipPath: `inset(0 ${interpolate(s, [0, 1], [100, 50])}% 0 ${interpolate(s, [0, 1], [0, 50])}%)`, transform: `scale(${interpolate(s, [0, 1], [1.1, 1])})` }; }
    case "blur_in": return { opacity: p, filter: `blur(${interpolate(p, [0, 1], [15, 0])}px)` };
    default: return { opacity: p };
  }
};

const RevealDemo: React.FC<{ techId: string; title: string }> = ({ techId, title }) => {
  const frame = useCurrentFrame();
  const local = frame % REVEAL_CYCLE;
  const fgVisible = local >= REVEAL_BG;
  const revealFrame = Math.min(Math.max(0, local - REVEAL_BG), REVEAL_DUR);
  // parallax 是持续漂移型，不截断帧号，让它在合成阶段继续漂
  const styleFrame = techId === "parallax" ? Math.max(0, local - REVEAL_BG) : revealFrame;
  const fgStyle = useRevealStyle(techId, styleFrame, REVEAL_DUR);
  const seg = (label: string, frames: number, color: string, isTransition?: boolean): TimelineSeg => ({ label, frames, color, isTransition });
  return (
    <DesignFrame>
      <PhotoScene img={BG_FOR_FG} />
      <AbsoluteFill style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.3) 0%, transparent 40%, transparent 70%, rgba(0,0,0,0.15) 100%)", pointerEvents: "none" }} />
      {fgVisible && (
        /* 发光轮廓：标出"前景"到底在哪 */
        <AbsoluteFill style={{ filter: "drop-shadow(0 0 20px rgba(34,211,238,0.9))", pointerEvents: "none" }}>
          <AbsoluteFill style={fgStyle}>
            <Img src={staticFile(FG_IMG)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </AbsoluteFill>
        </AbsoluteFill>
      )}
      <PhaseBadge text={fgVisible ? "前景" : "背景"} color={fgVisible ? "#0891b2" : "#4b5563"} />
      <TransitionTimeline segments={[
        seg("背景", REVEAL_BG, "#4b5563"),
        seg(`揭示 · ${title}`, REVEAL_DUR, "#facc15", true),
        seg("合成", REVEAL_CYCLE - REVEAL_BG - REVEAL_DUR, "#10b981"),
        seg("背景", REVEAL_BG, "#4b5563"),
        seg(`揭示 · ${title}`, REVEAL_DUR, "#facc15", true),
        seg("合成", REVEAL_CYCLE - REVEAL_BG - REVEAL_DUR, "#10b981"),
      ]} />
      <DemoLabel title={title} sub={`前景揭示 · ${techId} · 循环 2 次`} />
    </DesignFrame>
  );
};

// ===== subtitle: 字幕样式（教学版） =====
//
// 教学设计：
// - 固定示例文案「示例字幕 ABC123」，与顶部技法名标签区分开——谁是被演示对象一目了然
// - 动画完整播放后整体循环 1 次（typewriter 等慢动画也能看全）

const SUB_CYCLE = 75;

const SubtitleDemo: React.FC<{ techId: string; title: string }> = ({ techId, title }) => {
  const frame = useCurrentFrame();
  const local = frame % SUB_CYCLE;
  return (
    <DesignFrame>
      <PhotoScene img={PHOTOS[2]} />
      <SceneSubtitle text="示例字幕 ABC123" frame={local} style={techId as never} />
      <DemoLabel title={title} sub={`字幕样式 · ${techId} · 示例文案循环 2 次`} />
    </DesignFrame>
  );
};

// ===== effect: 特效（前后对比教学版） =====
//
// 教学设计：
// - 前半段原片（右上角「原片」灰标）→ 后半段特效（「特效」蓝标），同机位素材直接对比
// - 变速加「匀速/变速」双进度条，把不可见的时间重映射画出来
// - 运动模糊 / 甩镜头加运动方向箭头
// - 颗粒类在演示中加大强度（生产 0.18 在 540×960 下不易察觉，演示提到 0.3+ ）

const EFFECT_PHASE = 45;

/** 匀速缩放（speed_ramp 对照组，与变速组起止参数一致） */
const LinearZoomPhoto: React.FC<{ img: string; f: number; duration: number }> = ({ img, f, duration }) => {
  const z = interpolate(f, [0, duration], [1, 1.35], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(f, [0, duration], [0, -60], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Img src={staticFile(img)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z}) translateY(${y}px)` }} />
    </AbsoluteFill>
  );
};

/** 匀速平移（motion_blur 对照组） */
const SlidePhoto: React.FC<{ img: string; f: number; duration: number }> = ({ img, f, duration }) => {
  const x = interpolate(f, [0, duration], [120, -120], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill style={{ transform: `translateX(${x}px)` }}>
        <Img src={staticFile(img)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 慢速平移（whip_pan 对照组） */
const PanPhoto: React.FC<{ img: string; f: number; duration: number }> = ({ img, f, duration }) => {
  const x = interpolate(f, [0, duration], [60, -60], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill style={{ transform: `translateX(${x}px)` }}>
        <Img src={staticFile(img)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 匀速/变速双进度条：把时间重映射可视化 */
const RampBars: React.FC<{ linear: number; ramp: number }> = ({ linear, ramp }) => (
  <div style={{ position: "absolute", left: 48, right: 48, bottom: 160, zIndex: 25, display: "flex", flexDirection: "column", gap: 14, pointerEvents: "none" }}>
    {[{ label: "匀速", v: linear, c: "#9ca3af" }, { label: "变速", v: ramp, c: "#facc15" }].map((b) => (
      <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ width: 64, color: "#fff", fontSize: 22, fontWeight: 700, fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>{b.label}</span>
        <div style={{ flex: 1, height: 18, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.35)", overflow: "hidden" }}>
          <div style={{ width: `${Math.min(1, Math.max(0, b.v)) * 100}%`, height: "100%", backgroundColor: b.c }} />
        </div>
      </div>
    ))}
  </div>
);

const SpeedRampPhoto: React.FC<{ rampType: "beat_hit" | "slow_fast"; f: number; duration: number; showBars?: boolean }> = ({ rampType, f, duration, showBars }) => {
  const p = useSpeedRamp({ frame: f, duration, rampType });
  const z = interpolate(p, [0, 1], [1, 1.35], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(p, [0, 1], [0, -60], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Img
        src={staticFile(PHOTOS[3])}
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z}) translateY(${y}px)` }}
      />
      {showBars && <RampBars linear={f / duration} ramp={p} />}
    </AbsoluteFill>
  );
};

const MotionBlurPhoto: React.FC<{ f: number; duration: number }> = ({ f, duration }) => {
  const x = interpolate(f, [0, duration], [120, -120], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const intensity = interpolate(f, [0, 8, duration - 8, duration], [0.1, 0.7, 0.7, 0.1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill style={{ transform: `translateX(${x}px)` }}>
        <Img src={staticFile(PHOTOS[4])} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <MotionBlur intensity={intensity} direction="horizontal" />
    </AbsoluteFill>
  );
};

const WhipPanPhoto: React.FC<{ f: number }> = ({ f }) => {
  const style = useWhipPanEnhanced(Math.min(f, 22), 22, "right");
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill style={style}>
        <Img src={staticFile(PHOTOS[5])} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const EffectDemo: React.FC<{ techId: string; title: string }> = ({ techId, title }) => {
  const frame = useCurrentFrame();
  const isFx = frame >= EFFECT_PHASE;
  const local = isFx ? frame - EFFECT_PHASE : frame;

  let baseline: React.ReactNode;
  let fx: React.ReactNode;
  if (techId === "film_grain" || techId === "film_grain_dust") {
    const dust = techId === "film_grain_dust";
    baseline = <PhotoScene img={PHOTOS[4]} />;
    fx = (
      <>
        <PhotoScene img={PHOTOS[4]} />
        {dust && <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)", pointerEvents: "none" }} />}
        <FilmGrain opacity={dust ? 0.35 : 0.3} type={dust ? "dust" : "film"} />
      </>
    );
  } else if (techId === "speed_ramp" || techId === "speed_ramp_slow") {
    const rampType = techId === "speed_ramp" ? ("beat_hit" as const) : ("slow_fast" as const);
    baseline = <LinearZoomPhoto img={PHOTOS[3]} f={local} duration={EFFECT_PHASE} />;
    fx = <SpeedRampPhoto rampType={rampType} f={local} duration={EFFECT_PHASE} showBars />;
  } else if (techId === "motion_blur") {
    baseline = <SlidePhoto img={PHOTOS[4]} f={local} duration={EFFECT_PHASE} />;
    fx = <><MotionBlurPhoto f={local} duration={EFFECT_PHASE} /><DirectionArrow dir="left" /></>;
  } else if (techId === "whip_pan_enhanced") {
    baseline = <PanPhoto img={PHOTOS[5]} f={local} duration={EFFECT_PHASE} />;
    fx = <><WhipPanPhoto f={local} /><DirectionArrow dir="right" /></>;
  } else {
    baseline = <PhotoScene img={PHOTOS[4]} />;
    fx = <PhotoScene img={PHOTOS[4]} />;
  }

  return (
    <DesignFrame>
      {isFx ? fx : baseline}
      <PhaseBadge text={isFx ? "特效" : "原片"} color={isFx ? "#0891b2" : "#4b5563"} />
      <DemoLabel title={title} sub={`特效 · ${techId} · 前半原片 → 后半特效`} />
    </DesignFrame>
  );
};

// ===== packaging: 风格预设组合（教学版：配方清单 + 转场弹标 + 时间轴） =====
//
// 教学设计：
// - 画面左下固定「配方清单」：这条风格 = 哪些转场 + 哪种字幕 + 多少颗粒
// - 每次转场时弹出转场名标签，风格差异不再靠悟
// - 底部时间轴标注「场景 → 转场 → 场景」

const PACKAGING_D = 44;
const PACKAGING_O = 16;

const TRANSITION_NAMES: Record<string, string> = {
  whip: "甩镜头", zoom_flash: "缩放闪光", glitch: "故障抖动",
  fade: "淡入", blur_in: "模糊清晰", circle_reveal: "圆形展开",
  spin: "360°旋转", zoom_heavy: "重度缩放", freeze_frame: "冻结帧",
};
const SUBTITLE_NAMES: Record<string, string> = {
  neon_sign: "霓虹发光", cinematic: "电影黑条", gradient_bar: "渐变条",
};

/** 在 Sequence 内读取相对帧驱动字幕动画（转场结束后开始） */
const SceneSubtitleLive: React.FC<{ text: string; style: string }> = ({ text, style }) => {
  const frame = useCurrentFrame();
  return <SceneSubtitle text={text} frame={Math.max(0, frame - PACKAGING_O)} style={style as never} />;
};

/** 转场窗口内弹出的转场名标签（仅在转场的前 O 帧显示） */
const TransitionPopup: React.FC<{ label: string; showFrames: number }> = ({ label, showFrames }) => {
  const frame = useCurrentFrame();
  if (frame >= showFrames) return null;
  return (
    <div style={{ position: "absolute", bottom: 180, left: 0, right: 0, textAlign: "center", pointerEvents: "none", zIndex: 25 }}>
      <span style={{ color: "#ff0", fontSize: 26, fontFamily: "'PingFang SC','Microsoft YaHei',monospace", background: "rgba(0,0,0,0.55)", padding: "4px 22px", borderRadius: 6, letterSpacing: 3 }}>
        {label}
      </span>
    </div>
  );
};

const PROFILES: Record<string, { transitions: TransitionType[]; subtitle: string; grain: number; hint: string }> = {
  douyin_travel_fast: { transitions: ["whip", "zoom_flash", "glitch"], subtitle: "neon_sign", grain: 0, hint: "快节奏 · 高频转场 · 音乐卡点" },
  douyin_travel_cinematic: { transitions: ["fade", "blur_in", "circle_reveal"], subtitle: "cinematic", grain: 0.12, hint: "电影感 · 慢节奏 · 情绪渲染" },
  douyin_travel_creative: { transitions: ["spin", "zoom_heavy", "freeze_frame"], subtitle: "gradient_bar", grain: 0.1, hint: "创意风 · 前景分离 · 特效字幕" },
};

const PackagingDemo: React.FC<{ techId: string; title: string }> = ({ techId, title }) => {
  const profile = PROFILES[techId] ?? PROFILES["douyin_travel_fast"];
  const t1 = profile.transitions[0];
  const t2 = profile.transitions[1];
  return (
    <DesignFrame>
      {[0, 1, 2].map((i) => {
        const isFirst = i === 0;
        const from = i * (PACKAGING_D - PACKAGING_O);
        const dur = isFirst ? PACKAGING_D : PACKAGING_D + PACKAGING_O;
        const transition = isFirst ? ("cut" as TransitionType) : profile.transitions[i - 1];
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <DualTransitionLayer
              transitionType={transition}
              overlapFrames={isFirst ? 0 : PACKAGING_O}
              totalDurationInFrames={dur}
              currentContent={
                <AbsoluteFill>
                  <PhotoScene img={PHOTOS[i]} />
                  {profile.grain > 0 && <FilmGrain opacity={profile.grain} type="film" />}
                  {i === 1 && <SceneSubtitleLive text={profile.hint} style={profile.subtitle} />}
                </AbsoluteFill>
              }
              outgoingContent={isFirst ? null : <PhotoScene img={PHOTOS[i - 1]} />}
            />
            {!isFirst && (
              <TransitionPopup label={`转场 · ${TRANSITION_NAMES[transition] ?? transition}`} showFrames={PACKAGING_O} />
            )}
          </Sequence>
        );
      })}
      {/* 配方清单 */}
      <div style={{ position: "absolute", left: 48, bottom: 170, zIndex: 25, backgroundColor: "rgba(0,0,0,0.55)", border: "2px solid rgba(255,255,255,0.25)", borderRadius: 10, padding: "12px 20px", pointerEvents: "none" }}>
        <div style={{ color: "#0ff", fontSize: 20, fontWeight: 700, fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif", letterSpacing: 2, marginBottom: 6 }}>风格配方</div>
        <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 19, fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif", lineHeight: 1.7 }}>
          转场：{profile.transitions.map((t) => TRANSITION_NAMES[t] ?? t).join(" / ")}<br />
          字幕：{SUBTITLE_NAMES[profile.subtitle] ?? profile.subtitle}<br />
          颗粒：{profile.grain > 0 ? `胶片 ×${profile.grain}` : "无"}
        </div>
      </div>
      <TransitionTimeline segments={[
        { label: "场景 1", frames: 28, color: "#3b82f6" },
        { label: TRANSITION_NAMES[t1] ?? t1, frames: PACKAGING_O, color: "#facc15", isTransition: true },
        { label: "场景 2", frames: 12, color: "#f97316" },
        { label: TRANSITION_NAMES[t2] ?? t2, frames: PACKAGING_O, color: "#facc15", isTransition: true },
        { label: "场景 3", frames: 44, color: "#10b981" },
      ]} />
      <DemoLabel title={title} sub={`包装风格 · ${techId}`} />
    </DesignFrame>
  );
};

// ===== montage: 前3秒抓眼球（大标题 + 快切） =====

const MontageDemo: React.FC<{ title: string }> = ({ title }) => {
  const frame = useCurrentFrame();
  const TITLE_DUR = 18;
  const CUT = 9;
  const timeline = (
    <TransitionTimeline segments={[
      { label: "大标题 Hook", frames: TITLE_DUR, color: "#ef4444" },
      { label: "快切 ×6", frames: 54, color: "#f59e0b" },
      { label: "定格", frames: 13, color: "#6b7280" },
    ]} />
  );
  if (frame < TITLE_DUR) {
    const sp = spring({ fps: 30, frame: Math.min(frame, TITLE_DUR), config: { damping: 12, mass: 0.5, stiffness: 160 } });
    return (
      <DesignFrame>
        <AbsoluteFill style={{ background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)" }}>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 88, fontWeight: "bold", color: "#fff", fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif", transform: `scale(${interpolate(sp, [0, 1], [0.2, 1])})`, letterSpacing: 8, textShadow: "0 0 60px rgba(100,100,255,0.8)" }}>
              震撼开场
            </div>
          </div>
        </AbsoluteFill>
        <DemoLabel title={title} sub="前 3 秒：大标题强冲击" />
        {timeline}
      </DesignFrame>
    );
  }
  const f = frame - TITLE_DUR;
  const idx = Math.min(Math.floor(f / CUT), 5);
  const local = f - idx * CUT;
  const zoom = interpolate(local, [0, CUT], [1.25, 1.0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <DesignFrame>
      <AbsoluteFill style={{ backgroundColor: "#000", transform: `scale(${zoom})` }}>
        <Img src={staticFile(PHOTOS[idx])} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      {local < 2 && idx > 0 && <AbsoluteFill style={{ backgroundColor: "#fff", opacity: interpolate(local, [0, 2], [0.6, 0]), pointerEvents: "none" }} />}
      <DemoLabel title={title} sub="大标题后接快速切换，3 秒内抓住注意力" />
      {timeline}
    </DesignFrame>
  );
};

// ===== beat: 音乐卡点（节拍指示点已具备教学性，保持原设计） =====

const BeatDemo: React.FC<{ title: string }> = ({ title }) => {
  const frame = useCurrentFrame();
  const BEAT = 15;
  const idx = Math.min(Math.floor(frame / BEAT), 7);
  const local = frame - idx * BEAT;
  const punch = interpolate(local, [0, 5, BEAT], [1.18, 1.02, 1.06], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <DesignFrame>
      <Audio src={staticFile("bgm.mp3")} volume={0.7} />
      <AbsoluteFill style={{ backgroundColor: "#000", transform: `scale(${punch})` }}>
        <Img src={staticFile(PHOTOS[idx % PHOTOS.length])} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      {local < 2 && <AbsoluteFill style={{ backgroundColor: "#fff", opacity: interpolate(local, [0, 2], [0.45, 0]), pointerEvents: "none" }} />}
      {/* 节拍指示点 */}
      <div style={{ position: "absolute", bottom: 120, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 18, pointerEvents: "none" }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ width: 18, height: 18, borderRadius: 9, background: i <= idx ? "#0ff" : "rgba(255,255,255,0.25)", transform: `scale(${i === idx ? 1.4 : 1})` }} />
        ))}
      </div>
      <DemoLabel title={title} sub="画面切换与音乐节拍对齐" />
    </DesignFrame>
  );
};

// ===== emotion_arc: 5 段式情绪设计（补教学时间轴） =====

const EMOTION_SEGS = [
  { label: "① 开场 Hook", hint: "强冲击抓住注意力", photos: 1, fast: true },
  { label: "② 铺垫发展", hint: "节奏放缓，展示场景", photos: 1, fast: false },
  { label: "③ 情绪高潮", hint: "快速切换推高情绪", photos: 3, fast: true },
  { label: "④ 回落舒缓", hint: "慢下来，留白", photos: 1, fast: false },
  { label: "⑤ 收尾余韵", hint: "胶片颗粒 + 渐隐", photos: 1, fast: false, grain: true },
];

const EmotionArcDemo: React.FC<{ title: string }> = ({ title }) => {
  const frame = useCurrentFrame();
  const SEG = 30;
  const segIdx = Math.min(Math.floor(frame / SEG), 4);
  const seg = EMOTION_SEGS[segIdx];
  const local = frame - segIdx * SEG;

  let content: React.ReactNode;
  if (seg.photos === 3) {
    const CUT = 10;
    const pIdx = Math.min(Math.floor(local / CUT), 2);
    const pLocal = local - pIdx * CUT;
    const zoom = interpolate(pLocal, [0, CUT], [1.2, 1.0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    content = (
      <AbsoluteFill style={{ backgroundColor: "#000", transform: `scale(${zoom})` }}>
        <Img src={staticFile(PHOTOS[(segIdx + pIdx) % PHOTOS.length])} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
    );
  } else {
    content = (
      <Sequence from={segIdx * SEG} durationInFrames={SEG}>
        <PhotoScene img={PHOTOS[segIdx % PHOTOS.length]} zoom={seg.fast ? 1.3 : 1.06} panY={seg.fast ? -60 : -12} />
      </Sequence>
    );
  }

  const bannerP = interpolate(local, [0, 6], [0, 1], { extrapolateLeft: "clamp" });
  return (
    <DesignFrame>
      {content}
      {seg.grain && <FilmGrain opacity={0.2} type="film" />}
      {segIdx === 4 && <AbsoluteFill style={{ backgroundColor: "#000", opacity: interpolate(local, [SEG - 12, SEG], [0, 0.8], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), pointerEvents: "none" }} />}
      <div style={{ position: "absolute", bottom: 200, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, opacity: bannerP, pointerEvents: "none" }}>
        <span style={{ color: "#ffd700", fontSize: 40, fontWeight: "bold", fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif", textShadow: "2px 2px 16px rgba(0,0,0,0.9)", letterSpacing: 4 }}>{seg.label}</span>
        <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 24, fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif", textShadow: "2px 2px 10px rgba(0,0,0,0.9)", letterSpacing: 2 }}>{seg.hint}</span>
      </div>
      <TransitionTimeline segments={[
        { label: "开场", frames: 30, color: "#ef4444" },
        { label: "铺垫", frames: 30, color: "#3b82f6" },
        { label: "高潮", frames: 30, color: "#f59e0b" },
        { label: "回落", frames: 30, color: "#6366f1" },
        { label: "收尾", frames: 40, color: "#10b981" },
      ]} />
      <DemoLabel title={title} sub="开场→铺垫→高潮→回落→收尾" />
    </DesignFrame>
  );
};

// ===== variety: 转场不做重复（教学版：4 种转场连播 + 弹标 + 时间轴） =====

const VARIETY_TRANSITIONS: { t: TransitionType; name: string }[] = [
  { t: "whip", name: "甩镜头" },
  { t: "glitch", name: "故障抖动" },
  { t: "spin", name: "360°旋转" },
  { t: "zoom_flash", name: "缩放闪光" },
];

const VARIETY_D = 40;
const VARIETY_O = 14;

const VarietyDemo: React.FC<{ title: string }> = ({ title }) => {
  const scenes = VARIETY_TRANSITIONS.length + 1;
  return (
    <DesignFrame>
      {Array.from({ length: scenes }).map((_, i) => {
        const isFirst = i === 0;
        const from = i * (VARIETY_D - VARIETY_O);
        const dur = isFirst ? VARIETY_D : VARIETY_D + VARIETY_O;
        const vt = isFirst ? null : VARIETY_TRANSITIONS[i - 1];
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <DualTransitionLayer
              transitionType={vt ? vt.t : "cut"}
              overlapFrames={isFirst ? 0 : VARIETY_O}
              totalDurationInFrames={dur}
              currentContent={<PhotoScene img={PHOTOS[i % PHOTOS.length]} />}
              outgoingContent={isFirst ? null : <PhotoScene img={PHOTOS[(i - 1) % PHOTOS.length]} />}
            />
            {vt && <TransitionPopup label={`转场 ${i} · ${vt.name}`} showFrames={VARIETY_O} />}
          </Sequence>
        );
      })}
      <TransitionTimeline segments={[
        { label: "场景 1", frames: 26, color: "#3b82f6" },
        { label: "甩镜头", frames: 14, color: "#facc15", isTransition: true },
        { label: "场景 2", frames: 12, color: "#f97316" },
        { label: "故障", frames: 14, color: "#facc15", isTransition: true },
        { label: "场景 3", frames: 12, color: "#3b82f6" },
        { label: "旋转", frames: 14, color: "#facc15", isTransition: true },
        { label: "场景 4", frames: 12, color: "#f97316" },
        { label: "闪光", frames: 14, color: "#facc15", isTransition: true },
        { label: "场景 5", frames: 40, color: "#10b981" },
      ]} />
      <DemoLabel title={title} sub="相邻镜头不重复同一种转场" />
    </DesignFrame>
  );
};

// ===== 主组件 =====

export const TechniqueDemo: React.FC<TechniqueDemoProps> = ({ kind, tech_id, title }) => {
  switch (kind) {
    case "transition": return <TransitionDemo techId={tech_id} title={title} />;
    case "reveal": return <RevealDemo techId={tech_id} title={title} />;
    case "subtitle": return <SubtitleDemo techId={tech_id} title={title} />;
    case "effect": return <EffectDemo techId={tech_id} title={title} />;
    case "packaging": return <PackagingDemo techId={tech_id} title={title} />;
    case "montage": return <MontageDemo title={title} />;
    case "beat": return <BeatDemo title={title} />;
    case "emotion_arc": return <EmotionArcDemo title={title} />;
    case "variety": return <VarietyDemo title={title} />;
    default: return <SubtitleDemo techId="scale_bounce" title={title} />;
  }
};
