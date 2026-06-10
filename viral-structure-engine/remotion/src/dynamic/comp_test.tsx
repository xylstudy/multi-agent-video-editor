import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

/** LLM 生成的测试组件：渐变背景 + 旋转文字 */
const TestComponent: React.FC<{
  text?: string;
  bgColor?: string;
  accentColor?: string;
}> = ({ text = "Hello", bgColor = "#1a1a2e", accentColor = "#e94560" }) => {
  const frame = useCurrentFrame();

  const rotation = interpolate(frame, [0, 60], [0, 360]);
  const opacity = interpolate(frame, [0, 20, 40, 60], [0, 1, 1, 0]);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${bgColor}, ${accentColor})`,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          color: "#fff",
          fontSize: 72,
          fontWeight: 700,
          transform: `rotate(${rotation}deg)`,
          opacity,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

export default TestComponent;
