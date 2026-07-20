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
//  TechniqueDemo — 知识库单条技法演示
//
//  通过 props 指定演示类型与技法 ID，为知识库每个条目渲染独立短片：
//  - transition: 23 种转场（A 照片 → 转场 → B 照片）
//  - reveal:     7 种前景揭示特效（背景 + 前景分离动画）
//  - subtitle:   8 种字幕样式
//  - effect:     胶片颗粒 / 变速 / 运动模糊 / 强化甩镜头
//  - packaging:  3 种包装风格预设组合（转场+字幕+颗粒）
//  - montage / beat / emotion_arc / variety: 抽象剪辑原则演示
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
    case "transition": return 90;  // 教学版: 30 A段 + 30 放慢转场 + 30 B段（硬切为 4 段循环）
    case "reveal": return 80;
    case "subtitle": return 75;
    case "effect": return 80;
    case "packaging": return 94;   // 3 场景链: 3*36 - 14
    case "montage": return 85;
    case "beat": return 135;       // 8 拍 × 15f + 15f 尾
    case "emotion_arc": return 160;
    case "variety": return 104;    // 5 场景链: 5*28 - 3*12
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

// ===== reveal: 背景 + 前景揭示特效 =====

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
  const revealStart = 10;
  const revealFrame = Math.max(0, frame - revealStart);
  const fgStyle = useRevealStyle(techId, revealFrame, 22);
  return (
    <DesignFrame>
      <PhotoScene img={BG_FOR_FG} />
      <AbsoluteFill style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.3) 0%, transparent 40%, transparent 70%, rgba(0,0,0,0.15) 100%)", pointerEvents: "none" }} />
      {frame >= revealStart && (
        <AbsoluteFill style={fgStyle}>
          <Img src={staticFile(FG_IMG)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </AbsoluteFill>
      )}
      <DemoLabel title={title} sub={`前景揭示 · ${techId}`} />
    </DesignFrame>
  );
};

// ===== subtitle: 照片 + 字幕样式 =====

const SubtitleDemo: React.FC<{ techId: string; title: string }> = ({ techId, title }) => {
  const frame = useCurrentFrame();
  return (
    <DesignFrame>
      <PhotoScene img={PHOTOS[2]} />
      <SceneSubtitle text={title} frame={frame} style={techId as never} />
      <DemoLabel title={title} sub={`字幕样式 · ${techId}`} />
    </DesignFrame>
  );
};

// ===== effect: 胶片颗粒 / 变速 / 运动模糊 / 强化甩镜头 =====

const SpeedRampPhoto: React.FC<{ rampType: "beat_hit" | "slow_fast" }> = ({ rampType }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = useSpeedRamp({ frame, duration: durationInFrames, rampType });
  const z = interpolate(p, [0, 1], [1, 1.35], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(p, [0, 1], [0, -60], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Img
        src={staticFile(PHOTOS[3])}
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z}) translateY(${y}px)` }}
      />
    </AbsoluteFill>
  );
};

const MotionBlurPhoto: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const x = interpolate(frame, [0, durationInFrames], [120, -120], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const intensity = interpolate(frame, [0, 8, durationInFrames - 8, durationInFrames], [0.1, 0.7, 0.7, 0.1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill style={{ transform: `translateX(${x}px)` }}>
        <Img src={staticFile(PHOTOS[4])} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <MotionBlur intensity={intensity} direction="horizontal" />
    </AbsoluteFill>
  );
};

const WhipPanPhoto: React.FC = () => {
  const frame = useCurrentFrame();
  const style = useWhipPanEnhanced(frame, 22, "right");
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill style={style}>
        <Img src={staticFile(PHOTOS[5])} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const EffectDemo: React.FC<{ techId: string; title: string }> = ({ techId, title }) => {
  return (
    <DesignFrame>
      {techId === "film_grain" && (<><PhotoScene img={PHOTOS[4]} /><FilmGrain opacity={0.18} type="film" /></>)}
      {techId === "film_grain_dust" && (<><PhotoScene img={PHOTOS[4]} /><AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)", pointerEvents: "none" }} /><FilmGrain opacity={0.28} type="dust" /></>)}
      {techId === "speed_ramp" && <SpeedRampPhoto rampType="beat_hit" />}
      {techId === "speed_ramp_slow" && <SpeedRampPhoto rampType="slow_fast" />}
      {techId === "motion_blur" && <MotionBlurPhoto />}
      {techId === "whip_pan_enhanced" && <WhipPanPhoto />}
      <DemoLabel title={title} sub={`特效 · ${techId}`} />
    </DesignFrame>
  );
};

// ===== packaging: 风格预设组合（3 场景链 + 字幕 + 颗粒） =====

const PACKAGING_D = 36;
const PACKAGING_O = 14;

/** 在 Sequence 内读取相对帧驱动字幕动画（转场结束后开始） */
const SceneSubtitleLive: React.FC<{ text: string; style: string }> = ({ text, style }) => {
  const frame = useCurrentFrame();
  return <SceneSubtitle text={text} frame={Math.max(0, frame - PACKAGING_O)} style={style as never} />;
};

const PROFILES: Record<string, { transitions: TransitionType[]; subtitle: string; grain: number; hint: string }> = {
  douyin_travel_fast: { transitions: ["whip", "zoom_flash", "glitch"], subtitle: "neon_sign", grain: 0, hint: "快节奏 · 高频转场 · 音乐卡点" },
  douyin_travel_cinematic: { transitions: ["fade", "blur_in", "circle_reveal"], subtitle: "cinematic", grain: 0.12, hint: "电影感 · 慢节奏 · 情绪渲染" },
  douyin_travel_creative: { transitions: ["spin", "zoom_heavy", "freeze_frame"], subtitle: "gradient_bar", grain: 0.1, hint: "创意风 · 前景分离 · 特效字幕" },
};

const PackagingDemo: React.FC<{ techId: string; title: string }> = ({ techId, title }) => {
  const profile = PROFILES[techId] ?? PROFILES["douyin_travel_fast"];
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
          </Sequence>
        );
      })}
      <DemoLabel title={title} sub={`包装风格 · ${techId}`} />
    </DesignFrame>
  );
};

// ===== montage: 前3秒抓眼球（大标题 + 快切） =====

const MontageDemo: React.FC<{ title: string }> = ({ title }) => {
  const frame = useCurrentFrame();
  const TITLE_DUR = 18;
  const CUT = 9;
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
    </DesignFrame>
  );
};

// ===== beat: 音乐卡点 =====

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

// ===== emotion_arc: 5 段式情绪设计 =====

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
      <DemoLabel title={title} sub="开场→铺垫→高潮→回落→收尾" />
    </DesignFrame>
  );
};

// ===== variety: 转场不做重复（4 种转场连播） =====

const VARIETY_TRANSITIONS: { t: TransitionType; name: string }[] = [
  { t: "whip", name: "甩镜头" },
  { t: "glitch", name: "故障抖动" },
  { t: "spin", name: "360°旋转" },
  { t: "zoom_flash", name: "缩放闪光" },
];

const VARIETY_D = 28;
const VARIETY_O = 12;

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
            {vt && (
              <div style={{ position: "absolute", bottom: 160, left: 0, right: 0, textAlign: "center", pointerEvents: "none" }}>
                <span style={{ color: "#ff0", fontSize: 26, fontFamily: "'PingFang SC','Microsoft YaHei',monospace", background: "rgba(0,0,0,0.5)", padding: "4px 20px", borderRadius: 6, letterSpacing: 3 }}>
                  转场 {i}: {vt.name}
                </span>
              </div>
            )}
          </Sequence>
        );
      })}
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
