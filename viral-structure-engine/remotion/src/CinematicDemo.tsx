import React, { useEffect, useRef } from "react";
import {
  AbsoluteFill, Sequence, Img, staticFile, useCurrentFrame, useVideoConfig,
  interpolate, spring, Easing,
} from "remotion";
import { FilmGrain } from "./components/Effects";

// ================================================================
//  CinematicDemo — 跳出"PPT 感"的进阶特效示范
//
//  对比现有 CSS transform/opacity/filter 动画，这里演示三样更接近
//  影视级 / 抖音效果的技术，全部用 React + 数学函数在 Remotion 里实现：
//   1. Canvas 粒子层        —— 尘埃 + 散景，纯 DOM 动画做不出的有机质感
//   2. 真实运动模糊 (Trail) —— 多帧残影，甩镜时有拖影，不是贴一张模糊图
//   3. 卡点缩放 + 粒子爆发   —— spring 过冲回弹 + 中心粒子放射 + 白闪
//  外加：胶片颗粒覆盖层、电影黑条、甩镜横向光条。
//  所有粒子位置由 hash(i) 生成，逐帧确定性，可复现、可并行渲染。
// ================================================================

const PHOTO_A = "/photos/88250e8474df89bdc677ba059048b55c.jpg";
const PHOTO_B = "/photos/微信图片_20260602210252_47_11.jpg";

// 场景时间轴（30fps）
const S_INTRO = 45;
const S_DUST = 90;      // 45–135   尘埃粒子
const S_WHIP = 70;      // 135–205  真实运动模糊甩镜
const S_BEAT = 140;     // 205–345  卡点缩放 + 粒子爆发
const S_OUTRO = 45;     // 345–390  结尾

export const CINEMATIC_DEMO_DURATION = S_INTRO + S_DUST + S_WHIP + S_BEAT + S_OUTRO; // 390

// 确定性伪随机：只依赖 index，保证同一帧重复渲染结果一致
const hash = (n: number): number => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const wrap = (v: number, m: number): number => ((v % m) + m) % m;

// ===== 1. Canvas 尘埃 + 散景粒子层 =====

interface DustParticlesProps {
  count?: number;      // 小尘埃数量
  bokehCount?: number; // 大散景数量
  speed?: number;      // 上升速度系数
  opacity?: number;
}

const DustParticles: React.FC<DustParticlesProps> = ({
  count = 70,
  bokehCount = 14,
  speed = 1,
  opacity = 0.5,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    // 小尘埃：缓慢上升的亮点
    for (let i = 0; i < count; i++) {
      const x = wrap(hash(i) * width + frame * (6 + hash(i + 1) * 14) * speed, width);
      const y = wrap(hash(i + 50) * height - frame * (4 + hash(i + 2) * 16) * speed, height);
      const r = 0.8 + hash(i + 7) * 1.8;
      const a = 0.15 + hash(i + 9) * 0.3 + Math.sin(frame * 0.05 + i) * 0.08;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0, Math.min(1, a))})`;
      ctx.fill();
    }

    // 散景：径向渐变软光斑，模拟浅景深
    for (let i = 0; i < bokehCount; i++) {
      const x = wrap(hash(i + 101) * width + frame * (2 + hash(i + 11) * 6) * speed, width);
      const y = wrap(hash(i + 151) * height - frame * (1 + hash(i + 12) * 5) * speed, height);
      const r = 14 + hash(i + 17) * 34;
      const a = 0.05 + hash(i + 19) * 0.12;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [frame, width, height, count, bokehCount, speed]);

  return (
    <canvas
      ref={ref}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity, mixBlendMode: "screen" }}
    />
  );
};

// ===== 2. 真实运动模糊（多帧残影 Trail）=====

interface MotionTrailProps {
  layers?: number;        // 残影层数
  lagInFrames?: number;   // 每层时间偏移
  trailOpacity?: number;  // 每层不透明度衰减
  children: (lagFrames: number) => React.ReactNode;
}

/**
 * 把子内容复制渲染 layers 层，每层读取更早 N 帧的状态并降低不透明度，
 * 从而在快速移动时留下"上一帧位置"的残影 —— 这才是真实的运动模糊拖影，
 * 而不是盖一张静止的模糊图。最上层（lag=0）完全不透明，静止时覆盖下层。
 */
const MotionTrail: React.FC<MotionTrailProps> = ({
  layers = 5,
  lagInFrames = 2,
  trailOpacity = 0.35,
  children,
}) => {
  const arr = Array.from({ length: layers });
  return (
    <>
      {arr.map((_, k) => {
        const i = layers - 1 - k; // k=0 为最底层（lag 最大），k=layers-1 为主层
        const lag = i * lagInFrames;
        return (
          <AbsoluteFill
            key={i}
            style={{
              opacity: i === 0 ? 1 : Math.pow(trailOpacity, i),
              filter: i === 0 ? "none" : `blur(${i * 3}px)`,
              zIndex: i,
            }}
          >
            {children(lag)}
          </AbsoluteFill>
        );
      })}
    </>
  );
};

// ===== 粒子爆发（卡点放射）=====

interface ParticleBurstProps {
  trigger: number; // 场景内触发帧
  frame: number;   // 场景内当前帧
  count?: number;
}

const ParticleBurst: React.FC<ParticleBurstProps> = ({ trigger, frame, count = 64 }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const { width, height } = useVideoConfig();
  const local = frame - trigger;
  const t = local / 42; // 42 帧爆发

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    if (local < 0 || t > 1) return;

    const cx = width / 2;
    const cy = height / 2;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + hash(i) * 0.4;
      const spd = 420 + hash(i + 31) * 900;
      const dist = (spd * local) / 30;
      const x = cx + Math.cos(ang) * dist;
      const y = cy + Math.sin(ang) * dist;
      const r = 4 + hash(i + 57) * 8;
      const a = (1 - t) * 0.85;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [local, t, width, height, count]);

  return (
    <canvas ref={ref} style={{ position: "absolute", inset: 0, pointerEvents: "none", mixBlendMode: "screen" }} />
  );
};

// ===== 通用装饰层 =====

const CinematicBars: React.FC = () => {
  const frame = useCurrentFrame();
  const slide = interpolate(frame, [0, 12], [-90, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.ease),
  });
  const bar = { position: "absolute" as const, left: 0, right: 0, height: 90, backgroundColor: "#000", zIndex: 60 };
  return (
    <>
      <div style={{ ...bar, top: 0, transform: `translateY(${slide}px)` }} />
      <div style={{ ...bar, bottom: 0, transform: `translateY(${-slide}px)` }} />
    </>
  );
};

const TechBadge: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: "clamp" });
  return (
    <div style={{ position: "absolute", top: 200, left: 0, right: 0, display: "flex", justifyContent: "center", opacity, pointerEvents: "none", zIndex: 70 }}>
      <span style={{
        color: "#0ff", fontSize: 30, fontFamily: "'PingFang SC','Microsoft YaHei',monospace",
        background: "rgba(0,0,0,0.6)", padding: "8px 28px", borderRadius: 8,
        border: "2px solid rgba(0,255,255,0.4)", letterSpacing: 4,
      }}>
        {text}
      </span>
    </div>
  );
};

// ===== 场景：片头 =====

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.ease) });
  const sp = spring({ fps: 30, frame: Math.min(frame, 24), config: { damping: 12, mass: 0.5, stiffness: 120 } });
  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)" }}>
      <DustParticles opacity={0.6} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 72, fontWeight: 900, color: "#fff", letterSpacing: 10, transform: `scale(${interpolate(sp, [0, 1], [0.6, 1])})`, opacity: p, textShadow: "0 0 60px rgba(100,180,255,0.6)" }}>
          Remotion 进阶特效
        </div>
        <div style={{ fontSize: 30, color: "rgba(255,255,255,0.75)", marginTop: 28, letterSpacing: 6, opacity: interpolate(frame, [16, 32], [0, 1], { extrapolateLeft: "clamp" }) }}>
          粒子 · 真实运动模糊 · 卡点爆发
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ===== 场景：尘埃粒子 + 胶片颗粒 =====

const DustScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const z = interpolate(spring({ fps, frame: Math.min(frame, durationInFrames), config: { damping: 300, stiffness: 200 } }), [0, 1], [1, 1.08]);
  const y = interpolate(frame / durationInFrames, [0, 1], [0, -24], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill style={{ transform: `scale(${z}) translateY(${y}px)` }}>
        <Img src={staticFile(PHOTO_A)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      {/* 暗角 */}
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
      <DustParticles opacity={0.7} speed={1.4} />
      <FilmGrain opacity={0.12} />
      <TechBadge text="Canvas 粒子层 + 胶片颗粒" />
      <CinematicBars />
    </AbsoluteFill>
  );
};

// ===== 场景：真实运动模糊甩镜 =====

const WhipScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hold = 16;   // A 静止
  const whipDur = 22; // 甩镜时长
  const ease = Easing.bezier(0.1, 0.6, 0.4, 1);

  const whipP = interpolate(frame, [hold, hold + whipDur], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease,
  });
  const aSlide = interpolate(whipP, [0, 1], [0, -280]);
  const streakX = interpolate(whipP, [0, 1], [2400, -2400]);
  const streakOp = Math.sin(whipP * Math.PI);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* A 向左退场 */}
      <AbsoluteFill style={{ transform: `translateX(${aSlide}px)` }}>
        <Img src={staticFile(PHOTO_A)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.1)" }} />
      </AbsoluteFill>

      {/* B 甩入 —— 套上真实运动模糊残影 */}
      <MotionTrail layers={5} lagInFrames={2} trailOpacity={0.35}>
        {(lag) => {
          const f = Math.max(0, frame - lag);
          const wp = interpolate(f, [hold, hold + whipDur], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease,
          });
          const slide = interpolate(wp, [0, 1], [1500, 0]);
          const zoom = interpolate(wp, [0, 1], [1.16, 1.04]);
          return (
            <AbsoluteFill style={{ transform: `translateX(${slide}px)` }}>
              <Img src={staticFile(PHOTO_B)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})` }} />
            </AbsoluteFill>
          );
        }}
      </MotionTrail>

      {/* 甩镜瞬间横向光条 */}
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", opacity: streakOp, zIndex: 55 }}>
        <div style={{ width: "120%", height: 60, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)", filter: "blur(14px)", transform: `translateX(${streakX}px)` }} />
      </AbsoluteFill>

      {/* 甩镜峰值白闪 */}
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: interpolate(frame, [hold + whipDur / 2, hold + whipDur / 2 + 3], [0.3, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }} />

      <FilmGrain opacity={0.1} />
      <TechBadge text="真实运动模糊 · 多帧残影 Trail" />
      <CinematicBars />
    </AbsoluteFill>
  );
};

// ===== 场景：卡点缩放 + 粒子爆发 =====

const BeatScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beats = [24, 100];

  const drift = Math.sin(frame * 0.02) * 8;
  const zoom = beats.reduce((acc, beat) => {
    const local = frame - beat;
    if (local < 0 || local > 44) return acc;
    const sp = spring({ fps, frame: Math.min(local, 44), config: { damping: 6, mass: 0.7, stiffness: 190 } });
    return acc * interpolate(sp, [0, 1], [1, 1.18]); // 过冲回弹
  }, 1);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill style={{ transform: `scale(${zoom}) translateX(${drift}px)` }}>
        <Img src={staticFile(PHOTO_B)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.08)" }} />
      </AbsoluteFill>

      {beats.map((beat, i) => <ParticleBurst key={`b${i}`} trigger={beat} frame={frame} />)}
      {beats.map((beat, i) => {
        const fl = interpolate(frame - beat, [0, 5], [0.45, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return <AbsoluteFill key={`f${i}`} style={{ backgroundColor: "#fff", opacity: fl }} />;
      })}

      <FilmGrain opacity={0.1} />
      <TechBadge text="卡点缩放 · spring 过冲回弹 + 粒子爆发" />
      <CinematicBars />
    </AbsoluteFill>
  );
};

// ===== 场景：结尾 =====

const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)" }}>
      <DustParticles opacity={0.4} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: p }}>
        <div style={{ fontSize: 52, fontWeight: 800, color: "#fff", letterSpacing: 8, textShadow: "0 0 40px rgba(100,180,255,0.5)" }}>特效全部由 React + 数学函数驱动</div>
        <div style={{ fontSize: 28, color: "rgba(255,255,255,0.6)", marginTop: 24, letterSpacing: 4, opacity: interpolate(frame, [18, 34], [0, 1], { extrapolateLeft: "clamp" }) }}>
          Remotion ≠ PPT
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ===== 主合成 =====

export const CinematicDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Sequence from={0} durationInFrames={S_INTRO} name="intro"><Intro /></Sequence>
      <Sequence from={S_INTRO} durationInFrames={S_DUST} name="dust"><DustScene /></Sequence>
      <Sequence from={S_INTRO + S_DUST} durationInFrames={S_WHIP} name="whip"><WhipScene /></Sequence>
      <Sequence from={S_INTRO + S_DUST + S_WHIP} durationInFrames={S_BEAT} name="beat"><BeatScene /></Sequence>
      <Sequence from={S_INTRO + S_DUST + S_WHIP + S_BEAT} durationInFrames={S_OUTRO} name="outro"><Outro /></Sequence>
    </AbsoluteFill>
  );
};
