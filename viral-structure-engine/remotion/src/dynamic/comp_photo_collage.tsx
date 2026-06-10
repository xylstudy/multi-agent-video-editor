import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate, Easing, spring, random } from 'remotion';

interface StickerConfig {
  type: string;
  text?: string;
  emoji?: string;
  animation?: string;
}

interface PhotoCollageProps {
  images: string[];
  transitionDuration?: number;
  stickerConfig?: StickerConfig;
}

const PhotoCollage: React.FC<PhotoCollageProps> = ({
  images = [],
  transitionDuration = 0.5,
  stickerConfig
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 如果没有图片，显示占位
  if (images.length === 0) {
    return (
      <AbsoluteFill style={{
        backgroundColor: '#1a1a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#666',
        fontSize: 32,
        fontFamily: 'PingFang SC, Microsoft YaHei',
      }}>
        暂无照片
      </AbsoluteFill>
    );
  }

  // 计算每张图片的显示帧数（包括过渡）
  const transitionFrames = Math.round(transitionDuration * fps);
  const displayFramesPerImage = 30; // 每张图片基础显示30帧
  const totalFramesPerImage = displayFramesPerImage + transitionFrames * 2; // 入场过渡+显示+出场过渡

  // 计算当前应该显示哪张图片以及过渡进度
  const currentIndex = Math.floor(frame / totalFramesPerImage);
  const localFrame = frame % totalFramesPerImage;
  
  // 安全处理
  const safeIndex = Math.min(currentIndex, images.length - 1);
  const nextIndex = Math.min(safeIndex + 1, images.length - 1);

  // 过渡进度
  let transitionProgress = 1;
  let isEntering = false;
  let isExiting = false;

  if (localFrame < transitionFrames) {
    // 入场过渡
    isEntering = true;
    transitionProgress = localFrame / transitionFrames;
  } else if (localFrame < transitionFrames + displayFramesPerImage) {
    // 正常显示
    transitionProgress = 1;
  } else if (localFrame < totalFramesPerImage) {
    // 出场过渡
    isExiting = true;
    transitionProgress = 1 - (localFrame - transitionFrames - displayFramesPerImage) / transitionFrames;
  }

  // 缩放动画
  const scale = interpolate(transitionProgress, [0, 1], [0.8, 1.1], {
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  });

  // 透明度
  const opacity = interpolate(transitionProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);

  // 旋转效果
  const rotation = interpolate(transitionProgress, [0, 1], [-5, 5]);

  // 动态贴纸动画
  const stickerSpring = spring({
    frame: frame - safeIndex * totalFramesPerImage,
    fps,
    config: {
      damping: 12,
      mass: 0.5,
      stiffness: 100,
    },
  });

  const stickerOpacity = interpolate(stickerSpring, [0, 1], [0, 1]);
  const stickerScale = interpolate(stickerSpring, [0, 1], [0.5, 1.2]);
  const stickerBounce = interpolate(stickerSpring, [0, 0.5, 1], [0, -20, 0]);

  // 随机旋转角度（基于当前帧和图片索引）
  const randomRotation = interpolate(
    random(safeIndex * 100),
    [0, 1],
    [-3, 3]
  );

  // 随机位置偏移
  const randomX = interpolate(
    random(safeIndex * 100 + 1),
    [0, 1],
    [-20, 20]
  );
  const randomY = interpolate(
    random(safeIndex * 100 + 2),
    [0, 1],
    [-20, 20]
  );

  // 渲染贴纸
  const renderSticker = () => {
    if (!stickerConfig) return null;

    const stickerStyle: React.CSSProperties = {
      position: 'absolute',
      bottom: 60 + stickerBounce,
      right: 40,
      transform: `scale(${stickerScale})`,
      opacity: stickerOpacity,
      fontFamily: 'PingFang SC, Microsoft YaHei',
      zIndex: 10,
    };

    switch (stickerConfig.type) {
      case 'location_tag':
        return (
          <div style={{
            ...stickerStyle,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(10px)',
            padding: '12px 24px',
            borderRadius: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{ fontSize: 20 }}>📍</span>
            <span style={{ color: '#fff', fontSize: 20, fontWeight: 500 }}>
              {stickerConfig.text || '地点'}
            </span>
          </div>
        );
      case 'emoji':
        return (
          <div style={{
            ...stickerStyle,
            fontSize: 48,
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
          }}>
            {stickerConfig.emoji || '⭐'}
          </div>
        );
      case 'star':
        return (
          <div style={{
            ...stickerStyle,
            fontSize: 36,
            color: '#FFD700',
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
            animation: 'none',
          }}>
            ⭐
          </div>
        );
      default:
        return null;
    }
  };

  // 为每张图片添加装饰边框
  const renderBorder = () => {
    return (
      <div style={{
        position: 'absolute',
        top: -4,
        left: -4,
        right: -4,
        bottom: -4,
        border: '4px solid rgba(255,255,255,0.3)',
        borderRadius: 12,
        zIndex: 5,
      }} />
    );
  };

  return (
    <AbsoluteFill style={{
      backgroundColor: '#0a0a0a',
      overflow: 'hidden',
    }}>
      {/* 主图片 */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: `translate(-50%, -50%) translate(${randomX}px, ${randomY}px) scale(${scale}) rotate(${rotation + randomRotation}deg)`,
        opacity,
        width: '85%',
        height: '75%',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        transition: 'all 0.1s ease',
      }}>
        <Img
          src={images[safeIndex]}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        {renderBorder()}
      </div>

      {/* 下一张图片（用于过渡） */}
      {isExiting && safeIndex < images.length - 1 && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${interpolate(transitionProgress, [0, 1], [0.9, 1])})`,
          opacity: interpolate(transitionProgress, [0, 1], [0, 1]),
          width: '85%',
          height: '75%',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>
          <Img
            src={images[nextIndex]}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          {renderBorder()}
        </div>
      )}

      {/* 动态贴纸 */}
      {renderSticker()}

      {/* 装饰性光晕效果 */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `radial-gradient(circle at ${50 + randomX}% ${30 + randomY}%, rgba(255,255,255,0.1) 0%, transparent 60%)`,
        pointerEvents: 'none',
        zIndex: 2,
      }} />
    </AbsoluteFill>
  );
};

export default PhotoCollage;
