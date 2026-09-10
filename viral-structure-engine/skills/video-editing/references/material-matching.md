# Material Matching（素材匹配）

## 适用条件

- Gene 某镜头所需的画面（如"航拍 establishing"）在用户素材里**没有同类物体**。
- 需要判断"用哪个用户素材替代这个镜头功能"。

## 不适用条件 / caution

- **不要**机械寻找"航拍/同一物体"：找不到就失败是错误行为。
- 不要为了"像原片"强行用不合适素材——那是 Content Copy，不是 Structure Transfer。

## 推荐策略（功能级匹配，非物体级匹配）

1. 先看 Gene 的 `visual_requirement`（功能性要求），再看 `semantic_role`。
2. 用**功能**去匹配用户素材：establishing → 宽景/地标/环境交代；climax → 最美/最有感染力画面。
3. 匹配顺序：功能语义 > 情绪 > 景别 > 具体物体。
4. 实在无替代 → 用 `structure-adaptation`（见下）降级：文字卡 + 运镜，或拼贴多图交代环境。

## 例子

- Gene 需要航拍 establishing，用户只有地标仰拍/宽景街景 → 选宽景地标照，功能等价。
- Gene 需要情绪高点的人脸特写，用户无清晰人脸 → 选最有感染力的风景特写替代，情绪等价。
