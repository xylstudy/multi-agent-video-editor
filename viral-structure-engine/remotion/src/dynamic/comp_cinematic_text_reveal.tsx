import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing, Img, spring } from 'remotion';
import React from 'react';

interface CinematicTextRevealProps {
  text: string;
  fontColor: string;
  fontSize: number;
  glowIntensity: number;
  animation: string;
  backgroundDim: number;
}

export default function CinematicTextReveal(props: Record<string, any>) {
  const { text, fontColor, fontSize, glowIntensity, animation, backgroundDim } = props as CinematicTextRevealProps;
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // 文字动画参数
  const textStartFrame = 15; // 文字开始出现的帧
  const textHoldFrames = durationInFrames - 45; // 文字保持显示的帧数（留出淡出时间）
  const textFadeOutStart = durationInFrames - 30; // 文字淡出开始帧

  // 文字缩放动画（放大淡入）
  const scale = spring({
    frame: frame - textStartFrame,
    fps: 30,
    config: {
      damping: 12,
      stiffness: 100,
      mass: 0.5,
    },
  });

  // 文字透明度
  const textOpacity = interpolate(
    frame,
    [textStartFrame, textStartFrame + 20, textFadeOutStart, durationInFrames],
    [0, 1, 1, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.ease,
    }
  );

  // 背景亮度调整
  const backgroundOpacity = interpolate(
    frame,
    [textStartFrame, textStartFrame + 20, durationInFrames],
    [1, 1 - backgroundDim, 1 - backgroundDim],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  // 金色发光效果
  const glowOpacity = interpolate(
    frame,
    [textStartFrame, textStartFrame + 20, textFadeOutStart, durationInFrames],
    [0, glowIntensity, glowIntensity, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  // 文字位置（居中）
  const textY = interpolate(
    frame,
    [textStartFrame, textStartFrame + 30],
    [1200, 960], // 从下方移动到中心
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    }
  );

  return (
    <AbsoluteFill style={containerStyle}>
      {/* 背景视频层 */}
      <AbsoluteFill style={backgroundLayerStyle}>
        <Img
          src="https://images.unsplash.com/photo-1578894381163-e7192f6c1b4a?w=1080&h=1920&fit=crop"
          style={{
            ...backgroundImageStyle,
            opacity: backgroundOpacity,
          }}
        />
      </AbsoluteFill>

      {/* 发光层 */}
      <AbsoluteFill style={glowLayerStyle}>
        <div
          style={{
            ...glowTextStyle,
            fontSize: fontSize + 10,
            opacity: glowOpacity,
            color: fontColor,
            filter: `blur(${20 * glowIntensity}px)`,
          }}
        >
          {text}
        </div>
      </AbsoluteFill>

      {/* 文字层 */}
      <AbsoluteFill style={textLayerStyle}>
        <div
          style={{
            ...textStyle,
            fontSize: fontSize,
            color: fontColor,
            opacity: textOpacity,
            transform: `translateY(${textY - 960}px) scale(${scale})`,
            textShadow: `0 0 ${20 * glowIntensity}px ${fontColor}, 0 0 ${40 * glowIntensity}px ${fontColor}, 0 0 ${60 * glowIntensity}px ${fontColor}`,
          }}
        >
          {text}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

const containerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  backgroundColor: '#000',
};

const backgroundLayerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
};

const backgroundImageStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  transition: 'opacity 0.3s',
};

const glowLayerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 2,
};

const glowTextStyle: React.CSSProperties = {
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  fontWeight: 'bold',
  letterSpacing: '8px',
  userSelect: 'none',
};

const textLayerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 3,
};

const textStyle: React.CSSProperties = {
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  fontWeight: 'bold',
  letterSpacing: '6px',
  userSelect: 'none',
  whiteSpace: 'nowrap',
};
