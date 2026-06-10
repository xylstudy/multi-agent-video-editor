# 爆款剪辑迁移 V2 改造方案

## 现状三大问题

### 问题 1：不是爆款迁移，只是简单剪辑

**当前做法：**
- 从爆款视频提取 4 个段落（期待/活力/平静）
- 从爆款音频检测 BPM 和节拍
- 用户照片按比例分配到各段，每段固定拍数（2拍或4拍）
- 从情绪转场池随机选转场

**这叫「用爆款音乐的节拍剪用户照片」，不是迁移。**

**本质缺陷：** 没有提取任何「镜头级别」的剪辑手法。爆款视频的编辑风格 = 每个镜头的 **时长序列 + 转场序列 + 运镜序列** 的组合，而非 4 个段落的概念标签。

---

### 问题 2：节拍卡点不完美

**三个具体缺陷：**

**a) 段落时长与节拍总数不匹配**
- `acts.json` 说总时长 = 33.0s
- 实际节拍覆盖到 30.557s（62拍，BPM=123）
- 最后 2.4s 无节拍可对齐

**b) 每镜拍数固定，没有还原原视频的节奏变化**
- 原视频 33 个镜头，每个 1.0s（≈2拍）
- 迁移后 28 个镜头，Act 3 用 4拍/镜头（比原视频长一倍）
- 用户照片数不同 → 强行压缩导致原节奏丢失

**c) Remotion Sequence 重叠帧导致对齐偏移**
- `cursor += dur - FRAME_MARGIN（2帧）` 使得每镜实际起始帧偏离了精确的 beat 位置
- 转场重叠帧 = 时序偏移的根源

---

### 问题 3：转场不神奇

**a) whip 和 mask 未实现**
- schema.ts 中定义了 `"whip" | "mask"` 类型
- Transitions.tsx 中 fall through 到 `default` → 无效果

**b) 当前转场只有「单层入场」**

当前架构（只看到新镜头）：
```
Sequence N → TransitionLayer（只包裹新镜头）
           → 只对 incoming 做动画，outgoing 直接消失
```

真转场需要（同时看到旧镜头消失 + 新镜头出现）：
```
Sequence N-1 (outgoing) ─┐
                         ├→ TransitionLayer（两层叠加）
Sequence N (incoming)  ──┘
```

**c) 缺少真正炫酷的效果**
所有转场都是基础 2D CSS：translate、clip-path inset、opacity、blur、rotate。没有 3D 透视、形状揭示、复合动画。

---

## V2 改造方案

### 改造 1：镜头级剪辑 DNA 提取

**目标：** 从爆款视频提取「镜头序列 → 节奏模式 → 迁移到新素材」

**步骤：**

```
extract_editing_pattern() 重写 →
  1. 从 shot_analyses 提取每个镜头的 start_time / end_time
  2. 用 beat_times 将每个镜头时长映射到「拍数」：
     镜头 i 时长 = end_i - start_i
     拍数 = round(时长 / beat_interval)
  3. 输出节奏序列：
     Act 0: [2, 2, 2]     — 3 镜头各 2 拍
     Act 1: [2, 2, 2, 2, 2] — 5 镜头各 2 拍
     Act 2: [2, 2, ...] × 20
     Act 3: [2, 2, 2, 2, 2]
  4. 提取转场序列（默认全 cut，后续可增强）
  5. 提取运镜序列：shot_analyses → camera_movement
```

**输出新增字段：**
```python
editing_pattern = {
    "acts": [...],
    "shot_rhythm": {          # 逐镜头的拍数序列
        0: [2, 2, 2],
        1: [2, 2, 2, 2, 2],
        2: [2, 2, ...],      # 20 个
        3: [2, 2, 2, 2, 2],
    },
    "shot_beats_total": [62],  # 总拍数对齐
    "beat_interval": 0.488,
}
```

**build_photo_scheme() 改造：**
- 按 `shot_rhythm` 的拍数序列分配时长，而非固定 beats_per_shot
- 用户照片不够时循环复用，而非压缩
- 如果 photo_count < shot_count：用照片复用策略（同张照片不同运镜）

---

### 改造 2：精确节拍同步

**目标：** 每个镜头切换点精准落在 beat_times 上

**步骤：**

**a) 帧级节拍对齐**

在 `build_photo_scheme()` 中，每个镜头的 start/end 直接取 beat_times 的值：

```python
# 第 i 个镜头，对应拍段 [beat_start, beat_end)
frame_start = beat_times[beat_start]    # 精确节拍时间
frame_end = beat_times[beat_end]        # 精确节拍时间
duration = frame_end - frame_start      # 精确到毫秒
```

**b) 总时长匹配**

不再用 acts.json 的近似时长，而是用 `beat_times[-1] - beat_times[0]` 作为实际总时长。最后一镜自然延伸到音频结束。

**c) VideoScheme.tsx 去掉 FRAME_MARGIN 偏移**

对于精确节拍同步的镜头，不需要重叠帧：
- `startFrame = round(beat_times[beat_start] * fps)` 直接计算帧位置
- `durationInFrames = round((beat_times[beat_end] - beat_times[beat_start]) * fps)`

如需转场重叠，用内部时序控制而非 margin 偏移。

---

### 改造 3：双层转场架构 + 新转场效果

#### 3a) 重构转场架构为「A→B 双层」

**当前（单层）：**
```
<Sequence>
  <TransitionLayer>         ← 只看到 incoming
    <FrameLayer (shot N) />
  </TransitionLayer>
</Sequence>
```

**改造后（双层）：**

新的 `DualTransitionLayer` 组件，在过渡帧同时渲染 outgoing 和 incoming：

```
<Sequence from={startN} durationInFrames={durN + overlap}>
  <DualTransitionLayer
    prevFrame={storyboard[N-1]}    ← 前一镜
    nextFrame={storyboard[N]}      ← 当前镜
    transitionType={...}
    overlapInFrames={overlap}
  >
    <FrameLayer frame={storyboard[N-1]} />   ← 旧镜头
    <FrameLayer frame={storyboard[N]} />     ← 新镜头
  </DualTransitionLayer>
</Sequence>
```

过渡期内：
- frame [0, overlap)：旧镜头做 exit 动画，新镜头做 entry 动画
- frame [overlap, durN)：只显示新镜头

VideoScheme.tsx 的 Sequence 编排对应调整，不再用 FRAME_MARGIN 偏移，而是用 Sequence 原生长度 + 过渡重叠。

#### 3b) 实现 whip 和 mask

**Whip Pan（甩镜头）：**
- 旧镜头：快速水平位移 + 运动模糊（通过 scale 拉伸模拟）
- 新镜头：从相反方向快速滑入
- 总时长 8-10 帧

**Mask（遮罩转场）：**
- 用 clip-path 从中心圆展开或形状遮罩过渡
- 支持圆形、菱形、心形遮罩

#### 3c) 新增 6 种炫酷转场

| 转场 | 实现方式 | 适用场景 |
|------|----------|----------|
| **3D Flip** | CSS perspective + rotateY 卡片翻转 | 段间大切换 |
| **Circle Reveal** | clip-path: circle() 从中心展开 | 情绪高点出现 |
| **Whip Pan** | 横向模糊高速甩镜 | 快节奏段 |
| **Zoom Flash** | zoom out→flash→zoom in 复合 | 段间分隔 |
| **Radial Wipe** | clip-path: polygon 角度擦除 | 中速段 |
| **Glitch** | RGB 偏移 + 抖动 + 闪烁 | 活力/动感段 |

实现示例（Circle Reveal）：

```tsx
// 双层的遮罩过渡
const circleRadius = interpolate(frame, [0, overlapFrames], [0, Math.sqrt(2) * 50], {
  extrapolateLeft: "clamp", extrapolateRight: "clamp",
});
// old clip: visible outside circle
// new clip: visible inside circle
```

---

## 涉及文件清单

| 文件 | 改动 |
|------|------|
| `run_editing_transfer.py` | 重写 `extract_editing_pattern()` 提取节奏序列；改造 `build_photo_scheme()` 按拍数序列分配；去掉 beat_per_shot_override |
| `remotion/src/VideoScheme.tsx` | 重构 Sequence 编排：去掉 FRAME_MARGIN，引入双层过渡架构 |
| `remotion/src/components/Transitions.tsx` | 新增 `DualTransitionLayer` 组件；实现 whip / mask / 3D flip / circle reveal / zoom flash / radial wipe / glitch |
| `remotion/src/types/schema.ts` | 无需改动（类型已覆盖） |
| `remotion/src/components/FrameLayer.tsx` | 可能微调以支持双层渲染时的引用传递 |

---

## 实施顺序

```
第1步：改造 extract_editing_pattern() → 输出 shot_rhythm 节奏序列
第2步：改造 build_photo_scheme() → 按拍数序列分配、精确节拍对齐
第3步：重构 VideoScheme.tsx → 双层 Sequence 架构
第4步：重构 Transitions.tsx → DualTransitionLayer + 实现未完成的转场
第5步：新增 6 种炫酷转场
第6步：集成测试 + Remotion 渲染验证
```

---

## 预期效果

| 指标 | 当前 | V2 目标 |
|------|------|---------|
| 节拍同步 | 近似的固定拍数 | 精确到每个镜头的拍序列对齐 |
| 迁移真实感 | 段落级概念迁移 | 镜头级节奏 DNA 复刻 |
| 转场多样性 | 12 种（含 2 种无效） | 18 种（全部有效，含双层过渡） |
| 转场视觉效果 | 基础 2D CSS 动画 | 3D 透视 + 形状揭示 + 复合动画 |
