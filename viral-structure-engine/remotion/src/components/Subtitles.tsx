import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Easing } from "remotion";

export interface SubtitleConfig {
  text: string;
  voiceover?: string;
  emotion?: string;
  durationInFrames: number;

  /** 逐词高亮模式（如 TikTok 风格） */
  wordHighlight?: boolean;
  /** 入场动画: fade_in（默认）, scale_up, none */
  animation?: "fade_in" | "scale_up" | "none";

  // === 自由定位与样式 ===

  /** 字体大小（px），默认 42 */
  fontSize?: number;
  /** 垂直位置: "bottom" | "top" | "center"，默认 "bottom" */
  verticalAlign?: "bottom" | "top" | "center";
  /** 距离顶部或底部的偏移（px），默认 80 */
  marginFromEdge?: number;
  /** 水平偏移（px），默认 0 */
  offsetX?: number;
  /** 文字颜色，默认 "#ffffff" */
  color?: string;
  /** 文字对齐: "left" | "center" | "right"，默认 "center" */
  textAlign?: "left" | "center" | "right";
  /** 最大宽度（百分比），默认 90 */
  maxWidthPercent?: number;
  /** 文字阴影，默认 "2px 2px 8px rgba(0,0,0,0.8)" */
  textShadow?: string;
  /** 背景色（如 "rgba(0,0,0,0.3)"），默认无 */
  background?: string;
  /** 背景内边距（px），有背景时生效 */
  padding?: string;
  /** 字间距（px），默认 0 */
  letterSpacing?: number;
  /** 字体粗细，默认 600 */
  fontWeight?: number;
  /** 自定义字体族 */
  fontFamily?: string;
  /** 行高，默认 1.5 */
  lineHeight?: number;
}

const CURSOR_BLINK_FRAMES = 16;

/**
 * 支持完全自由配置的字幕组件。
 *
 * 通过 SubtitleConfig 可以控制：
 * - 字号 / 颜色 / 字重 / 字间距 / 字体
 * - 垂直位置（top / center / bottom）+ 偏移
 * - 水平偏移 / 对齐
 * - 最大宽度 / 背景 / 内边距 / 阴影
 * - 入场动画（淡入 / 缩放）
 * - 逐词高亮模式
 */
export const Subtitles: React.FC<SubtitleConfig> = ({
  text,
  voiceover,
  durationInFrames,
  wordHighlight,
  animation = "fade_in",

  fontSize = 42,
  verticalAlign = "bottom",
  marginFromEdge = 80,
  offsetX = 0,
  color = "#ffffff",
  textAlign = "center",
  maxWidthPercent = 90,
  textShadow = "2px 2px 8px rgba(0,0,0,0.8)",
  background,
  padding,
  letterSpacing = 0,
  fontWeight = 600,
  fontFamily = "'PingFang SC', 'Microsoft YaHei', sans-serif",
  lineHeight = 1.5,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const displayText = text || voiceover || "";

  if (!displayText) return null;

  const chars = displayText.length;

  // ---- 渐入渐出 timing ----
  const ENTER_FRAMES = 8;
  const EXIT_FRAMES = 8;

  const enterProgress = interpolate(frame, [0, ENTER_FRAMES], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const exitProgress = interpolate(
    frame,
    [durationInFrames - EXIT_FRAMES, durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) },
  );
  const opacity = animation === "none" ? 1 : Math.min(enterProgress, 1 - exitProgress);
  const scale = animation === "scale_up"
    ? interpolate(enterProgress, [0, 1], [0.3, 1])
    : 1;

  // ---- 逐字显示进度 ----
  const charFrames = 2;
  const visibleChars = Math.min(Math.floor(frame / charFrames), chars);
  const visibleText = displayText.slice(0, visibleChars);

  // ---- 逐词高亮 ----
  const words = useMemo(() => displayText.split(/(\s+)/), [displayText]);
  const wordBoundaries = useMemo(() => {
    const boundaries: number[] = [];
    let pos = 0;
    for (const w of words) {
      pos += w.length;
      boundaries.push(pos);
    }
    return boundaries;
  }, [words, displayText]);

  const activeWordIndex = useMemo(() => {
    if (!wordHighlight) return -1;
    const wordsPerFrame = words.length / durationInFrames;
    return Math.min(Math.floor(frame * wordsPerFrame), words.length - 1);
  }, [frame, wordHighlight, words.length, durationInFrames]);

  // ---- 定位计算 ----
  const justifyContent = verticalAlign === "top" ? "flex-start"
    : verticalAlign === "center" ? "center"
    : "flex-end";

  const paddingStyle = verticalAlign === "top"
    ? { paddingTop: marginFromEdge, paddingBottom: 40 }
    : verticalAlign === "center"
    ? { paddingTop: 0, paddingBottom: 0 }
    : { paddingTop: 40, paddingBottom: marginFromEdge };

  const showCursor = visibleChars < chars;

  // ---- 文字基础样式 ----
  const textStyle: React.CSSProperties = {
    color,
    fontSize,
    fontFamily,
    fontWeight,
    textAlign,
    textShadow,
    letterSpacing: letterSpacing || undefined,
    lineHeight,
    opacity,
    transform: scale !== 1 ? `scale(${scale})` : undefined,
    maxWidth: `${maxWidthPercent}%`,
    margin: "0 auto",
    whiteSpace: "pre-wrap",
    background: background || undefined,
    padding: padding || undefined,
    borderRadius: padding ? 8 : undefined,
  };

  // ---- 渲染 ----
  if (wordHighlight) {
    let charOffset = 0;
    return (
      <AbsoluteFill
        style={{
          justifyContent,
          ...paddingStyle,
          paddingLeft: 40 + offsetX,
          paddingRight: 40,
          pointerEvents: "none",
        }}
      >
        <div style={textStyle}>
          {words.map((word, idx) => {
            const start = charOffset;
            const end = charOffset + word.length;
            charOffset = end;
            if (start >= visibleChars) return null;
            const isActive = idx === activeWordIndex;
            const wordVisible = visibleText.slice(start, end);
            return (
              <span
                key={idx}
                style={{
                  color: isActive ? "#39E508" : color,
                  transition: "none",
                }}
              >
                {wordVisible}
              </span>
            );
          })}
          {showCursor && (
            <span
              style={{
                opacity: interpolate(
                  frame % CURSOR_BLINK_FRAMES,
                  [0, CURSOR_BLINK_FRAMES / 2, CURSOR_BLINK_FRAMES],
                  [1, 0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                ),
                fontSize,
              }}
            >
              |
            </span>
          )}
        </div>
      </AbsoluteFill>
    );
  }

  // 普通模式
  return (
    <AbsoluteFill
      style={{
        justifyContent,
        ...paddingStyle,
        paddingLeft: 40 + offsetX,
        paddingRight: 40,
        pointerEvents: "none",
        marginLeft: offsetX < 0 ? Math.abs(offsetX) : 0,
      }}
    >
      <div style={textStyle}>
        {visibleText}
        {showCursor && (
          <span
            style={{
              opacity: interpolate(
                frame % CURSOR_BLINK_FRAMES,
                [0, CURSOR_BLINK_FRAMES / 2, CURSOR_BLINK_FRAMES],
                [1, 0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              ),
              fontSize,
            }}
          >
            |
          </span>
        )}
      </div>
    </AbsoluteFill>
  );
};
