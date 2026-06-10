import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from "remotion";

interface TextCardProps {
  text: string;
  bgColor: string;
  textColor: string;
  animation: string;
  durationInFrames: number;
}

// ============================================================
//  打字机逻辑 —— 纯函数，不含 hooks，遵循 skill 最佳实践
// ============================================================

/** 逐字显示，支持中间 pause */
const getTypedText = (
  frame: number,
  fullText: string,
  charFrames: number,
  pauseFrames: number,
): string => {
  const totalChars = fullText.length;
  // 第一阶段：逐字打出
  const typeEnd = totalChars * charFrames;
  if (frame < typeEnd) {
    return fullText.slice(0, Math.floor(frame / charFrames));
  }
  // 第二阶段：pause（全文本显示）
  if (frame < typeEnd + pauseFrames) {
    return fullText;
  }
  // 第三阶段：保持完整
  return fullText;
};

const CURSOR_BLINK_FRAMES = 16;

const Cursor: React.FC<{ frame: number; visible: boolean }> = ({ frame, visible }) => {
  if (!visible) return null;
  const blinkOpacity = interpolate(
    frame % CURSOR_BLINK_FRAMES,
    [0, CURSOR_BLINK_FRAMES / 2, CURSOR_BLINK_FRAMES],
    [1, 0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return (
    <span
      style={{
        opacity: blinkOpacity,
        fontSize: "inherit",
        fontWeight: "inherit",
        marginLeft: 2,
      }}
    >
      |
    </span>
  );
};

// ============================================================
//  TextCard 组件
// ============================================================

/**
 * 文字卡：全屏背景 + 居中文字，替代缺失的画面。
 * 遵循 skill 最佳实践：
 * - 打字机用 string slicing（非 per-character opacity）
 * - 入场用 ease-out bezier 曲线
 * - 出场用 ease-in
 * - 分离 timing 和 mapping
 */
export const TextCard: React.FC<TextCardProps> = ({
  text,
  bgColor,
  textColor,
  animation,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ---- timing（集中管理） ----
  const ENTER_FRAMES = 12;
  const EXIT_FRAMES = 10;

  /** 入场 progress 0→1 */
  const enterProgress = useMemo(
    () => interpolate(frame, [0, ENTER_FRAMES], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    }),
    [frame],
  );

  /** 出场 progress 0→1 */
  const exitProgress = useMemo(
    () => interpolate(
      frame,
      [durationInFrames - EXIT_FRAMES, durationInFrames],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) },
    ),
    [frame, durationInFrames],
  );

  // ---- 从 progress 映射到属性 ----
  const opacity = interpolate(enterProgress - exitProgress, [0, 1], [0, 1]);

  /** slide_in 位移 */
  const translateY = animation === "slide_in"
    ? interpolate(enterProgress, [0, 1], [100, 0])
    : 0;

  // ---- 打字机效果 ----
  const charFrames = 2;    // 每字 2 帧
  const pauseFrames = Math.round(fps * 0.8); // 打完后停顿 0.8s
  const isTypewriter = animation === "typewriter";

  const displayText = isTypewriter
    ? getTypedText(frame, text, charFrames, pauseFrames)
    : text;

  const isTypingDone = !isTypewriter || frame >= text.length * charFrames + pauseFrames;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        justifyContent: "center",
        alignItems: "center",
        padding: 60,
      }}
    >
      <div
        style={{
          color: textColor,
          fontSize: 64,
          fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
          fontWeight: 700,
          textAlign: "center",
          lineHeight: 1.6,
          opacity,
          transform: `translateY(${translateY}px)`,
          maxWidth: "90%",
          textShadow: "0 2px 12px rgba(0,0,0,0.3)",
        }}
      >
        <span>{displayText}</span>
        {isTypewriter && !isTypingDone && (
          <Cursor frame={frame} visible />
        )}
      </div>
    </AbsoluteFill>
  );
};
