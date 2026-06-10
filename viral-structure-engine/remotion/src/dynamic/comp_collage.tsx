import { useCurrentFrame, useVideoConfig, interpolate, Easing, AbsoluteFill, Img } from 'remotion';
import React from 'react';

interface CollageProps {
  images: string[];
  layout: string;
  animation: string;
}

const Collage: React.FC<CollageProps> = ({ images, layout, animation }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const duration = durationInFrames / fps; // 总时长（秒）

  // 如果图片数量不足，用占位图补足
  const defaultImages = [
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2NjYyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7mtojmm7Tlm77niYc8L3RleHQ+PC9zdmc+',
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2NjYyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7mtojmm7Tlm77niYc8L3RleHQ+PC9zdmc+',
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2NjYyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7mtojmm7Tlm77niYc8L3RleHQ+PC9zdmc+',
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2NjYyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7mtojmm7Tlm77niYc8L3RleHQ+PC9zdmc+',
  ];
  const displayImages = images.length >= 4 ? images.slice(0, 4) : [...images, ...defaultImages].slice(0, 4);

  // 定义 4 个图片的起始位置（从屏幕外飞入）
  const startPositions = [
    { x: -300, y: -300 }, // 左上
    { x: 300, y: -300 },  // 右上
    { x: -300, y: 300 },  // 左下
    { x: 300, y: 300 },   // 右下
  ];

  // 最终位置（2x2 网格）
  const endPositions = [
    { x: 0, y: 0 },
    { x: 540, y: 0 },
    { x: 0, y: 960 },
    { x: 540, y: 960 },
  ];

  // 每个图片的动画延迟（帧）
  const delays = [0, 5, 10, 15];

  // 动画持续帧数
  const animDuration = 20;

  // 计算每个图片的进度
  const getProgress = (index: number) => {
    const delay = delays[index];
    const localFrame = Math.max(0, frame - delay);
    const progress = Math.min(localFrame / animDuration, 1);
    return progress;
  };

  // 缓动函数
  const easeOutBack = (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };

  const renderImage = (index: number) => {
    const progress = getProgress(index);
    const easedProgress = easeOutBack(progress);

    const startPos = startPositions[index];
    const endPos = endPositions[index];

    const currentX = interpolate(easedProgress, [0, 1], [startPos.x, endPos.x], {
      extrapolateRight: 'clamp',
    });
    const currentY = interpolate(easedProgress, [0, 1], [startPos.y, endPos.y], {
      extrapolateRight: 'clamp',
    });

    // 缩放：从 0.5 到 1
    const scale = interpolate(easedProgress, [0, 1], [0.5, 1], {
      extrapolateRight: 'clamp',
    });

    // 旋转：从 -15 度到 0 度（轻微摇摆效果）
    const rotation = interpolate(easedProgress, [0, 1], [-15, 0], {
      extrapolateRight: 'clamp',
    });

    // 透明度：从 0 到 1
    const opacity = interpolate(progress, [0, 0.3, 1], [0, 0.5, 1], {
      extrapolateRight: 'clamp',
    });

    // 边框阴影效果（自豪开心的氛围）
    const shadowOpacity = interpolate(progress, [0.5, 1], [0, 0.3], {
      extrapolateRight: 'clamp',
    });

    return (
      <div
        key={index}
        style={{
          position: 'absolute',
          left: currentX,
          top: currentY,
          width: 540,
          height: 960,
          transform: `scale(${scale}) rotate(${rotation}deg)`,
          opacity,
          boxShadow: `0 0 20px rgba(0,0,0,${shadowOpacity})`,
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <Img
          src={displayImages[index]}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ backgroundColor: '#1a1a2e' }}>
      {/* 背景光晕效果 */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          background: 'radial-gradient(circle at center, rgba(255,215,0,0.1) 0%, transparent 70%)',
        }}
      />
      {[0, 1, 2, 3].map((i) => renderImage(i))}
      {/* 装饰性星星粒子（可选） */}
      {[...Array(12)].map((_, i) => {
        const starDelay = (i * 3) % 30;
        const starProgress = Math.max(0, Math.min((frame - starDelay) / 15, 1));
        const starOpacity = interpolate(starProgress, [0, 0.5, 1], [0, 1, 0]);
        const starSize = interpolate(starProgress, [0, 1], [5, 15]);
        const starX = (i * 90 + 45) % 1080;
        const starY = (i * 160 + 80) % 1920;
        return (
          <div
            key={`star-${i}`}
            style={{
              position: 'absolute',
              left: starX,
              top: starY,
              width: starSize,
              height: starSize,
              backgroundColor: '#FFD700',
              borderRadius: '50%',
              opacity: starOpacity,
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 6px #FFD700',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export default Collage;
