import React, { useCallback } from "react";
import { Audio, Sequence } from "remotion";
import { interpolate } from "remotion";

/** BGM 淡入/淡出时长（帧） */
const FADE_FRAMES = 15;

export interface BGMConfig {
  /** 音频文件路径（相对 public/ 或绝对路径） */
  src: string;
  /** 音量 0-1，默认 0.3 */
  volume?: number;
  /** 是否循环，默认 true */
  loop?: boolean;
  /** 淡入淡出时长（帧），默认 15 */
  fadeFrames?: number;
  /** 从第几帧开始裁剪 */
  trimBefore?: number;
  /** 裁剪到第几帧结束 */
  trimAfter?: number;
  /** 总时长（帧），用于淡出计算，默认 Infinity */
  totalDuration?: number;
}

interface AudioLayerProps {
  bgm: BGMConfig;
}

/**
 * BGM 音轨层 — 支持独立使用，无需 materialMap。
 *
 * 功能：
 * - 音量可配置，默认 30%
 * - 首尾淡入淡出
 * - 支持循环 / 裁剪
 * - 总时长任意，自动淡出
 */
export const AudioLayer: React.FC<AudioLayerProps> = ({ bgm }) => {
  const {
    src,
    volume = 0.3,
    loop = true,
    fadeFrames = FADE_FRAMES,
    trimBefore = 0,
    trimAfter,
    totalDuration,
  } = bgm;

  if (!src) return null;

  const resolvedSrc = src.startsWith("http://") || src.startsWith("https://")
    ? src
    : src.startsWith("/")
      ? src
      : src;

  const volumeCallback = useCallback(
    (f: number) => {
      const fadeIn = interpolate(f, [0, fadeFrames], [0, volume], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: (t) => t * t,
      });

      let fadeOut = 1;
      if (totalDuration && totalDuration > 0) {
        fadeOut = interpolate(
          f,
          [totalDuration - fadeFrames, totalDuration],
          [volume, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
      }

      if (fadeOut < fadeIn) return Math.max(0, fadeOut);
      return fadeIn;
    },
    [volume, fadeFrames, totalDuration]
  );

  return (
    <Sequence name="bgm" from={0} durationInFrames={Infinity}>
      <Audio
        src={resolvedSrc}
        volume={volumeCallback}
        trimBefore={trimBefore}
        trimAfter={trimAfter}
        loop={loop}
      />
    </Sequence>
  );
};

export const BGMVolume = {
  /** 背景氛围 — 几乎听不见 */
  ambient: 0.1,
  /** 轻柔背景（默认） */
  soft: 0.2,
  /** 正常背景 */
  normal: 0.3,
  /** 突出音乐 */
  prominent: 0.5,
  /** 音乐为主 */
  loud: 0.7,
} as const;
