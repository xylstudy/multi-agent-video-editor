import { useCurrentFrame, useVideoConfig, interpolate, Easing, AbsoluteFill, Img, Audio, Sequence, spring } from 'remotion';
import React from 'react';

interface SlowLifeMontageProps {
  source_material_ids?: string[];
  imagePath?: string;
  imageUrls?: string[];
  animation?: string;
  color_grade?: string;
  ambient_sound?: boolean;
  subtitle?: string;
  subtitle_animation?: string;
}

const SlowLifeMontage: React.FC<SlowLifeMontageProps> = ({
  source_material_ids = [],
  imagePath = '',
  imageUrls = [],
  animation = 'zoom_in_slow',
  color_grade = 'warm',
  ambient_sound = true,
  subtitle = '',
  subtitle_animation = 'fade_in'
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const imageSrc = imageUrls[0] || imagePath;

  // 缩放动画：缓慢推进
  const zoomScale = interpolate(frame, [0, durationInFrames], [1, 1.08], {
    easing: Easing.inOut(Easing.ease),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 暖色调叠加层透明度
  const warmOpacity = interpolate(frame, [0, durationInFrames * 0.3], [0, 0.15], {
    easing: Easing.inOut(Easing.ease),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 字幕淡入动画
  const subtitleOpacity = interpolate(
    frame,
    [durationInFrames * 0.1, durationInFrames * 0.3],
    [0, 1],
    {
      easing: Easing.inOut(Easing.ease),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  // 环境音提示（视觉元素：左下角的音量图标）
  const ambientOpacity = interpolate(frame, [0, 15], [0, 0.6], {
    easing: Easing.inOut(Easing.ease),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 轻微平移效果
  const translateX = interpolate(frame, [0, durationInFrames], [0, -15], {
    easing: Easing.inOut(Easing.ease),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 字幕底部间距动画
  const subtitleY = interpolate(
    frame,
    [durationInFrames * 0.1, durationInFrames * 0.3],
    [30, 0],
    {
      easing: Easing.out(Easing.quad),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  const containerStyle: React.CSSProperties = {
    width: 1080,
    height: 1920,
    overflow: 'hidden',
    position: 'relative',
    background: '#1a1a2e',
  };

  const imageStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: `scale(${zoomScale}) translateX(${translateX}px)`,
    transition: 'transform 0.1s ease-out',
  };

  const warmOverlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, #ff8c42 0%, #ffd700 50%, #ff6347 100%)',
    opacity: warmOpacity,
    mixBlendMode: 'overlay',
    pointerEvents: 'none',
  };

  const vignetteStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)',
    pointerEvents: 'none',
  };

  const ambientIndicatorStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 100,
    left: 40,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    opacity: ambientOpacity,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    letterSpacing: 2,
    textShadow: '0 0 10px rgba(0,0,0,0.5)',
  };

  const subtitleStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 180,
    left: '50%',
    transform: `translateX(-50%) translateY(${subtitleY}px)`,
    color: '#fff',
    fontSize: 36,
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    fontWeight: 300,
    letterSpacing: 4,
    opacity: subtitleOpacity,
    textAlign: 'center',
    width: '80%',
    textShadow: '0 2px 20px rgba(0,0,0,0.6)',
    lineHeight: 1.6,
  };

  // 装饰性元素：顶部光晕
  const lightGlowStyle: React.CSSProperties = {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 400,
    height: 400,
    background: 'radial-gradient(circle, rgba(255,200,100,0.15) 0%, transparent 70%)',
    pointerEvents: 'none',
    opacity: interpolate(frame, [0, durationInFrames * 0.5], [0, 0.3], {
      easing: Easing.inOut(Easing.ease),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  };

  return (
    <AbsoluteFill style={containerStyle}>
      {/* 背景图片 */}
      {imageSrc && <Img src={imageSrc} style={imageStyle} />}

      {/* 暖色调叠加层 */}
      <div style={warmOverlayStyle} />

      {/* 暗角效果 */}
      <div style={vignetteStyle} />

      {/* 顶部光晕 */}
      <div style={lightGlowStyle} />

      {/* 环境音提示 */}
      {ambient_sound && (
        <div style={ambientIndicatorStyle}>
          <span>🎧</span>
          <span>环境音 · 胡同</span>
        </div>
      )}

      {/* 字幕 */}
      {subtitle && (
        <div style={subtitleStyle}>
          {subtitle}
        </div>
      )}

      {/* 底部渐变黑边 */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        height: '40%',
        background: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 100%)',
        pointerEvents: 'none',
      }} />
    </AbsoluteFill>
  );
};

export default SlowLifeMontage;
