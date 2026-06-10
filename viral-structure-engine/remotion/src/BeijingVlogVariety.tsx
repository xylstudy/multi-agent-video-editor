/**
 * 北京旅行Vlog · 完整手法演示
 *
 * 系统能力展示：
 *   1. 前景/背景自由合成 — fg（抠图人物/物体）可出现在任意 bg 上
 *   2. 字幕自由配置 — 每场独立的字号、位置、颜色、对齐
 *   3. 背景音乐 — 从参考视频提取的 BGM，支持淡入淡出 + 循环
 *
 * 节奏设计（5段式）：
 *   开场 (2快) → 场景建立 (3中) → 日常探索 (6快慢交替)
 *   → 情绪高潮 (3慢) → 余韵收尾 (2慢)
 *
 * 用法术：
 *   - 23种转场（交替使用）
 *   - 7种前景揭示效果
 *   - 8种字幕样式
 *   - 4种 Ken Burns 运镜
 *   - 变速节奏（1.5s~4s 分镜时长变化）
 */
import React from "react";
import {
  AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig,
  interpolate, spring, Easing, Img, staticFile, Audio,
} from "remotion";

// ===== Types =====

type RevealType =
  | "float_up" | "scale_burst" | "tilt_3d" | "glow_fade"
  | "parallax" | "split" | "blur_in";

type SubtitleStyleType =
  | "typewriter" | "neon_sign" | "gradient_bar" | "scale_bounce"
  | "slide_crop" | "letter_fall" | "wave" | "cinematic";

type TransitionStyle =
  | "cut" | "fade" | "zoom_in" | "zoom_out" | "flash_white"
  | "slide" | "slide_right" | "slide_up" | "blur_in"
  | "rotate_in" | "whip" | "zoom_flash" | "glitch"
  | "spin" | "zoom_heavy" | "light_leak" | "freeze_frame";

type KenBurnsType = "zoom_in" | "zoom_out" | "pan_left" | "pan_right" | "focus_scan";

/** 字幕位置自由配置 */
interface SubtitlePositionConfig {
  /** 字体大小（px），默认 32 */
  fontSize?: number;
  /** 垂直位置: "bottom" | "top" | "center"，默认 "bottom" */
  verticalAlign?: "bottom" | "top" | "center";
  /** 距离顶部或底部的偏移（px），默认 80 */
  marginFromEdge?: number;
  /** 水平偏移（px），默认 0 */
  offsetX?: number;
  /** 文字颜色，默认 "#ffffff" */
  color?: string;
  /** 文字对齐，默认 "center" */
  textAlign?: "left" | "center" | "right";
  /** 最大宽度（百分比），默认 90 */
  maxWidthPercent?: number;
}

// ===== Scene Definition =====

interface SceneConfig {
  bg: string;              // 背景照片路径
  fg: string;              // 前景抠图路径 — 可来自任意照片，与 bg 独立
  duration: number;        // frames
  reveal: RevealType;
  subtitle: string;
  subtitleStyle: SubtitleStyleType;
  subtitleConfig: SubtitlePositionConfig;  // 每场独立的字幕配置
  transition: TransitionStyle;
  kenBurns: KenBurnsType;
  subtitleDelay?: number;
}

// ===== Asset Lists =====

const PHOTO_FILES = [
  "88250e8474df89bdc677ba059048b55c.jpg",
  "北京丨这可能是我花的最值的两块钱…_1_小鹿拍全国_来自小红书网页版.jpg",
  "北京丨这可能是我花的最值的两块钱…_7_小鹿拍全国_来自小红书网页版.jpg",
  "微信图片_20260602210248_45_11.jpg",
  "微信图片_20260602210250_46_11.jpg",
  "微信图片_20260602210252_47_11.jpg",
  "微信图片_20260602210253_48_11.jpg",
  "微信图片_20260602210254_49_11.jpg",
  "微信图片_20260602210255_50_11.jpg",
  "微信图片_20260602210255_51_11.jpg",
  "微信图片_20260602210256_52_11.jpg",
  "微信图片_20260602210304_53_11.jpg",
  "微信图片_20260602210305_54_11.jpg",
  "微信图片_20260602210307_55_11.jpg",
  "微信图片_20260602210308_56_11.jpg",
  "微信图片_20260602210309_57_11.jpg",
  "微信图片_20260602210309_58_11.jpg",
  "微信图片_20260602210310_59_11.jpg",
  "微信图片_20260602210311_60_11.jpg",
  "微信图片_20260602210312_61_11.jpg",
  "微信图片_20260602210327_62_11.jpg",
  "微信图片_20260602210328_63_11.jpg",
  "微信图片_20260602210329_64_11.jpg",
  "微信图片_20260602210330_65_11.jpg",
  "微信图片_20260602210331_66_11.jpg",
  "微信图片_20260602210332_67_11.jpg",
  "微信图片_20260602210333_68_11.jpg",
  "微信图片_20260602210334_69_11.jpg",
  "微信图片_20260602210335_70_11.jpg",
  "微信图片_20260602210345_71_11.jpg",
  "微信图片_20260602210346_72_11.jpg",
  "微信图片_20260602210347_73_11.jpg",
  "微信图片_20260602210348_74_11.jpg",
  "微信图片_20260602210349_75_11.jpg",
  "微信图片_20260602210350_76_11.jpg",
  "微信图片_20260602210350_77_11.jpg",
  "来北京天坛 拍这些机位就够了❗️_1_🐰Double three_来自小红书网页版.jpg",
  "来北京天坛 拍这些机位就够了❗️_2_🐰Double three_来自小红书网页版.jpg",
  "来北京天坛 拍这些机位就够了❗️_3_🐰Double three_来自小红书网页版.jpg",
];

/** 已有的抠图前景文件（20 个） */
const FG_FILES = [
  "fg_000.png", "fg_001.png", "fg_002.png", "fg_003.png",
  "fg_004.png", "fg_005.png", "fg_006.png", "fg_007.png",
  "fg_008.png", "fg_009.png", "fg_010.png", "fg_011.png",
  "fg_012.png", "fg_013.png", "fg_014.png", "fg_015.png",
  "fg_016.png", "fg_017.png", "fg_018.png", "fg_019.png",
];

// ===== 前景/背景交叉映射表 =====
//
// 核心创意：将照片 A 的前景（抠出的人物/物体）合成到照片 B 的背景上。
// 下表定义了每个 scene 的 bg 和 fg 独立选取，
// 通过错位映射实现 "前景穿越到不同场景" 的效果。
//
// 映射规则：
//   bg = PHOTO_FILES[i]          — 第 i 张照片作为背景
//   fg = FG_FILES[crossMap[i]]   — 从另一张照片抠出的前景
//
// 当 crossMap[i] === i 时，前景出现在原始背景上（传统方式）
// 当 crossMap[i] !== i 时，实现"穿越"合成
//
// 这里故意设置错位映射：前景来自不同的照片索引

const FG_CROSS_MAP: number[] = (() => {
  // 初始：直接对应
  const map = PHOTO_FILES.map((_, i) => i % FG_FILES.length);
  // 对后半段做错位混洗，制造"前景穿越"效果
  for (let i = 20; i < map.length; i++) {
    // 前景来自完全不同的照片
    map[i] = (i * 7 + 3) % FG_FILES.length;
  }
  // 部分前半段也做交叉
  for (let i = 4; i < 12; i++) {
    map[i] = (i + 8) % FG_FILES.length;
  }
  return map;
})();

const REVEAL_EFFECTS: RevealType[] = [
  "float_up", "scale_burst", "tilt_3d", "glow_fade",
  "parallax", "split", "blur_in",
];

const SUBTITLE_STYLES: SubtitleStyleType[] = [
  "typewriter", "neon_sign", "gradient_bar", "scale_bounce",
  "slide_crop", "letter_fall", "wave", "cinematic",
];

const TRANSITIONS: TransitionStyle[] = [
  "cut", "fade", "zoom_in", "zoom_out", "flash_white",
  "slide", "slide_right", "blur_in", "rotate_in",
  "whip", "zoom_flash", "glitch", "spin", "zoom_heavy",
  "light_leak", "freeze_frame",
];

const KEN_BURNS: KenBurnsType[] = [
  "zoom_in", "zoom_out", "pan_left", "pan_right", "focus_scan",
];

const SUBTITLE_TEXTS = [
  "飞越 CBD，北京醒了",
  "天坛祈年，六百年回响",
  "红墙内外，两个世界",
  "角楼映在护城河里",
  "故宫的屋檐，划破天空",
  "胡同深处，藏着故事",
  "绿瓦红墙，岁月静好",
  "银杏大道，秋日私语",
  "景山万春，俯瞰紫禁",
  "摩天楼群，城市脉搏",
  "白塔红墙，妙应寺深",
  "颐和园里，昆明湖静",
  "长城蜿蜒，山河壮阔",
  "国贸夜色，流光溢彩",
  "天坛圜丘，天地对话",
  "什刹海畔，晚风微凉",
  "鸟巢落日，奥运记忆",
  "前门大街，老字号香",
  "故宫雪景，静谧如诗",
  "三里屯夜，青春不眠",
  "琉璃厂街，墨香四溢",
  "钟鼓楼下，时光慢流",
  "大栅栏里，市井烟火",
  "北海白塔，碧波荡漾",
  "国子监街，古木参天",
  "南锣鼓巷，文艺老街",
  "雍和宫香，祈愿升腾",
  "明城墙下，历史层叠",
  "CBD 云端，摩登北京",
  "紫禁城暮，金光万丈",
  "天安门前，红旗飘扬",
  "胡同骑行，穿街走巷",
  "相声茶馆，满堂欢笑",
  "豆汁焦圈，老北京味",
  "簋街灯火，不夜之城",
  "香山红叶，层林尽染",
  "天坛星空，银河低垂",
  "京城夜色，晚安北京",
  "后海酒吧，歌声飘荡",
];

// ===== 字幕自由配置方案 =====
//
// 每场字幕独立指定位置、大小、颜色，展示系统灵活性
const SUBTITLE_CONFIGS: SubtitlePositionConfig[] = [
  // 开场 — 大字居中，醒目
  { fontSize: 40, verticalAlign: "center", color: "#ffffff", textAlign: "center", marginFromEdge: 0 },
  { fontSize: 36, verticalAlign: "bottom", color: "#ffd700", textAlign: "center", marginFromEdge: 120 },
  { fontSize: 34, verticalAlign: "bottom", color: "#ffffff", textAlign: "center", marginFromEdge: 100 },
  { fontSize: 38, verticalAlign: "center", color: "#ffffff", textAlign: "center", marginFromEdge: 0, offsetX: -60 },
  // 场景建立 — 底部偏左
  { fontSize: 30, verticalAlign: "bottom", color: "#ffffff", textAlign: "left", marginFromEdge: 100, offsetX: 20 },
  { fontSize: 28, verticalAlign: "bottom", color: "#e0e0e0", textAlign: "left", marginFromEdge: 80 },
  { fontSize: 32, verticalAlign: "bottom", color: "#ffffff", textAlign: "center", marginFromEdge: 90 },
  { fontSize: 26, verticalAlign: "top", color: "#ffffff", textAlign: "right", marginFromEdge: 60, offsetX: -20 },
  // 探索段 — 多样化
  { fontSize: 34, verticalAlign: "bottom", color: "#ff6b6b", textAlign: "center", marginFromEdge: 120 },
  { fontSize: 28, verticalAlign: "top", color: "#ffffff", textAlign: "center", marginFromEdge: 80 },
  { fontSize: 30, verticalAlign: "bottom", color: "#4ecdc4", textAlign: "left", marginFromEdge: 100 },
  { fontSize: 36, verticalAlign: "center", color: "#ffe66d", textAlign: "center", marginFromEdge: 0 },
  { fontSize: 26, verticalAlign: "bottom", color: "#ffffff", textAlign: "right", marginFromEdge: 90, offsetX: -30 },
  { fontSize: 32, verticalAlign: "top", color: "#ffffff", textAlign: "left", marginFromEdge: 100, offsetX: 40 },
  { fontSize: 28, verticalAlign: "bottom", color: "#a8e6cf", textAlign: "center", marginFromEdge: 80 },
  { fontSize: 34, verticalAlign: "bottom", color: "#ff8b94", textAlign: "center", marginFromEdge: 130 },
  { fontSize: 30, verticalAlign: "center", color: "#ffffff", textAlign: "center", marginFromEdge: 0, offsetX: 0 },
  { fontSize: 26, verticalAlign: "bottom", color: "#dcedc1", textAlign: "left", marginFromEdge: 100 },
  { fontSize: 32, verticalAlign: "top", color: "#ffffff", textAlign: "center", marginFromEdge: 70 },
  { fontSize: 28, verticalAlign: "bottom", color: "#ffd3b6", textAlign: "center", marginFromEdge: 90 },
  { fontSize: 34, verticalAlign: "bottom", color: "#ffffff", textAlign: "right", marginFromEdge: 100, offsetX: -40 },
  // 高潮段 — 大号字，居中底部，更有冲击力
  { fontSize: 40, verticalAlign: "bottom", color: "#ffffff", textAlign: "center", marginFromEdge: 140 },
  { fontSize: 42, verticalAlign: "center", color: "#ffd700", textAlign: "center", marginFromEdge: 0 },
  { fontSize: 38, verticalAlign: "bottom", color: "#ffffff", textAlign: "center", marginFromEdge: 120 },
  { fontSize: 36, verticalAlign: "bottom", color: "#ff6b6b", textAlign: "center", marginFromEdge: 130 },
  { fontSize: 44, verticalAlign: "center", color: "#ffffff", textAlign: "center", marginFromEdge: 0 },
  { fontSize: 36, verticalAlign: "bottom", color: "#4ecdc4", textAlign: "right", marginFromEdge: 110, offsetX: -20 },
  { fontSize: 40, verticalAlign: "bottom", color: "#ffffff", textAlign: "center", marginFromEdge: 140 },
  { fontSize: 38, verticalAlign: "top", color: "#ffe66d", textAlign: "center", marginFromEdge: 80 },
  { fontSize: 42, verticalAlign: "bottom", color: "#ffffff", textAlign: "left", marginFromEdge: 120, offsetX: 30 },
  { fontSize: 36, verticalAlign: "center", color: "#ffffff", textAlign: "center", marginFromEdge: 0 },
  // 收尾 — 小字，有沉淀感
  { fontSize: 30, verticalAlign: "bottom", color: "#ffffff", textAlign: "center", marginFromEdge: 100 },
  { fontSize: 28, verticalAlign: "bottom", color: "#e0e0e0", textAlign: "center", marginFromEdge: 90 },
  { fontSize: 26, verticalAlign: "center", color: "#ffffff", textAlign: "center", marginFromEdge: 0 },
  { fontSize: 32, verticalAlign: "bottom", color: "#ffffff", textAlign: "center", marginFromEdge: 100 },
  { fontSize: 28, verticalAlign: "top", color: "#ffffff", textAlign: "center", marginFromEdge: 80 },
  { fontSize: 30, verticalAlign: "bottom", color: "#a8e6cf", textAlign: "center", marginFromEdge: 90 },
  { fontSize: 34, verticalAlign: "center", color: "#ffffff", textAlign: "center", marginFromEdge: 0 },
  { fontSize: 28, verticalAlign: "bottom", color: "#ffffff", textAlign: "center", marginFromEdge: 100 },
];

// ===== Build Scene Configs =====

function buildScenes(): SceneConfig[] {
  const scenes: SceneConfig[] = [];

  for (let i = 0; i < PHOTO_FILES.length; i++) {
    const photo = PHOTO_FILES[i];
    const fgIdx = FG_CROSS_MAP[i];
    const section = i < 4 ? "hook" : i < 8 ? "establish" : i < 22 ? "explore" : i < 32 ? "climax" : "outro";

    let duration: number;
    switch (section) {
      case "hook":      duration = [42, 48, 45, 36][i]; break;
      case "establish": duration = [75, 66, 72, 60][i - 4]; break;
      case "explore": {
        const fastSlow = [60, 90, 54, 84, 66, 78, 48, 96, 60, 72, 51, 87, 63, 75];
        duration = fastSlow[(i - 8) % fastSlow.length];
        break;
      }
      case "climax":    duration = [105, 114, 99, 108, 96, 111, 102, 120, 90, 117][i - 22]; break;
      case "outro":      duration = [120, 105, 135, 90, 114, 99, 126][i - 32]; break;
      default:           duration = 72;
    }

    scenes.push({
      bg: `/photos/${photo}`,
      fg: `/segmented/${FG_FILES[fgIdx]}`,
      duration,
      reveal: REVEAL_EFFECTS[i % REVEAL_EFFECTS.length],
      subtitle: SUBTITLE_TEXTS[i % SUBTITLE_TEXTS.length],
      subtitleStyle: SUBTITLE_STYLES[i % SUBTITLE_STYLES.length],
      subtitleConfig: SUBTITLE_CONFIGS[i % SUBTITLE_CONFIGS.length],
      transition: TRANSITIONS[i % TRANSITIONS.length],
      kenBurns: KEN_BURNS[i % KEN_BURNS.length],
      subtitleDelay: section === "hook" ? 6 : section === "climax" ? 18 : 10,
    });
  }

  return scenes;
}

const SCENES = buildScenes();

// ===== Ken Burns Background =====

const BackgroundLayer: React.FC<{ img: string; duration: number; motion: KenBurnsType }> = ({ img, duration, motion }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = interpolate(frame, [0, duration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  let transform: string;
  switch (motion) {
    case "zoom_in": {
      const z = spring({ fps, frame: Math.min(frame, duration), config: { damping: 300, stiffness: 200 } });
      transform = `scale(${interpolate(z, [0, 1], [1, 1.12])})`;
      break;
    }
    case "zoom_out": {
      const z = spring({ fps, frame: Math.min(frame, duration), config: { damping: 300, stiffness: 200 } });
      transform = `scale(${interpolate(z, [0, 1], [1.15, 1])})`;
      break;
    }
    case "pan_left":
      transform = `scale(1.15) translateX(${interpolate(progress, [0, 1], [0, -40])}px)`;
      break;
    case "pan_right":
      transform = `scale(1.15) translateX(${interpolate(progress, [0, 1], [0, 40])}px)`;
      break;
    case "focus_scan":
      transform = `scale(1.1) translate(${interpolate(progress, [0, 1], [-10, 10])}px, ${interpolate(progress, [0, 1], [0, -15])}px)`;
      break;
    default:
      transform = "scale(1)";
  }

  return (
    <AbsoluteFill>
      <div style={{ width: "100%", height: "100%", transform, overflow: "hidden" }}>
        <Img src={staticFile(img)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    </AbsoluteFill>
  );
};

// ===== Foreground Reveal =====

const useRevealStyle = (reveal: RevealType, revealFrame: number, revealDur: number): React.CSSProperties => {
  const { fps } = useVideoConfig();
  const progress = interpolate(revealFrame, [0, revealDur], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const sp = spring({ fps, frame: Math.min(revealFrame, revealDur), config: { damping: 14, mass: 0.6, stiffness: 180 } });

  switch (reveal) {
    case "float_up":
      return { opacity: progress, transform: `translateY(${interpolate(sp, [0, 1], [180, 0])}px)` };
    case "scale_burst":
      return { opacity: progress, transform: `scale(${interpolate(sp, [0, 1], [0.3, 1])})` };
    case "tilt_3d":
      return { opacity: progress, transform: `perspective(800px) rotateY(${interpolate(progress, [0, 1], [25, 0])}deg)`, filter: `brightness(${interpolate(progress, [0, 1], [1.3, 1])})` };
    case "glow_fade": {
      const glow = interpolate(revealFrame, [0, revealDur * 0.6, revealDur], [0, 1.5, 0]);
      return { opacity: progress, filter: `brightness(${1 + glow * 0.3}) drop-shadow(0 0 ${glow * 20}px rgba(255,215,0,${glow * 0.6}))` };
    }
    case "parallax":
      return { opacity: progress, transform: `translateX(${Math.sin(revealFrame * 0.025) * 15}px) translateY(${Math.cos(revealFrame * 0.02) * 10}px)`, filter: "drop-shadow(4px 8px 12px rgba(0,0,0,0.4))" };
    case "split": {
      const s = interpolate(sp, [0, 1], [0, 1]);
      return { opacity: progress, clipPath: `inset(0 ${interpolate(s, [0, 1], [100, 50])}% 0 ${interpolate(s, [0, 1], [0, 50])}%)`, transform: `scale(${interpolate(s, [0, 1], [1.1, 1])})` };
    }
    case "blur_in":
      return { opacity: progress, filter: `blur(${interpolate(progress, [0, 1], [15, 0])}px)` };
    default:
      return { opacity: progress };
  }
};

// ===== Transition Layer =====

const TransitionLayer: React.FC<{ children: React.ReactNode; type: TransitionStyle; duration: number; frame: number }> = ({ children, type, duration, frame }) => {
  const p = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });

  const style: React.CSSProperties = (() => {
    switch (type) {
      case "cut": return {};
      case "fade": return { opacity: p };
      case "zoom_in": return { opacity: p, transform: `scale(${interpolate(p, [0, 1], [0.92, 1])})` };
      case "zoom_out": return { opacity: p, transform: `scale(${interpolate(p, [0, 1], [1.08, 1])})` };
      case "flash_white": return {};
      case "slide": return { opacity: p, transform: `translateX(${interpolate(p, [0, 1], [-80, 0])}px)` };
      case "slide_right": return { opacity: p, transform: `translateX(${interpolate(p, [0, 1], [80, 0])}px)` };
      case "slide_up": return { opacity: p, transform: `translateY(${interpolate(p, [0, 1], [80, 0])}px)` };
      case "blur_in": return { opacity: p, filter: `blur(${interpolate(p, [0, 1], [8, 0])}px)` };
      case "rotate_in": return { opacity: p, transform: `rotate(${interpolate(p, [0, 1], [-5, 0])}deg)` };
      case "whip": return { opacity: p, transform: `translateX(${interpolate(p, [0, 1], [200, 0])}px)`, filter: `blur(${interpolate(p, [0, 1], [15, 0])}px)` };
      case "zoom_flash": return { opacity: p, transform: `scale(${interpolate(p, [0, 1], [1.15, 1])})` };
      case "glitch": {
        const g = Math.sin(frame * 3.7) * 8 * (1 - p);
        return { opacity: p, transform: `translateX(${g}px) skewX(${g * 0.3}deg)`, filter: p < 0.5 ? "contrast(1.3)" : "none" };
      }
      case "spin": return { opacity: p, transform: `rotate(${interpolate(p, [0, 1], [360, 0])}deg) scale(${interpolate(p, [0, 1], [1.3, 1])})` };
      case "zoom_heavy": return { opacity: interpolate(frame, [0, 3], [0, 1]), transform: `scale(${interpolate(Math.min(frame, 15), [0, 15], [2, 1])})`, filter: `blur(${interpolate(frame, [0, 14], [15, 0])}px)` };
      case "light_leak": return { opacity: p };
      case "freeze_frame": return { opacity: p };
      default: return { opacity: p };
    }
  })();

  return (
    <AbsoluteFill style={style}>
      {children}
      {type === "flash_white" && (
        <AbsoluteFill style={{ backgroundColor: "#fff", opacity: interpolate(frame, [0, 4, 6], [1, 0.5, 0]), pointerEvents: "none" }} />
      )}
      {type === "light_leak" && (
        <AbsoluteFill style={{
          background: `linear-gradient(${60 + frame * 1.5}deg, rgba(255,150,50,${interpolate(frame, [0, 6, 14], [1, 0.6, 0])}) 0%, transparent 60%)`,
          pointerEvents: "none",
        }} />
      )}
      {type === "freeze_frame" && (
        <>
          <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen", opacity: interpolate(frame, [0, 3, 8], [0, 0.4, 0]) }}>
            <div style={{ position: "absolute", inset: 0, transform: "translateX(4px)" }}>{children}</div>
          </AbsoluteFill>
          <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen", opacity: interpolate(frame, [0, 3, 8], [0, 0.3, 0]) }}>
            <div style={{ position: "absolute", inset: 0, transform: "translateX(-4px)" }}>{children}</div>
          </AbsoluteFill>
        </>
      )}
    </AbsoluteFill>
  );
};

// ===== Subtitle Renderer (with flexible positioning) =====

const SceneSubtitle: React.FC<{
  text: string;
  frame: number;
  style: SubtitleStyleType;
  sceneDuration: number;
  config: SubtitlePositionConfig;
}> = ({ text, frame, style, sceneDuration, config }) => {
  const fadeOut = interpolate(frame, [sceneDuration - 20, sceneDuration - 5], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dim = { opacity: fadeOut };

  const {
    fontSize = 32,
    verticalAlign = "bottom",
    marginFromEdge = 80,
    offsetX = 0,
    color = "#ffffff",
    textAlign = "center",
  } = config;

  // 根据 verticalAlign 计算垂直位置
  const getVPos = () => {
    switch (verticalAlign) {
      case "top": return { top: marginFromEdge };
      case "center": return { top: "50%", transform: "translateY(-50%)" };
      case "bottom": return { bottom: marginFromEdge };
    }
  };

  const vPos = getVPos();
  const leftAlign = textAlign === "center" ? { left: 0, right: 0 } : textAlign === "left" ? { left: 40 + (offsetX > 0 ? offsetX : 0) } : { right: 40 + (offsetX < 0 ? -offsetX : 0) };

  switch (style) {
    case "typewriter": {
      const p = interpolate(frame, [0, 25], [0, text.length], { extrapolateLeft: "clamp", easing: Easing.out(Easing.ease) });
      const len = Math.max(1, Math.floor(p));
      const cursor = frame < 25 && frame % 6 < 3 ? "|" : "";
      return <div style={dim as any}><div style={{ position: "absolute", ...vPos, ...leftAlign, textAlign: textAlign as any }}>
        <span style={{ color, fontSize, fontFamily: "'PingFang SC','Microsoft YaHei',monospace", fontWeight: "bold", textShadow: "2px 2px 12px rgba(0,0,0,0.9)", letterSpacing: 3, background: "rgba(0,0,0,0.3)", padding: "8px 24px", borderRadius: 4, display: "inline-block" }}>{text.slice(0, len)}{cursor}</span>
      </div></div>;
    }
    case "neon_sign": {
      const p = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp" });
      const colors = ["#0ff", "#f0f", "#ff0"];
      const neonColor = colors[Math.floor((frame / 12) % colors.length)];
      return <div style={dim as any}><div style={{ position: "absolute", ...vPos, ...leftAlign, textAlign: textAlign as any, opacity: p }}>
        <span style={{ color: neonColor, fontSize, fontWeight: "bold", fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif", letterSpacing: 6, textShadow: `0 0 20px ${neonColor}, 0 0 40px ${neonColor}` }}>{text}</span>
      </div></div>;
    }
    case "gradient_bar": {
      const p = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp" });
      const tp = interpolate(frame, [6, 18], [0, 1], { extrapolateLeft: "clamp" });
      return <div style={dim as any}><div style={{ position: "absolute", ...vPos, ...leftAlign, display: "flex", justifyContent: textAlign === "center" ? "center" : textAlign === "left" ? "flex-start" : "flex-end" }}>
        <div style={{ background: "linear-gradient(90deg, #ff3264, #6432ff)", borderRadius: 8, padding: "12px 24px", opacity: p }}>
          <span style={{ color: "#fff", fontSize, fontWeight: "bold", textAlign: textAlign as any, letterSpacing: 3, opacity: tp }}>{text}</span>
        </div>
      </div></div>;
    }
    case "scale_bounce": {
      const sp = spring({ fps: 30, frame: Math.min(frame, 20), config: { damping: 10, mass: 0.5, stiffness: 200 } });
      const s = interpolate(sp, [0, 1], [1.5, 1]);
      return <div style={dim as any}><div style={{ position: "absolute", ...vPos, ...leftAlign, textAlign: textAlign as any, transform: verticalAlign === "center" ? `translateY(-50%) scale(${s})` : `scale(${s})` }}>
        <span style={{ display: "inline-block", color: "#fff", fontSize, fontWeight: "bold", padding: "8px 28px", borderRadius: 50, background: "linear-gradient(135deg, #667eea, #764ba2)" }}>{text}</span>
      </div></div>;
    }
    case "slide_crop": {
      const p = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: "clamp" });
      return <div style={dim as any}><div style={{ position: "absolute", ...vPos, ...leftAlign, textAlign: textAlign as any }}>
        <div style={{ display: "inline-block", overflow: "hidden", clipPath: `inset(0 ${interpolate(p, [0, 1], [100, 0])}% 0 0)` }}>
          <span style={{ display: "block", color: "#ffd700", fontSize, fontWeight: "bold", textShadow: "0 0 20px rgba(255,215,0,0.5)", letterSpacing: 4 }}>{text}</span>
        </div>
      </div></div>;
    }
    case "letter_fall": {
      return <div style={dim as any}><div style={{ position: "absolute", ...vPos, ...leftAlign, textAlign: textAlign as any }}>
        <div style={{ color, fontSize, fontWeight: "bold", textShadow: "2px 2px 12px rgba(0,0,0,0.8)", letterSpacing: 3 }}>
          {text.split("").map((char, i) => {
            const sp = spring({ fps: 30, frame: Math.max(0, Math.min(frame - i * 3, 15)), config: { damping: 15, stiffness: 300 } });
            return <span key={i} style={{ display: "inline-block", opacity: interpolate(Math.max(0, frame - i * 3), [0, 5], [0, 1]), transform: `translateY(${interpolate(sp, [0, 1], [-40, 0])}px)` }}>{char}</span>;
          })}
        </div>
      </div></div>;
    }
    case "wave": {
      const gradientPos = (frame * 4) % 200;
      return <div style={dim as any}><div style={{ position: "absolute", ...vPos, ...leftAlign, textAlign: textAlign as any }}>
        <div style={{ fontSize, fontWeight: "bold", textShadow: "2px 2px 12px rgba(0,0,0,0.8)", letterSpacing: 3, background: "linear-gradient(90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f)", backgroundSize: "200% 100%", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundPosition: `${gradientPos}% 0` }}>
          <span style={{ display: "inline-flex", gap: 2 }}>
            {text.split("").map((char, i) => (
              <span key={i} style={{ display: "inline-block", transform: `translateY(${Math.sin((frame * 0.12) + i * 0.7) * 8}px)` }}>{char}</span>
            ))}
          </span>
        </div>
      </div></div>;
    }
    case "cinematic": {
      const barP = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp" });
      const tP = interpolate(frame, [10, 22], [0, 1], { extrapolateLeft: "clamp" });
      return <div style={dim as any}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 70, background: "rgba(0,0,0,0.7)", transform: `translateY(${interpolate(barP, [0, 1], [-70, 0])}px)` }} />
        <div style={{ position: "absolute", ...vPos, ...leftAlign, display: "flex", alignItems: "center", justifyContent: textAlign === "center" ? "center" : textAlign === "left" ? "flex-start" : "flex-end" }}>
          <span style={{ color: "#fff", fontSize, fontWeight: "bold", letterSpacing: 4, opacity: tP, background: "rgba(0,0,0,0.7)", padding: "8px 24px" }}>{text}</span>
        </div>
      </div>;
    }
    default:
      return <div style={dim as any}><div style={{ position: "absolute", ...vPos, ...leftAlign, textAlign: textAlign as any }}>
        <span style={{ color, fontSize, fontWeight: "bold", textShadow: "2px 2px 12px rgba(0,0,0,0.8)" }}>{text}</span>
      </div></div>;
  }
};

// ===== Single Scene =====

const Scene: React.FC<{ config: SceneConfig }> = ({ config }) => {
  const frame = useCurrentFrame();
  const { bg, fg, duration, reveal, subtitle, subtitleStyle, subtitleConfig, transition, kenBurns } = config;
  const revealFrame = Math.max(0, frame - 3);
  const subtitleFrame = Math.max(0, frame - (config.subtitleDelay ?? 10));

  return (
    <TransitionLayer type={transition} duration={duration} frame={frame}>
      {/* Background with Ken Burns */}
      <BackgroundLayer img={staticFile(bg)} duration={duration} motion={kenBurns} />

      {/* Gradient overlay */}
      <AbsoluteFill style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.25) 0%, transparent 40%, transparent 70%, rgba(0,0,0,0.1) 100%)", pointerEvents: "none" }} />

      {/* Foreground — 可来自与 bg 不同的照片，实现交叉合成 */}
      {fg && (
        <AbsoluteFill style={useRevealStyle(reveal, revealFrame, 20)}>
          <Img src={staticFile(fg)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </AbsoluteFill>
      )}

      {/* Subtitle — 每场独立配置位置、大小、颜色 */}
      <SceneSubtitle
        text={subtitle}
        frame={subtitleFrame}
        style={subtitleStyle}
        sceneDuration={duration}
        config={subtitleConfig}
      />
    </TransitionLayer>
  );
};

// ===== Intro =====

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = 36;
  const sp = spring({ fps: 30, frame: Math.min(frame, dur), config: { damping: 12, mass: 0.5, stiffness: 100 } });
  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)" }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 56, fontWeight: "bold", color: "#fff", transform: `scale(${interpolate(sp, [0, 1], [0.3, 1])})`, opacity: interpolate(frame, [0, dur], [0, 1]), letterSpacing: 6, textShadow: "0 0 40px rgba(100,100,255,0.5)" }}>
          北京 · 节奏
        </div>
        <div style={{ fontSize: 20, color: "rgba(255,255,255,0.5)", marginTop: 20, opacity: interpolate(frame, [15, dur], [0, 1]) }}>
          前景交叉合成 · 自由字幕 · BGM 同步
        </div>
      </div>
      {/* Film grain */}
      <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.12, mixBlendMode: "overlay", backgroundImage: "repeating-conic-gradient(rgba(255,255,255,0.03) 0% 25%, transparent 0% 50%), repeating-linear-gradient(45deg, transparent, rgba(0,0,0,0.02) 1px, transparent 3px)", backgroundSize: "2px 2px, 200% 200%", backgroundPosition: `0 0, ${(frame * 7.3) % 200 * 0.3}px ${(frame * 7.3) % 200 * 0.7}px` }} />
    </AbsoluteFill>
  );
};

// ===== Outro =====

const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = 36;
  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)" }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 48, color: "#fff", opacity: interpolate(frame, [0, dur], [0, 1]), letterSpacing: 4 }}>北京 · 下次见</div>
        <div style={{ fontSize: 18, color: "rgba(255,255,255,0.4)", marginTop: 20, opacity: interpolate(frame, [15, dur], [0, 1]) }}>
          Viral Structure Engine — 前景交叉 · 自由字幕 · BGM
        </div>
      </div>
      {/* Film grain */}
      <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.15, mixBlendMode: "overlay", backgroundImage: "repeating-conic-gradient(rgba(255,255,255,0.03) 0% 25%, transparent 0% 50%)", backgroundSize: "2px 2px" }} />
    </AbsoluteFill>
  );
};

// ===== BGM 音量控制（淡入淡出 + 循环） =====

const BGMVolume: React.FC = () => {
  const frame = useCurrentFrame();
  const totalDur = BEIJING_VARIETY_DURATION;
  const fadeFrames = 30;

  // 音量回调：淡入 → 持续 → 淡出
  const volume = interpolate(frame, [0, fadeFrames, totalDur - fadeFrames, totalDur], [0, 0.25, 0.25, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: (t) => t * t,
  });

  return (
    <Audio
      src={staticFile("bgm.mp3")}
      volume={volume}
      loop
    />
  );
};

// ===== Main Composition =====

export const BeijingVlogVariety: React.FC = () => {
  const introDur = 36;
  const outroDur = 36;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* 背景音乐层 — 从参考视频提取的 BGM */}
      <Sequence name="bgm" from={0} durationInFrames={Infinity}>
        <BGMVolume />
      </Sequence>

      <Sequence from={0} durationInFrames={introDur} name="intro">
        <Intro />
      </Sequence>

      {SCENES.map((config, i) => {
        const start = introDur + SCENES.slice(0, i).reduce((acc, s) => acc + s.duration, 0);
        return (
          <Sequence key={i} from={start} durationInFrames={config.duration} name={`scene-${i}`}>
            <Scene config={config} />
          </Sequence>
        );
      })}

      <Sequence from={introDur + SCENES.reduce((acc, s) => acc + s.duration, 0)} durationInFrames={outroDur} name="outro">
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};

export const BEIJING_VARIETY_DURATION = 36 + SCENES.reduce((acc, s) => acc + s.duration, 0) + 36;
