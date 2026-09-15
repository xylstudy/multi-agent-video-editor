import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate, Easing, spring } from 'remotion';
import React from 'react';

const comp_fg_overlay_animation: React.FC<{
  backgroundSourceId?: string;
  foregroundSourceId?: string;
  subtitleText?: string;
  subtitleColor?: string;
  foregroundEffect?: string;
  foregroundDuration?: number;
}> = ({
  backgroundSourceId = '',
  foregroundSourceId = '',
  subtitleText = '',
  subtitleColor = '#ffd700',
  foregroundEffect = 'glow_fade_in',
  foregroundDuration = 4,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // 背景保持静态，但可以加一点缓慢缩放
  const bgScale = interpolate(frame, [0, durationInFrames], [1, 1.05], {
    extrapolateRight: 'clamp',
  });

  // 前景效果：发光淡入 + 轻微3D透视旋转
  // 使用 spring 动画让出现更自然
  const enterProgress = spring({
    frame: frame,
    fps,
    config: { damping: 12, stiffness: 80 },
  });

  // 透明度：从0到1，在0.5秒内完成
  const opacity = interpolate(enterProgress, [0, 1], [0, 1]);

  // 发光效果：模拟辉光，实际通过阴影和亮度模拟
  const glowOpacity = interpolate(enterProgress, [0, 0.3, 1], [0, 0.8, 0.2]);
  const glowSize = interpolate(enterProgress, [0, 0.5, 1], [0, 40, 20]);

  // 3D透视旋转：轻微左右摆动，模拟3D效果
  const rotateY = interpolate(
    frame % 120,
    [0, 60, 120],
    [-5, 5, -5],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.sin),
    }
  );

  // 字幕动画：从下方滑入
  const subtitleY = interpolate(frame, [20, 40], [200, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.back()),
  });
  const subtitleOpacity = interpolate(frame, [20, 40], [0, 1]);

  // DynamicFrame 已把素材 ID 解析为当前任务 HTTP 服务的完整 URL。
  const bgSrc = backgroundSourceId;
  const fgSrc = foregroundSourceId || backgroundSourceId;

  return (
    <AbsoluteFill style={{
      backgroundColor: '#000',
      width: 1080,
      height: 1920,
    }}>
      {/* 背景层 */}
      <AbsoluteFill style={{
        transform: `scale(${bgScale})`,
      }}>
        {bgSrc && (
          <Img
            src={bgSrc}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        )}
      </AbsoluteFill>

      {/* 前景层（抠图人物） */}
      <AbsoluteFill style={{
        opacity: opacity,
        transform: `
          perspective(1000px)
          rotateY(${rotateY}deg)
          scale(${1 + (1 - enterProgress) * 0.1})
        `,
        filter: `
          brightness(${0.5 + enterProgress * 0.5})
          drop-shadow(0 0 ${glowSize}px rgba(255, 215, 0, ${glowOpacity}))
        `,
        transition: 'transform 0.1s ease-out',
      }}>
        {fgSrc && (
          <Img
            src={fgSrc}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              // 假设前景图片已经是抠好的PNG，用mix-blend-mode可以增强效果
              // 如果是在绿幕上，可以加chroma key，这里假设已经抠好
            }}
          />
        )}
      </AbsoluteFill>

      {/* 金色字幕层 */}
      <AbsoluteFill style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 100,
      }}>
        <div
          style={{
            transform: `translateY(${subtitleY}px)`,
            opacity: subtitleOpacity,
            color: subtitleColor,
            fontSize: 56,
            fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            fontWeight: 'bold',
            textShadow: `
              0 2px 4px rgba(0,0,0,0.5),
              0 0 20px rgba(255,215,0,0.3),
              0 0 40px rgba(255,215,0,0.1)
            `,
            textAlign: 'center',
            letterSpacing: 4,
            lineHeight: 1.5,
            padding: '0 40px',
          }}
        >
          {subtitleText}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default comp_fg_overlay_animation;
