import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring } from "remotion";

// ===== 纯数值验证：用 SVG 背景测试缩放/平移动画 =====

const GridSVG: React.FC = () => (
  <svg width="1080" height="1920" viewBox="0 0 1080 1920" style={{ position: "absolute", width: "100%", height: "100%" }}>
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ff6b6b" />
        <stop offset="50%" stopColor="#4ecdc4" />
        <stop offset="100%" stopColor="#45b7d1" />
      </linearGradient>
    </defs>
    <rect width="1080" height="1920" fill="url(#bg)" />
    {Array.from({ length: 20 }).map((_, i) => (
      <line key={`h${i}`} x1={0} y1={i * 96} x2={1080} y2={i * 96} stroke="rgba(255,255,255,0.3)" strokeWidth={2} />
    ))}
    {Array.from({ length: 12 }).map((_, i) => (
      <line key={`v${i}`} x1={i * 90} y1={0} x2={i * 90} y2={1920} stroke="rgba(255,255,255,0.3)" strokeWidth={2} />
    ))}
    <circle cx={540} cy={960} r={40} fill="none" stroke="#fff" strokeWidth={4} />
    <circle cx={540} cy={960} r={4} fill="#fff" />
  </svg>
);

// ---------- 测试1: zoom_in (spring) ----------
const TestZoomIn: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = 45;
  const sp = spring({ fps: 30, frame: Math.min(frame, dur), config: { damping: 300, stiffness: 200 } });
  const zoom = interpolate(sp, [0, 1], [1, 1.15]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${zoom})` }}>
        <GridSVG />
      </div>
      <Overlay frame={frame} dur={dur} label="ZOOM_IN" zoom={zoom} />
    </AbsoluteFill>
  );
};

// ---------- 测试2: zoom_out ----------
const TestZoomOut: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = 45;
  const progress = interpolate(frame, [0, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const zoom = interpolate(progress, [0, 1], [1.15, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${zoom})` }}>
        <GridSVG />
      </div>
      <Overlay frame={frame} dur={dur} label="ZOOM_OUT" zoom={zoom} />
    </AbsoluteFill>
  );
};

// ---------- 测试3: pan_right ----------
const TestPanRight: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = 45;
  const progress = interpolate(frame, [0, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const panX = interpolate(progress, [0, 1], [0, 100]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${panX}px)` }}>
        <GridSVG />
      </div>
      <Overlay frame={frame} dur={dur} label="PAN_RIGHT" pan={panX} />
    </AbsoluteFill>
  );
};

// ---------- 测试4: pan_left ----------
const TestPanLeft: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = 45;
  const progress = interpolate(frame, [0, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const panX = interpolate(progress, [0, 1], [0, -100]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${panX}px)` }}>
        <GridSVG />
      </div>
      <Overlay frame={frame} dur={dur} label="PAN_LEFT" pan={panX} />
    </AbsoluteFill>
  );
};

// ---------- 测试5: KenBurns 完整模拟（zoom_in + pan 组合） ----------
const TestKenBurns: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = 60;
  const sp = spring({ fps: 30, frame: Math.min(frame, dur), config: { damping: 300, stiffness: 200 } });
  const zoom = interpolate(sp, [0, 1], [1, 1.1]);
  const progress = interpolate(frame, [0, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const panX = interpolate(progress, [0, 1], [0, 30]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${zoom}) translateX(${panX}px)` }}>
        <GridSVG />
      </div>
      <Overlay frame={frame} dur={dur} label="ZOOM_IN + PAN" zoom={zoom} pan={panX} />
    </AbsoluteFill>
  );
};

// ---------- 叠加信息 ----------
const Overlay: React.FC<{ frame: number; dur: number; label: string; zoom?: number; pan?: number }> = ({
  frame, dur, label, zoom, pan,
}) => (
  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", padding: 40 }}>
    <div style={{
      background: "rgba(0,0,0,0.75)", padding: "16px 24px", borderRadius: 10,
      color: "#fff", fontSize: 22, fontFamily: "monospace", lineHeight: 1.6,
    }}>
      <div style={{ color: "#ff0", fontWeight: "bold", marginBottom: 4 }}>{label}</div>
      <div>Frame: {frame}/{dur}</div>
      {zoom !== undefined && (
        <div style={{ color: zoom > 1.005 ? "#0f0" : "#f66" }}>
          zoom: {zoom.toFixed(4)} {zoom > 1.005 ? "✓" : ""}
        </div>
      )}
      {pan !== undefined && (
        <div style={{ color: Math.abs(pan) > 2 ? "#0f0" : "#f66" }}>
          pan: {pan.toFixed(1)}px {Math.abs(pan) > 2 ? "✓" : ""}
        </div>
      )}
    </div>
  </div>
);

// ===== 主测试：6 段串联 =====
export const KenBurnsTestSuite: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <Sequence from={0} durationInFrames={45} name="zoom-in"><TestZoomIn /></Sequence>
    <Sequence from={45} durationInFrames={45} name="zoom-out"><TestZoomOut /></Sequence>
    <Sequence from={90} durationInFrames={45} name="pan-right"><TestPanRight /></Sequence>
    <Sequence from={135} durationInFrames={45} name="pan-left"><TestPanLeft /></Sequence>
    <Sequence from={180} durationInFrames={60} name="kenburns"><TestKenBurns /></Sequence>
  </AbsoluteFill>
);
