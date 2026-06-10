import React from "react";
import {
  AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig,
  interpolate, spring, Easing, Img, staticFile,
} from "remotion";

// ================================================================
//  北京 · 建筑剪影
//  使用阿里云 API 分割的 39 张前景图片合成全新视频
//  整合: Ken Burns 背景 + 前景分割揭示特效 + 8 种字幕样式 + 转场
// ================================================================

// ===== Types =====

type RevealType =
  | "float_up" | "scale_burst" | "tilt_3d" | "glow_fade"
  | "parallax" | "split" | "blur_in";

type SubtitleStyle =
  | "typewriter" | "neon_sign" | "gradient_bar" | "scale_bounce"
  | "slide_crop" | "letter_fall" | "wave" | "cinematic";

const REVEAL_EFFECTS: RevealType[] = [
  "float_up", "scale_burst", "tilt_3d", "glow_fade",
  "parallax", "split", "blur_in",
];

const SUBTITLE_STYLES: SubtitleStyle[] = [
  "typewriter", "neon_sign", "gradient_bar", "scale_bounce",
  "slide_crop", "letter_fall", "wave", "cinematic",
];

const SUBTITLE_TEXTS = [
  "红墙金瓦，岁月留痕",
  "胡同深处，京城烟火",
  "天坛祈年，古韵悠长",
  "角楼映日，护城河畔",
  "故宫恢宏，六百春秋",
  "摩天楼宇，现代脉搏",
  "檐角飞翘，匠心独运",
  "光影交错，古城新貌",
  "银杏大道，秋意正浓",
  "京城之巅，俯瞰繁华",
  "石狮守门，岁月静好",
  "园林深处，别有洞天",
];

// ===== Image Pairs (first 12 photos with known mappings) =====

interface ImagePair { bg: string; fg: string }

const SCENE_PAIRS: ImagePair[] = [
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
  { bg: "/photos/微信图片_20260602210308_56_11.jpg", fg: "/segmented/fg_014.png" },
  { bg: "/photos/微信图片_20260602210329_64_11.jpg", fg: "/segmented/fg_022.png" },
];

// ===== Ken Burns Background =====

const BackgroundLayer: React.FC<{ img: string; duration: number }> = ({ img, duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = interpolate(frame, [0, duration], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const zoomSpring = spring({
    fps, frame: Math.min(frame, duration),
    config: { damping: 300, stiffness: 200 },
  });
  const zoom = interpolate(zoomSpring, [0, 1], [1, 1.08]);
  const panY = interpolate(progress, [0, 1], [0, -15]);
  return (
    <AbsoluteFill>
      <div style={{ width: "100%", height: "100%", transform: `scale(${zoom}) translateY(${panY}px)`, overflow: "hidden" }}>
        <Img src={img} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    </AbsoluteFill>
  );
};

// ===== Foreground Reveal Effects =====

const useRevealStyle = (reveal: RevealType, revealFrame: number, revealDur: number): React.CSSProperties => {
  const { fps } = useVideoConfig();
  const progress = interpolate(revealFrame, [0, revealDur], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const sp = spring({
    fps, frame: Math.min(revealFrame, revealDur),
    config: { damping: 14, mass: 0.6, stiffness: 180 },
  });

  switch (reveal) {
    case "float_up":
      return { opacity: progress, transform: `translateY(${interpolate(sp, [0, 1], [180, 0])}px)` };
    case "scale_burst":
      return { opacity: progress, transform: `scale(${interpolate(sp, [0, 1], [0.3, 1])})` };
    case "tilt_3d":
      return {
        opacity: progress,
        transform: `perspective(800px) rotateY(${interpolate(progress, [0, 1], [25, 0])}deg)`,
        filter: `brightness(${interpolate(progress, [0, 1], [1.3, 1])})`,
      };
    case "glow_fade": {
      const glow = interpolate(revealFrame, [0, revealDur * 0.6, revealDur], [0, 1.5, 0]);
      return {
        opacity: progress,
        filter: `brightness(${1 + glow * 0.3}) drop-shadow(0 0 ${glow * 20}px rgba(255,215,0,${glow * 0.6}))`,
      };
    }
    case "parallax":
      return {
        opacity: progress,
        transform: `translateX(${Math.sin(revealFrame * 0.02) * 12}px) translateY(${Math.cos(revealFrame * 0.015) * 8}px)`,
        filter: "drop-shadow(4px 8px 12px rgba(0,0,0,0.4))",
      };
    case "split": {
      const s = interpolate(sp, [0, 1], [0, 1]);
      return {
        opacity: progress,
        clipPath: `inset(0 ${interpolate(s, [0, 1], [100, 50])}% 0 ${interpolate(s, [0, 1], [0, 50])}%)`,
        transform: `scale(${interpolate(s, [0, 1], [1.1, 1])})`,
      };
    }
    case "blur_in":
      return { opacity: progress, filter: `blur(${interpolate(progress, [0, 1], [15, 0])}px)` };
    default:
      return { opacity: progress };
  }
};

// ===== Subtitle Styles =====

const SubtitleRenderer: React.FC<{ text: string; frame: number; style: SubtitleStyle }> = ({ text, frame, style }) => {
  const fadeOut = interpolate(frame, [35, 45], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const baseStyle: React.CSSProperties = { opacity: fadeOut };

  const renderContent = () => {
    switch (style) {
      case "typewriter": {
        const p = interpolate(frame, [0, 25], [0, text.length], { extrapolateLeft: "clamp", easing: Easing.out(Easing.ease) });
        const len = Math.max(1, Math.floor(p));
        const cursor = frame < 25 && frame % 6 < 3 ? "|" : "";
        return (
          <span style={{ color: "#fff", fontSize: 30, fontFamily: "'PingFang SC','Microsoft YaHei',monospace", fontWeight: "bold", textShadow: "2px 2px 12px rgba(0,0,0,0.9)", letterSpacing: 3, background: "rgba(0,0,0,0.3)", padding: "8px 24px", borderRadius: 4 }}>
            {text.slice(0, len)}{cursor}
          </span>
        );
      }
      case "neon_sign": {
        const p = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", easing: Easing.out(Easing.ease) });
        const flicker = frame < 18 ? (frame % 3 === 0 ? 0.7 : 1) : 1;
        const colors = ["#0ff", "#f0f", "#ff0"];
        const color = colors[Math.floor((frame / 20) % colors.length)];
        const blur = interpolate(p, [0, 1], [30, 6]);
        return (
          <span style={{ color, fontSize: 36, fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif", fontWeight: "bold", letterSpacing: 6, opacity: p * flicker, textShadow: `0 0 ${blur}px ${color}, 0 0 ${blur * 2}px ${color}` }}>
            {text}
          </span>
        );
      }
      case "gradient_bar": {
        const p = interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: "clamp", easing: Easing.out(Easing.ease) });
        const barW = interpolate(p, [0, 1], [0, 100]);
        const textP = interpolate(frame, [5, 15], [0, 1], { extrapolateLeft: "clamp", easing: Easing.out(Easing.ease) });
        return (
          <div style={{ background: "linear-gradient(90deg, rgba(255,50,100,0.85), rgba(100,50,255,0.85))", borderRadius: 8, padding: "10px 0", overflow: "hidden", width: `${barW}%`, maxWidth: "80%", minWidth: barW > 1 ? 200 : 0 }}>
            <div style={{ color: "#fff", fontSize: 28, fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif", fontWeight: "bold", textAlign: "center", letterSpacing: 3, opacity: textP, transform: `translateY(${interpolate(textP, [0, 1], [10, 0])}px)` }}>
              {text}
            </div>
          </div>
        );
      }
      case "scale_bounce": {
        const sp = spring({ fps: 30, frame: Math.min(frame, 18), config: { damping: 10, mass: 0.5, stiffness: 200 } });
        const opacity = interpolate(frame, [0, 6], [0, 1], { extrapolateLeft: "clamp" });
        return (
          <span style={{ display: "inline-block", color: "#fff", fontSize: 30, fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif", fontWeight: "bold", textShadow: "2px 2px 20px rgba(0,0,0,0.8)", letterSpacing: 3, background: "linear-gradient(135deg, #667eea, #764ba2)", padding: "8px 28px", borderRadius: 50, transform: `scale(${interpolate(sp, [0, 1], [1.5, 1])})`, opacity }}>
            {text}
          </span>
        );
      }
      case "slide_crop": {
        const p = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", easing: Easing.out(Easing.ease) });
        return (
          <div style={{ display: "inline-block", overflow: "hidden", clipPath: `inset(0 ${interpolate(p, [0, 1], [100, 0])}% 0 0)` }}>
            <span style={{ display: "block", color: "#ffd700", fontSize: 34, fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif", fontWeight: "bold", textShadow: "0 0 20px rgba(255,215,0,0.5), 2px 2px 12px rgba(0,0,0,0.8)", letterSpacing: 4, transform: `translateX(${interpolate(p, [0, 1], [-30, 0])}px)` }}>
              {text}
            </span>
          </div>
        );
      }
      case "letter_fall": {
        return (
          <span style={{ color: "#fff", fontSize: 30, fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif", fontWeight: "bold", textShadow: "2px 2px 12px rgba(0,0,0,0.8)", letterSpacing: 3 }}>
            {text.split("").map((char, i) => {
              const delay = i * 3;
              const ff = Math.max(0, frame - delay);
              const sp2 = spring({ fps: 30, frame: Math.min(ff, 14), config: { damping: 15, stiffness: 300 } });
              return (
                <span key={i} style={{ display: "inline-block", opacity: interpolate(ff, [0, 4], [0, 1], { extrapolateLeft: "clamp" }), transform: `translateY(${interpolate(sp2, [0, 1], [-35, 0])}px)` }}>
                  {char}
                </span>
              );
            })}
          </span>
        );
      }
      case "wave": {
        return (
          <span style={{ display: "inline-flex", gap: 2, fontSize: 30, fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif", fontWeight: "bold", textShadow: "2px 2px 12px rgba(0,0,0,0.8)", letterSpacing: 3, background: "linear-gradient(90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f)", backgroundSize: "200% 100%", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", backgroundPosition: `${(frame * 3) % 200}% 0` }}>
            {text.split("").map((char, i) => (
              <span key={i} style={{ display: "inline-block", transform: `translateY(${Math.sin(frame * 0.12 + i * 0.7) * 8}px)` }}>
                {char}
              </span>
            ))}
          </span>
        );
      }
      case "cinematic": {
        const barSlide = interpolate(frame, [0, 12], [100, 0], { extrapolateLeft: "clamp", easing: Easing.out(Easing.ease) });
        const textFade = interpolate(frame, [8, 18], [0, 1], { extrapolateLeft: "clamp", easing: Easing.out(Easing.ease) });
        return (
          <>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 65, background: "rgba(0,0,0,0.7)", transform: `translateY(${interpolate(barSlide, [0, 100], [-65, 0])}px)` }} />
            <div style={{ position: "absolute", bottom: 60, left: 0, right: 0, height: 65, background: "rgba(0,0,0,0.7)", transform: `translateY(${interpolate(barSlide, [0, 100], [65, 0])}px)` }}>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: textFade }}>
                <span style={{ color: "#fff", fontSize: 26, fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif", fontWeight: "bold", letterSpacing: 4 }}>{text}</span>
              </div>
            </div>
          </>
        );
      }
    }
  };

  return <div style={{ position: "absolute", bottom: 80, left: 0, right: 0, display: "flex", justifyContent: "center", ...baseStyle }}>{renderContent()}</div>;
};

// ===== Scene: Photo + Foreground Reveal + Subtitle =====

interface SceneProps {
  bgImg: string;
  fgImg: string;
  reveal: RevealType;
  subtitle: string;
  subtitleStyle: SubtitleStyle;
  duration: number;
  revealStart: number;
  sceneIndex: number;
}

const Scene: React.FC<SceneProps> = ({ bgImg, fgImg, reveal, subtitle, subtitleStyle, duration, revealStart, sceneIndex }) => {
  const frame = useCurrentFrame();
  const revealFrame = Math.max(0, frame - revealStart);
  const revealDur = 18;
  const fgStyle = useRevealStyle(reveal, revealFrame, revealDur);

  // Effect label (top left)
  const labelOpacity = interpolate(revealFrame, [0, 8, revealDur, revealDur + 15], [0, 1, 1, 0], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Background with Ken Burns */}
      <BackgroundLayer img={bgImg} duration={duration} />

      {/* Gradient overlay */}
      <AbsoluteFill style={{
        background: "linear-gradient(0deg, rgba(0,0,0,0.35) 0%, transparent 40%, transparent 70%, rgba(0,0,0,0.15) 100%)",
        pointerEvents: "none",
      }} />

      {/* Foreground reveal */}
      {frame >= revealStart && (
        <AbsoluteFill style={fgStyle}>
          <Img src={fgImg} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </AbsoluteFill>
      )}

      {/* Label */}
      {frame >= revealStart && (
        <div style={{ position: "absolute", top: 50, left: 40, opacity: labelOpacity, pointerEvents: "none", zIndex: 10 }}>
          <div style={{ color: "#ff0", fontSize: 14, fontFamily: "monospace", background: "rgba(0,0,0,0.5)", padding: "3px 10px", borderRadius: 4 }}>
            场景 {sceneIndex + 1} · {reveal}
          </div>
        </div>
      )}

      {/* Subtitle */}
      {subtitle && frame >= revealStart && (
        <SubtitleRenderer text={subtitle} frame={revealFrame} style={subtitleStyle} />
      )}
    </AbsoluteFill>
  );
};

// ===== Montage: Quick-cut foregrounds over gradient =====

const MontageSegment: React.FC<{ fgIndices: number[]; duration: number }> = ({ fgIndices, duration }) => {
  const frame = useCurrentFrame();
  const segFrames = Math.max(4, Math.floor(duration / fgIndices.length));
  const idx = Math.min(Math.floor(frame / segFrames), fgIndices.length - 1);
  const localFrame = frame - idx * segFrames;
  const progress = localFrame / segFrames;

  const zoom = interpolate(progress, [0, 1], [1.1, 0.95], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacity = idx === 0 ? 1 : interpolate(localFrame, [0, 2], [0, 1], { extrapolateLeft: "clamp" });
  const label = `fg_${String(fgIndices[idx]).padStart(3, "0")}`;

  // Flash transition between images
  const showFlash = localFrame < 3 && idx > 0;

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)" }}>
      <AbsoluteFill style={{ opacity, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Img
          src={staticFile(`/segmented/fg_${String(fgIndices[idx]).padStart(3, "0")}.png`)}
          style={{ maxWidth: "90%", maxHeight: "85%", objectFit: "contain", transform: `scale(${zoom})`, filter: "drop-shadow(0 0 30px rgba(100,100,255,0.3))" }}
        />
      </AbsoluteFill>

      <div style={{ position: "absolute", bottom: 30, left: 0, right: 0, textAlign: "center", pointerEvents: "none" }}>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, fontFamily: "monospace" }}>{label}</span>
      </div>

      {showFlash && (
        <AbsoluteFill style={{ backgroundColor: "#fff", opacity: interpolate(localFrame, [0, 3], [0.5, 0]), pointerEvents: "none" }} />
      )}
    </AbsoluteFill>
  );
};

// ===== Collage: 4 foregrounds in a grid =====

const CollageGrid: React.FC<{ fgIndices: number[]; duration: number }> = ({ fgIndices, duration }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, duration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)" }}>
      {fgIndices.slice(0, 4).map((idx, i) => {
        const cols = 2, rows = 2;
        const w = 100 / cols, h = 100 / rows;
        const x = (i % cols) * w, y = Math.floor(i / cols) * h;
        const delay = i * 5;
        const localP = interpolate(Math.max(0, frame - delay), [0, 15], [0, 1], { extrapolateLeft: "clamp", easing: Easing.out(Easing.ease) });
        return (
          <div key={i} style={{
            position: "absolute", left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`,
            overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.3)",
            opacity: localP,
            transform: `scale(${interpolate(localP, [0, 1], [0.85, 1])})`,
          }}>
            <Img
              src={staticFile(`/segmented/fg_${String(idx).padStart(3, "0")}.png`)}
              style={{ width: "100%", height: "100%", objectFit: "contain", transform: `scale(${1 + (i + 1) * 0.03})` }}
            />
          </div>
        );
      })}
      <div style={{ position: "absolute", bottom: 40, left: 0, right: 0, textAlign: "center", pointerEvents: "none" }}>
        <div style={{ color: "#fff", fontSize: 22, fontFamily: "sans-serif", fontWeight: "bold", textShadow: "2px 2px 8px rgba(0,0,0,0.8)", letterSpacing: 2, opacity: interpolate(frame, [0, 10, duration - 10, duration], [0, 1, 1, 0]) }}>
          北京 · 建筑之美
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
        <div style={{ fontSize: 68, fontWeight: "bold", color: "#fff", fontFamily: "sans-serif", transform: `scale(${interpolate(sp, [0, 1], [0.3, 1])})`, opacity: p, letterSpacing: 8, textShadow: "0 0 40px rgba(100,100,255,0.5)" }}>
          北京 · 建筑剪影
        </div>
        <div style={{ fontSize: 22, color: "rgba(255,255,255,0.5)", fontFamily: "sans-serif", marginTop: 16, opacity: interpolate(frame, [10, dur], [0, 1]) }}>
          阿里云 AI 分割 · 前景独立动画
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
        <div style={{ fontSize: 44, color: "#fff", fontFamily: "sans-serif", opacity: p, letterSpacing: 4 }}>北京旅行 · 记忆存档</div>
        <div style={{ fontSize: 18, color: "rgba(255,255,255,0.4)", fontFamily: "sans-serif", marginTop: 20, opacity: interpolate(frame, [15, dur], [0, 1]) }}>
          Powered by Remotion + Alibaba Cloud Vision API
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ===== Main Composition =====

const SCENE_DUR = 50;
const REVEAL_START = 12;

export const BeijingVlogSegmented: React.FC<Record<string, unknown>> = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Intro: 30 frames */}
      <Sequence from={0} durationInFrames={30} name="intro">
        <Intro />
      </Sequence>

      {/* 12 individual scenes: 50 frames each */}
      {SCENE_PAIRS.map((pair, i) => {
        const startFrame = 30 + i * SCENE_DUR;
        return (
          <Sequence key={i} from={startFrame} durationInFrames={SCENE_DUR} name={`scene-${i}`}>
            <Scene
              bgImg={staticFile(pair.bg)}
              fgImg={staticFile(pair.fg)}
              reveal={REVEAL_EFFECTS[i % REVEAL_EFFECTS.length]}
              subtitle={SUBTITLE_TEXTS[i]}
              subtitleStyle={SUBTITLE_STYLES[i % SUBTITLE_STYLES.length]}
              duration={SCENE_DUR}
              revealStart={REVEAL_START}
              sceneIndex={i}
            />
          </Sequence>
        );
      })}

      {/* Montage: foreground cutouts over gradient bg */}
      <Sequence from={30 + 12 * SCENE_DUR} durationInFrames={50} name="montage">
        <MontageSegment
          fgIndices={[10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 23, 24, 25, 26]}
          duration={50}
        />
      </Sequence>

      {/* Collage: 4 foregrounds in grid */}
      <Sequence from={30 + 12 * SCENE_DUR + 50} durationInFrames={35} name="collage">
        <CollageGrid
          fgIndices={[27, 28, 29, 30]}
          duration={35}
        />
      </Sequence>

      {/* Outro: 30 frames */}
      <Sequence from={30 + 12 * SCENE_DUR + 50 + 35} durationInFrames={30} name="outro">
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
