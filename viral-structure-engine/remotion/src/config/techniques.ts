/**
 * 剪辑手法注册表 — TypeScript 端镜像
 *
 * 与 knowledge/editing_techniques.json 保持同步。
 * 供 VideoScheme 渲染组件、TransitionLayer、ForegroundSplit 等自主引用。
 *
 * 用法:
 *   import { TRANSITIONS, getTransitionInfo } from "./config/techniques";
 *   const t = getTransitionInfo("whip");  // => { name, best_for, ... }
 */

// ===== 转场注册表 =====

export interface TransitionInfo {
  name: string;
  name_en: string;
  suitability: { fast: number; medium: number; slow: number };
  best_for: string[];
  avoid_when?: string;
  duration_hint_frames: number;
}

export const TRANSITIONS: Record<string, TransitionInfo> = {
  cut:            { name: "硬切", name_en: "Cut", suitability: { fast: 5, medium: 5, slow: 4 }, best_for: ["任意场景", "节奏快速切换"], duration_hint_frames: 0 },
  fade:           { name: "淡入", name_en: "Fade", suitability: { fast: 2, medium: 4, slow: 5 }, best_for: ["开场", "收尾", "慢节奏段落"], duration_hint_frames: 10 },
  dissolve:       { name: "溶解", name_en: "Dissolve", suitability: { fast: 1, medium: 3, slow: 5 }, best_for: ["回忆闪回", "时间流逝", "梦幻感"], duration_hint_frames: 15 },
  zoom_in:        { name: "放大入场", name_en: "Zoom In", suitability: { fast: 4, medium: 5, slow: 3 }, best_for: ["特写", "人物出场", "细节强调"], duration_hint_frames: 10 },
  zoom_out:       { name: "缩小入场", name_en: "Zoom Out", suitability: { fast: 3, medium: 5, slow: 4 }, best_for: ["全景展示", "空间介绍"], duration_hint_frames: 10 },
  flash_white:    { name: "闪白", name_en: "Flash White", suitability: { fast: 5, medium: 4, slow: 1 }, best_for: ["快节奏卡点", "场景切换"], duration_hint_frames: 8 },
  flash_black:    { name: "闪黑", name_en: "Flash Black", suitability: { fast: 3, medium: 4, slow: 5 }, best_for: ["结束感", "夜间场景切换"], duration_hint_frames: 8 },
  slide:          { name: "左滑入", name_en: "Slide Left", suitability: { fast: 4, medium: 5, slow: 3 }, best_for: ["平行场景切换", "推进叙事"], duration_hint_frames: 14 },
  slide_right:    { name: "右滑入", name_en: "Slide Right", suitability: { fast: 4, medium: 5, slow: 3 }, best_for: ["返回/回顾", "倒叙"], duration_hint_frames: 14 },
  slide_up:       { name: "上滑入", name_en: "Slide Up", suitability: { fast: 4, medium: 4, slow: 3 }, best_for: ["向上运动", "轻快过渡"], duration_hint_frames: 14 },
  slide_down:     { name: "下滑入", name_en: "Slide Down", suitability: { fast: 4, medium: 4, slow: 3 }, best_for: ["向下俯视", "降落感"], duration_hint_frames: 14 },
  wipe_left:      { name: "左擦除", name_en: "Wipe Left", suitability: { fast: 3, medium: 4, slow: 5 }, best_for: ["前后对比", "地点切换"], duration_hint_frames: 12 },
  wipe_right:     { name: "右擦除", name_en: "Wipe Right", suitability: { fast: 3, medium: 4, slow: 5 }, best_for: ["时间推进", "线性叙事"], duration_hint_frames: 12 },
  blur_in:        { name: "模糊清晰", name_en: "Blur In", suitability: { fast: 2, medium: 4, slow: 5 }, best_for: ["梦境/回忆", "唯美段落"], duration_hint_frames: 14 },
  rotate_in:      { name: "旋转入场", name_en: "Rotate In", suitability: { fast: 3, medium: 4, slow: 5 }, best_for: ["创意转场", "活泼段落"], duration_hint_frames: 14 },
  whip:           { name: "甩镜头", name_en: "Whip Pan", suitability: { fast: 5, medium: 3, slow: 1 }, best_for: ["城市街拍", "连续动作", "抖音热门"], duration_hint_frames: 10 },
  circle_reveal:  { name: "圆形展开", name_en: "Circle Reveal", suitability: { fast: 2, medium: 4, slow: 5 }, best_for: ["聚光灯效果", "焦点引入"], duration_hint_frames: 15 },
  zoom_flash:     { name: "缩放闪光", name_en: "Zoom Flash", suitability: { fast: 5, medium: 4, slow: 1 }, best_for: ["音乐卡点", "高潮入场", "快剪"], duration_hint_frames: 8 },
  glitch:         { name: "故障抖动", name_en: "Glitch", suitability: { fast: 5, medium: 3, slow: 1 }, best_for: ["科技感", "城市霓虹"], avoid_when: "温馨/浪漫段落", duration_hint_frames: 10 },
  spin:           { name: "360°旋转", name_en: "Spin", suitability: { fast: 4, medium: 4, slow: 2 }, best_for: ["创意转场", "城市全景切换"], duration_hint_frames: 14 },
  zoom_heavy:     { name: "重度缩放", name_en: "Zoom Heavy", suitability: { fast: 5, medium: 3, slow: 1 }, best_for: ["爆点入场", "音乐鼓点卡点"], duration_hint_frames: 8 },
  light_leak:     { name: "彩色漏光", name_en: "Light Leak", suitability: { fast: 3, medium: 4, slow: 4 }, best_for: ["复古胶片感", "日落段落"], duration_hint_frames: 14 },
  freeze_frame:   { name: "冻结帧+RGB偏移", name_en: "Freeze Frame", suitability: { fast: 4, medium: 3, slow: 1 }, best_for: ["瞬间定格", "节奏骤停"], duration_hint_frames: 8 },
} as const;

// ===== 镜头类型 → 推荐转场映射 =====

export const SHOT_TRANSITION_MAP: Record<string, { recommended: string[]; avoid: string[] }> = {
  hook:            { recommended: ["zoom_heavy", "zoom_flash", "whip", "flash_white"], avoid: ["dissolve", "fade"] },
  scene_establish: { recommended: ["fade", "blur_in", "zoom_out", "slide"], avoid: ["glitch", "freeze_frame"] },
  daily_moment:    { recommended: ["cut", "slide", "fade", "zoom_in"], avoid: [] },
  emotion_peak:    { recommended: ["zoom_flash", "zoom_heavy", "whip", "spin"], avoid: ["dissolve", "fade"] },
  transition:      { recommended: ["whip", "slide", "spin", "glitch", "flash_white"], avoid: [] },
  closing:         { recommended: ["fade", "dissolve", "blur_in", "flash_black"], avoid: ["glitch", "zoom_heavy"] },
  persona:         { recommended: ["zoom_in", "fade", "blur_in", "circle_reveal"], avoid: ["glitch", "freeze_frame"] },
  info_card:       { recommended: ["cut", "slide_up", "fade"], avoid: ["glitch", "spin"] },
};

// ===== 节奏 → 转场密度映射 =====

export const RHYTHM_TRANSITION_MAP: Record<string, { frequency: string; recommended_types: string[] }> = {
  "快": { frequency: "frequent", recommended_types: ["cut", "whip", "flash_white", "zoom_flash", "glitch"] },
  "中": { frequency: "moderate", recommended_types: ["slide", "zoom_in", "fade", "spin", "light_leak"] },
  "慢": { frequency: "sparse", recommended_types: ["fade", "dissolve", "blur_in", "circle_reveal"] },
};

// ===== Helper =====

/** 获取转场信息，含 fallback */
export function getTransitionInfo(type: string): TransitionInfo {
  return TRANSITIONS[type] ?? { name: type, name_en: type, suitability: { fast: 3, medium: 3, slow: 3 }, best_for: [], duration_hint_frames: 0 };
}

/** 根据镜头类型推荐转场 */
export function suggestTransitions(shotType: string): string[] {
  return SHOT_TRANSITION_MAP[shotType]?.recommended ?? ["cut", "fade"];
}

/** 根据节奏推荐转场密度 */
export function getRhythmConfig(rhythm: string): { frequency: string; recommended_types: string[] } {
  return RHYTHM_TRANSITION_MAP[rhythm] ?? { frequency: "moderate", recommended_types: ["fade", "slide"] };
}
