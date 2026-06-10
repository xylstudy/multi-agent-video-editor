import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

interface BlueTintedKenBurnsProps {
  src: string;
  animation?: 'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right';
  startScale?: number;
  endScale?: number;
  duration?: number;
  colorOverlay?: {
    color: string;
    opacity: number;
  };
}

const BlueTintedKenBurns: React.FC<BlueTintedKenBurnsProps> = ({
  src,
  animation = 'zoom_in',
  startScale = 1.0,
  endScale = 1.15,
  duration = 4,
  colorOverlay = { color: '#ADD8E6', opacity: 0.3 },
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Calculate normalized progress (0 to 1) over the duration
  const totalFrames = duration * fps;
  const progress = Math.min(frame / totalFrames, 1);

  // Determine scale based on animation type
  let scale: number;
  let translateX: number;
  let translateY: number;

  switch (animation) {
    case 'zoom_in':
      scale = interpolate(progress, [0, 1], [startScale, endScale]);
      translateX = 0;
      translateY = 0;
      break;
    case 'zoom_out':
      scale = interpolate(progress, [0, 1], [endScale, startScale]);
      translateX = 0;
      translateY = 0;
      break;
    case 'pan_left':
      scale = startScale;
      translateX = interpolate(progress, [0, 1], [0, -100]);
      translateY = 0;
      break;
    case 'pan_right':
      scale = startScale;
      translateX = interpolate(progress, [0, 1], [0, 100]);
      translateY = 0;
      break;
    default:
      scale = startScale;
      translateX = 0;
      translateY = 0;
  }

  const imageStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
  };

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: colorOverlay.color,
    opacity: colorOverlay.opacity,
    pointerEvents: 'none',
  };

  return (
    <AbsoluteFill>
      <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
        <Img src={src} style={imageStyle} />
      </div>
      <div style={overlayStyle} />
    </AbsoluteFill>
  );
};

export default BlueTintedKenBurns;
