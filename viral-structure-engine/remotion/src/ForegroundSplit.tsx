import React from "react";
import {
  AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig,
  interpolate, spring, Easing, Img, staticFile,
} from "remotion";

// ================================================================
//  Foreground Extraction Showcase
//  Demonstrates extracted buildings/objects animated independently
//  over their original photos, with rich subtitle styles.
// ================================================================

interface ForegroundSplitProps {
  material_map: Record<string, string>;
}

// ===== 7 Reveal Effects =====

type RevealType =
  | "float_up"
  | "scale_burst"
  | "tilt_3d"
  | "glow_fade"
  | "parallax"
  | "split"
  | "blur_in"

const REVEAL_EFFECTS: RevealType[] = [
  "float_up", "scale_burst", "tilt_3d", "glow_fade",
  "parallax", "split", "blur_in",
];

// ===== 8 Subtitle Styles =====

type SubtitleStyle =
  | "typewriter"       // 打字机逐字出现
  | "neon_sign"        // 霓虹发光
  | "gradient_bar"     // 渐变色背景条
  | "scale_bounce"     // 弹簧缩放弹入
  | "slide_crop"       // 从裁切中滑入
  | "letter_fall"      // 文字从上掉落
  | "wave"             // 波浪摆动
  | "cinematic"        // 电影上下黑条

const SUBTITLE_STYLES: SubtitleStyle[] = [
  "typewriter", "neon_sign", "gradient_bar", "scale_bounce",
  "slide_crop", "letter_fall", "wave", "cinematic",
];

// ===== Subtitle Components =====

const SubtitleTypewriter: React.FC<{ text: string; frame: number }> = ({ text, frame, children }) => {
  const progress = interpolate(frame, [0, 30], [0, text.length], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.ease),
  });
  const visibleLen = Math.max(1, Math.floor(progress));
  const cursor = frame < 30 && frame % 6 < 3 ? "|" : "";
  return (
    <div style={{
      position: "absolute", bottom: 80, left: 0, right: 0, textAlign: "center",
      opacity: interpolate(frame, [0, 4], [0, 1], { extrapolateLeft: "clamp" }),
    }}>
      <span style={{
        color: "#fff", fontSize: 32, fontFamily: "'PingFang SC','Microsoft YaHei',monospace",
        fontWeight: "bold", textShadow: "2px 2px 12px rgba(0,0,0,0.9)",
        letterSpacing: 3, background: "rgba(0,0,0,0.3)", padding: "8px 24px", borderRadius: 4,
      }}>
        {text.slice(0, visibleLen)}{cursor}
      </span>
    </div>
  );
};

const SubtitleNeonSign: React.FC<{ text: string; frame: number }> = ({ text, frame }) => {
  const p = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", easing: Easing.out(Easing.ease) });
  const flicker = frame < 20 ? (frame % 3 === 0 ? 0.7 : 1) : 1;
  const colors = ["#0ff", "#f0f", "#ff0", "#0f0"];
  const color = colors[Math.floor((frame / 15) % colors.length)];
  const blur = interpolate(p, [0, 1], [30, 6]);
  return (
    <div style={{
      position: "absolute", bottom: 80, left: 0, right: 0, textAlign: "center", opacity: p * flicker,
    }}>
      <span style={{
        color, fontSize: 38, fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif",
        fontWeight: "bold", letterSpacing: 6,
        textShadow: `0 0 ${blur * 1}px ${color}, 0 0 ${blur * 2}px ${color}, 0 0 ${blur * 3}px ${color}`,
      }}>
        {text}
      </span>
    </div>
  );
};

const SubtitleGradientBar: React.FC<{ text: string; frame: number }> = ({ text, frame }) => {
  const p = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", easing: Easing.out(Easing.ease) });
  const barW = interpolate(p, [0, 1], [0, 100]);
  const textP = interpolate(frame, [6, 18], [0, 1], { extrapolateLeft: "clamp", easing: Easing.out(Easing.ease) });
  return (
    <div style={{
      position: "absolute", bottom: 80, left: 0, right: 0, display: "flex", justifyContent: "center",
    }}>
      <div style={{
        background: `linear-gradient(90deg, rgba(255,50,100,0.8), rgba(100,50,255,0.8))`,
        borderRadius: 8, padding: "12px 0", overflow: "hidden",
        width: `${barW}%`, maxWidth: "80%", minWidth: barW > 1 ? 200 : 0,
      }}>
        <div style={{
          color: "#fff", fontSize: 30, fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif",
          fontWeight: "bold", textAlign: "center", letterSpacing: 3,
          opacity: textP, transform: `translateY(${interpolate(textP, [0, 1], [10, 0])}px)`,
        }}>
          {text}
        </div>
      </div>
    </div>
  );
};

const SubtitleScaleBounce: React.FC<{ text: string; frame: number }> = ({ text, frame }) => {
  const sp = spring({ fps: 30, frame: Math.min(frame, 20), config: { damping: 10, mass: 0.5, stiffness: 200 } });
  const scale = interpolate(sp, [0, 1], [1.5, 1]);
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateLeft: "clamp" });
  return (
    <div style={{
      position: "absolute", bottom: 80, left: 0, right: 0, textAlign: "center", opacity,
      transform: `scale(${scale})`,
    }}>
      <span style={{
        display: "inline-block", color: "#fff", fontSize: 32,
        fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif",
        fontWeight: "bold", textShadow: "2px 2px 20px rgba(0,0,0,0.8)",
        letterSpacing: 3,
        background: "linear-gradient(135deg, #667eea, #764ba2)",
        WebkitBackgroundClip: "background" !== "background" ? undefined : undefined,
        padding: "8px 28px", borderRadius: 50,
      }}>
        {text}
      </span>
    </div>
  );
};

const SubtitleSlideCrop: React.FC<{ text: string; frame: number }> = ({ text, frame }) => {
  const p = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: "clamp", easing: Easing.out(Easing.ease) });
  const clip = interpolate(p, [0, 1], [100, 0]);
  return (
    <div style={{
      position: "absolute", bottom: 80, left: 0, right: 0, textAlign: "center",
      opacity: interpolate(frame, [0, 5], [0, 1], { extrapolateLeft: "clamp" }),
    }}>
      <div style={{ display: "inline-block", overflow: "hidden", clipPath: `inset(0 ${clip}% 0 0)` }}>
        <span style={{
          display: "block", color: "#ffd700", fontSize: 36,
          fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif",
          fontWeight: "bold", textShadow: "0 0 20px rgba(255,215,0,0.5), 2px 2px 12px rgba(0,0,0,0.8)",
          letterSpacing: 4, transform: `translateX(${interpolate(p, [0, 1], [-30, 0])}px)`,
        }}>
          {text}
        </span>
      </div>
    </div>
  );
};

const SubtitleLetterFall: React.FC<{ text: string; frame: number }> = ({ text, frame }) => {
  return (
    <div style={{
      position: "absolute", bottom: 80, left: 0, right: 0, textAlign: "center",
      opacity: interpolate(frame, [0, 5], [0, 1], { extrapolateLeft: "clamp" }),
    }}>
      <div style={{
        color: "#fff", fontSize: 32, fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif",
        fontWeight: "bold", textShadow: "2px 2px 12px rgba(0,0,0,0.8)",
        letterSpacing: 3,
      }}>
        {text.split("").map((char, i) => {
          const delay = i * 3;
          const fallFrame = Math.max(0, frame - delay);
          const sp = spring({ fps: 30, frame: Math.min(fallFrame, 15), config: { damping: 15, stiffness: 300 } });
          const y = interpolate(sp, [0, 1], [-40, 0]);
          const opacity = interpolate(fallFrame, [0, 5], [0, 1], { extrapolateLeft: "clamp" });
          return (
            <span key={i} style={{
              display: "inline-block", opacity,
              transform: `translateY(${y}px)`,
            }}>
              {char}
            </span>
          );
        })}
      </div>
    </div>
  );
};

const SubtitleWave: React.FC<{ text: string; frame: number }> = ({ text, frame }) => {
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: "clamp" });
  return (
    <div style={{
      position: "absolute", bottom: 80, left: 0, right: 0, textAlign: "center", opacity,
    }}>
      <div style={{
        fontSize: 32, fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif",
        fontWeight: "bold", textShadow: "2px 2px 12px rgba(0,0,0,0.8)",
        letterSpacing: 3,
        background: "linear-gradient(90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        backgroundPosition: `${(frame * 3) % 200}% 0`,
      }}>
        <span style={{ display: "inline-flex", gap: 2 }}>
          {text.split("").map((char, i) => {
            const waveY = Math.sin((frame * 0.12) + i * 0.7) * 8;
            return (
              <span key={i} style={{ display: "inline-block", transform: `translateY(${waveY}px)` }}>
                {char}
              </span>
            );
          })}
        </span>
      </div>
    </div>
  );
};

const SubtitleCinematic: React.FC<{ text: string; frame: number }> = ({ text, frame }) => {
  const barSlide = interpolate(frame, [0, 15], [100, 0], {
    extrapolateLeft: "clamp", easing: Easing.out(Easing.ease),
  });
  const textFade = interpolate(frame, [10, 22], [0, 1], { extrapolateLeft: "clamp", easing: Easing.out(Easing.ease) });
  return (
    <>
      {/* Top letterbox bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 70,
        background: "rgba(0,0,0,0.7)",
        transform: `translateY(${interpolate(barSlide, [0, 100], [-70, 0])}px)`,
      }} />
      {/* Bottom letterbox bar */}
      <div style={{
        position: "absolute", bottom: 60, left: 0, right: 0, height: 70,
        background: "rgba(0,0,0,0.7)",
        transform: `translateY(${interpolate(barSlide, [0, 100], [70, 0])}px)`,
      }}>
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          opacity: textFade,
        }}>
          <span style={{
            color: "#fff", fontSize: 28, fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif",
            fontWeight: "bold", letterSpacing: 4,
          }}>
            {text}
          </span>
        </div>
      </div>
    </>
  );
};

// ===== Subtitle Router =====

export const SceneSubtitle: React.FC<{ text: string; frame: number; style: SubtitleStyle }> = ({ text, frame, style }) => {
  const fadeOut = interpolate(frame, [45, 55], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ opacity: fadeOut }}>
      {style === "typewriter" && <SubtitleTypewriter text={text} frame={frame} />}
      {style === "neon_sign" && <SubtitleNeonSign text={text} frame={frame} />}
      {style === "gradient_bar" && <SubtitleGradientBar text={text} frame={frame} />}
      {style === "scale_bounce" && <SubtitleScaleBounce text={text} frame={frame} />}
      {style === "slide_crop" && <SubtitleSlideCrop text={text} frame={frame} />}
      {style === "letter_fall" && <SubtitleLetterFall text={text} frame={frame} />}
      {style === "wave" && <SubtitleWave text={text} frame={frame} />}
      {style === "cinematic" && <SubtitleCinematic text={text} frame={frame} />}
    </div>
  );
};

// ===== Scene: Foreground Reveal =====

interface SceneProps {
  bgImg: string;
  fgImg: string;
  reveal: RevealType;
  sceneDuration: number;
  revealStartFrame: number;
  subtitle?: string;
  subtitleStyle: SubtitleStyle;
}

const SceneForeground: React.FC<SceneProps> = ({
  bgImg, fgImg, reveal, sceneDuration, revealStartFrame, subtitle, subtitleStyle,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const revealFrame = Math.max(0, frame - revealStartFrame);
  const revealDur = 20;

  // ---- Background Ken Burns ----
  const bgSpring = spring({
    fps, frame: Math.min(frame, sceneDuration),
    config: { damping: 300, stiffness: 200 },
  });
  const bgZoom = interpolate(bgSpring, [0, 1], [1, 1.08]);
  const bgPanY = interpolate(frame / sceneDuration, [0, 1], [0, -20], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // ---- Foreground Reveal ----
  const revealProgress = interpolate(revealFrame, [0, revealDur], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const revealSpring = spring({
    fps, frame: Math.min(revealFrame, revealDur),
    config: { damping: 14, mass: 0.6, stiffness: 180 },
  });

  const buildRevealStyle = (): React.CSSProperties => {
    switch (reveal) {
      case "float_up":
        return { opacity: revealProgress, transform: `translateY(${interpolate(revealSpring, [0, 1], [200, 0])}px)` };
      case "scale_burst":
        return { opacity: revealProgress, transform: `scale(${interpolate(revealSpring, [0, 1], [0.3, 1])})` };
      case "tilt_3d":
        return { opacity: revealProgress, transform: `perspective(800px) rotateY(${interpolate(revealProgress, [0, 1], [25, 0])}deg)`, filter: `brightness(${interpolate(revealProgress, [0, 1], [1.3, 1])})` };
      case "glow_fade": {
        const glow = interpolate(revealFrame, [0, revealDur * 0.6, revealDur], [0, 1.5, 0]);
        return { opacity: revealProgress, filter: `brightness(${1 + glow * 0.3}) drop-shadow(0 0 ${glow * 20}px rgba(255,215,0,${glow * 0.6}))` };
      }
      case "parallax": {
        return { opacity: revealProgress, transform: `translateX(${Math.sin(frame * 0.02) * 15}px) translateY(${Math.cos(frame * 0.015) * 10}px)`, filter: "drop-shadow(4px 8px 12px rgba(0,0,0,0.4))" };
      }
      case "split": {
        const sp = interpolate(revealSpring, [0, 1], [0, 1]);
        return { opacity: revealProgress, clipPath: `inset(0 ${interpolate(sp, [0, 1], [100, 50])}% 0 ${interpolate(sp, [0, 1], [0, 50])}%)`, transform: `scale(${interpolate(sp, [0, 1], [1.1, 1])})` };
      }
      case "blur_in":
        return { opacity: revealProgress, filter: `blur(${interpolate(revealProgress, [0, 1], [15, 0])}px)` };
      default:
        return { opacity: revealProgress };
    }
  };

  const fgStyle = buildRevealStyle();

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Background layer */}
      <AbsoluteFill>
        <div style={{ width: "100%", height: "100%", transform: `scale(${bgZoom}) translateY(${bgPanY}px)`, overflow: "hidden" }}>
          <Img src={bgImg} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      </AbsoluteFill>

      {/* Gradient overlay */}
      <AbsoluteFill style={{
        background: "linear-gradient(0deg, rgba(0,0,0,0.3) 0%, transparent 40%, transparent 70%, rgba(0,0,0,0.15) 100%)",
        pointerEvents: "none",
      }} />

      {/* Foreground layer */}
      {frame >= revealStartFrame && (
        <AbsoluteFill style={fgStyle}>
          <Img src={fgImg} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </AbsoluteFill>
      )}

      {/* Effect label */}
      {frame >= revealStartFrame && (
        <div style={{ position: "absolute", top: 50, left: 40, opacity: interpolate(revealFrame, [0, 10, revealDur, revealDur + 20], [0, 1, 1, 0]), pointerEvents: "none" }}>
          <div style={{ color: "#ff0", fontSize: 16, fontFamily: "monospace", background: "rgba(0,0,0,0.5)", padding: "4px 12px", borderRadius: 4, letterSpacing: 1 }}>
            特效: {reveal} · 字幕: {subtitleStyle}
          </div>
        </div>
      )}

      {/* Subtitle with rich style */}
      {subtitle && frame >= revealStartFrame && (
        <SceneSubtitle text={subtitle} frame={frame - revealStartFrame} style={subtitleStyle} />
      )}
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
        <div style={{ fontSize: 60, fontWeight: "bold", color: "#fff", fontFamily: "sans-serif", transform: `scale(${interpolate(sp, [0, 1], [0.3, 1])})`, opacity: p, letterSpacing: 6, textShadow: "0 0 40px rgba(100,100,255,0.5)" }}>
          8 种字幕样式
        </div>
        <div style={{ fontSize: 24, color: "rgba(255,255,255,0.6)", fontFamily: "sans-serif", marginTop: 20, opacity: interpolate(frame, [10, dur], [0, 1]) }}>
          打字机 · 霓虹 · 渐变条 · 弹簧 · 滑入 · 掉落 · 波浪 · 电影
        </div>
      </div>
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
        <div style={{ fontSize: 48, color: "#fff", fontFamily: "sans-serif", opacity: p, letterSpacing: 4 }}>字幕样式展示完毕</div>
        <div style={{ fontSize: 20, color: "rgba(255,255,255,0.5)", fontFamily: "sans-serif", marginTop: 20, opacity: interpolate(frame, [15, dur], [0, 1]) }}>
          Built with Remotion
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ===== Main Composition =====

const SCENE_DUR = 60;
const REVEAL_START = 15;

const IMAGE_PAIRS = [
  { bg: "/photos/88250e8474df89bdc677ba059048b55c.jpg", fg: "/segmented/fg_000.png" },
  { bg: "/photos/北京丨这可能是我花的最值的两块钱…_1_小鹿拍全国_来自小红书网页版.jpg", fg: "/segmented/fg_001.png" },
  { bg: "/photos/微信图片_20260602210252_47_11.jpg", fg: "/segmented/fg_005.png" },
  { bg: "/photos/微信图片_20260602210253_48_11.jpg", fg: "/segmented/fg_006.png" },
  { bg: "/photos/微信图片_20260602210255_51_11.jpg", fg: "/segmented/fg_009.png" },
  { bg: "/photos/微信图片_20260602210256_52_11.jpg", fg: "/segmented/fg_010.png" },
  { bg: "/photos/微信图片_20260602210308_56_11.jpg", fg: "/segmented/fg_014.png" },
  { bg: "/photos/微信图片_20260602210329_64_11.jpg", fg: "/segmented/fg_022.png" },
  { bg: "/photos/微信图片_20260602210334_69_11.jpg", fg: "/segmented/fg_027.png" },
  { bg: "/photos/北京丨这可能是我花的最值的两块钱…_7_小鹿拍全国_来自小红书网页版.jpg", fg: "/segmented/fg_002.png" },
];

const SUBTITLES = [
  "建筑从照片中分离",
  "前景独立升起动画",
  "缩放弹入效果",
  "3D 透视旋转",
  "发光淡入效果",
  "视差漂移运动",
  "分裂合拢效果",
  "模糊变清晰",
  "弹性弹入效果",
  "浮动升起动画",
];

export const ForegroundSplitShowcase: React.FC<ForegroundSplitProps> = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Sequence from={0} durationInFrames={30} name="intro">
        <Intro />
      </Sequence>

      {IMAGE_PAIRS.map((pair, i) => {
        const startFrame = 30 + i * SCENE_DUR;
        return (
          <Sequence key={i} from={startFrame} durationInFrames={SCENE_DUR} name={`scene-${i}`}>
            <SceneForeground
              bgImg={staticFile(pair.bg)}
              fgImg={staticFile(pair.fg)}
              reveal={REVEAL_EFFECTS[i % REVEAL_EFFECTS.length]}
              sceneDuration={SCENE_DUR}
              revealStartFrame={REVEAL_START}
              subtitle={SUBTITLES[i] ?? `效果 ${i + 1}`}
              subtitleStyle={SUBTITLE_STYLES[i % SUBTITLE_STYLES.length]}
            />
          </Sequence>
        );
      })}

      <Sequence from={30 + IMAGE_PAIRS.length * SCENE_DUR} durationInFrames={30} name="outro">
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
