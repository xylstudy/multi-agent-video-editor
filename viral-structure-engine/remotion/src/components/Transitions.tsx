import React, { ReactNode, useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import type { TransitionType } from "../types/schema";

interface TransitionLayerProps {
  children: ReactNode;
  transitionType: TransitionType;
  durationInFrames: number;
}

// ============================================================
//  timing helpers — 分离"timing"（时间曲线）和"mapping"（值映射）
// ============================================================

/** 入场 timing：strong ease-out，0→1 经过 enterFrames 帧 */
const enterTiming = (
  frame: number,
  enterFrames: number,
) => interpolate(frame, [0, enterFrames], [0, 1], {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
  easing: Easing.bezier(0.16, 1, 0.3, 1), // crisp UI entrance, 无 overshoot
});

/** 线性 timing */
const linearTiming = (frame: number, dur: number) =>
  interpolate(frame, [0, dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/**
 * 转场包装层 —— 包裹单个分镜的内容，在开头应用入场转场。
 *
 * 支持 20+ 种转场效果：
 * - 基础: cut, fade, dissolve, none
 * - 闪光: flash_white, flash_black
 * - 方向滑入: slide, slide_left, slide_right, slide_up, slide_down
 * - 方向擦除: wipe_left, wipe_right, wipe_up, wipe_down  (clip-path)
 * - 缩放: zoom_in, zoom_out
 * - 特效: blur_in, rotate_in
 */
export const TransitionLayer: React.FC<TransitionLayerProps> = ({
  children,
  transitionType,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ---- 关键帧常量（集中管理） ----
  const ENTER_FRAMES = 10;  // 标准入场帧数
  const SLIDE_FRAMES = 14;  // 滑入/擦除帧数

  // ---- 分离 timing 与 mapping ----

  /** 标准入场 progress (0→1, ease-out bezier) */
  const enterProgress = useMemo(
    () => enterTiming(frame, ENTER_FRAMES),
    [frame],
  );

  /** 滑入类 progress (0→1, ease-out bezier, SLIDE_FRAMES) */
  const slideProgress = useMemo(
    () => enterTiming(frame, SLIDE_FRAMES),
    [frame],
  );

  /** 溶解 progress (0→1 全时长) */
  const dissolveProgress = useMemo(
    () => linearTiming(frame, durationInFrames),
    [frame, durationInFrames],
  );

  /** 擦除 progress (0→1, ease-out) */
  const wipeProgress = useMemo(
    () => enterTiming(frame, 12),
    [frame],
  );

  // ---- 从 progress 派生具体属性值 ----

  const opacity = enterProgress;
  const dissolveOpacity = dissolveProgress;

  const translateXFrom = (fromPx: number) =>
    interpolate(slideProgress, [0, 1], [fromPx, 0]);
  const translateYFrom = (fromPx: number) =>
    interpolate(slideProgress, [0, 1], [fromPx, 0]);

  const wipePct = interpolate(wipeProgress, [0, 1], [0, 100]);

  // spring 缩放入场（比线性缩放更自然）
  const springScale = spring({
    fps,
    frame: Math.min(frame, SLIDE_FRAMES),
    config: { damping: 200, stiffness: 400 },
  });
  const scaleIn = interpolate(springScale, [0, 1], [0.95, 1]);
  const scaleOutStart = interpolate(springScale, [0, 1], [1.08, 1]);

  /** 闪光透明度: 1→0.6→0 (前 8 帧) */
  const flashOpacity = interpolate(frame, [0, 4, 8], [1, 0.6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /** 模糊值: 10px→0 */
  const blurPx = interpolate(slideProgress, [0, 1], [10, 0]);

  /** 旋转度: -6°→0 */
  const rotateDeg = interpolate(slideProgress, [0, 1], [-6, 0]);

  // --- 转场渲染 ---

  switch (transitionType) {
    // ---- 直接切 / 无转场 ----
    case "cut":
    case "none":
      return <AbsoluteFill>{children}</AbsoluteFill>;

    // ---- 淡入 ----
    case "fade":
      return (
        <AbsoluteFill style={{ opacity }}>
          {children}
        </AbsoluteFill>
      );

    // ---- 溶解（全时长渐变） ----
    case "dissolve":
      return (
        <AbsoluteFill style={{ opacity: dissolveOpacity }}>
          {children}
        </AbsoluteFill>
      );

    // ---- 缩放 ----
    case "zoom_in":
      return (
        <AbsoluteFill style={{ transform: `scale(${scaleIn})`, opacity }}>
          {children}
        </AbsoluteFill>
      );
    case "zoom_out":
      return (
        <AbsoluteFill style={{ transform: `scale(${scaleOutStart})`, opacity }}>
          {children}
        </AbsoluteFill>
      );

    // ---- 闪光 ----
    case "flash_white":
      return (
        <AbsoluteFill>
          {children}
          <AbsoluteFill
            style={{
              backgroundColor: "#fff",
              opacity: flashOpacity,
              pointerEvents: "none",
            }}
          />
        </AbsoluteFill>
      );
    case "flash_black":
      return (
        <AbsoluteFill>
          {children}
          <AbsoluteFill
            style={{
              backgroundColor: "#000",
              opacity: flashOpacity,
              pointerEvents: "none",
            }}
          />
        </AbsoluteFill>
      );

    // ---- 滑入（方向性） ----
    case "slide":
    case "slide_left":
      return (
        <AbsoluteFill
          style={{
            transform: `translateX(${translateXFrom(-100)}px)`,
            opacity,
          }}
        >
          {children}
        </AbsoluteFill>
      );
    case "slide_right":
      return (
        <AbsoluteFill
          style={{
            transform: `translateX(${translateXFrom(100)}px)`,
            opacity,
          }}
        >
          {children}
        </AbsoluteFill>
      );
    case "slide_up":
      return (
        <AbsoluteFill
          style={{
            transform: `translateY(${translateYFrom(100)}px)`,
            opacity,
          }}
        >
          {children}
        </AbsoluteFill>
      );
    case "slide_down":
      return (
        <AbsoluteFill
          style={{
            transform: `translateY(${translateYFrom(-100)}px)`,
            opacity,
          }}
        >
          {children}
        </AbsoluteFill>
      );

    // ---- 擦除（clip-path 方向性） ----
    case "wipe_left":
      return (
        <AbsoluteFill
          style={{
            clipPath: `inset(0 ${100 - wipePct}% 0 0)`,
          }}
        >
          {children}
        </AbsoluteFill>
      );
    case "wipe_right":
      return (
        <AbsoluteFill
          style={{
            clipPath: `inset(0 0 0 ${100 - wipePct}%)`,
          }}
        >
          {children}
        </AbsoluteFill>
      );
    case "wipe_up":
      return (
        <AbsoluteFill
          style={{
            clipPath: `inset(${100 - wipePct}% 0 0 0)`,
          }}
        >
          {children}
        </AbsoluteFill>
      );
    case "wipe_down":
      return (
        <AbsoluteFill
          style={{
            clipPath: `inset(0 0 ${100 - wipePct}% 0)`,
          }}
        >
          {children}
        </AbsoluteFill>
      );

    // ---- 模糊入场 ----
    case "blur_in":
      return (
        <AbsoluteFill
          style={{
            filter: `blur(${blurPx}px)`,
            opacity,
          }}
        >
          {children}
        </AbsoluteFill>
      );

    // ---- 旋转入场 ----
    case "rotate_in":
      return (
        <AbsoluteFill
          style={{
            transform: `rotate(${rotateDeg}deg) scale(${scaleIn})`,
            opacity,
          }}
        >
          {children}
        </AbsoluteFill>
      );

    // ---- 甩镜头（横向高速滑入 + 模糊） ----
    case "whip": {
      const whipProgress = enterTiming(frame, durationInFrames);
      const whipX = interpolate(whipProgress, [0, 1], [250, 0]);
      const whipBlur = interpolate(whipProgress, [0, 1], [20, 0]);
      return (
        <AbsoluteFill
          style={{
            transform: `translateX(${whipX}px)`,
            filter: `blur(${whipBlur}px)`,
            opacity,
          }}
        >
          {children}
        </AbsoluteFill>
      );
    }

    // ---- 遮罩/圆形展开 ----
    case "mask":
    case "circle_reveal": {
      const circleProgress = enterTiming(frame, durationInFrames);
      const circlePct = interpolate(circleProgress, [0, 1], [0, 100]);
      return (
        <AbsoluteFill
          style={{
            clipPath: `circle(${circlePct}% at 50% 50%)`,
          }}
        >
          {children}
        </AbsoluteFill>
      );
    }

    // ---- 缩放闪光（zoom out + 闪白 → 复位） ----
    case "zoom_flash": {
      const zfScale = interpolate(frame, [0, 2, durationInFrames], [1.12, 1.06, 1], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
        easing: Easing.out(Easing.ease),
      });
      const zfFlash = interpolate(frame, [0, 2, 6], [1, 0.7, 0], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
      });
      return (
        <AbsoluteFill>
          <AbsoluteFill style={{ transform: `scale(${zfScale})` }}>
            {children}
          </AbsoluteFill>
          <AbsoluteFill
            style={{
              backgroundColor: "#fff",
              opacity: zfFlash,
              pointerEvents: "none",
            }}
          />
        </AbsoluteFill>
      );
    }

    // ---- 故障抖动（RGB 偏移 + 水平抖动） ----
    case "glitch": {
      const gIntensity = interpolate(
        frame, [0, 1, durationInFrames - 1, durationInFrames],
        [1, 1, 0, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );
      const shake = Math.sin(frame * Math.PI * 3.7) * gIntensity * 10;
      const skew = Math.sin(frame * Math.PI * 5.1) * gIntensity * 4;
      return (
        <AbsoluteFill
          style={{
            transform: `translateX(${shake}px) skewX(${skew}deg)`,
            filter: gIntensity > 0.3 ? "contrast(1.4) brightness(1.15)" : "none",
            opacity,
          }}
        >
          {children}
        </AbsoluteFill>
      );
    }

    // ---- 360° 旋转转场 ----
    case "spin": {
      const spProgress = enterTiming(frame, SLIDE_FRAMES);
      const spDeg = interpolate(spProgress, [0, 1], [360, 0]);
      const spScale = interpolate(spProgress, [0, 1], [1.2, 1]);
      const spBlur = interpolate(spProgress, [0, 1], [8, 0]);
      return (
        <AbsoluteFill style={{ transform: `rotate(${spDeg}deg) scale(${spScale})`, filter: `blur(${spBlur}px)`, opacity }}>
          {children}
        </AbsoluteFill>
      );
    }

    // ---- 重度缩放 + 闪白 ----
    case "zoom_heavy": {
      const zhScale = interpolate(frame, [0, 3, durationInFrames], [2.2, 1.8, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.ease) });
      const zhFlash = interpolate(frame, [0, 2, 8], [1, 0.8, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      const zhBlur = interpolate(frame, [0, 4, durationInFrames], [20, 8, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      return (
        <AbsoluteFill>
          <AbsoluteFill style={{ transform: `scale(${zhScale})`, filter: `blur(${zhBlur}px)` }}>{children}</AbsoluteFill>
          <AbsoluteFill style={{ background: "radial-gradient(circle at center, #fff, transparent 60%)", opacity: zhFlash, pointerEvents: "none" }} />
        </AbsoluteFill>
      );
    }

    // ---- 彩色漏光转场 ----
    case "light_leak": {
      const llP = enterTiming(frame, 14);
      const llX = interpolate(llP, [0, 1], [100, -20]);
      const llOp = interpolate(frame, [0, 4, 10, 14], [1, 0.8, 0.4, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      const llC = interpolate(frame, [0, 7, 14], [0.6, 0.3, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      return (
        <AbsoluteFill>
          <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>
          <AbsoluteFill style={{
            background: `linear-gradient(${70 + frame * 2}deg, rgba(255,${Math.floor(180 - llC * 100)},${Math.floor(80 - llC * 80)},${llOp}) 0%, rgba(255,${Math.floor(200 - llC * 80)},${Math.floor(120 - llC * 60)},${llOp * 0.5}) ${llX}%, transparent ${Math.min(100, llX + 30)}%)`,
            pointerEvents: "none",
          }} />
        </AbsoluteFill>
      );
    }

    // ---- 冻结帧 + RGB 偏移 ----
    case "freeze_frame": {
      const ffIntensity = interpolate(frame, [0, 3, 8], [0, 6, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      return (
        <AbsoluteFill style={{ opacity }}>
          {ffIntensity > 0.5 && (
            <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen" }}>
              <div style={{ position: "absolute", inset: 0, transform: `translateX(${ffIntensity}px)`, opacity: 0.4 }}>{children}</div>
            </AbsoluteFill>
          )}
          <AbsoluteFill>{children}</AbsoluteFill>
          {ffIntensity > 0.5 && (
            <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen" }}>
              <div style={{ position: "absolute", inset: 0, transform: `translateX(${-ffIntensity}px)`, opacity: 0.3 }}>{children}</div>
            </AbsoluteFill>
          )}
        </AbsoluteFill>
      );
    }

    // ---- 其他 ----
    default:
      return <AbsoluteFill>{children}</AbsoluteFill>;
  }
};
