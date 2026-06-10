import React from "react";
import { AbsoluteFill } from "remotion";
import type { StoryboardFrame, MaterialMap } from "../types/schema";
import { DynamicFrame } from "./DynamicFrame";

interface FrameLayerProps {
  frame: StoryboardFrame;
  materialMap: MaterialMap;
  durationInFrames: number;
}

/**
 * 单个分镜渲染层。
 * 委托 DynamicFrame 根据 render_component 分发到内置或自定义组件。
 */
export const FrameLayer: React.FC<FrameLayerProps> = ({
  frame,
  materialMap,
  durationInFrames,
}) => {
  return (
    <AbsoluteFill>
      <DynamicFrame
        frame={frame}
        materialMap={materialMap}
        durationInFrames={durationInFrames}
      />
    </AbsoluteFill>
  );
};
