def build_fill_strategy_prompt(
    target_topic: str,
    scheme_summary: str,
    gaps_list: str,
    available_materials: str,
    style_guide: str,
) -> str:
    return f"""你是一位Vlog创意补全专家。当一个Vlog方案存在素材缺口时，你需要在有限条件下想出最有创意、最可行的补全方案。

你的核心原则：用最低成本达到最好效果。

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

可用的补全策略：
1. 素材复用：从现有素材中选择最接近的做裁切、镜像、变速等
2. Ken Burns效果：对静态图做缓慢缩放+平移
3. 文字卡替代：用精美文字卡作为独立镜头
4. 结构重排：调整分镜顺序
5. 空镜头填充：用环境空镜头做过渡
6. 变速/倒放：对现有素材做慢放或倒放

{{
  "fill_plans": [
    {{
      "gap_slot_index": 0,
      "gap_priority": 0,
      "impact_if_unfilled": 0,
      "chosen_strategy": "素材复用/Ken Burns/文字卡替代/结构重排/空镜头填充/变速倒放",
      "source_material_id": "利用的现有素材ID",
      "execution_plan": "具体怎么执行",
      "expected_result": "预期效果",
      "audience_feeling": "观众感受",
      "risk": "可能的问题",
      "fallback_plan": "备选方案"
    }}
  ],
  "text_cards_to_generate": [
    {{
      "gap_slot_index": 0,
      "text_content": "文案（不超过15字）",
      "background_color": "背景色",
      "font_style": "字体风格",
      "animation": "入场动画",
      "duration": 显示秒数
    }}
  ],
  "ken_burns_configs": [
    {{
      "gap_slot_index": 0,
      "source_material_id": "源素材ID",
      "motion_type": "zoom_in/zoom_out/pan_left/pan_right/focus_scan",
      "start_description": "起始画面区域",
      "end_description": "终止画面区域",
      "speed": "slow/medium",
      "focus_on_face": false
    }}
  ],
  "structure_reorder": {{
    "needed": false,
    "original_order": [],
    "new_order": [],
    "reasoning": "为什么调整"
  }},
  "overall_strategy_summary": "整体补全思路（2-3句话）"
}}"""


def build_text_card_content_prompt(
    target_topic: str,
    card_purpose: str,
    emotion: str,
    style_guide: str,
) -> str:
    return f"""你是一位Vlog文字卡设计师。文字卡是在简洁美观的背景上放一句简短有力的文字，用来传递信息、制造情绪、替代缺失的画面。

Vlog文字卡的风格要求：
- 像朋友在跟你说话，不是官方公告
- 简短有力，不超过15个字
- 有情绪感染力
- 符合抖音/小红书年轻用户的审美

━━━━━━━━━━━━━━━━━━━━━━━━
背景信息
━━━━━━━━━━━━━━━━━━━━━━━━
Vlog主题：{target_topic}
这张文字卡的用途：{card_purpose}
情绪要求：{emotion}
风格指引：{style_guide}

请生成3个版本的文字卡方案：

版本A：直接有力型
版本B：文艺质感型
版本C：俏皮活泼型

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
      "design_reasoning": "设计理由"
    }}
  ]
}}"""
