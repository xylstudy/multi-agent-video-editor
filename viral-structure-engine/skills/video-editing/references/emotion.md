# Emotion（情绪）

## 适用条件

- 需要为分镜标 `emotion`，或保证整条情绪弧连贯。
- Gene 给出 `emotion_role` / `overall_emotion` / `emotion_arc` 时。

## 不适用条件 / caution

- 情绪一致性 > 内容丰富度：不要因为某张素材"好看"就插进情绪不匹配的位置。
- 避免情绪断裂或刻意煽情（最怕"假"）。

## 推荐策略

- 沿 Gene 的情绪弧走：起始情绪 → 递进 → 高潮 → 回落 → 余韵。
- 分镜 `emotion` 与素材的 `emotion_label` 尽量一致。
- 高潮段用大字幕 + 金色/亮色 + scale_up；平静段用小字幕 + 柔色 + fade_in。
- 音频情绪（mood_segments）与画面 emotion 对齐。

## 例子 / 来源

- 来源：爆款 5 段式情绪弧（治愈/燃/轻松/怀旧/活力）每段主导情绪聚合。
- 反例：素材是夕阳余韵却放在开场 hook → 情绪错位。
