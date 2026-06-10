import React, { ReactNode } from "react";
import {
  AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig,
  interpolate, spring, Easing, Img,
} from "remotion";

// ================================================================
//  炫酷特效展示 — 7 种场景 × 7 种转场 + 内置动画
// ================================================================

// ---------- 场景生成器 ----------
const SceneSVG: React.FC<{ colors: string[]; label: string; pattern?: "grid" | "circle" | "stripe" }> = ({
  colors, label, pattern = "grid",
}) => {
  const gradientId = `g_${colors.join("_").replace(/#/g, "")}`;
  return (
    <svg width="1080" height="1920" viewBox="0 0 1080 1920" style={{ position: "absolute", width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          {colors.map((c, i) => (
            <stop key={i} offset={`${(i / (colors.length - 1)) * 100}%`} stopColor={c} />
          ))}
        </linearGradient>
        {pattern === "circle" && (
          <radialGradient id={`fg_${gradientId}`} cx="30%" cy="40%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        )}
      </defs>
      <rect width="1080" height="1920" fill={`url(#${gradientId})`} />
      {/* 装饰 */}
      {pattern === "grid" && Array.from({ length: 16 }).map((_, i) => (
        <line key={i} x1={i * 72} y1={0} x2={i * 72} y2={1920} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      ))}
      {pattern === "grid" && Array.from({ length: 28 }).map((_, i) => (
        <line key={`h${i}`} x1={0} y1={i * 72} x2={1080} y2={i * 72} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      ))}
      {pattern === "circle" && <rect width="1080" height="1920" fill={`url(#fg_${gradientId})`} />}
      {pattern === "stripe" && Array.from({ length: 12 }).map((_, i) => (
        <rect key={i} x={i * 100} y={0} width={30} height={1920} fill="rgba(255,255,255,0.04)" />
      ))}
      <text x={540} y={960} textAnchor="middle" dominantBaseline="central"
        fill="rgba(255,255,255,0.7)" fontSize={48} fontFamily="sans-serif" fontWeight="bold"
        letterSpacing={4}>{label}</text>
    </svg>
  );
};

// ---------- 转场包装 ----------
const EFFECTS: Record<string, (frame: number, dur: number, fps: number) => React.CSSProperties> = {
  fade: (f, d) => ({ opacity: interpolate(f, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }) }),
  dissolve: (f, d) => ({ opacity: interpolate(f, [0, d], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }),
  glitch: (f, d, fps) => {
    const p = interpolate(f, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const s = Math.sin(f * Math.PI * 3.7) * (1 - p) * 10;
    const sk = Math.sin(f * Math.PI * 5.1) * (1 - p) * 4;
    return { transform: `translateX(${s}px) skewX(${sk}deg)`, filter: p < 0.5 ? "contrast(1.4) brightness(1.2)" : "none", opacity: p };
  },
  whip: (f, d) => {
    const p = interpolate(f, [0, d], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
    return { transform: `translateX(${interpolate(p, [0, 1], [250, 0])}px)`, filter: `blur(${interpolate(p, [0, 1], [20, 0])}px)`, opacity: interpolate(f, [0, 4], [0, 1]) };
  },
  flash: (f, d) => ({
    opacity: interpolate(f, [0, 1, 8], [0, 1, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    filter: f < 6 ? `brightness(${interpolate(f, [0, 4, 6], [3, 1.5, 1])})` : "none",
  }),
  zoom: (f, d) => {
    const sp = spring({ fps: 30, frame: Math.min(f, 14), config: { damping: 200, stiffness: 400 } });
    return { transform: `scale(${interpolate(sp, [0, 1], [0.95, 1])})`, opacity: interpolate(f, [0, 10], [0, 1]) };
  },
  blur_in: (f, d) => {
    const p = interpolate(f, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
    return { filter: `blur(${interpolate(p, [0, 1], [12, 0])}px)`, opacity: p };
  },
};

// ---------- 内置场景动画 ----------
const useKenBurns = (dur: number, motion: "zoom" | "pan" | "bounce" = "zoom") => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sp = spring({ fps: 30, frame: Math.min(frame, dur), config: { damping: 300, stiffness: 200 } });

  if (motion === "zoom") return { transform: `scale(${interpolate(sp, [0, 1], [1, 1.08])})` };
  if (motion === "pan") return { transform: `translateY(${interpolate(progress, [0, 1], [0, -40])}px) scale(1.05)` };
  // bounce
  const bounce = Math.sin(progress * Math.PI * 2) * 3;
  return { transform: `scale(${interpolate(sp, [0, 1], [1, 1.05])}) translateY(${bounce}px)` };
};

// ---------- 场景 ----------
const scenes = [
  { colors: ["#ff6b6b", "#ffa500", "#ffd93d"], label: "落日余晖", pattern: "circle" as const, anim: "zoom" as const },
  { colors: ["#0f2027", "#203a43", "#2c5364"], label: "深海秘境", pattern: "grid" as const, anim: "pan" as const },
  { colors: ["#134e5e", "#71b280"], label: "丛林漫步", pattern: "circle" as const, anim: "zoom" as const },
  { colors: ["#200122", "#6f0000"], label: "暮色之城", pattern: "stripe" as const, anim: "bounce" as const },
  { colors: ["#f12711", "#f5af19"], label: "金色年华", pattern: "grid" as const, anim: "zoom" as const },
  { colors: ["#00b4db", "#0083b0"], label: "碧海蓝天", pattern: "circle" as const, anim: "pan" as const },
  { colors: ["#4a00e0", "#8e2de2"], label: "梦幻星河", pattern: "stripe" as const, anim: "zoom" as const },
];

const transitionList = ["fade", "glitch", "whip", "flash", "zoom", "blur_in", "dissolve"];

// ---------- 片头 ----------
const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = 30;
  const p = interpolate(frame, [0, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sp = spring({ fps: 30, frame: Math.min(frame, dur), config: { damping: 12, mass: 0.5, stiffness: 100 } });
  const scale = interpolate(sp, [0, 1], [0.3, 1]);
  const bg = `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`;

  return (
    <AbsoluteFill style={{ background: bg }}>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ fontSize: 72, fontWeight: "bold", color: "#fff", fontFamily: "sans-serif", transform: `scale(${scale})`, opacity: p, letterSpacing: 8 }}>
          🎬 特效展示
        </div>
        <div style={{ fontSize: 28, color: "rgba(255,255,255,0.7)", fontFamily: "sans-serif", marginTop: 20, opacity: interpolate(frame, [10, dur], [0, 1]) }}>
          7 种场景 × 7 种转场
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- 每个场景 ----------
const SceneWithTransition: React.FC<{
  scene: typeof scenes[0];
  transition: string;
  transitionDur: number;
  sceneDur: number;
}> = ({ scene, transition, transitionDur, sceneDur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const kenStyle = useKenBurns(sceneDur, scene.anim);

  // 文字动画
  const textOpacity = interpolate(frame, [0, 10, sceneDur - 10, sceneDur], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const labelY = interpolate(frame, [0, 10], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // 转场仅在进入时叠加
  const enterStyle = frame < transitionDur ? (EFFECTS[transition]?.(frame, transitionDur, fps) ?? {}) : {};

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill style={{ ...kenStyle } as React.CSSProperties}>
        <SceneSVG colors={scene.colors} label={scene.label} pattern={scene.pattern} />
      </AbsoluteFill>

      {/* 叠加入场转场 */}
      <AbsoluteFill style={enterStyle as React.CSSProperties} />

      {/* 标签：场景名 + 转场名 */}
      <div style={{
        position: "absolute", bottom: 80, left: 0, right: 0, display: "flex",
        flexDirection: "column", alignItems: "center", opacity: textOpacity,
        transform: `translateY(${labelY}px)`,
      }}>
        <div style={{ color: "#fff", fontSize: 36, fontFamily: "sans-serif", fontWeight: "bold", textShadow: "2px 2px 12px rgba(0,0,0,0.6)", letterSpacing: 2 }}>
          {scene.label}
        </div>
        <div style={{ color: "#ff0", fontSize: 20, fontFamily: "monospace", marginTop: 8, background: "rgba(0,0,0,0.5)", padding: "4px 16px", borderRadius: 20 }}>
          转场: {transition}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- 片尾 ----------
const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = 30;
  const p = interpolate(frame, [0, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)" }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 48, color: "#fff", fontFamily: "sans-serif", opacity: p, letterSpacing: 4 }}>感谢观看</div>
        <div style={{ fontSize: 20, color: "rgba(255,255,255,0.5)", fontFamily: "sans-serif", marginTop: 20, opacity: interpolate(frame, [15, dur], [0, 1]) }}>
          Built with Remotion
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ===== 主合成 =====
const SCENE_DUR = 30; // 每场景帧数
const TRANS_DUR = 15; // 转场帧数

export const EffectsShowcase: React.FC = () => {
  let cursor = 0;
  const segments: { start: number; end: number; sceneIdx: number; transIdx: number }[] = [];

  for (let i = 0; i < scenes.length; i++) {
    segments.push({ start: cursor, end: cursor + SCENE_DUR, sceneIdx: i, transIdx: i });
    cursor += SCENE_DUR;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* 片头 30帧 */}
      <Sequence from={0} durationInFrames={30} name="intro">
        <Intro />
      </Sequence>

      {/* 场景序列 */}
      {segments.map((seg, i) => (
        <Sequence key={i} from={30 + seg.start} durationInFrames={seg.end - seg.start + TRANS_DUR} name={`scene-${i}`}>
          <SceneWithTransition
            scene={scenes[seg.sceneIdx]}
            transition={transitionList[seg.transIdx % transitionList.length]}
            transitionDur={TRANS_DUR}
            sceneDur={SCENE_DUR}
          />
        </Sequence>
      ))}

      {/* 片尾 30帧 */}
      <Sequence from={30 + cursor} durationInFrames={30} name="outro">
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
