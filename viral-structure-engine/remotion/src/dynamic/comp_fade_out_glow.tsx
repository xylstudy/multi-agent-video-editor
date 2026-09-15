import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing, Img, Sequence } from 'remotion';

interface FadeOutGlowProps {
  src?: string;
  subtitleText?: string;
  glowColor?: string;
  glowIntensity?: number;
  glowRadius?: number;
  fadeDuration?: number;
  [key: string]: any;
}

const FadeOutGlow: React.FC<FadeOutGlowProps> = ({
  src = '',
  subtitleText = '期待下一次相遇',
  glowColor = '#FFD700',
  glowIntensity = 0.5,
  glowRadius = 30,
  fadeDuration = 2.0,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  // 计算淡入淡出效果
  const fadeFrames = Math.max(1, Math.min(durationInFrames, fadeDuration * fps));
  const fadeOutStartFrame = Math.max(0, durationInFrames - fadeFrames);
  const glowPeakFrame = fadeOutStartFrame + fadeFrames * 0.6;
  
  // 透明度：前段保持1，后段渐变为0
  const opacity = interpolate(
    frame,
    [fadeOutStartFrame, durationInFrames],
    [1, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.ease),
    }
  );

  // 辉光强度：从0开始，在淡出过程中达到峰值，然后随透明度降低
  const glowIntensityProgress = interpolate(
    frame,
    [fadeOutStartFrame, glowPeakFrame, durationInFrames],
    [0, glowIntensity * 1.2, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.ease),
    }
  );

  // 辉光半径：逐渐增大
  const currentGlowRadius = interpolate(
    frame,
    [fadeOutStartFrame, durationInFrames],
    [0, glowRadius * 2],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.ease),
    }
  );

  // 字幕淡入
  const subtitleStartFrame = Math.max(0, fadeOutStartFrame - fps);
  const subtitleOpacity = fadeOutStartFrame > subtitleStartFrame
    ? interpolate(
        frame,
        [subtitleStartFrame, fadeOutStartFrame],
        [0, 1],
        {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.out(Easing.ease),
        }
      )
    : 1;

  return (
    <AbsoluteFill style={{
      backgroundColor: 'black',
    }}>
      {/* 视频素材层 */}
      <AbsoluteFill style={{
        opacity: opacity,
        filter: `blur(${currentGlowRadius * 0.3}px)`,
      }}>
        {src && (
          <Img
            src={src}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        )}
      </AbsoluteFill>

      {/* 暖色辉光叠加层 */}
      <AbsoluteFill style={{
        backgroundColor: glowColor,
        opacity: glowIntensityProgress * 0.3,
        mixBlendMode: 'screen',
      }} />

      {/* 径向渐变辉光层 */}
      <AbsoluteFill style={{
        background: `radial-gradient(circle at 50% 50%, ${glowColor} ${currentGlowRadius}px, transparent ${currentGlowRadius * 2}px)`,
        opacity: glowIntensityProgress * 0.4,
        mixBlendMode: 'overlay',
      }} />

      {/* 字幕层 */}
      <Sequence from={subtitleStartFrame}>
        <AbsoluteFill style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingBottom: 100,
        }}>
          <div style={{
            color: '#ffffff',
            fontSize: 40,
            fontWeight: 600,
            fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            textShadow: `0 0 20px ${glowColor}, 0 0 40px ${glowColor}`,
            opacity: subtitleOpacity,
            textAlign: 'center',
            padding: '20px 40px',
            background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.3) 100%)',
            borderRadius: 8,
            maxWidth: '80%',
          }}>
            {subtitleText}
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

export default FadeOutGlow;
