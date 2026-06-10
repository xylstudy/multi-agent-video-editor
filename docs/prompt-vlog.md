# Vlog 主题 Prompt 完整模板

以下按 `prompts/` 目录结构组织，每个 Prompt 是一个 Python 函数，接收参数后返回格式化好的 Prompt 字符串。

---

## prompts/analyst_prompts.py

```python
# prompts/analyst_prompts.py
# Analyst Agent 的两个 Prompt：逐帧画面分析 + 综合结构分析


def build_shot_analysis_prompt(
    shot_index: int,
    start_time: float,
    end_time: float,
    total_duration: float,
    prev_frame_desc: str,
) -> str:
    """
    Prompt 1.1：单镜头画面分析
    每个关键帧调用一次，输出该帧的画面内容、拍摄技法、结构功能判断
    """

    prev_context = f"前一帧内容：{prev_frame_desc}" if prev_frame_desc else "这是视频的第一个镜头。"

    return f"""你是一位有8年经验的短视频内容分析师，专门研究抖音和小红书爆款Vlog的画面语言。你能从一帧画面中读出拍摄意图、情绪信息和结构作用。

【输入信息】
这是一条Vlog视频的第{shot_index + 1}个镜头的关键帧。
该镜头时间：{start_time:.1f}s - {end_time:.1f}s（时长 {end_time - start_time:.1f}s）
视频总时长：{total_duration:.1f}s
{prev_context}

请按以下三步分析这帧画面：

=== 第一步：画面内容识别 ===
- 画面中的主体是什么？从以下选项中选择最匹配的：人物特写 / 人物中景 / 美食 / 风景 / 建筑 / 街道 / 室内环境 / 物品特写 / 文字卡 / 黑场/白场 / 动物 / 其他
- 如果有人物：有几人？是正面/侧面/背影？表情大致如何（开心/平静/专注/惊喜/其他）？在做什么动作？
- 场景环境：室内还是室外？地点类型是什么（家/咖啡厅/餐厅/街道/景区/公园/办公室/商场/车内/其他）？
- 色调和光影：整体偏暖还是偏冷？是自然光还是人工光？光影质量如何（柔和/强烈/逆光/阴天/黄昏/夜景）？
- 画面中有没有文字信息？如果有，大致内容是什么？

=== 第二步：拍摄技法判断 ===
- 景别：特写（脸/手/物品局部）/ 近景（胸部以上）/ 中景（半身或膝上）/ 全景（全身或完整场景）/ 远景（大范围环境）
- 构图：居中构图 / 三分法 / 对角线 / 框架构图 / 大面积留白 / 对称 / 俯拍 / 仰拍
- 运镜推断（结合画面模糊程度和构图特点）：固定镜头 / 推镜头 / 拉镜头 / 平移 / 跟随 / 手持晃动 / 无法判断
- 画面质感：高清干净 / 有轻微噪点 / 有胶片感 / 有明显滤镜 / 有光斑或虚化 / 画面模糊或过曝

=== 第三步：Vlog结构功能判断 ===
这个镜头在Vlog叙事中最可能承担什么功能？只选一个主功能：

- hook吸引：画面有强烈的视觉冲击力或悬念感，出现在视频开头，目的是抓住观众注意力
- 场景建立：展示地点、环境、空间，让观众知道"这是在哪"，通常用于Vlog的开头或场景切换处
- 日常铺展：展示做事的过程、日常生活的片段，信息量中等，节奏中等，是Vlog的"填充内容"
- 情绪高点：整条Vlog中视觉最美、最有感染力、最震撼或最温暖的画面，通常配合BGM高潮
- 人物表达：重点展示人物的状态、情绪、反应或与他人的互动，Vlog中增加"人格感"的关键
- 信息传递：画面中有明确的文字信息（字幕卡、标题、价格、地址等），起到传递信息而非叙事的作用
- 收尾定格：视频结尾的画面，通常带有情绪落点、感悟感或温暖感，给观众一个"收束"的感觉
- 过渡连接：内容信息量低，主要起连接两个不同段落的过渡作用，如空镜、模糊转场画面

请严格按以下JSON格式回答，不要添加任何其他文字：

{{
  "shot_index": {shot_index},
  "content": {{
    "main_subject": "主体描述（一句话）",
    "people_count": 0,
    "people_description": "人物描述（无人物则为空字符串）",
    "scene_type": "场景类型",
    "indoor_outdoor": "indoor/outdoor/unknown",
    "color_temperature": "warm/cool/neutral",
    "light_quality": "描述光影质量",
    "has_text_in_frame": false,
    "text_content": "画面中的文字（无则为空）"
  }},
  "technique": {{
    "shot_size": "close_up/medium_close/medium/medium_long/long",
    "composition": "构图方式",
    "camera_movement": "推断的运镜",
    "visual_quality": "画面质感描述"
  }},
  "structure_role": {{
    "primary_function": "hook/scene_establish/daily_moment/emotion_peak/persona_expression/info_card/closing_moment/transition",
    "confidence": 0.0,
    "reasoning": "一句话说明判断依据"
  }},
  "emotion": "这个镜头传递的核心情绪（一个词，如：活力/平静/温馨/震撼/期待/好奇/治愈/热血/忧郁/欢乐）",
  "one_sentence_summary": "一句话描述这个镜头的画面和作用"
}}"""


def build_structure_analysis_prompt(
    duration: float,
    width: int,
    height: int,
    shot_count: int,
    shot_analyses_text: str,
    transcript: str,
) -> str:
    """
    Prompt 1.2：综合结构分析
    所有镜头分析完成后，做全局的结构化推理
    这是AnalystAgent最核心的Prompt
    """

    transcript_section = (
        f"以下是视频的完整语音转写文本（旁白/口播/对话）：\n{transcript}"
        if transcript
        else "该视频无语音内容或语音转写为空。"
    )

    return f"""你是一位抖音Vlog赛道的资深编导，看过上万条爆款Vlog，对Vlog的结构模式、节奏设计、情绪曲线有深入研究。你正在对一条Vlog做全面的结构拆解，这个拆解结果将被用于"结构迁移"——把这条视频的成功方法论迁移到新内容上。

【视频基础信息】
总时长：{duration:.1f}秒
分辨率：{width}x{height}
镜头总数：{shot_count}个

【逐镜头分析结果】（按时间顺序）
{shot_analyses_text}

【语音转写】
{transcript_section}

请完成以下六个分析任务，每个任务都是结构迁移的关键依据：

========================================
任务一：脚本段落结构
========================================
将视频按叙事逻辑划分为3-7个段落。Vlog的段落不是随机切分的，而是按叙事节奏来划分——每个段落有明确的叙事目的。

对每个段落标注：
- 段落目的，从以下选项中选择：
  · hook：开头吸引，前3秒关键
  · 人设展示：展示博主是谁、在哪、在做什么
  · 场景铺展：展示环境、氛围、日常过程
  · 情绪递进：情绪逐步升温或发生转折
  · 高潮爆发：视觉或情绪的最高点
  · 价值输出：感悟、金句、经验、总结
  · CTA互动：引导关注、评论、点赞、收藏
- 对应的镜头范围（镜头序号）
- 该段的文案/旁白概要（从转写文本中提取或用自己的话概括）
- 建议时长
- 情绪基调（一个词）
- 节奏特征（快/中/慢）

========================================
任务二：节奏结构分析
========================================
1. 节奏曲线关键节点：列出6-10个时间点，每个标注节奏强度（0-1）和设计意图
2. 节奏模式判断（选一个）：
   · 快-慢-快：开头快切吸引，中段慢下来讲故事，结尾再加速
   · 慢-快-慢：开头舒缓建立氛围，中段节奏加快，结尾回归平静
   · 持续递增：节奏从慢到快逐步升温
   · 全程卡点：以BGM节拍为主导，画面严格卡点
   · 平稳-爆发：大部分时间平稳，在某一个点突然爆发
3. 高潮位置：在总时长的百分之多少处？（如70%处）
4. 前3秒节奏：前3秒有几个镜头？每秒切几刀？
5. BGM推断：从画面切换节奏推断BGM的大概风格和BPM范围

========================================
任务三：包装结构分析
========================================
1. 字幕风格：
   - 推测字体类型（黑体/圆体/手写体/宋体/艺术字）
   - 字幕颜色和描边情况
   - 字幕位置（顶部/底部/居中）
   - 字幕动画效果（静态/淡入/逐字出现/弹出/滑入）
   - 字幕密度（每秒大约多少字）
2. 标题/文字卡：
   - 是否有独立的文字卡镜头？
   - 文字卡出现的位置和大致内容
3. 转场方式：
   - 主要使用了哪些转场？（硬切/叠化/缩放/遮罩/甩镜/闪白/模糊过渡）
   - 转场的分布规律（规律分布还是随机的？集中在什么位置？）
4. 滤镜/调色风格：
   - 整体色调倾向（日系清新/胶片复古/电影感/高饱和活力/低饱和质感/黑白/自然）
5. 其他视觉元素：
   - 贴纸、表情符号、动态特效、边框等

========================================
任务四：Hook策略分析
========================================
详细分析前3秒的hook策略：
1. hook的具体手法是什么？从以下选项中选择最适合的：
   · 悬念提问：用问句或悬念制造好奇心（如"你知道我今天经历了什么吗"）
   · 视觉冲击：用最震撼/最美/最反差的画面开场
   · 金句开头：用一句有力量的话开场
   · 反差对比：开头展示一个反常识或反差的画面
   · 声音吸引：用特殊音效或突兀的声音抓住注意力
   · 直接展示结果：先把结果/最精彩的画面放出来
2. hook和后面内容的衔接是否自然？

========================================
任务五：整体结构模式分类
========================================
这条Vlog属于哪种结构类型？选一个最匹配的：
· 悬念前置型：先抛出结果或悬念，再回溯过程展开叙述
· 情绪递进型：情绪从低到高逐步升温，像爬坡一样
· 节奏卡点型：以BGM节拍为主导，画面切换严格配合音乐节奏
· 日常流水型：按时间线串联日常片段，没有强烈的戏剧冲突
· 对比反转型：前后形成强烈对比（如before/after、变化前/变化后）
· 故事叙事型：有明确的起承转合，像讲一个小故事

为什么归为此类？核心特征是什么？

========================================
任务六：关键技法提取
========================================
列出3-6个这条Vlog最核心的剪辑或拍摄技法标签，每个标签要有具体含义。
示例标签：快切开头、慢动作高潮、叠化转场、手写字幕、Ken Burns效果、
画中画、分屏对比、音效强调、留白呼吸、BGM卡点、跳切剪辑、遮罩转场等。

请严格按以下JSON格式输出，不要添加任何其他文字：

{{
  "script_structure": [
    {{
      "index": 0,
      "purpose": "hook/人设展示/场景铺展/情绪递进/高潮爆发/价值输出/CTA互动",
      "shot_range": "镜头X - 镜头Y",
      "content_summary": "该段的文案/旁白概要",
      "duration_hint": 秒数,
      "emotion": "情绪基调",
      "rhythm": "快/中/慢"
    }}
  ],
  "rhythm_analysis": {{
    "curve_points": [
      {{"time": 0.0, "intensity": 0.0, "note": "设计意图说明"}}
    ],
    "pattern": "快-慢-快/慢-快-慢/持续递增/全程卡点/平稳-爆发",
    "climax_position_percent": 0,
    "front_3s_shot_count": 0,
    "estimated_bpm_range": "低-高",
    "bgm_style_guess": "BGM风格推测"
  }},
  "packaging_analysis": {{
    "subtitle_font_guess": "推测的字体类型",
    "subtitle_color_and_stroke": "颜色和描边描述",
    "subtitle_position": "top/bottom/center",
    "subtitle_animation": "none/fade_in/typewriter/bounce/slide_in",
    "subtitle_density": "每秒大约X字",
    "title_cards": [
      {{"position_in_timeline": "大概在X秒处", "content": "文字卡内容", "style": "样式描述"}}
    ],
    "transitions_used": [
      {{"between": "镜头X到镜头Y", "type": "转场类型"}}
    ],
    "color_grade": "japanese_fresh/film_retro/cinematic/vivid/b_w/natural",
    "color_grade_detail": "调色风格的详细描述",
    "stickers_effects": "贴纸和特效描述（无则为空字符串）"
  }},
  "hook_strategy": {{
    "method": "悬念提问/视觉冲击/金句开头/反差对比/声音吸引/直接展示结果",
    "detail": "具体手法描述",
    "effectiveness": "这个hook的效果评估（一句话）",
    "connection_to_body": "hook和后面内容的衔接是否自然"
  }},
  "structure_type": {{
    "category": "悬念前置型/情绪递进型/节奏卡点型/日常流水型/对比反转型/故事叙事型",
    "reasoning": "为什么归为此类",
    "core_characteristics": "这个结构模式的核心特征（2-3句话）"
  }},
  "key_techniques": [
    "技法标签1：具体含义",
    "技法标签2：具体含义"
  ],
  "narrative_type": "timeline/emotion/event",
  "persona_type": "voiceover/talking_head/back_figure/hands_only/mixed/no_persona",
  "persona_ratio": 0.0,
  "empty_shot_count": 0,
  "overall_emotion": "整条Vlog的情绪基调（一个词）",
  "overall_summary": "50字以内的整体结构总结，要包含结构类型、hook方式和核心技法"
}}"""
```

---

## prompts/material_prompts.py

```python
# prompts/material_prompts.py
# Material Manager Agent 的四个 Prompt


def build_image_analysis_prompt(
    material_id: str,
    target_topic: str,
    topic_description: str,
) -> str:
    """
    Prompt 2.1：图片素材分析
    每张图片调用一次，输出内容理解、Vlog适用性、质量评估
    """

    return f"""你是一位短视频素材管理专家，负责评估用户上传的图片在Vlog创作中的价值。你需要像一个有经验的编导看到素材时的第一反应——快速判断它能用在哪、好不好用。

【背景信息】
用户要制作的Vlog主题：{target_topic}
主题描述：{topic_description}
素材ID：{material_id}

【你的任务】
分析这张图片，回答以下问题：

=== 第一步：内容识别 ===
看清楚画面里有什么：
- 主体内容是什么？（人物自拍/人物他拍/美食/风景/建筑/街道/室内环境/物品/宠物/合照/其他）
- 有没有人物？如果有：几个人？什么状态（站/坐/走/吃/笑/看镜头/看远方/互动）？
- 场景是什么？（家/咖啡厅/餐厅/街道/景区/公园/商场/办公室/车内/户外/其他）
- 画面给你的整体感觉是什么？（温馨/活力/安静/热闹/文艺/日常/震撼/治愈/其他）

=== 第二步：Vlog适用性评估 ===
这张图最适合放在Vlog的什么位置？按适合程度排序，给出所有可能的位置：

- hook镜头：画面第一眼就能抓住人，有视觉冲击力或好奇心，适合放在视频开头
- 场景建立：画面展示了明确的地点或环境信息，能让观众知道"这是在哪"
- 日常铺展：画面展示了一个活动或过程的片段，适合放在Vlog中间做日常展示
- 情绪高点：画面特别美、特别有感染力、或特别打动人，适合作为Vlog的情绪高潮
- 人物表达：画面中人物的状态很好（表情自然/动作好看/有故事感），适合展示博主的人物魅力
- 信息传递：画面中有文字/价格/地址等信息，适合做信息展示
- 收尾定格：画面有"收束感"，适合放在Vlog结尾做定格或渐隐
- 不适合使用：画质太差/内容不相关/构图太乱/模糊过曝

=== 第三步：质量评估 ===
- 画质：高清/一般/偏暗/过曝/模糊/有噪点
- 构图：专业/不错/一般/需要裁切改善/构图较差
- 光影：黄金时段/柔和自然光/光线充足/偏暗/逆光/人工光源
- 是否需要后期处理？如果需要，建议做什么？（裁切/调亮/降噪/加滤镜/虚化背景）

=== 第四步：情绪和标签 ===
- 这张图传递的情绪是什么？（一个词：开心/平静/温暖/活力/期待/专注/惊喜/治愈/文艺/自由/其他）
- 给这张图打3-5个标签，用于后续检索匹配

请严格按以下JSON格式回答：

{{
  "material_id": "{material_id}",
  "content": {{
    "main_subject": "主体描述",
    "people_count": 0,
    "people_description": "人物描述（无人物则为空）",
    "scene_type": "场景类型",
    "atmosphere": "画面整体感觉"
  }},
  "vlog_applicability": [
    {{
      "position": "hook/scene_establish/daily_moment/emotion_peak/persona_expression/info_card/closing",
      "confidence": 0.0,
      "reasoning": "为什么适合这个位置"
    }}
  ],
  "quality": {{
    "overall": "high/medium/low",
    "resolution": "high/medium/low",
    "composition": "good/okay/needs_crop/poor",
    "light": "golden_hour/soft/sufficient/dim/backlit/artificial",
    "needs_processing": false,
    "suggested_processing": ["处理建议"]
  }},
  "emotion_label": "情绪标签",
  "tags": ["标签1", "标签2", "标签3"],
  "best_as_hook_subtitle": "如果用作hook，可以配什么字幕？（不超过15字）",
  "overall_vlog_value": "high/medium/low"
}}"""


def build_video_analysis_prompt(
    material_id: str,
    target_topic: str,
    duration: float,
    frame_descriptions: str,
) -> str:
    """
    Prompt 2.2：视频素材分析
    每段视频调用一次，输出内容段落划分、高光片段、可用性评估
    """

    return f"""你是一位短视频素材管理专家，擅长从一段原始视频素材中快速提取Vlog可用的高光片段。你的判断要像一个编导快速浏览素材时的直觉——哪些能用、用在哪、多长合适。

【背景信息】
Vlog主题：{target_topic}
素材ID：{material_id}
视频时长：{duration:.1f}秒

以下是该视频的关键帧描述（每隔一定时间抽取一帧）：
{frame_descriptions}

请完成以下分析：

=== 第一步：内容段落划分 ===
根据关键帧描述，将这段视频按内容变化划分为若干小段。
每段标注：
- 起止时间（大致即可）
- 内容描述
- 画面稳定性推测（stable / slight_shake / heavy_shake）
- 信息密度（high / medium / low —— 画面是否有看点、是否丰富）

=== 第二步：高光片段提取 ===
从所有段落中筛选出最有Vlog价值的片段（最多5个）。
"有价值"的判断标准：
- 画面好看（构图、光影、色彩至少一个维度突出）
- 有情绪感染力（能让人感到开心/温暖/震撼/治愈）
- 有故事感（画面中发生了什么有趣的事）
- 有信息量（展示了有意义的过程或结果）

对每个高光片段标注：
- 时间范围
- 为什么有价值
- 在Vlog中适合担任的角色（hook / scene / daily / emotion_peak / persona / closing）

=== 第三步：整体评估 ===
- 整体画质水平
- 是否有稳定可用的片段
- 是否有需要保留的音频（人声/环境音/音乐）
- 是否有需要跳过的问题段落

请严格按以下JSON格式回答：

{{
  "material_id": "{material_id}",
  "total_duration": {duration},
  "content_segments": [
    {{
      "index": 0,
      "start": 0.0,
      "end": 0.0,
      "description": "内容描述",
      "stability": "stable/slight_shake/heavy_shake",
      "density": "high/medium/low"
    }}
  ],
  "highlight_clips": [
    {{
      "start": 0.0,
      "end": 0.0,
      "duration": 0.0,
      "description": "内容描述",
      "why_valuable": "为什么有价值",
      "suggested_vlog_role": "hook/scene_establish/daily_moment/emotion_peak/persona_expression/closing",
      "confidence": 0.0
    }}
  ],
  "overall_assessment": {{
    "quality": "high/medium/low",
    "has_usable_clips": true,
    "usable_clip_count": 0,
    "audio_to_keep": "none/ambient/voice/music",
    "problem_segments": [
      {{"start": 0.0, "end": 0.0, "reason": "问题原因"}}
    ]
  }},
  "emotion_label": "整段视频的情绪标签",
  "tags": ["标签1", "标签2"],
  "overall_vlog_value": "high/medium/low"
}}"""


def build_text_analysis_prompt(
    target_topic: str,
    text_content: str,
) -> str:
    """
    Prompt 2.3：文本素材分析
    每段文本调用一次，提取核心信息、金句、情绪、适用位置
    """

    return f"""你是一位Vlog文案策划师，擅长从用户随手写的文字中提取Vlog创作的灵感和素材。

【背景信息】
Vlog主题：{target_topic}
用户提供的文字素材：
---
{text_content}
---

请分析这段文字：

1. 核心信息：这段文字最核心的1-3个信息点是什么？（地点、事件、心情、人物、时间等）

2. 情绪基调：这段文字传递的是什么情绪？（开心/平静/温暖/期待/感慨/兴奋/治愈/自由/其他）

3. 金句提取：有没有可以直接用作Vlog字幕或旁白的短句？
   好的Vlog金句特点：口语化、简短有力（不超过15字）、有画面感或情绪感染力
   如果原文没有特别好的金句，可以基于原文改写2-3个Vlog风格的短句

4. Vlog结构建议：这段文字最适合用在Vlog的什么位置？
   - hook字幕：作为视频开头的悬念或吸引文字
   - 中段旁白：作为过程展示时的旁白或字幕
   - 高潮旁白：配合情绪高点画面的旁白
   - 收尾金句：放在视频结尾的感悟或总结
   - 信息字幕：作为地点/时间/事件的信息标注

请严格按以下JSON格式回答：

{{
  "core_info": ["信息点1", "信息点2"],
  "emotion_tone": "情绪基调",
  "extractable_quotes": [
    {{
      "text": "金句内容（不超过15字）",
      "source": "原文摘取/基于原文改写",
      "suggested_position": "hook/middle/climax/ending",
      "mood": "金句的情绪色彩"
    }}
  ],
  "structure_suggestion": "这段文字在Vlog中的最佳使用方式（2-3句话）",
  "vlog_value": "high/medium/low",
  "tags": ["标签1", "标签2"]
}}"""


def build_gap_check_prompt(
    storyboard_json: str,
    materials_summary: str,
) -> str:
    """
    Prompt 2.4：缺口识别推理
    用于更精细的缺口评估（可选，规则匹配为主，LLM辅助判断模糊情况）
    """

    return f"""你是一位Vlog编导助理，负责检查一个Vlog方案的素材完整性。你的工作是精确找出"需要什么但没有"的缺口，并评估每个缺口对视频质量的影响。

【Vlog方案分镜表】
{storyboard_json}

【可用素材清单】
{materials_summary}

请逐步分析：

=== 第一步：逐分镜检查 ===
对分镜表中的每一帧，判断：
- 是否已分配素材？
- 已分配的素材是否真的适合这个位置？（素材的内容描述和分镜需要的画面是否匹配？）
- 如果没有分配素材，或者分配了但明显不合适，标记为缺口

=== 第二步：缺口评估 ===
对每个识别出的缺口：

1. 影响评估（1-5分）：
   5分 = 致命缺口（没有这个素材视频完全无法成立，如hook镜头缺失）
   4分 = 重大缺口（严重影响观感，如缺少人物表达，Vlog失去人格感）
   3分 = 中等缺口（质量明显下降，如缺少场景建立镜头）
   2分 = 轻微缺口（可以通过文字卡或简单处理替代）
   1分 = 可忽略（不影响整体效果，如过渡镜头可直接硬切）

2. 补全策略建议（从以下选择最适合的）：
   - 素材复用：从其他分镜的素材中裁切/变速/换角度复用
   - Ken Burns效果：对现有静态图片做缓慢缩放平移，制造动态感
   - 文字卡替代：用精心设计的文字卡（背景色+手写体文字）作为独立镜头
   - 结构重排：调整分镜顺序，用更强的素材补到更重要的位置
   - 空镜头填充：用环境空镜头做过渡和情绪铺垫
   - 旁白驱动：用旁白文案把不太相关的画面串联成连贯叙事

=== Vlog特殊注意 ===
- hook镜头是Vlog的生死线，如果hook缺失且无法从现有素材中找到替代，影响分必须是5
- 如果整条Vlog没有任何人脸出现（缺少persona类镜头），会严重影响完播率，即使不是"缺口"也要标记风险
- 文字卡在Vlog中是被广泛接受的，用文字卡替代缺失画面对Vlog来说是合理的，影响分可以适当降低

请严格按以下JSON格式回答：

{{
  "per_slot_check": [
    {{
      "slot_index": 0,
      "assigned_material_id": "已分配的素材ID或null",
      "match_quality": "perfect/good/勉强/不匹配/无素材",
      "issue": "有什么问题（无问题则为空字符串）"
    }}
  ],
  "gaps": [
    {{
      "slot_index": 0,
      "required_content": "这个分镜需要什么画面",
      "required_type": "hook/scene_establish/daily_moment/emotion_peak/persona_expression/info_card/closing/transition",
      "impact_score": 0,
      "impact_reasoning": "为什么给这个分数",
      "suggested_strategy": "建议的补全策略",
      "strategy_detail": "具体怎么操作",
      "alternative_strategy": "备选策略"
    }}
  ],
  "coverage_rate": 0.0,
  "face_coverage_warning": "如果Vlog中几乎没有人物出镜，这里给出警告（无问题则为空字符串）",
  "priority_fill_order": [0, 1, 2],
  "overall_feasibility": "当前素材条件下这个方案是否可行（一句话判断）"
}}"""
```

---

## prompts/planner_prompts.py

```python
# prompts/planner_prompts.py
# Planner Agent 的三个 Prompt


def build_skeleton_extract_prompt(
    source_structure_json: str,
) -> str:
    """
    Prompt 4.1：结构骨架提取
    从爆款分析结果中提取可迁移的结构模板
    """

    return f"""你是一位Vlog赛道的金牌编导，你的专长是"看透爆款的结构密码"。你能从一条爆款Vlog中提取出它的结构骨架——那些让视频"好看"的方法论，而不是具体内容。

现在你要分析一条爆款Vlog的结构拆解结果，找出其中可迁移的结构模式。

【爆款Vlog的结构分析结果】
{source_structure_json}

请回答以下问题：

=== 1. 结构骨架 ===
用不超过5句话描述这条Vlog的"结构骨架"。
骨架必须是通用的——不能包含任何具体内容（不能出现具体的商品名、地名、人名），
换任何主题、任何素材都适用。

例如好的骨架描述：
"前3秒用悬念问句+最震撼画面做hook，中段用3个生活片段铺展日常，
每个片段1-2个镜头配慢节奏BGM，在70%处放一个视觉最强的画面做高潮，
最后用温暖的定格画面+金句字幕收尾。"

=== 2. 骨架元素 vs 可替换内容 ===
明确区分：
- 骨架元素（必须保留的）：结构顺序、段落数量、节奏模式、hook类型、高潮位置、情绪走向
- 可替换内容（可以换的）：具体画面、具体文案、具体场景、具体人物、具体BGM

=== 3. 有效性的底层逻辑 ===
这个结构为什么有效？从观众心理的角度解释：
- 开头为什么能留住人？（好奇心/视觉冲击/情感共鸣/信息缺口）
- 中间为什么不会走神？（节奏变化/信息密度/情绪递进）
- 高潮为什么有冲击力？（位置选择/铺垫反差/感官刺激）
- 结尾为什么能引发互动？（情绪落点/认同感/期待感）

=== 4. 局限性 ===
这个结构不适合什么类型的Vlog？在什么情况下效果会打折？

请严格按以下JSON格式回答：

{{
  "skeleton_description": "5句话以内的结构骨架描述",
  "skeleton_segments": [
    {{
      "segment_index": 0,
      "name": "段落名称（如：悬念hook）",
      "role": "这个段落在结构中的作用",
      "must_keep": true,
      "keep_reason": "为什么必须保留"
    }}
  ],
  "replaceable_elements": [
    {{
      "element": "可替换的元素",
      "replacement_rule": "替换时要遵循什么规则"
    }}
  ],
  "why_effective": {{
    "hook_psychology": "开头为什么能留住人",
    "middle_psychology": "中间为什么不会走神",
    "climax_psychology": "高潮为什么有冲击力",
    "ending_psychology": "结尾为什么能引发互动"
  }},
  "limitations": "不适合的场景和原因",
  "best_suited_vlog_types": ["最适合的Vlog类型1", "类型2"],
  "skeleton_as_template": "将骨架描述整理为一个可直接复用的模板（用[xxx]标记需要替换的部分）"
}}"""


def build_scheme_generate_prompt(
    skeleton_analysis: str,
    key_techniques: str,
    target_topic: str,
    target_info: str,
    target_duration: float,
    style_preference: str,
    material_inventory_desc: str,
    knowledge_refs: str,
    user_preferences: str,
) -> str:
    """
    Prompt 4.2：迁移方案生成（核心Prompt）
    这是整个系统中最重要的Prompt，决定了最终输出质量
    """

    knowledge_section = (
        f"以下是从知识库中检索到的相关参考：\n{knowledge_refs}\n\n请参考但不要照搬。"
        if knowledge_refs
        else ""
    )

    return f"""你是一位Vlog编导，现在需要完成一个"结构迁移"任务：
把一条爆款Vlog的成功结构，迁移到一个全新的Vlog主题上。

你要做的是"迁移方法"而不是"复制内容"。
爆款的成功在于它的结构设计——hook方式、节奏控制、情绪曲线、包装手法。
你需要保留这些结构设计的精髓，但用全新的内容去填充。

━━━━━━━━━━━━━━━━━━━━━━━━
一、爆款的结构骨架
━━━━━━━━━━━━━━━━━━━━━━━━
{skeleton_analysis}

━━━━━━━━━━━━━━━━━━━━━━━━
二、爆款的关键技法
━━━━━━━━━━━━━━━━━━━━━━━━
{key_techniques}

━━━━━━━━━━━━━━━━━━━━━━━━
三、新Vlog信息
━━━━━━━━━━━━━━━━━━━━━━━━
主题：{target_topic}
详细信息：{target_info}
目标平台：抖音
目标时长：{target_duration}秒
风格偏好：{style_preference}

━━━━━━━━━━━━━━━━━━━━━━━━
四、用户偏好
━━━━━━━━━━━━━━━━━━━━━━━━
{user_preferences}

━━━━━━━━━━━━━━━━━━━━━━━━
五、可用素材
━━━━━━━━━━━━━━━━━━━━━━━━
{material_inventory_desc}

{knowledge_section}

请按以下步骤完成方案设计。每一步都要写清楚你的思考过程，最后输出完整JSON。

========================================
步骤一：结构映射
========================================
将爆款的结构骨架映射到新Vlog上。对每一个骨架段落：
- 爆款的这个段落在做什么？
- 新Vlog中对应什么内容？
- 哪些部分保留了爆款的方法？哪些做了适配调整？为什么？

关键要求：
- 新Vlog的叙事线选择要合理：有明确时间顺序的素材用timeline，以情绪照为主的用emotion，有事件线索的用event
- 有人脸的素材优先分配到hook和情绪高点位置
- 素材质量最高的优先分配到hook（Vlog的生死在前3秒）

========================================
步骤二：脚本设计
========================================
为每个段落写脚本。

Vlog脚本的特点：
- 旁白要口语化，像在和朋友聊天，不是在念稿子
- 短句为主，每段旁白不超过25字
- 不要用"首先""然后""最后"这种连接词
- 字幕要更简短有力（和旁白可以不同），每张字幕不超过15字
- 好的Vlog旁白是可以闭上眼睛光听就有画面感的

========================================
步骤三：分镜规划
========================================
为每个镜头做详细规划：
- 时间范围精确到0.5秒
- 画面内容描述要具体、可执行（不能写"展示一些好看的画面"这种模糊描述）
- 素材来源从可用素材中选择，标注素材ID
- 如果没有合适素材，标注"待补全"并说明需要什么
- 运镜/动效建议（Ken Burns缩放方向、平移方向、速度等）
- 转场选择要克制——Vlog最常用的是硬切和叠化，不要用太多花哨转场

分镜的总时长应该等于目标时长。每个分镜的duration = end_time - start_time。
分镜数量通常在8-20个之间（30秒Vlog大约10-15个分镜）。

========================================
步骤四：包装设计
========================================
- 字幕样式：字体、颜色、描边、位置、动画方式
- 文字卡样式：背景色、字体、动画（如果方案中有文字卡的话）
- 调色/滤镜建议：根据Vlog的整体情绪选择
- 强调元素：需要放大、圈注的地方

Vlog包装的原则：简洁干净，不要过度包装。字幕能少则少，画面本身说话。

========================================
步骤五：节奏设计
========================================
- 8-12个节奏曲线关键点
- BGM风格建议（类型、情绪、参考曲目）
- 卡点位置标注（哪些画面切换需要严格卡BGM节拍）

Vlog节奏的"呼吸感"规则：
- 不能全程快切（观众会累），也不能全程慢（观众会走）
- 快慢交替，像呼吸一样
- 前3秒必须快（至少2-3个镜头），这是Vlog的铁律
- 高潮处可以快切也可以慢放（取决于风格），但必须有变化
- 结尾通常放慢，给观众一个情绪落点

========================================
步骤六：设计说明
========================================
解释你的迁移逻辑：
- 从爆款中保留了什么？为什么这些不能丢？
- 做了什么适配？为什么需要改？
- 新Vlog的预期观众感受是什么？

请严格按以下JSON格式输出：

{{
  "structure_mapping": [
    {{
      "original_segment": "爆款骨架中的段落描述",
      "new_vlog_segment": "映射到新Vlog的内容",
      "kept_from_original": "保留了什么方法",
      "adapted": "做了什么调整",
      "reasoning": "为什么这样映射"
    }}
  ],
  "narrative_type": "timeline/emotion/event",
  "script_blocks": [
    {{
      "index": 0,
      "purpose": "hook/人设展示/场景铺展/情绪递进/高潮爆发/价值输出/CTA互动",
      "voiceover_text": "旁白文案（口语化，不超过25字）",
      "subtitle_text": "字幕文案（简短有力，不超过15字）",
      "emotion": "情绪基调",
      "rhythm": "快/中/慢",
      "duration_hint": 秒数
    }}
  ],
  "storyboard": [
    {{
      "index": 0,
      "start_time": 0.0,
      "end_time": 0.0,
      "duration": 0.0,
      "purpose": "结构目的",
      "shot_type": "hook/scene_establish/daily_moment/emotion_peak/persona_expression/info_card/closing_moment/transition",
      "visual_content": "具体、可执行的画面描述",
      "material_id": "素材ID 或 '待补全'",
      "is_gap": false,
      "gap_description": "如果是待补全，需要什么内容",
      "subtitle_text": "字幕（可为空）",
      "voiceover_text": "旁白（可为空）",
      "text_card_content": "如果是文字卡镜头，内容是什么（否则为空）",
      "camera_note": "运镜/动效建议",
      "motion_effect": "ken_burns_zoom_in/ken_burns_pan/static/zoom_in/focus_scan/none",
      "transition": "cut/fade/dissolve/zoom_in/flash_white/none",
      "emotion": "这个镜头的情绪",
      "rhythm_intensity": 0.0,
      "bgm_sync": false
    }}
  ],
  "packaging_config": {{
    "subtitle_style": {{
      "font_family": "字体",
      "color": "颜色",
      "stroke_color": "描边颜色",
      "stroke_width": 0,
      "position": "bottom/top/center",
      "animation": "none/fade_in/typewriter/bounce/slide_in",
      "max_chars_per_line": 15
    }},
    "text_card_style": {{
      "background": "纯色/渐变/模糊底图",
      "background_color": "色值",
      "font": "字体",
      "text_color": "色值",
      "animation": "淡入/弹出/滑入"
    }},
    "color_grade": "japanese_fresh/film_retro/cinematic/vivid/b_w/natural",
    "filter_description": "滤镜/调色的详细描述",
    "emphasis_elements": [
      {{
        "at_time": 0.0,
        "type": "zoom/circle/arrow/flash",
        "description": "具体强调什么"
      }}
    ]
  }},
  "rhythm_design": {{
    "curve_points": [
      {{"time": 0.0, "intensity": 0.0, "note": "设计意图"}}
    ],
    "bgm_suggestion": {{
      "genre": "曲风",
      "mood": "情绪",
      "energy": "low/medium/high",
      "bpm_range": "低-高",
      "reference_track": "参考曲目（如果能想到的话）"
    }},
    "beat_sync_points": [
      {{"time": 0.0, "action": "什么画面卡在这个节拍上"}}
    ]
  }},
  "design_explanation": {{
    "what_kept_from_original": "从爆款中保留的结构设计",
    "what_adapted_and_why": "做了什么适配调整以及为什么",
    "expected_audience_feeling": "观众看到这条Vlog会有什么感受",
    "key_success_factor": "这条新Vlog成功的关键因素是什么"
  }},
  "identified_gaps": [
    {{
      "slot_index": 0,
      "needed_content": "需要什么画面",
      "priority": 0,
      "suggested_fill_strategy": "建议的补全方式"
    }}
  ]
}}"""


def build_scheme_iterate_prompt(
    previous_scheme_json: str,
    review_scores: str,
    review_issues: str,
    review_suggestions: str,
    skeleton_analysis: str,
    material_inventory_desc: str,
) -> str:
    """
    Prompt 4.3：迭代优化
    审核不通过时调用，根据反馈修改方案
    """

    return f"""你是一位Vlog编导，之前提交的Vlog方案被审核打回了。
你需要根据审核意见修改方案，但不要全盘推翻——只改有问题的地方，已经通过的部分保持不变。

━━━━━━━━━━━━━━━━━━━━━━━━
一、审核结果
━━━━━━━━━━━━━━━━━━━━━━━━
评分详情：
{review_scores}

具体问题：
{review_issues}

修改建议：
{review_suggestions}

━━━━━━━━━━━━━━━━━━━━━━━━
二、上一版方案
━━━━━━━━━━━━━━━━━━━━━━━━
{previous_scheme_json}

━━━━━━━━━━━━━━━━━━━━━━━━
三、原始爆款结构参照
━━━━━━━━━━━━━━━━━━━━━━━━
{skeleton_analysis}

━━━━━━━━━━━━━━━━━━━━━━━━
四、可用素材
━━━━━━━━━━━━━━━━━━━━━━━━
{material_inventory_desc}

修改原则：
1. 只改审核指出的问题，不要动已经通过的部分
2. 每个修改都要有明确理由
3. 如果你认为审核建议不合理，可以提出替代方案，但必须说明为什么你的方案更好
4. Vlog的hook和情绪连贯性是最重要的，优先修复这两方面的问题

请输出修改后的完整方案（JSON格式同上一版），并在末尾增加change_log字段：

{{
  ...(修改后的完整方案JSON)...,
  "change_log": [
    {{
      "issue_addressed": "针对的审核问题",
      "what_changed": "做了什么修改",
      "before": "修改前是什么",
      "after": "修改后是什么",
      "reasoning": "为什么这样改"
    }}
  ]
}}"""
```

---

## prompts/creative_prompts.py

```python
# prompts/creative_prompts.py
# Creative Agent 的两个 Phase 1 Prompt


def build_fill_strategy_prompt(
    target_topic: str,
    scheme_summary: str,
    gaps_list: str,
    available_materials: str,
    style_guide: str,
) -> str:
    """
    Prompt 5.1：缺口补全策略决策
    对所有缺口统一制定补全方案
    """

    return f"""你是一位Vlog创意补全专家。当一个Vlog方案存在素材缺口时，你需要在有限条件下想出最有创意、最可行的补全方案。

你的核心原则：用最低成本达到最好效果。Vlog观众其实对"素材不够丰富"的容忍度比你想象的高——一条Vlog不一定要每个镜头都是大片，但必须每个镜头都有存在的理由。

━━━━━━━━━━━━━━━━━━━━━━━━
一、Vlog主题
━━━━━━━━━━━━━━━━━━━━━━━━
{target_topic}

━━━━━━━━━━━━━━━━━━━━━━━━
二、当前Vlog方案概要
━━━━━━━━━━━━━━━━━━━━━━━━
{scheme_summary}

━━━━━━━━━━━━━━━━━━━━━━━━
三、素材缺口列表
━━━━━━━━━━━━━━━━━━━━━━━━
{gaps_list}

━━━━━━━━━━━━━━━━━━━━━━━━
四、可用素材
━━━━━━━━━━━━━━━━━━━━━━━━
{available_materials}

━━━━━━━━━━━━━━━━━━━━━━━━
五、风格指引
━━━━━━━━━━━━━━━━━━━━━━━━
{style_guide}

请对每个缺口给出补全方案。

═══════════════════════════
可用的补全策略详解
═══════════════════════════

策略1：素材复用
  操作：从现有素材中选择最接近的一张/一段，做裁切、镜像、变速等处理，让它"变成"新镜头
  适用：现有素材中确实有内容接近的画面
  示例：一张风景照裁切出左半边和右半边，变成两个"新"镜头

策略2：Ken Burns效果
  操作：对一张静态图片做缓慢缩放+平移，让画面"活"起来
  适用：手上有静态图片但缺少动态镜头
  示例：一张咖啡厅照片，从全景缓慢推进到桌上的咖啡杯特写
  关键：如果有脸，缩放终点对准人脸；如果有主体，从全景推向主体

策略3：文字卡替代
  操作：设计一张精美的文字卡作为独立镜头
  适用：缺失的画面可以用文字信息替代
  Vlog中的文字卡完全被观众接受，很多Vlog博主大量使用文字卡
  示例：缺少"出发去目的地"的画面 → 一张文字卡"出发！"配日系清新背景色

策略4：结构重排
  操作：调整分镜顺序，把更强的素材放到更重要的位置
  适用：某些位置缺素材，但其他位置素材有富余
  示例：缺少专用hook镜头 → 把"情绪高点"位置的素材挪到开头做hook

策略5：空镜头填充
  操作：用环境空镜头（天空/街道/植物/光影）做过渡和情绪铺垫
  适用：现有素材中有风景类的素材可以当空镜用
  Vlog中空镜头是合法的、常用的、甚至是加分的元素

策略6：变速/倒放
  操作：对现有视频素材做慢放或倒放
  适用：有动态素材但缺少变化感
  示例：一个走路的视频做0.5倍慢放 + 降低饱和度 → 瞬间变"电影感"

对每个缺口，请评估：
1. 该缺口如果完全不补，对Vlog整体质量的影响大吗？（1-5）
2. 最适合用哪个策略？
3. 具体怎么操作？（用哪个素材？做什么处理？做成什么样？）
4. 观众看到补全后的内容会有什么感受？会不会觉得"假"或"突兀"？

请严格按以下JSON格式回答：

{{
  "fill_plans": [
    {{
      "gap_slot_index": 0,
      "gap_priority": 0,
      "impact_if_unfilled": 0,
      "chosen_strategy": "素材复用/Ken Burns/文字卡替代/结构重排/空镜头填充/变速倒放",
      "source_material_id": "利用的现有素材ID（如果是文字卡则为空）",
      "execution_plan": "具体怎么执行（详细到每一步操作）",
      "expected_result": "执行后的预期效果描述",
      "audience_feeling": "观众看到后的预期感受",
      "risk": "可能的问题",
      "fallback_plan": "如果主方案不行的备选"
    }}
  ],
  "text_cards_to_generate": [
    {{
      "gap_slot_index": 0,
      "text_content": "文字卡的文案内容（不超过15字）",
      "background_color": "背景色建议",
      "font_style": "字体风格",
      "animation": "入场动画",
      "duration": 建议显示秒数
    }}
  ],
  "ken_burns_configs": [
    {{
      "gap_slot_index": 0,
      "source_material_id": "源素材ID",
      "motion_type": "zoom_in/zoom_out/pan_left/pan_right/focus_scan",
      "start_description": "起始画面区域描述",
      "end_description": "终止画面区域描述",
      "speed": "slow/medium",
      "focus_on_face": false
    }}
  ],
  "structure_reorder": {{
    "needed": false,
    "original_order": [],
    "new_order": [],
    "reasoning": "为什么调整顺序"
  }},
  "overall_strategy_summary": "整体的补全思路（2-3句话）"
}}"""


def build_text_card_content_prompt(
    target_topic: str,
    card_purpose: str,
    emotion: str,
    style_guide: str,
) -> str:
    """
    Prompt 5.2：文字卡内容生成
    为每个需要文字卡的缺口生成具体文案
    """

    return f"""你是一位Vlog文字卡设计师。文字卡是Vlog中非常常见的元素——在简洁美观的背景上放一句简短有力的文字，用来传递信息、制造情绪、替代缺失的画面。

Vlog文字卡的风格要求：
- 像朋友在跟你说话，不是官方公告
- 简短有力，绝对不超过15个字
- 有情绪感染力，看到会让人有感觉
- 符合抖音/小红书年轻用户的审美
- 不要用网络烂梗和过时的流行语

━━━━━━━━━━━━━━━━━━━━━━━━
背景信息
━━━━━━━━━━━━━━━━━━━━━━━━
Vlog主题：{target_topic}
这张文字卡的用途：{card_purpose}
情绪要求：{emotion}
风格指引：{style_guide}

请生成3个版本的文字卡方案。

对每个版本提供：
1. 文案内容（不超过15字，越短越有力量）
2. 背景色（色值或描述，要和Vlog整体风格匹配）
3. 字体风格（圆体/手写体/黑体/衬线体）
4. 文字颜色
5. 入场动画（淡入/弹出/打字机效果/从下往上滑入/缩放出现）
6. 建议显示时长
7. 配合的音效建议（无/轻快音效/翻页声/弹出声/环境音）

版本A：直接有力型（用最直白的方式表达）
版本B：文艺质感型（更有Vlog的文艺感）
版本C：俏皮活泼型（轻松有趣的感觉）

请严格按以下JSON格式回答：

{{
  "card_variants": [
    {{
      "version": "A",
      "style_name": "直接有力型",
      "text": "文案内容",
      "bg_color": "色值",
      "bg_type": "纯色/渐变",
      "font_style": "字体风格",
      "text_color": "文字颜色",
      "animation": "入场动画",
      "duration": 秒数,
      "sound_effect": "音效建议",
      "design_reasoning": "为什么选择这个设计（一句话）"
    }}
  ]
}}"""
```

---

## prompts/reviewer_prompts.py

```python
# prompts/reviewer_prompts.py
# Reviewer Agent 的一个 Phase 1 Prompt


def build_review_prompt(
    source_structure_summary: str,
    scheme_json: str,
    material_coverage_desc: str,
) -> str:
    """
    Prompt 7.1：方案质量评估
    对Vlog迁移方案做8维度审核
    """

    return f"""你是一位严苛但公正的Vlog内容审核专家。你审核过上万条Vlog，对什么样的Vlog完播率高、互动率高有极其敏锐的判断力。

你的审核标准基于真实数据经验：
- Vlog的生死在前3秒，hook不行后面全白搭
- Vlog需要"呼吸感"——不能全程快切也不能全程慢
- Vlog的情绪一致性比内容丰富度更重要——宁可素材少但情绪统一，也不要素材多但情绪割裂
- Vlog最怕"假"和"刻意"——补全部分如果太突兀会被观众感知到
- 文字卡在Vlog中是完全合法的，好的文字卡甚至能加分

━━━━━━━━━━━━━━━━━━━━━━━━
一、原始爆款的结构模式
━━━━━━━━━━━━━━━━━━━━━━━━
{source_structure_summary}

━━━━━━━━━━━━━━━━━━━━━━━━
二、新Vlog方案
━━━━━━━━━━━━━━━━━━━━━━━━
{scheme_json}

━━━━━━━━━━━━━━━━━━━━━━━━
三、素材覆盖情况
━━━━━━━━━━━━━━━━━━━━━━━━
{material_coverage_desc}

请从以下8个维度逐项评估。每个维度给出0-10分和一句话理由。

========================================
维度1：结构保真度（权重1.0）
========================================
新方案是否保留了爆款的核心结构骨架？
重点检查：
- 结构类型的迁移是否正确（如爆款是"悬念前置型"，新方案是否也用了悬念前置？）
- 段落数量和顺序是否与骨架一致？
- 情绪走向是否与爆款的模式匹配？
- 如果有偏差，偏差是否合理（因为新内容的特殊性而做了合理调整）？

========================================
维度2：Hook吸引力（权重1.5）★★★
========================================
这是Vlog最重要的维度，权重最高。

前3秒是否足够抓人？
具体检查：
- 前3秒的画面是什么？是否有视觉冲击力或好奇心？
- 前3秒的节奏是否足够快？（至少2个镜头切换）
- 前3秒是否有字幕/旁白辅助吸引？
- 如果你刷到这条Vlog，前3秒你会不会继续看下去？诚实地回答。

评分标准：
- 9-10分：前3秒让人"不得不继续看"，有强烈好奇心或视觉震撼
- 7-8分：前3秒能留住大部分观众，有明确的吸引力
- 5-6分：前3秒平平无奇，可能会留住一半观众
- 3-4分：前3秒没有吸引力，大部分观众会划走
- 1-2分：前3秒完全没有设计，像是随手拍的

========================================
维度3：内容适配度（权重1.0）
========================================
新内容和结构模板的适配程度。
- 有没有"生搬硬套"的感觉？（如用"悬念前置"结构做了一条完全没悬念的日常Vlog）
- 结构迁移到这个Vlog主题上是否自然？
- 脚本文案是否口语化、有Vlog感？不像广告或新闻稿？

========================================
维度4：节奏合理性（权重1.0）
========================================
- 节奏曲线是否有起伏？还是从头到尾一个节奏？
- 快慢交替是否有"呼吸感"？
- 前3秒是否快节奏？（应该至少2-3个镜头）
- 高潮位置是否在60%-75%处？（太早高潮后继无力，太晚高潮来不及铺垫）
- 结尾是否适当放慢？（给观众情绪落点）

========================================
维度5：情绪连贯性（权重1.2）★★
========================================
这是Vlog第二重要的维度。
- 整条Vlog的情绪基调是否一致？
- 有没有情绪割裂的地方？（前半段温馨后半段突然热血）
- 情绪曲线是否合理？（起-铺-升-高-落）
- 画面的情绪和字幕/旁白的情绪是否匹配？

========================================
维度6：缺口补全质量（权重1.0）
========================================
- 识别出的缺口是否都得到了处理？
- 补全的方式是否合理？（文字卡/Ken Burns/素材复用/结构重排）
- 补全部分在最终Vlog中会不会显得突兀？
- 文字卡的设计是否和整体视觉风格匹配？
- Ken Burns效果是否自然？

========================================
维度7：包装与视觉一致性（权重0.8）
========================================
- 字幕样式是否全片统一？
- 调色/滤镜是否一致？
- 转场是否克制且一致？（不要前半段硬切后半段叠化）
- 如果有文字卡，风格是否统一？

========================================
维度8：完整性与可执行性（权重0.5）
========================================
- 每个分镜是否都有素材或补全方案？（不存在"待补全"却没处理的情况）
- 时间线是否连贯没有空隙？
- 总时长是否接近目标时长？
- 方案是否可以实际执行产出视频？

========================================
最终判定
========================================
计算加权总分：
总分 = Σ(各维度分数 × 权重) / Σ(权重)

通过条件：总分 ≥ 60分
强制迭代条件：Hook吸引力 < 4分（不管总分多少都要改）

请严格按以下JSON格式回答：

{{
  "scores": {{
    "structure_fidelity": {{"score": 0, "weight": 1.0, "reason": "一句话理由"}},
    "hook_appeal": {{"score": 0, "weight": 1.5, "reason": "一句话理由"}},
    "content_adaptation": {{"score": 0, "weight": 1.0, "reason": "一句话理由"}},
    "rhythm": {{"score": 0, "weight": 1.0, "reason": "一句话理由"}},
    "emotion_coherence": {{"score": 0, "weight": 1.2, "reason": "一句话理由"}},
    "gap_filling_quality": {{"score": 0, "weight": 1.0, "reason": "一句话理由"}},
    "packaging_consistency": {{"score": 0, "weight": 0.8, "reason": "一句话理由"}},
    "completeness": {{"score": 0, "weight": 0.5, "reason": "一句话理由"}}
  }},
  "total_score": 0,
  "pass": false,
  "force_iterate": false,
  "top_3_issues": [
    "最需要改进的问题1",
    "问题2",
    "问题3"
  ],
  "top_3_highlights": [
    "做得好的亮点1",
    "亮点2",
    "亮点3"
  ],
  "suggestions": [
    {{
      "target_dimension": "维度名称",
      "current_problem": "当前问题的具体描述",
      "suggested_change": "建议怎么改（具体、可执行）",
      "priority": "high/medium/low"
    }}
  ],
  "one_line_verdict": "一句话总评"
}}"""
```

---

## prompts/knowledge_prompts.py（Phase 4，预留）

```python
# prompts/knowledge_prompts.py
# Knowledge Agent 的两个 Prompt，Phase 4 使用


def build_knowledge_extract_prompt(
    video_structure_json: str,
    category: str,
    duration: float,
) -> str:
    """
    Prompt 3.1：知识提炼
    从单条爆款Vlog的分析结果中提炼可复用的创作知识
    """

    return f"""你是一位Vlog内容研究专家，负责从具体案例中提炼可复用的创作知识。
你提炼的每条知识都会被存入一个"Vlog创作知识库"，供系统后续在新Vlog创作时参考。
每条知识必须具备：可复用性、具体性、有案例支撑。

【爆款Vlog分析结果】
{video_structure_json}

视频品类：{category}
时长：{duration}秒

请从以下维度提炼知识条目：

=== 维度一：结构模板 ===
这条视频的结构能否被抽象为一个通用模板？
- 给模板起一个直观的名字
- 用[主题]、[画面]、[文案]这样的占位符描述模板
- 标注适用的Vlog类型和最佳使用条件

=== 维度二：Hook技法 ===
这条视频的hook手法，能否被总结为可复用的技法？
- 具体怎么操作（步骤化描述）
- 在什么Vlog场景下效果最好
- 有什么注意事项

=== 维度三：节奏模式 ===
这条视频的节奏设计，能否被总结为可复用的节奏模板？
- 节奏曲线的通用描述
- 关键时间点的节奏分布
- 适用于什么风格的Vlog

=== 维度四：情绪设计 ===
这条视频的情绪曲线，能否被总结为可参考的情绪设计模式？
- 情绪的起承转合
- 情绪转折点的位置和方式

=== 维度五：包装风格 ===
这条视频的包装风格，能否被总结为可参考的视觉方案？

请输出一组知识条目，每条包含类型、标题、内容、结构化数据、标签和适用场景：

{{
  "knowledge_entries": [
    {{
      "type": "structure_template/hook_technique/rhythm_pattern/emotion_design/packaging_style",
      "title": "知识标题（简洁直观）",
      "content": "知识的自然语言描述（200字以内）",
      "structured_data": {{
        "根据类型不同结构不同"
      }},
      "tags": ["品类标签", "风格标签", "平台标签"],
      "applicable_vlog_types": ["适用的Vlog类型"],
      "best_when": "最佳使用条件",
      "confidence": 0.0,
      "source_summary": "来源视频的关键信息（一句话）"
    }}
  ]
}}"""


def build_knowledge_retrieve_prompt(
    target_topic: str,
    target_info: str,
    material_summary: str,
    user_preferences: str,
    candidate_entries: str,
) -> str:
    """
    Prompt 3.2：知识检索与推荐
    从知识库中为新的Vlog创作需求找到最相关的参考知识
    """

    return f"""你是一位Vlog创作顾问，负责从知识库中为新的创作任务找到最相关的参考知识。

【新的Vlog创作需求】
主题：{target_topic}
详情：{target_info}
素材概况：{material_summary}
用户偏好：{user_preferences}

【知识库中预筛选的候选知识条目】
{candidate_entries}

请完成：
1. 从候选知识中选出与本次创作最相关的3-5条
2. 对每条解释为什么相关
3. 给出具体的应用建议

{{
  "selected_entries": [
    {{
      "knowledge_id": "知识条目ID",
      "title": "知识标题",
      "relevance_score": 0.0,
      "why_relevant": "为什么对这次创作有参考价值",
      "how_to_apply": "具体怎么应用到新Vlog中",
      "caution": "使用时需要注意什么"
    }}
  ],
  "overall_strategy": "基于选出的知识，建议这次Vlog创作的整体策略（3-5句话）"
}}"""
```

---

## Prompt 调用关系总览

```
graph/nodes/ 调用 agents/ → agents/ 引用 prompts/ → 填入变量 → 调用 LLM

调用链路图：

analyze_video 节点
  └── AnalystAgent.execute()
        ├── 对每个镜头：analyst_prompts.build_shot_analysis_prompt() → LLM
        └── 最后一次：analyst_prompts.build_structure_analysis_prompt() → LLM

ingest_materials 节点
  └── MaterialManagerAgent.execute(action="ingest")
        ├── 对每张图片：material_prompts.build_image_analysis_prompt() → LLM
        ├── 对每段视频：material_prompts.build_video_analysis_prompt() → LLM
        └── 对每段文本：material_prompts.build_text_analysis_prompt() → LLM

plan_scheme 节点（首次）
  └── PlannerAgent.execute()
        ├── planner_prompts.build_skeleton_extract_prompt() → LLM
        └── planner_prompts.build_scheme_generate_prompt() → LLM

plan_scheme 节点（迭代）
  └── PlannerAgent.execute()
        └── planner_prompts.build_scheme_iterate_prompt() → LLM

check_gaps 节点
  └── MaterialManagerAgent.execute(action="find_gaps")
        └──（规则匹配为主，可选调用）material_prompts.build_gap_check_prompt() → LLM

fill_gaps 节点
  └── CreativeAgent.execute()
        ├── creative_prompts.build_fill_strategy_prompt() → LLM
        └── 对每个文字卡缺口：creative_prompts.build_text_card_content_prompt() → LLM

review_result 节点
  └── ReviewerAgent.execute()
        └── reviewer_prompts.build_review_prompt() → LLM
```

---

## Phase 1 Prompt LLM 调用次数估算

```
假设输入：1条爆款Vlog（15个镜头）+ 5张图片 + 1段视频 + 1段文本

Analyst 阶段：
  15次 逐帧画面分析 + 1次综合结构分析 = 16次 LLM 调用

Material 阶段：
  5次图片分析 + 1次视频分析 + 1次文本分析 = 7次 LLM 调用

Plan 阶段（首次）：
  1次骨架提取 + 1次方案生成 = 2次 LLM 调用

Check Gaps 阶段：
  0次（规则匹配）或 1次（LLM 辅助评估）

Fill Gaps 阶段：
  1次策略决策 + N次文字卡生成（假设3个缺口用文字卡）= 4次 LLM 调用

Review 阶段：
  1次评估 = 1次 LLM 调用

首次完整流程：约 30-31 次 LLM 调用
每次迭代增加：约 5-7 次（plan迭代 + 再review）

预估成本（Doubao-Seed-2.0-lite）：
  每次调用约 2000-4000 tokens
  总计约 60K-120K tokens / 完整流程
  Doubao lite 价格低，成本可控
```

以上是完整的 Vlog 主题 Prompt 模板，共 **15 个 Prompt 函数**（Phase 1 使用其中 11 个），直接作为 `prompts/` 目录下的代码使用。需要我把这些 Prompt 和之前的 Agent/Node 代码整合成一个完整的可执行项目吗？