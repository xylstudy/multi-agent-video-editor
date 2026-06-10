import React from "react";
import {
  AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig,
  interpolate, spring, Easing, Img, staticFile,
} from "remotion";
import { FilmGrain, useSpeedRamp, useWhipPanEnhanced } from "./components/Effects";

// ================================================================
//  抖音旅行 Vlog 剪辑手法展示
//  演示所有新增 + 现有的剪辑技巧:
//  - spin, zoom_heavy, light_leak, freeze_frame 转场
//  - 胶片颗粒, 变速卡点, 运动模糊, 强化甩镜头
//  - 7 种前景揭示特效 + 8 种字幕样式
// ================================================================

// ===== Types =====

type RevealType =
  | "float_up" | "scale_burst" | "tilt_3d" | "glow_fade"
  | "parallax" | "split" | "blur_in";

const REVEAL_EFFECTS: RevealType[] = [
  "float_up", "scale_burst", "tilt_3d", "glow_fade",
  "parallax", "split", "blur_in",
];

const SCENE_TRANSITIONS = [
  "freeze_frame", "zoom_heavy", "light_leak", "spin",
  "fade", "zoom_flash", "glitch", "whip",
  "light_leak", "spin",
];

const SUBTITLES = [
  "冻结帧 · RGB 偏移开场",
  "重度缩放 · 闪白冲击",
  "彩色漏光 · 暖色扫入",
  "360° 旋转 · 视角翻转",
  "胶片颗粒 · 电影质感",
  "变速卡点 · 节拍爆发",
  "故障抖动 · 数字失真",
  "甩镜头 · 惯性滑动",
  "漏光 + 模糊入场",
  "旋转 + 前景分裂",
];

const SOUND_EFFECTS = [
  "✨", "💥", "🌈", "🔄", "🎬", "🎵", "⚡", "💨", "🌟", "🌀",
];

// ===== Image Pairs =====

const SCENE_PAIRS = [
  { bg: "/photos/88250e8474df89bdc677ba059048b55c.jpg", fg: "/segmented/fg_000.png" },
  { bg: "/photos/北京丨这可能是我花的最值的两块钱…_1_小鹿拍全国_来自小红书网页版.jpg", fg: "/segmented/fg_001.png" },
  { bg: "/photos/北京丨这可能是我花的最值的两块钱…_7_小鹿拍全国_来自小红书网页版.jpg", fg: "/segmented/fg_002.png" },
  { bg: "/photos/微信图片_20260602210248_45_11.jpg", fg: "/segmented/fg_003.png" },
  { bg: "/photos/微信图片_20260602210250_46_11.jpg", fg: "/segmented/fg_004.png" },
  { bg: "/photos/微信图片_20260602210252_47_11.jpg", fg: "/segmented/fg_005.png" },
  { bg: "/photos/微信图片_20260602210253_48_11.jpg", fg: "/segmented/fg_006.png" },
  { bg: "/photos/微信图片_20260602210254_49_11.jpg", fg: "/segmented/fg_007.png" },
  { bg: "/photos/微信图片_20260602210255_51_11.jpg", fg: "/segmented/fg_009.png" },
  { bg: "/photos/微信图片_20260602210256_52_11.jpg", fg: "/segmented/fg_010.png" },
];

// ===== Ken Burns Background =====

const BackgroundLayer: React.FC<{ img: string; duration: number; speed?: number }> = ({ img, duration, speed = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame * speed, [0, duration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sp = spring({ fps, frame: Math.min(frame * speed, duration), config: { damping: 300, stiffness: 200 } });
  return (
    <AbsoluteFill>
      <div style={{ width: "100%", height: "100%", transform: `scale(${interpolate(sp, [0, 1], [1, 1.08])}) translateY(${interpolate(p, [0, 1], [0, -15])}px)`, overflow: "hidden" }}>
        <Img src={img} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    </AbsoluteFill>
  );
};

// ===== Foreground Reveal =====

const useRevealStyle = (reveal: RevealType, revealFrame: number, revealDur: number): React.CSSProperties => {
  const { fps } = useVideoConfig();
  const p = interpolate(revealFrame, [0, revealDur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const sp = spring({ fps, frame: Math.min(revealFrame, revealDur), config: { damping: 14, mass: 0.6, stiffness: 180 } });
  switch (reveal) {
    case "float_up": return { opacity: p, transform: `translateY(${interpolate(sp, [0, 1], [180, 0])}px)` };
    case "scale_burst": return { opacity: p, transform: `scale(${interpolate(sp, [0, 1], [0.3, 1])})` };
    case "tilt_3d": return { opacity: p, transform: `perspective(800px) rotateY(${interpolate(p, [0, 1], [25, 0])}deg)`, filter: `brightness(${interpolate(p, [0, 1], [1.3, 1])})` };
    case "glow_fade": { const g = interpolate(revealFrame, [0, revealDur * 0.6, revealDur], [0, 1.5, 0]); return { opacity: p, filter: `brightness(${1 + g * 0.3}) drop-shadow(0 0 ${g * 20}px rgba(255,215,0,${g * 0.6}))` }; }
    case "parallax": return { opacity: p, transform: `translateX(${Math.sin(revealFrame * 0.02) * 12}px) translateY(${Math.cos(revealFrame * 0.015) * 8}px)`, filter: "drop-shadow(4px 8px 12px rgba(0,0,0,0.4))" };
    case "split": { const s = interpolate(sp, [0, 1], [0, 1]); return { opacity: p, clipPath: `inset(0 ${interpolate(s, [0, 1], [100, 50])}% 0 ${interpolate(s, [0, 1], [0, 50])}%)`, transform: `scale(${interpolate(s, [0, 1], [1.1, 1])})` }; }
    case "blur_in": return { opacity: p, filter: `blur(${interpolate(p, [0, 1], [15, 0])}px)` };
    default: return { opacity: p };
  }
};

// ===== Subtitle (scene bottom) =====

const SubtitleLine: React.FC<{ text: string; frame: number; emoji: string }> = ({ text, frame, emoji }) => {
  const opacity = interpolate(frame, [0, 8, 35, 45], [0, 1, 1, 0], { extrapolateLeft: "clamp" });
  const y = interpolate(frame, [0, 8], [15, 0], { extrapolateLeft: "clamp" });
  return (
    <div style={{ position: "absolute", bottom: 70, left: 0, right: 0, textAlign: "center", opacity, transform: `translateY(${y}px)`, pointerEvents: "none" }}>
      <span style={{ color: "#fff", fontSize: 22, fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif", fontWeight: "bold", textShadow: "2px 2px 12px rgba(0,0,0,0.9)", letterSpacing: 2, background: "rgba(0,0,0,0.4)", padding: "6px 20px", borderRadius: 6 }}>
        {emoji} {text}
      </span>
    </div>
  );
};

// ===== Transition Label =====

const TransitionLabel: React.FC<{ text: string; frame: number; duration: number }> = ({ text, frame, duration }) => {
  const opacity = interpolate(frame, [0, 5, duration - 10, duration], [0, 1, 1, 0], { extrapolateLeft: "clamp" });
  return (
    <div style={{ position: "absolute", top: 50, left: 40, opacity, pointerEvents: "none", zIndex: 20 }}>
      <div style={{ color: "#0ff", fontSize: 14, fontFamily: "monospace", background: "rgba(0,0,0,0.5)", padding: "3px 10px", borderRadius: 4, border: "1px solid rgba(0,255,255,0.3)" }}>
        转场: {text}
      </div>
    </div>
  );
};

// ===== Scene: Photo + Foreground + Transition + Effects =====

interface SceneProps {
  bgImg: string;
  fgImg: string;
  reveal: RevealType;
  transition: string;
  subtitle: string;
  duration: number;
  sceneIndex: number;
  showFilmGrain?: boolean;
  useSpeedRamp?: boolean;
  useMotionBlur?: boolean;
}

const Scene: React.FC<SceneProps> = ({
  bgImg, fgImg, reveal, transition, subtitle, duration, sceneIndex,
  showFilmGrain = false, useSpeedRamp: useRamp = false, useMotionBlur: useMB = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const revealStart = 10;
  const revealFrame = Math.max(0, frame - revealStart);
  const revealDur = 18;
  const fgStyle = useRevealStyle(reveal, revealFrame, revealDur);

  // Speed ramp: 如果启用，重映射背景的 Ken Burns 进度
  const speedMult = useRamp
    ? useSpeedRamp({ frame, duration, rampType: "slow_fast" })
    : frame / duration;
  const bgProgress = useRamp ? speedMult : interpolate(frame, [0, duration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bgSpring = spring({ fps, frame: Math.min(frame, duration), config: { damping: 300, stiffness: 200 } });
  const bgZoom = interpolate(bgSpring, [0, 1], [1, 1.08]);
  const bgPanY = interpolate(bgProgress, [0, 1], [0, -15], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Motion blur intensity (如果没有单独启用，根据 reveal 阶段自动产生)
  const mbIntensity = useMB
    ? interpolate(revealFrame, [0, 6, revealDur], [0.6, 0.2, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Background */}
      <AbsoluteFill>
        <div style={{ width: "100%", height: "100%", transform: `scale(${bgZoom}) translateY(${bgPanY}px)`, overflow: "hidden" }}>
          <Img src={bgImg} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      </AbsoluteFill>

      {/* Gradient overlay */}
      <AbsoluteFill style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.35) 0%, transparent 40%, transparent 70%, rgba(0,0,0,0.15) 100%)", pointerEvents: "none" }} />

      {/* Foreground reveal */}
      {frame >= revealStart && (
        <AbsoluteFill style={fgStyle}>
          <Img src={fgImg} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </AbsoluteFill>
      )}

      {/* Transition label */}
      <TransitionLabel text={transition} frame={frame} duration={duration} />

      {/* Film grain overlay */}
      {showFilmGrain && <FilmGrain opacity={0.12} type="film" />}

      {/* Subtitle */}
      {subtitle && frame >= revealStart && (
        <SubtitleLine text={subtitle} frame={revealFrame} emoji={SOUND_EFFECTS[sceneIndex]} />
      )}
    </AbsoluteFill>
  );
};

// ===== Montage: Quick-cut foregrounds + grain + leak =====

const MontageSegment: React.FC<{ fgIndices: number[]; duration: number }> = ({ fgIndices, duration }) => {
  const frame = useCurrentFrame();
  const segFrames = Math.max(3, Math.floor(duration / fgIndices.length));
  const idx = Math.min(Math.floor(frame / segFrames), fgIndices.length - 1);
  const localFrame = frame - idx * segFrames;
  const zoom = interpolate(localFrame / segFrames, [0, 1], [1.15, 0.95], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacity = idx === 0 ? 1 : interpolate(localFrame, [0, 2], [0, 1], { extrapolateLeft: "clamp" });
  const showFlash = localFrame < 3 && idx > 0;

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)" }}>
      <AbsoluteFill style={{ opacity, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Img src={staticFile(`/segmented/fg_${String(fgIndices[idx]).padStart(3, "0")}.png`)}
          style={{ maxWidth: "90%", maxHeight: "85%", objectFit: "contain", transform: `scale(${zoom})`, filter: "drop-shadow(0 0 30px rgba(100,100,255,0.3))" }} />
      </AbsoluteFill>
      {showFlash && <AbsoluteFill style={{ backgroundColor: "#fff", opacity: interpolate(localFrame, [0, 3], [0.5, 0]), pointerEvents: "none" }} />}
      {/* Film grain + light leak on montage */}
      <FilmGrain opacity={0.1} type="film" />
    </AbsoluteFill>
  );
};

// ===== Collage: 4 foregrounds grid + motion blur =====

const CollageGrid: React.FC<{ fgIndices: number[]; duration: number }> = ({ fgIndices, duration }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)" }}>
      {fgIndices.slice(0, 4).map((idx, i) => {
        const delay = i * 5;
        const localP = interpolate(Math.max(0, frame - delay), [0, 15], [0, 1], { extrapolateLeft: "clamp", easing: Easing.out(Easing.ease) });
        const cols = 2; const w = 50; const h = 50;
        return (
          <div key={i} style={{
            position: "absolute", left: `${(i % cols) * w}%`, top: `${Math.floor(i / cols) * h}%`, width: `${w}%`, height: `${h}%`,
            overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)",
            opacity: localP, transform: `scale(${interpolate(localP, [0, 1], [0.85, 1])})`,
          }}>
            <Img src={staticFile(`/segmented/fg_${String(idx).padStart(3, "0")}.png`)}
              style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
        );
      })}
      <div style={{ position: "absolute", bottom: 40, left: 0, right: 0, textAlign: "center", pointerEvents: "none" }}>
        <div style={{ color: "#fff", fontSize: 22, fontFamily: "sans-serif", fontWeight: "bold", textShadow: "2px 2px 8px rgba(0,0,0,0.8)", letterSpacing: 2, opacity: interpolate(frame, [0, 10, duration - 10, duration], [0, 1, 1, 0]) }}>
          拼贴 · 运动模糊
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ===== Intro =====

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = 30;
  const p = interpolate(frame, [0, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sp = spring({ fps: 30, frame: Math.min(frame, dur), config: { damping: 12, mass: 0.5, stiffness: 100 } });
  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)" }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 58, fontWeight: "bold", color: "#fff", fontFamily: "sans-serif", transform: `scale(${interpolate(sp, [0, 1], [0.3, 1])})`, opacity: p, letterSpacing: 6, textShadow: "0 0 40px rgba(100,100,255,0.5)" }}>
          抖音旅行 Vlog
        </div>
        <div style={{ fontSize: 28, color: "rgba(255,255,255,0.6)", fontFamily: "sans-serif", marginTop: 12, opacity: interpolate(frame, [8, dur], [0, 1]) }}>
          剪辑手法全展示
        </div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", fontFamily: "monospace", marginTop: 30, opacity: interpolate(frame, [15, dur], [0, 1]) }}>
          10 种转场 · 胶片颗粒 · 变速卡点 · 运动模糊
        </div>
      </div>
      {/* Film grain on intro */}
      <FilmGrain opacity={0.15} type="film" />
    </AbsoluteFill>
  );
};

// ===== Outro =====

const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = 30;
  const p = interpolate(frame, [0, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)" }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 40, color: "#fff", fontFamily: "sans-serif", opacity: p, letterSpacing: 4 }}>剪辑手法展示完毕</div>
        <div style={{ fontSize: 16, color: "rgba(255,255,255,0.4)", fontFamily: "sans-serif", marginTop: 20, opacity: interpolate(frame, [15, dur], [0, 1]) }}>
          10 种转场 · 胶片颗粒 · 变速卡点 · 运动模糊 · 7 种前景揭示
        </div>
      </div>
      <FilmGrain opacity={0.1} type="dust" />
    </AbsoluteFill>
  );
};

// ===== Main Composition =====

const SCENE_DUR = 45;
const TOTAL_SCENES = 10;

export const VlogTechniquesShowcase: React.FC<Record<string, unknown>> = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Intro: 30 frames */}
      <Sequence from={0} durationInFrames={30} name="intro">
        <Intro />
      </Sequence>

      {/* 10 scenes */}
      {Array.from({ length: TOTAL_SCENES }).map((_, i) => {
        const startFrame = 30 + i * SCENE_DUR;
        return (
          <Sequence key={i} from={startFrame} durationInFrames={SCENE_DUR} name={`scene-${i}`}>
            <Scene
              bgImg={staticFile(SCENE_PAIRS[i].bg)}
              fgImg={staticFile(SCENE_PAIRS[i].fg)}
              reveal={REVEAL_EFFECTS[i % REVEAL_EFFECTS.length]}
              transition={SCENE_TRANSITIONS[i]}
              subtitle={SUBTITLES[i]}
              duration={SCENE_DUR}
              sceneIndex={i}
              showFilmGrain={i === 4 || i === 7}
              useSpeedRamp={i === 5}
              useMotionBlur={i === 6 || i === 7}
            />
          </Sequence>
        );
      })}

      {/* Montage */}
      <Sequence from={30 + TOTAL_SCENES * SCENE_DUR} durationInFrames={45} name="montage">
        <MontageSegment
          fgIndices={[11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 23, 24, 25, 26]}
          duration={45}
        />
      </Sequence>

      {/* Collage */}
      <Sequence from={30 + TOTAL_SCENES * SCENE_DUR + 45} durationInFrames={30} name="collage">
        <CollageGrid fgIndices={[27, 28, 29, 30]} duration={30} />
      </Sequence>

      {/* Outro */}
      <Sequence from={30 + TOTAL_SCENES * SCENE_DUR + 45 + 30} durationInFrames={30} name="outro">
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
