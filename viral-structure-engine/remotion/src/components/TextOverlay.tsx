import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";
import type { FrameLayerConfig } from "../types/schema";

interface TextOverlayProps {
  layers: FrameLayerConfig[];
  durationInFrames: number;
}

/**
 * 渲染方案中 frame.layers 指定的文字层。
 *
 * 每个 layer 支持：
 * - type: "text" | "image" | "shape"
 * - content: 文字内容
 * - style.fontSize, style.color, style.strokeColor, style.strokeWidth
 * - style.animation: "fade_in" | "scale_in" | "slide_up" | "none"
 */
export const TextOverlay: React.FC<TextOverlayProps> = ({
  layers,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();

  if (!layers || layers.length === 0) return null;

  // 全局入场 progress
  const globalProgress = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {layers.map((layer, idx) => {
        if (layer.type !== "text" || !layer.content) return null;

        const style = (layer.style ?? {}) as Record<string, unknown>;
        const fontSize = (style.fontSize as number) ?? 36;
        const color = (style.color as string) ?? "#ffffff";
        const strokeColor = style.strokeColor as string | undefined;
        const strokeWidth = (style.strokeWidth as number) ?? 0;
        const animation = (style.animation as string) ?? "fade_in";
        const align = (style.textAlign as string) ?? "center";

        // 入场动画
        let opacity = 1;
        let transform = "";

        if (animation === "fade_in") {
          opacity = interpolate(globalProgress, [0, 1], [0, 1]);
        } else if (animation === "scale_in") {
          opacity = interpolate(globalProgress, [0, 1], [0, 1]);
          const scale = interpolate(globalProgress, [0, 1], [1.5, 1]);
          transform = `scale(${scale})`;
        } else if (animation === "slide_up") {
          opacity = interpolate(globalProgress, [0, 1], [0, 1]);
          const ty = interpolate(globalProgress, [0, 1], [40, 0]);
          transform = `translateY(${ty}px)`;
        }

        // 文字描边
        const textShadow = strokeColor && strokeWidth > 0
          ? `${strokeColor} 0 0 ${strokeWidth * 2}px, ${strokeColor} 0 0 ${strokeWidth}px`
          : "0 2px 8px rgba(0,0,0,0.6)";

        return (
          <div
            key={idx}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity,
              transform,
            }}
          >
            <span
              style={{
                fontSize,
                color,
                fontWeight: 700,
                fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                textShadow,
                textAlign: align as "center" | "left" | "right",
                letterSpacing: 2,
                lineHeight: 1.4,
                maxWidth: "85%",
              }}
            >
              {layer.content}
            </span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
