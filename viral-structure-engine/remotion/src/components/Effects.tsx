/**
 * 特效覆盖层组件
 * FilmGrain — CSS 噪点纹理
 * SpeedRampHook — 变速时间重映射
 * MotionBlur — 方向性运动模糊
 */
import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";

// ===== Film Grain Overlay =====

interface FilmGrainProps {
  opacity?: number;   // 0-1, default 0.15
  type?: "film" | "dust";
}

/**
 * 胶片颗粒噪点覆盖层。
 * 使用 CSS 渐变模拟胶片纹理，叠加在任意内容上方。
 */
export const FilmGrain: React.FC<FilmGrainProps> = ({
  opacity = 0.15,
  type = "film",
}) => {
  const frame = useCurrentFrame();
  // 每帧移动噪点位置，产生动态闪烁感
  const seed = (frame * 7.3) % 200;

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        opacity,
        mixBlendMode: "overlay" as React.CSSProperties["mixBlendMode"],
        backgroundImage: `
          repeating-conic-gradient(
            rgba(255,255,255,0.03) 0% 25%,
            transparent 0% 50%
          ),
          repeating-linear-gradient(
            45deg,
            transparent,
            rgba(0,0,0,0.02) ${seed + 1}px,
            transparent ${seed + 3}px
          ),
          repeating-linear-gradient(
            -45deg,
            transparent,
            rgba(255,255,255,0.02) ${(seed + 50) % 200 + 1}px,
            transparent ${(seed + 50) % 200 + 3}px
          )
        `,
        backgroundSize: `${type === "dust" ? "4px 4px" : "2px 2px"}, 200% 200%, 200% 200%`,
        backgroundPosition: `0 0, ${seed * 0.3}px ${seed * 0.7}px, ${-seed * 0.5}px ${-seed * 0.3}px`,
      }}
    />
  );
};

// ===== Speed Ramp Hook =====

export type RampType = "slow_fast" | "fast_slow" | "beat_hit" | "smooth";

interface SpeedRampOptions {
  frame: number;
  duration: number;
  rampType?: RampType;
  /** beat_hit 模式下的节拍帧位置 */
  beatFrame?: number;
}

/**
 * 变速时间重映射 Hook。
 * 输入线性帧，输出重映射后的 progress 值。
 *
 * slow_fast: 开始慢→逐渐加速（抖音常见）
 * fast_slow: 开始快→逐渐减速（子弹时间感）
 * beat_hit: 节拍点前后加速，形成爆发感
 * smooth: 缓入缓出匀速
 */
export const useSpeedRamp = ({
  frame,
  duration,
  rampType = "smooth",
  beatFrame,
}: SpeedRampOptions): number => {
  const progress = Math.min(frame / duration, 1);

  const remapped = useMemo(() => {
    switch (rampType) {
      case "slow_fast": {
        // 开始慢（ease-in），后半段快
        return interpolate(progress, [0, 0.5, 1], [0, 0.2, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.8, 0, 0.2, 1),
        });
      }
      case "fast_slow": {
        // 开始快，逐渐减速
        return interpolate(progress, [0, 1], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.1, 0.9, 0.3, 1),
        });
      }
      case "beat_hit": {
        // 在 beatFrame 处加速爆发
        const bf = beatFrame ?? Math.floor(duration * 0.6);
        const beatProgress = frame / bf;
        if (frame < bf) {
          return interpolate(beatProgress, [0, 1], [0, 0.8], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.ease),
          });
        }
        return interpolate(
          (frame - bf) / (duration - bf),
          [0, 1],
          [0.8, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.ease) }
        );
      }
      case "smooth":
      default:
        return interpolate(progress, [0, 1], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
    }
  }, [progress, rampType, frame, beatFrame, duration]);

  return remapped;
};

// ===== Motion Blur Overlay =====

interface MotionBlurProps {
  intensity?: number;   // 0-1 模糊强度
  direction?: "horizontal" | "vertical";
}

/**
 * 运动模糊模拟覆盖层。
 * 通过半透明副本 + CSS blur 实现快速移动的拖影效果。
 */
export const MotionBlur: React.FC<MotionBlurProps> = ({
  intensity = 0,
  direction = "horizontal",
}) => {
  if (intensity <= 0) return null;

  const blurPx = intensity * 20;
  const offsetPx = intensity * 15;
  const dirX = direction === "horizontal" ? offsetPx : 0;
  const dirY = direction === "vertical" ? offsetPx : 0;

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        mixBlendMode: "screen" as React.CSSProperties["mixBlendMode"],
        opacity: intensity * 0.3,
        filter: `blur(${blurPx}px)`,
        transform: `translate(${dirX}px, ${dirY}px)`,
        background: "transparent",
      }}
    />
  );
};

// ===== Whip Pan Enhanced =====

interface WhipPanStyle {
  transform: string;
  filter: string;
  opacity: number;
}

/**
 * 强化甩镜头计算。
 * 比普通 whip 更快的加速度 + 更重的运动模糊 + 轻微旋转。
 */
export const useWhipPanEnhanced = (
  frame: number,
  duration: number,
  direction: "left" | "right" = "right"
): WhipPanStyle => {
  const dir = direction === "right" ? 1 : -1;
  const progress = interpolate(frame, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.08, 0.9, 0.3, 1), // 快速启动，慢速结束（惯性感）
  });

  const dist = dir * interpolate(progress, [0, 1], [300, 0]);
  const blur = interpolate(progress, [0, 1], [35, 0]);
  const rot = interpolate(progress, [0, 1], [10, 0]) * dir;
  const opacity = interpolate(frame, [0, Math.min(6, duration)], [0, 1], {
    extrapolateLeft: "clamp",
  });

  return {
    transform: `translateX(${dist}px) rotate(${rot}deg)`,
    filter: `blur(${blur}px)`,
    opacity,
  };
};

// 从 DualTransitions 导出 useWhipPanDual 和 use3DFlip 供自定义组件使用
export { useWhipPanDual, use3DFlip } from "./DualTransitions";
