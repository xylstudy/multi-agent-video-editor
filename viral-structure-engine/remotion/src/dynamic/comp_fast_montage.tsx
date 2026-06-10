import { useCurrentFrame, useVideoConfig, interpolate, Easing, AbsoluteFill, Img, Sequence, spring } from 'remotion';
import React from 'react';

interface MontageSegment {
  start_frame: number;
  end_frame: number;
  animation: 'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right' | 'none';
}

interface FastMontageProps {
  source_material_ids?: string[];
  montage_segments?: MontageSegment[];
  subtitle?: string;
  bgm_sync?: boolean;
  // 实际图片资源（由外部传入，模拟从 source_material_ids 加载）
  imageUrls?: string[];
}

// 模拟图片数据（实际项目中应从素材库加载）
const MOCK_IMAGES = [
  'https://picsum.photos/seed/hutong1/1080/1920',
  'https://picsum.photos/seed/redwall/1080/1920',
  'https://picsum.photos/seed/sign/1080/1920',
  'https://picsum.photos/seed/food1/1080/1920',
  'https://picsum.photos/seed/hutong2/1080/1920',
  'https://picsum.photos/seed/food2/1080/1920',
  'https://picsum.photos/seed/street/1080/1920',
  'https://picsum.photos/seed/market/1080/1920',
  'https://picsum.photos/seed/art/1080/1920',
  'https://picsum.photos/seed/culture/1080/1920',
];

const getAnimationStyle = (
  frame: number,
  segment: MontageSegment,
  segmentDuration: number
): React.CSSProperties => {
  const localFrame = frame - segment.start_frame;
  const progress = localFrame / segmentDuration;

  switch (segment.animation) {
    case 'zoom_in':
      return {
        transform: `scale(${interpolate(progress, [0, 1], [1.2, 1.0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })})`,
      };
    case 'zoom_out':
      return {
        transform: `scale(${interpolate(progress, [0, 1], [1.0, 1.2], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })})`,
      };
    case 'pan_left':
      return {
        transform: `translateX(${interpolate(progress, [0, 1], [0, -100], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })}px)`,
      };
    case 'pan_right':
      return {
        transform: `translateX(${interpolate(progress, [0, 1], [0, 100], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })}px)`,
      };
    default:
      return {};
  }
};

const FastMontage: React.FC<FastMontageProps> = ({
  montage_segments = [],
  subtitle = '',
  imageUrls = MOCK_IMAGES,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // 字幕淡入淡出效果
  const subtitleOpacity = interpolate(
    frame,
    [0, 15, durationInFrames - 15, durationInFrames],
    [0, 1, 1, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  // 字幕弹入动画
  const subtitleScale = spring({
    frame: frame,
    fps,
    config: {
      damping: 12,
      mass: 0.5,
      stiffness: 100,
    },
  });

  return (
    <AbsoluteFill style={{
      backgroundColor: '#000',
      overflow: 'hidden',
    }}>
      {/* 蒙太奇片段 */}
      {montage_segments.map((segment, index) => {
        const segmentDuration = segment.end_frame - segment.start_frame;
        const imageIndex = index % imageUrls.length;
        
        return (
          <Sequence
            key={index}
            from={segment.start_frame}
            durationInFrames={segmentDuration}
          >
            <AbsoluteFill style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Img
                src={imageUrls[imageIndex]}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  ...getAnimationStyle(frame, segment, segmentDuration),
                }}
              />
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {/* 字幕叠加层 */}
      {subtitle && (
        <div
          style={{
            position: 'absolute',
            bottom: 120,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            opacity: subtitleOpacity,
            transform: `scale(${subtitleScale})`,
            zIndex: 10,
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(8px)',
              padding: '16px 32px',
              borderRadius: 12,
              maxWidth: '80%',
              textAlign: 'center',
            }}
          >
            <span
              style={{
                color: '#FFFFFF',
                fontSize: 28,
                fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                fontWeight: 600,
                letterSpacing: 2,
                lineHeight: 1.5,
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              {subtitle}
            </span>
          </div>
        </div>
      )}

      {/* 装饰性光晕效果 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.08) 0%, transparent 70%)`,
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />
    </AbsoluteFill>
  );
};

export default FastMontage;
