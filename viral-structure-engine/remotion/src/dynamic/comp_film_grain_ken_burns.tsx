import { useCurrentFrame, useVideoConfig, interpolate, Easing, AbsoluteFill, Img, spring, random } from 'remotion';
import React from 'react';

interface FilmGrainKenBurnsProps {
  src?: string;
  animation?: 'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right';
  startScale?: number;
  endScale?: number;
  duration?: number;
  effects?: {
    grainIntensity?: number;
    glowIntensity?: number;
    glowColor?: string;
  };
}

const FilmGrainKenBurns: React.FC<FilmGrainKenBurnsProps> = ({
  src = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1080&h=1920&fit=crop',
  animation = 'zoom_in',
  startScale = 1.0,
  endScale = 1.15,
  duration = 4,
  effects = { grainIntensity: 0.3, glowIntensity: 0.2, glowColor: '#FFD700' },
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const totalFrames = duration * fps;

  // 计算缩放进度
  const progress = interpolate(frame, [0, totalFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.ease),
  });

  // 根据动画类型计算当前缩放值
  let currentScale: number;
  let translateX = 0;
  let translateY = 0;

  switch (animation) {
    case 'zoom_in':
      currentScale = interpolate(progress, [0, 1], [startScale, endScale]);
      break;
    case 'zoom_out':
      currentScale = interpolate(progress, [0, 1], [endScale, startScale]);
      break;
    case 'pan_left':
      currentScale = startScale;
      translateX = interpolate(progress, [0, 1], [0, -width * 0.2]);
      break;
    case 'pan_right':
      currentScale = startScale;
      translateX = interpolate(progress, [0, 1], [0, width * 0.2]);
      break;
    default:
      currentScale = startScale;
  }

  // 胶片颗粒效果 - 使用随机噪点
  const grainIntensity = effects.grainIntensity || 0.3;
  const grainCanvas = React.useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const value = Math.random() * 255 * grainIntensity;
      data[i] = value;     // R
      data[i + 1] = value; // G
      data[i + 2] = value; // B
      data[i + 3] = 255 * grainIntensity; // A
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL();
  }, [width, height, grainIntensity]);

  // 光晕效果
  const glowIntensity = effects.glowIntensity || 0.2;
  const glowColor = effects.glowColor || '#FFD700';
  const glowOpacity = interpolate(
    spring({
      frame,
      fps,
      config: { damping: 15, stiffness: 50 },
    }),
    [0, 1],
    [0, glowIntensity]
  );

  // 字幕淡入（可选，这里只做视觉参考）
  const subtitleOpacity = interpolate(frame, [totalFrames * 0.5, totalFrames * 0.7], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {/* 主图缩放层 */}
      <AbsoluteFill
        style={{
          transform: `scale(${currentScale}) translate(${translateX}px, ${translateY}px)`,
          transition: 'transform 0.1s ease-out',
        }}
      >
        <Img
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </AbsoluteFill>

      {/* 光晕叠加层 */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 50%, ${glowColor} 0%, transparent 70%)`,
          opacity: glowOpacity,
          pointerEvents: 'none',
        }}
      />

      {/* 胶片颗粒叠加层 */}
      {grainCanvas && (
        <AbsoluteFill
          style={{
            backgroundImage: `url(${grainCanvas})`,
            backgroundSize: 'cover',
            mixBlendMode: 'overlay' as any,
            opacity: 0.5,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* 字幕（用于视觉参考） */}
      <div
        style={{
          position: 'absolute',
          bottom: 120,
          left: 0,
          right: 0,
          textAlign: 'center',
          color: 'white',
          fontSize: 36,
          fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
          textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
          opacity: subtitleOpacity,
          letterSpacing: 4,
          padding: '0 40px',
        }}
      >
        夕阳下的白塔，是这座城市最温柔的诗
      </div>
    </AbsoluteFill>
  );
};

export default FilmGrainKenBurns;
