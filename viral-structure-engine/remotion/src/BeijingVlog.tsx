import React from "react";
import {
  AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig,
  interpolate, spring, Easing, Img, staticFile,
} from "remotion";

// ================================================================
//  北京旅行 Vlog — 炫酷特效演示
//  使用实际照片，通过各种转场和动画展现
// ================================================================

interface BeijingVlogProps {
  material_map: Record<string, string>;
}

// ===== 工具函数 =====

/** Ken Burns 缩放 */
const useZoom = (dur: number, maxZoom = 1.1) => {
  const frame = useCurrentFrame();
  const sp = spring({ fps: 30, frame: Math.min(frame, dur), config: { damping: 300, stiffness: 200 } });
  return interpolate(sp, [0, 1], [1, maxZoom]);
};

/** 线性 progress */
const useProgress = (dur: number) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [0, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
};

// ===== 转场效果 =====

interface TransitionStyle {
  enterStyle: React.CSSProperties;
  overlayStyle?: React.CSSProperties;
}

const transitions: Record<string, (frame: number, dur: number) => TransitionStyle> = {
  // 直接切
  cut: () => ({ enterStyle: {} }),

  // 淡入
  fade: (f, d) => ({
    enterStyle: { opacity: interpolate(f, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }) },
  }),

  // 闪光白
  flash_white: (f, d) => ({
    enterStyle: { opacity: interpolate(f, [0, 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) },
    overlayStyle: {
      backgroundColor: "#fff",
      opacity: interpolate(f, [0, 3, 6], [1, 0.6, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    },
  }),

  // 缩放闪光
  zoom_flash: (f, d) => ({
    enterStyle: {
      transform: `scale(${interpolate(f, [0, 2, d], [1.12, 1.06, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.ease) })})`,
      opacity: interpolate(f, [0, 3], [0, 1]),
    },
    overlayStyle: {
      backgroundColor: "#fff",
      opacity: interpolate(f, [0, 2, 6], [1, 0.7, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    },
  }),

  // 故障抖动
  glitch: (f, d) => {
    const p = interpolate(f, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const intensity = 1 - p;
    return {
      enterStyle: {
        opacity: p,
        transform: `translateX(${Math.sin(f * 3.7) * intensity * 10}px) skewX(${Math.sin(f * 5.1) * intensity * 4}deg)`,
        filter: intensity > 0.3 ? "contrast(1.4) brightness(1.15)" : "none",
      },
    };
  },

  // 模糊入场
  blur_in: (f, d) => {
    const p = interpolate(f, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
    return { enterStyle: { filter: `blur(${interpolate(p, [0, 1], [12, 0])}px)`, opacity: p } };
  },

  // 旋转入场
  rotate_in: (f, d) => {
    const p = interpolate(f, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
    const sp = spring({ fps: 30, frame: Math.min(f, 14), config: { damping: 200, stiffness: 400 } });
    return { enterStyle: { transform: `rotate(${interpolate(p, [0, 1], [-6, 0])}deg) scale(${interpolate(sp, [0, 1], [0.95, 1])})`, opacity: p } };
  },

  // 滑入
  slide: (f, d) => {
    const p = interpolate(f, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
    return { enterStyle: { transform: `translateX(${interpolate(p, [0, 1], [-100, 0])}px)`, opacity: p } };
  },

  // 甩镜头
  whip: (f, d) => {
    const p = interpolate(f, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
    return { enterStyle: { transform: `translateX(${interpolate(p, [0, 1], [250, 0])}px)`, filter: `blur(${interpolate(p, [0, 1], [20, 0])}px)`, opacity: interpolate(f, [0, 4], [0, 1]) } };
  },
};

// ===== 图片场景 =====
const PhotoScene: React.FC<{
  img: string;
  motion: "zoom" | "pan" | "bounce";
  transition: string;
  transitionFrames: number;
  duration: number;
  label?: string;
  subtitle?: string;
}> = ({ img, motion, transition, transitionFrames, duration, label, subtitle }) => {
  const frame = useCurrentFrame();
  const progress = useProgress(duration);
  const zoomVal = useZoom(duration);

  let transform = "";
  if (motion === "zoom") transform = `scale(${zoomVal})`;
  else if (motion === "pan") transform = `scale(1.05) translateY(${interpolate(progress, [0, 1], [0, -40])}px)`;
  else if (motion === "bounce") transform = `scale(${zoomVal}) translateY(${Math.sin(progress * Math.PI * 3) * 5}px)`;

  const t = transitions[transition]?.(frame, transitionFrames) ?? { enterStyle: {} };
  const textOpacity = interpolate(frame, [0, 10, duration - 10, duration], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const labelY = interpolate(frame, [0, 10], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* 图片层 */}
      <AbsoluteFill style={{ ...t.enterStyle } as React.CSSProperties}>
        <div style={{ width: "100%", height: "100%", transform, overflow: "hidden" }}>
          <Img src={img} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      </AbsoluteFill>

      {/* 转场覆盖层 */}
      {t.overlayStyle && <AbsoluteFill style={t.overlayStyle as React.CSSProperties} />}

      {/* 场景装饰 */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        background: "linear-gradient(0deg, rgba(0,0,0,0.4) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.2) 100%)",
        pointerEvents: "none",
      }} />

      {/* 标签 */}
      {label && (
        <div style={{
          position: "absolute", top: 60, left: 40, opacity: textOpacity,
          transform: `translateY(${labelY}px)`, pointerEvents: "none",
        }}>
          <div style={{ color: "#fff", fontSize: 14, fontFamily: "monospace", background: "rgba(0,0,0,0.4)", padding: "4px 12px", borderRadius: 4 }}>
            转场: {transition} · 动画: {motion}
          </div>
        </div>
      )}

      {/* 字幕 */}
      {subtitle && (
        <div style={{
          position: "absolute", bottom: 80, left: 0, right: 0, textAlign: "center",
          opacity: textOpacity, pointerEvents: "none",
        }}>
          <div style={{
            color: "#fff", fontSize: 32, fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif",
            fontWeight: "bold", textShadow: "2px 2px 12px rgba(0,0,0,0.8)",
            letterSpacing: 2, lineHeight: 1.5,
          }}>
            {subtitle}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ===== 快速蒙太奇（多图快速切换） =====
const MontageSegment: React.FC<{
  images: string[];
  totalDuration: number;
  subtitle?: string;
}> = ({ images, totalDuration, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const segFrames = Math.floor(totalDuration / images.length);
  const idx = Math.min(Math.floor(frame / segFrames), images.length - 1);
  const localFrame = frame - idx * segFrames;
  const progress = localFrame / segFrames;

  const zoom = interpolate(progress, [0, 1], [1.2, 1.0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacity = idx === 0 ? 1 : interpolate(localFrame, [0, 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const subOpacity = interpolate(frame, [0, 10, totalDuration - 10, totalDuration], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill style={{ opacity }}>
        <Img src={images[idx]} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})` }} />
      </AbsoluteFill>

      {/* 闪烁切换指示 */}
      {localFrame < 3 && idx > 0 && (
        <AbsoluteFill style={{ backgroundColor: "#fff", opacity: interpolate(localFrame, [0, 3], [0.6, 0]) }} />
      )}

      {subtitle && (
        <div style={{
          position: "absolute", bottom: 80, left: 0, right: 0, textAlign: "center", opacity: subOpacity, pointerEvents: "none",
        }}>
          <div style={{
            color: "#fff", fontSize: 28, fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif",
            fontWeight: "bold", textShadow: "2px 2px 12px rgba(0,0,0,0.8)", letterSpacing: 2,
          }}>
            {subtitle}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ===== 分屏拼贴 =====
const CollageScene: React.FC<{
  images: string[];
  duration: number;
}> = ({ images, duration }) => {
  const frame = useCurrentFrame();
  const progress = useProgress(duration);
  const zoom = useZoom(duration);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {images.slice(0, 4).map((img, i) => {
        const cols = 2, rows = 2;
        const w = 100 / cols, h = 100 / rows;
        const x = (i % cols) * w, y = Math.floor(i / cols) * h;
        return (
          <div key={i} style={{
            position: "absolute", left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`,
            overflow: "hidden", border: "2px solid rgba(255,255,255,0.15)",
            transform: `scale(${interpolate(progress, [0, 1], [1.05, 1])})`,
          }}>
            <Img src={img} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1 + (i + 1) * 0.02})` }} />
          </div>
        );
      })}
      <div style={{ position: "absolute", bottom: 60, left: 0, right: 0, textAlign: "center", pointerEvents: "none" }}>
        <div style={{
          color: "#fff", fontSize: 24, fontFamily: "sans-serif", fontWeight: "bold",
          textShadow: "2px 2px 8px rgba(0,0,0,0.8)", letterSpacing: 2,
          opacity: interpolate(frame, [0, 10, duration - 10, duration], [0, 1, 1, 0]),
        }}>
          北京记忆
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ===== 片头 =====
const Intro: React.FC<{ img: string }> = ({ img }) => {
  const frame = useCurrentFrame();
  const dur = 30;
  const p = interpolate(frame, [0, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sp = spring({ fps: 30, frame: Math.min(frame, dur), config: { damping: 12, mass: 0.5, stiffness: 100 } });
  const scale = interpolate(sp, [0, 1], [0.3, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Img src={img} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.3)" }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 72, fontWeight: "bold", color: "#fff", fontFamily: "sans-serif", transform: `scale(${scale})`, opacity: p, letterSpacing: 8, textShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          北京
        </div>
        <div style={{ fontSize: 28, color: "rgba(255,255,255,0.7)", fontFamily: "sans-serif", marginTop: 16, opacity: interpolate(frame, [10, dur], [0, 1]) }}>
          旅行日记
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ===== 片尾 =====
const Outro: React.FC<{ img: string }> = ({ img }) => {
  const frame = useCurrentFrame();
  const dur = 30;
  const p = interpolate(frame, [0, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sp = spring({ fps: 30, frame: Math.min(frame, dur), config: { damping: 12, mass: 0.5, stiffness: 100 } });

  return (
    <AbsoluteFill>
      <Img src={img} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.4)" }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 48, color: "#fff", fontFamily: "sans-serif", opacity: p, transform: `scale(${interpolate(sp, [0, 1], [0.8, 1])})`, letterSpacing: 4 }}>
          下次见
        </div>
        <div style={{ fontSize: 20, color: "rgba(255,255,255,0.5)", fontFamily: "sans-serif", marginTop: 20, opacity: interpolate(frame, [15, dur], [0, 1]) }}>
          Made with Remotion
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ===== 主合成 =====
export const BeijingVlog: React.FC<BeijingVlogProps> = ({ material_map }) => {
  const images = Object.values(material_map);

  // 筛选出 /photos/ 路径（从 props JSON 传入）
  const paths = images.filter(p => p && p.startsWith("/photos/")).slice(0, 10);
  if (paths.length < 2) return <AbsoluteFill style={{ backgroundColor: "#000", color: "#fff", fontSize: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>需要至少 2 张图片 (found {paths.length})</AbsoluteFill>;

  // 转换为 Remotion staticFile() 可用的 URL
  const photoImgs = paths.map(p => staticFile(p));

  // 场景规划
  const SCENE_DUR = 30;
  const TRANS_DUR = 12;
  const sceneCount = Math.min(photoImgs.length, 10);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* 片头: 30帧 */}
      <Sequence from={0} durationInFrames={30} name="intro">
        <Intro img={photoImgs[0]} />
      </Sequence>

      {/* 场景 0-5: 逐张照片 + 不同转场 */}
      {Array.from({ length: Math.min(sceneCount, 6) }).map((_, i) => {
        const trans = ["fade", "glitch", "flash_white", "blur_in", "rotate_in", "slide", "whip", "zoom_flash"][i % 8];
        const motion = ["zoom", "pan", "bounce"][i % 3] as "zoom" | "pan" | "bounce";
        const subtitles = [
          "红墙与金黄琉璃瓦", "胡同里的慢时光", "街角的风景", "光影之间",
          "天空很蓝，风很轻", "每一帧都是故事",
        ];
        return (
          <Sequence key={i} from={30 + i * SCENE_DUR} durationInFrames={SCENE_DUR + TRANS_DUR} name={`scene-${i}`}>
            <PhotoScene
              img={photoImgs[i]}
              motion={motion}
              transition={trans}
              transitionFrames={TRANS_DUR}
              duration={SCENE_DUR + TRANS_DUR}
              label={`场景 ${i + 1}`}
              subtitle={subtitles[i] ?? ""}
            />
          </Sequence>
        );
      })}

      {/* 蒙太奇段: 快速切换多张照片 */}
      {sceneCount > 6 && (
        <Sequence from={30 + 6 * SCENE_DUR} durationInFrames={45} name="montage">
          <MontageSegment
            images={photoImgs.slice(0, 8)}
            totalDuration={45}
            subtitle="走过的路"
          />
        </Sequence>
      )}

      {/* 分屏拼贴 */}
      {sceneCount > 4 && (
        <Sequence from={30 + 6 * SCENE_DUR + (sceneCount > 6 ? 45 : 0)} durationInFrames={30} name="collage">
          <CollageScene images={photoImgs.slice(0, 4)} duration={30} />
        </Sequence>
      )}

      {/* 片尾: 最后一张 */}
      {(() => {
        const offset = 30 + 6 * SCENE_DUR + (sceneCount > 6 ? 45 : 0) + (sceneCount > 4 ? 30 : 0);
        return (
          <Sequence from={offset} durationInFrames={30} name="outro">
            <Outro img={photoImgs[photoImgs.length - 1]} />
          </Sequence>
        );
      })()}
    </AbsoluteFill>
  );
};
